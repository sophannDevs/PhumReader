"use client"

import { useQuery } from "@tanstack/react-query"
import { coinPacks, type PaymentMethodId } from "@/data"
import { ApiError } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import { withDemo } from "@/lib/demo-api"
import { useAccountEmail } from "@/lib/me"
import { useCoinsPage, useDemoFlag } from "@/lib/queries"
import { isDemoOrder, type StoredPurchase, useAppStore, useCoins, useHydrated } from "@/lib/store"
import { type OrderView, useOrder } from "@/lib/wallet"

/**
 * One order as the Receipt page shows it (spec §25, prototype Receipt). Demo: built from the store's `purchases`
 * (orderId, at, base, bonus, first). Real API: from `GET /coins/orders/{number}`.
 */
export type ReceiptStatus = "Paid" | "Failed" | "Cancelled" | "Refunded" | "Pending"

export type Receipt = {
  id: string
  /** Order time, epoch ms (shown in ICT) */
  at: number
  /** The pack's coins */
  base: number
  bonus: number
  first: number
  /** base + bonus + first */
  total: number
  method: PaymentMethodId
  status: ReceiptStatus
  /** Failed because the KHQR code ran out of time */
  expired: boolean
  priceUSD: string
  priceKHR: string
  /** Coins of this order already spent (paid orders) */
  spent: number
  /** Demo refund dates (epoch ms); the API doesn't send them */
  refundRequestedAt?: number
  refundedAt?: number
  /** Real API (V21-06): the reader's refund request, with the admin's note when declined */
  refundRequest?: { status: "open" | "approved" | "declined"; note: string | null; at: number; coins: number | null }
}

const DAY_MS = 86_400_000

/** The demo's paid row: 15 of its 33 coins are spent (prototype Receipt). */
const DEMO_SPENT: Record<string, number> = { "TW-48213377": 15 }

type PaidRow = { orderId?: string; at?: number; date: string; coins: number; status: string }

/**
 * Coins of an order still unused: spending takes the oldest coins first, so the current balance sits in the newest
 * paid orders. The demo's display-only rows are not part of the balance. An order missing from `rows` (the history
 * hasn't loaded) counts as the newest one.
 */
function unusedOf(id: string, total: number, rows: PaidRow[], balance: number): number {
  const time = (r: PaidRow) => r.at ?? Date.parse(r.date)
  const paid = rows
    .filter((r) => r.status === "Paid" && r.orderId && !isDemoOrder(r.orderId))
    .sort((a, b) => time(b) - time(a))
  let left = balance
  for (const r of paid) {
    const unused = Math.min(r.coins, Math.max(0, left))
    if (r.orderId === id) return unused
    left -= unused
  }
  return Math.min(total, Math.max(0, balance))
}

const placeholderPrice = (base: number) => {
  const p = coinPacks().find((x) => x.coins === base)
  return { priceUSD: p?.priceUSD ?? "[PRICE USD]", priceKHR: p?.priceKHR ?? "[PRICE KHR]" }
}

function fromStore(p: StoredPurchase & { orderId: string }, rows: PaidRow[], balance: number, refunded: boolean): Receipt {
  const base = p.base ?? (Number.parseInt(p.pack, 10) || p.coins)
  const first = p.first ?? 0
  const bonus = p.bonus ?? Math.max(0, p.coins - base - first)
  const at = p.at ?? Date.parse(`${p.date}T12:00:00+07:00`)
  const status: ReceiptStatus = p.status === "Paid" && refunded ? "Refunded" : p.status
  const spent = isDemoOrder(p.orderId) ? (DEMO_SPENT[p.orderId] ?? 0) : p.coins - unusedOf(p.orderId, p.coins, rows, balance)
  return {
    id: p.orderId,
    at,
    base,
    bonus,
    first,
    total: p.coins,
    method: p.method,
    status,
    expired: false,
    ...placeholderPrice(base),
    spent: status === "Paid" ? spent : 0,
    ...(status === "Refunded" ? { refundRequestedAt: at + DAY_MS, refundedAt: at + 2 * DAY_MS } : {}),
  }
}

const REAL_STATUS: Record<OrderView["status"], ReceiptStatus> = {
  paid: "Paid",
  failed: "Failed",
  expired: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  pending: "Pending",
}

function fromApi(o: OrderView, rows: PaidRow[], balance: number): Receipt {
  const status = REAL_STATUS[o.status]
  const fallback = placeholderPrice(o.coins)
  return {
    id: o.orderNumber,
    at: Date.parse(o.createdAt),
    base: o.coins,
    bonus: o.bonusCoins,
    first: o.firstBonusCoins,
    total: o.totalCoins,
    method: o.method,
    status,
    expired: o.status === "expired",
    priceUSD: o.priceUsdCents == null ? fallback.priceUSD : `$${(o.priceUsdCents / 100).toFixed(2)}`,
    priceKHR: o.priceKhr == null ? fallback.priceKHR : `${o.priceKhr.toLocaleString("en-US")} ៛`,
    spent: status === "Paid" ? o.totalCoins - unusedOf(o.orderNumber, o.totalCoins, rows, balance) : 0,
    ...(o.refundRequest
      ? {
          refundRequest: {
            status: o.refundRequest.status as "open" | "approved" | "declined",
            note: o.refundRequest.note ?? null,
            at: Date.parse(o.refundRequest.requestedAt),
            coins: o.refundRequest.refundedCoins ?? null,
          },
          refundRequestedAt: Date.parse(o.refundRequest.requestedAt),
        }
      : {}),
  }
}

export type ReceiptState =
  | { state: "loading" }
  | { state: "error"; retry: () => void }
  | { state: "login" }
  | { state: "notFound" }
  | { state: "ready"; receipt: Receipt }

/**
 * The receipt for order `id`. Demo: the fake API's delay and `?demo=` flags (`empty` = not found), then the live
 * store, so spent / unused coins follow the balance; `?status=refunded` shows a paid order as refunded (the demo
 * has no refunds). Real API: the order, plus the purchase history for spent / unused coins.
 */
export function useReceipt(id: string): ReceiptState {
  const hydrated = useHydrated()
  const flag = useDemoFlag()
  const email = useAccountEmail()
  const balance = useCoins()
  const purchases = useAppStore((s) => s.purchases)

  const demo = useQuery({
    queryKey: ["receipt", id, flag],
    queryFn: () =>
      withDemo(
        () => ({ found: true, refunded: new URLSearchParams(window.location.search).get("status") === "refunded" }),
        { empty: () => ({ found: false, refunded: false }) }
      ),
    enabled: DEMO_MODE && hydrated,
  })
  const real = useOrder(id)
  const history = useCoinsPage()

  if (DEMO_MODE) {
    if (!hydrated || demo.isPending) return { state: "loading" }
    if (demo.isError) return { state: "error", retry: () => void demo.refetch() }
    const p = purchases.find((x) => x.orderId === id)
    if (!demo.data.found || !p?.orderId) return { state: "notFound" }
    return { state: "ready", receipt: fromStore({ ...p, orderId: p.orderId }, purchases, balance, demo.data.refunded) }
  }

  if (!hydrated) return { state: "loading" }
  if (!email) return { state: "login" }
  if (real.isPending) return { state: "loading" }
  if (real.isError) {
    if (real.error instanceof ApiError && (real.error.status === 404 || real.error.status === 403)) return { state: "notFound" }
    return { state: "error", retry: () => void real.refetch() }
  }
  // The history only refines spent / unused coins (see `unusedOf`).
  const rows: PaidRow[] = history.data?.history ?? []
  return { state: "ready", receipt: fromApi(real.data, rows, balance) }
}
