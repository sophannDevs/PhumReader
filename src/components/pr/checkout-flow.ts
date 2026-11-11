"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { CoinPack, PaymentMethod } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import * as coins from "@/lib/api/coins"
import { DemoApiError, pay } from "@/lib/demo-api"
import { today } from "@/lib/format"
import { useAccountEmail } from "@/lib/me"
import { useAppStore } from "@/lib/store"
import { applyBalance } from "@/lib/wallet"

/** The open order, kept so a reload resumes it (real API only). */
const PENDING_KEY = "phumireader.pendingOrder"
const POLL_MS = 3000

type Pending = { email: string; number: string }
const readPending = (): Pending | null => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null")
  } catch {
    return null
  }
}
const writePending = (value: Pending | null) => {
  try {
    if (value) localStorage.setItem(PENDING_KEY, JSON.stringify(value))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage unavailable: the order still works, it just is not resumed after a reload.
  }
}

export type Flow =
  | { step: "review" }
  | { step: "pay"; deadline: number }
  | { step: "confirming" }
  | { step: "success"; orderId: string; added: number; balance: number; method: string }
  | { step: "failed"; reason: "declined" | "expired" }

/** Coins the reader gets for a pack: coins + pack bonus + first-purchase bonus (same as the pack). */
export const packTotal = (pack: CoinPack, offer: boolean) => pack.coins + pack.bonus + (offer ? pack.coins : 0)

const ICT_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

/**
 * "Now" for demo orders: the pinned demo date (`today`, assumption 2) at the real clock's time of day in ICT, so a
 * new order's history date and its receipt date and time agree.
 */
export function demoNow(): number {
  const [y, m, d] = today.split("-").map(Number)
  return Date.UTC(y, m - 1, d) + ((Date.now() + ICT_MS) % DAY_MS) - ICT_MS
}

/**
 * Checkout state machine: review -> pay -> confirming -> success | failed.
 * The KHQR code countdown applies to every method (Assumption 21); reaching 0 fails with
 * "expired". For testing in dev, `?expiry=<seconds>` shortens it.
 */
export function useCheckout({
  pack,
  method,
  offer,
  expiryMinutes,
  packId,
  simulator = true,
}: {
  pack: CoinPack
  method: PaymentMethod
  offer: boolean
  expiryMinutes: number
  /** Real API: the pack's id. */
  packId?: number
  /** Real API: the dev simulator can pay or fail the order. */
  simulator?: boolean
}) {
  const tt = useTranslations("toasts")
  const email = useAccountEmail()
  const qc = useQueryClient()
  const [starting, setStarting] = useState(false)
  const order = useRef<string | null>(null)
  const settled = useRef(false)
  const [flow, setFlow] = useState<Flow>({ step: "review" })
  const inFlight = useRef(false)
  const [remaining, setRemaining] = useState(expiryMinutes * 60)
  const total = packTotal(pack, offer)

  useEffect(() => {
    if (flow.step !== "pay") return
    const deadline = flow.deadline
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        order.current = null
        if (!DEMO_MODE) writePending(null)
        // Demo: an expired code is a failed order in the history (prototype `finish('failed', 'expired')`).
        else record("Failed", `TW-${String(Date.now()).slice(-8)}`)
        setFlow({ step: "failed", reason: "expired" })
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pack and method can't change while paying
  }, [flow])

  /** Demo: saves the order in the store (the history row and its Receipt). */
  function record(status: "Paid" | "Failed" | "Cancelled", orderId: string) {
    const first = offer ? pack.coins : 0
    useAppStore.getState().addPurchase({
      date: today,
      pack: `${pack.coins} coin pack`,
      coins: total,
      method: method.id,
      status,
      orderId,
      at: demoNow(),
      base: pack.coins,
      bonus: pack.bonus,
      first,
    })
  }

  /** Real API: an order reached its end state. */
  async function settle(state: coins.OrderState) {
    if (settled.current || state.status === "pending") return
    settled.current = true
    order.current = null
    writePending(null)
    void qc.invalidateQueries({ queryKey: ["coins-page"] })
    if (state.status === "paid") {
      try {
        const wallet = await coins.fetchWallet()
        if (email) applyBalance(qc, email, wallet.balance, false)
        toast.success(tt("coinsAdded", { count: state.totalCoins }))
        setFlow({ step: "success", orderId: state.orderNumber, added: state.totalCoins, balance: wallet.balance, method: state.method })
      } catch {
        setFlow({ step: "success", orderId: state.orderNumber, added: state.totalCoins, balance: useAppStore.getState().coins, method: state.method })
      }
    } else if (state.status === "cancelled") {
      setFlow({ step: "review" })
    } else {
      if (state.status === "failed") toast.error(tt("paymentFailed"))
      setFlow({ step: "failed", reason: state.status === "expired" ? "expired" : "declined" })
    }
  }

  // Real API: ask the order's state every 3 s while the reader pays or we wait for the result.
  useEffect(() => {
    if (DEMO_MODE || (flow.step !== "pay" && flow.step !== "confirming")) return
    const id = setInterval(() => {
      const number = order.current
      if (number) void coins.getOrder(number).then(settle, () => undefined)
    }, POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle only reads refs and stable setters
  }, [flow.step])

  // Real API: back on the page with an order still open (a reload, or another visit): pick it up.
  const setDraft = useAppStore((st) => st.setCheckoutDraft)
  useEffect(() => {
    if (DEMO_MODE || !email) return
    const pending = readPending()
    if (!pending || pending.email !== email || order.current) return
    void coins
      .getOrder(pending.number)
      .then((state) => {
        if (order.current) return
        order.current = state.orderNumber
        settled.current = false
        if (state.status === "pending" && state.expiresAt > Date.now()) {
          setDraft({ pack: state.coins, method: state.method })
          setRemaining(Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000)))
          setFlow({ step: "pay", deadline: state.expiresAt })
        } else void settle(state)
      })
      .catch(() => writePending(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per account
  }, [email])

  async function startReal() {
    if (starting || packId === undefined || !email) return
    setStarting(true)
    try {
      const state = await coins.createOrder(packId, method.id)
      order.current = state.orderNumber
      settled.current = false
      writePending({ email, number: state.orderNumber })
      setRemaining(Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000)))
      setFlow({ step: "pay", deadline: state.expiresAt })
    } catch {
      toast.error(tt("paymentFailed"))
    } finally {
      setStarting(false)
    }
  }

  function start() {
    if (!DEMO_MODE) return void startReal()
    let seconds = expiryMinutes * 60
    if (process.env.NODE_ENV !== "production") {
      const override = Number(new URLSearchParams(window.location.search).get("expiry"))
      if (override > 0) seconds = override
    }
    setRemaining(seconds)
    setFlow({ step: "pay", deadline: Date.now() + seconds * 1000 })
  }

  function cancel() {
    if (!DEMO_MODE) {
      const number = order.current
      if (number) {
        void coins.cancelOrder(number).then((state) => {
          toast.error(tt("paymentCancelled"))
          return settle(state)
        }, () => toast.error(tt("actionFailed")))
      }
      return
    }
    record("Cancelled", `TW-${String(Date.now()).slice(-8)}`)
    toast.error(tt("paymentCancelled"))
    setFlow({ step: "review" })
  }

  async function submitReal(outcome: "success" | "failed") {
    const number = order.current
    if (!number) return
    setFlow({ step: "confirming" })
    try {
      // With the dev simulator the buttons decide the result; without it we only wait for PayWay.
      if (simulator) await settle(await coins.simulateOrder(number, outcome === "success" ? "paid" : "failed"))
    } catch {
      toast.error(tt("paymentFailed"))
      setFlow({ step: "failed", reason: "declined" })
    }
  }

  async function submit(outcome: "success" | "failed") {
    if (inFlight.current) return // no double submit
    inFlight.current = true
    if (!DEMO_MODE) {
      try {
        await submitReal(outcome)
      } finally {
        inFlight.current = false
      }
      return
    }
    setFlow({ step: "confirming" })
    try {
      const result = await pay(
        { coins: pack.coins, bonus: pack.bonus, firstBonus: offer ? pack.coins : 0, method: method.id },
        outcome
      )
      const store = useAppStore.getState()
      store.addCoins(result.coins)
      record("Paid", result.orderId)
      toast.success(tt("coinsAdded", { count: result.coins }))
      setFlow({
        step: "success",
        orderId: result.orderId,
        added: result.coins,
        balance: useAppStore.getState().coins,
        method: method.id,
      })
    } catch (e) {
      if (e instanceof DemoApiError) record("Failed", `TW-${String(Date.now()).slice(-8)}`)
      toast.error(tt("paymentFailed"))
      setFlow({ step: "failed", reason: "declined" })
    } finally {
      inFlight.current = false
    }
  }

  return {
    flow,
    remaining,
    total,
    busy: flow.step === "pay" || flow.step === "confirming" || starting,
    starting,
    start,
    cancel,
    submit,
    reset: () => setFlow({ step: "review" }),
  }
}
