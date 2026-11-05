"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { CoinPack, PaymentMethod } from "@/data"
import { DemoApiError, pay } from "@/lib/demo-api"
import { today } from "@/lib/format"
import { useAppStore } from "@/lib/store"

export type Flow =
  | { step: "review" }
  | { step: "pay"; deadline: number }
  | { step: "confirming" }
  | { step: "success"; orderId: string; added: number; balance: number; method: string }
  | { step: "failed"; reason: "declined" | "expired" }

/** Coins the reader gets for a pack: coins + pack bonus + first-purchase bonus (same as the pack). */
export const packTotal = (pack: CoinPack, offer: boolean) => pack.coins + pack.bonus + (offer ? pack.coins : 0)

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
}: {
  pack: CoinPack
  method: PaymentMethod
  offer: boolean
  expiryMinutes: number
}) {
  const tt = useTranslations("toasts")
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
      if (left <= 0) setFlow({ step: "failed", reason: "expired" })
    }, 1000)
    return () => clearInterval(id)
  }, [flow])

  const record = (status: "Paid" | "Failed" | "Cancelled", orderId: string) =>
    useAppStore.getState().addPurchase({
      date: today,
      pack: `${pack.coins} coin pack`,
      coins: total,
      method: method.id,
      status,
      orderId,
    })

  function start() {
    let seconds = expiryMinutes * 60
    if (process.env.NODE_ENV !== "production") {
      const override = Number(new URLSearchParams(window.location.search).get("expiry"))
      if (override > 0) seconds = override
    }
    setRemaining(seconds)
    setFlow({ step: "pay", deadline: Date.now() + seconds * 1000 })
  }

  function cancel() {
    record("Cancelled", `PR-CANCEL${Date.now() % 100000}`)
    toast.error(tt("paymentCancelled"))
    setFlow({ step: "review" })
  }

  async function submit(outcome: "success" | "failed") {
    if (inFlight.current) return // no double submit
    inFlight.current = true
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
      if (e instanceof DemoApiError) record("Failed", `PR-FAILED${Date.now() % 100000}`)
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
    busy: flow.step === "pay" || flow.step === "confirming",
    start,
    cancel,
    submit,
    reset: () => setFlow({ step: "review" }),
  }
}
