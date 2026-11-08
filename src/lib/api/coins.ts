import type { CoinPack, PaymentMethod, PaymentMethodId, Purchase, PurchaseStatus } from "@/data"
import { coinPacks, faq, paymentMethods } from "@/data"
import { demoData } from "@/data/demo"
import { allPages } from "@/lib/api/catalog"
import { api, idempotencyKey, type Schemas } from "@/lib/api/client"
import type { CoinsPageData } from "@/lib/api/types"

/**
 * Coins from the real API (Stage 1 Step 5 part 4): the wallet, packs and orders, in the shapes the
 * Coins page already uses. Prices stay the design's placeholders until the API sends real ones.
 */

type Order = Schemas["OrderView"]

export type Wallet = { balance: number; firstPurchaseBonus: boolean }

export async function fetchWallet(): Promise<Wallet> {
  const w = await api.get<Schemas["Wallet"]>("/me/coins")
  return { balance: w.balance, firstPurchaseBonus: w.firstPurchaseBonus }
}

/** The Coins page plus what only the real API knows. */
export type RealCoinsPage = Required<Pick<CoinsPageData, "packIds" | "simulator">> & CoinsPageData

const money = (cents: number | null | undefined, fallback: string) =>
  cents == null ? fallback : `$${(cents / 100).toFixed(2)}`

const toPack = (p: Schemas["CoinPack"], placeholder: CoinPack | undefined): CoinPack => ({
  coins: p.coins,
  bonus: p.bonus,
  tag: p.tag === "popular" ? "Popular" : p.tag === "best_value" ? "Best value" : null,
  priceUSD: money(p.priceUsdCents, placeholder?.priceUSD ?? "[PRICE USD]"),
  priceKHR: p.priceKhr == null ? (placeholder?.priceKHR ?? "[PRICE KHR]") : `${p.priceKhr.toLocaleString("en-US")} ៛`,
})

const STATUS: Record<Order["status"], PurchaseStatus | null> = {
  paid: "Paid",
  failed: "Failed",
  expired: "Failed",
  cancelled: "Cancelled",
  refunded: "Cancelled", // the design has no "Refunded" badge (assumption 111)
  pending: null,
}

/** Finished orders as purchase rows (an order still open is not history yet). */
export const toPurchase = (o: Order): Purchase | null => {
  const status = STATUS[o.status]
  return status
    ? { date: (o.paidAt ?? o.createdAt).slice(0, 10), pack: `${o.coins} coin pack`, coins: o.totalCoins, method: o.method, status }
    : null
}

/** `signedIn` adds the reader's purchase history. */
export async function fetchCoinsPage(signedIn: boolean): Promise<RealCoinsPage> {
  const [shop, orders] = await Promise.all([
    api.get<Schemas["CoinShop"]>("/coins/packs"),
    signedIn ? allPages<Order>("/me/coins/orders", {}) : Promise.resolve([] as Order[]),
  ])
  const placeholders = coinPacks()
  const methods = paymentMethods()
  const offered = shop.methods.flatMap((id) => methods.filter((m) => m.id === id))
  return {
    packs: shop.packs.map((p) => toPack(p, placeholders.find((x) => x.coins === p.coins))),
    packIds: Object.fromEntries(shop.packs.map((p) => [p.coins, p.id])),
    methods: offered as PaymentMethod[],
    history: orders.flatMap((o) => toPurchase(o) ?? []),
    faq: faq(),
    firstPurchaseBonus: demoData.firstPurchaseBonus,
    khqrExpiryMinutes: shop.orderExpiryMinutes,
    fastPassPrice: demoData.fastPass.price,
    simulator: shop.simulator,
  }
}

// ---------------------------------------------------------------- orders

/** How to take a PayWay payment (only the answer that creates the order has it). */
export type Checkout = {
  qrImage: string | null
  qrString: string | null
  abaDeeplink: string | null
  /** Card: post these fields to this address (PayWay's hosted page). */
  formAction: string | null
  formFields: Record<string, string> | null
}

export type OrderState = {
  orderNumber: string
  status: Order["status"]
  method: PaymentMethodId
  /** The pack's coins. */
  coins: number
  /** Pack + bonuses. */
  totalCoins: number
  /** ms since 1970 */
  expiresAt: number
  checkout: Checkout | null
}

const toState = (o: Order): OrderState => ({
  orderNumber: o.orderNumber,
  status: o.status,
  method: o.method,
  coins: o.coins,
  totalCoins: o.totalCoins,
  expiresAt: new Date(o.expiresAt).getTime(),
  checkout: o.checkout
    ? {
        qrImage: o.checkout.qrImage ?? null,
        qrString: o.checkout.qrString ?? null,
        abaDeeplink: o.checkout.abaDeeplink ?? null,
        formAction: o.checkout.formAction ?? null,
        formFields: o.checkout.formFields ?? null,
      }
    : null,
})

/** A new attempt: a new Idempotency-Key. */
export async function createOrder(packId: number, method: PaymentMethodId, key = idempotencyKey()): Promise<OrderState> {
  return toState(await api.post<Order>("/coins/orders", { packId, method }, { headers: { "Idempotency-Key": key } }))
}

export const getOrder = async (number: string) => toState(await api.get<Order>(`/coins/orders/${number}`))

export const cancelOrder = async (number: string) => toState(await api.post<Order>(`/coins/orders/${number}/cancel`))

/** Dev only: pay or fail the order without PayWay. */
export const simulateOrder = async (number: string, outcome: "paid" | "failed") =>
  toState(await api.post<Order>(`/coins/orders/${number}/simulate`, { outcome }))

// ---------------------------------------------------------------- unlock

export type UnlockOutcome = { balance: number; coins: number; episode: number }

/** Spends the episode's price; the same key never charges twice. */
export async function unlockEpisode(slug: string, n: number, key: string): Promise<UnlockOutcome> {
  const r = await api.post<Schemas["UnlockResult"]>(`/series/${slug}/episodes/${n}/unlock`, undefined, {
    headers: { "Idempotency-Key": key },
  })
  return { balance: r.balance, coins: r.coins, episode: r.episode }
}
