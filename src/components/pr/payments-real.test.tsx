import { describe, expect, it } from "vitest"
import { AdminPayments } from "@/components/pr/admin-payments"
import { AdminDecisions } from "@/components/pr/admin-kit"
import { ReceiptPage } from "@/components/pr/receipt-page"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/** Admin payments (refund requests, "Paid but no coins") and the receipt's refund request on the real API (V21-06). */

const NOW = "2026-11-08T07:00:00Z"
const page = <T,>(items: T[]) => HttpResponse.json({ items, nextCursor: null })
const order = (number: string, coins = 63) => ({ id: `o-${number}`, orderNumber: number, userId: "u1", email: "dara@example.com", displayName: "Dara", coins, method: "khqr", paidAt: NOW })
const request = (id: string, kind: "unused" | "partial" | "spent", over: Record<string, unknown> = {}) => ({
  id,
  status: "open",
  reason: "I bought the wrong pack by mistake.",
  requestedAt: NOW,
  decidedAt: null,
  decidedBy: null,
  note: null,
  refundedCoins: null,
  order: order(`PR-0000000${id}`),
  eligibility: { kind, duplicate: false, unused: kind === "unused" ? 63 : kind === "partial" ? 40 : 0, spent: kind === "unused" ? 0 : kind === "partial" ? 23 : 63 },
  ...over,
})
const stuck = (id: string) => ({
  id,
  status: "open",
  order: order(`PR-9999999${id}`, 30),
  paidAmount: 1,
  currency: "USD",
  orderStatus: "expired",
  foundAt: NOW,
  resolvedAt: null,
  resolvedBy: null,
  note: null,
})
const signIn = () => useAppStore.getState().login({ name: "Admin", email: "admin@example.com", roles: ["ADMIN"] })
const view = () => (
  <AdminDecisions>
    <AdminPayments />
  </AdminDecisions>
)
const serve = (requests: object[], stucks: object[] = []) =>
  server.use(
    http.get(`${API}/admin/refund-requests`, () => page(requests)),
    http.get(`${API}/admin/stuck-payments`, () => page(stucks)),
    http.get(`${API}/admin/orders`, () => page([])),
    http.get(`${API}/admin/overview`, () => HttpResponse.json({})),
  )

describe("AdminPayments: real API", () => {
  it("lists the refund requests with what can be refunded, and the payments with no coins", async () => {
    signIn()
    serve([request("1", "unused"), request("2", "partial"), request("3", "spent")], [stuck("1")])
    renderUi(view())
    expect(await screen.findByText("PR-00000001")).toBeInTheDocument()
    expect(screen.getByText("Unused · eligible")).toBeInTheDocument()
    expect(screen.getByText("23 coins spent · 40 unused")).toBeInTheDocument()
    expect(screen.getByText("Coins spent")).toBeInTheDocument()
    // Nothing to take back: only Decline.
    const spentRow = screen.getByText("PR-00000003").closest("li")!
    expect(within(spentRow).queryByRole("button", { name: /Refund/ })).not.toBeInTheDocument()
    expect(within(spentRow).getByRole("button", { name: "Decline" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Refund 40 unused" })).toBeInTheDocument()
    expect(screen.getByText("PR-99999991")).toBeInTheDocument()
    expect(screen.getByText(/PayWay says 1.00 USD was paid/)).toBeInTheDocument()
  })

  it("shows the empty states", async () => {
    signIn()
    serve([], [])
    renderUi(view())
    expect(await screen.findByText("No refund requests waiting.")).toBeInTheDocument()
    expect(screen.getByText("Every paid order has its coins.")).toBeInTheDocument()
  })

  it("approves a request after the Undo window (leaving sends it), and declines with a reason", async () => {
    signIn()
    const sent: string[] = []
    serve([request("1", "unused"), request("2", "unused")])
    server.use(
      http.post(`${API}/admin/refund-requests/1/approve`, () => {
        sent.push("approve 1")
        return HttpResponse.json(request("1", "unused", { status: "approved" }))
      }),
      http.post(`${API}/admin/refund-requests/2/decline`, async ({ request: r }) => {
        sent.push(`decline 2 ${JSON.stringify(await r.json())}`)
        return HttpResponse.json(request("2", "unused", { status: "declined" }))
      }),
    )
    const { user, unmount } = renderUi(view())
    const first = (await screen.findByText("PR-00000001")).closest("li")!
    await user.click(within(first).getByRole("button", { name: "Refund" }))
    expect(sent).toEqual([])
    const second = screen.getByText("PR-00000002").closest("li")!
    await user.click(within(second).getByRole("button", { name: "Decline" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByRole("textbox"), "You already read the episodes.")
    await user.click(within(dialog).getByRole("button", { name: "Decline" }))
    unmount()
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent).toContain("approve 1")
    expect(sent).toContain('decline 2 {"reason":"You already read the episodes."}')
  })

  it("adds the coins of a stuck payment", async () => {
    signIn()
    let added = 0
    serve([], [stuck("1")])
    server.use(
      http.post(`${API}/admin/stuck-payments/1/add-coins`, () => {
        added++
        return HttpResponse.json({ ...stuck("1"), status: "resolved" })
      }),
    )
    const { user, unmount } = renderUi(view())
    await user.click(await screen.findByRole("button", { name: "Add coins" }))
    expect(added).toBe(0)
    unmount()
    await waitFor(() => expect(added).toBe(1))
  })
})

describe("Receipt: asking for a refund (real API)", () => {
  const paidOrder = (over: Record<string, unknown> = {}) => ({
    orderNumber: "PR-12345678",
    status: "paid",
    packId: 2,
    coins: 30,
    bonusCoins: 3,
    firstBonusCoins: 30,
    totalCoins: 63,
    method: "khqr",
    priceUsdCents: 250,
    priceKhr: 10000,
    provider: "payway",
    createdAt: "2026-11-05T05:00:00Z",
    expiresAt: "2026-11-05T05:10:00Z",
    paidAt: "2026-11-05T05:02:00Z",
    refundRequest: null,
    ...over,
  })

  it("sends the reason, then shows the request as waiting", async () => {
    useAppStore.getState().login({ name: "Dara", email: "dara@example.com" })
    useAppStore.setState({ coins: 63 })
    let current = paidOrder()
    const bodies: unknown[] = []
    server.use(
      http.get(`${API}/coins/orders/PR-12345678`, () => HttpResponse.json(current)),
      http.get(`${API}/coins/history`, () => HttpResponse.json({ items: [], nextCursor: null })),
      http.get(`${API}/coins/wallet`, () => HttpResponse.json({ balance: 63, firstPurchaseBonus: false })),
      http.post(`${API}/coins/orders/PR-12345678/refund-request`, async ({ request: r }) => {
        bodies.push(await r.json())
        current = paidOrder({ refundRequest: { status: "open", requestedAt: NOW, note: null, refundedCoins: null } })
        return HttpResponse.json(current)
      }),
    )
    const { user } = renderUi(<ReceiptPage id="PR-12345678" />)
    await user.click(await screen.findByRole("button", { name: "Ask for a refund" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Send request" }))
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText("Why do you want a refund?"), "I bought the wrong pack.")
    await user.click(within(dialog).getByRole("button", { name: "Send request" }))
    await waitFor(() => expect(bodies).toEqual([{ reason: "I bought the wrong pack." }]))
    expect(await screen.findByText(/Refund requested on/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ask for a refund" })).not.toBeInTheDocument()
  })

  it("shows the admin's reason when the request was declined", async () => {
    useAppStore.getState().login({ name: "Dara", email: "dara@example.com" })
    server.use(
      http.get(`${API}/coins/orders/PR-12345678`, () =>
        HttpResponse.json(paidOrder({ refundRequest: { status: "declined", requestedAt: NOW, note: "You already read the episodes.", refundedCoins: null } })),
      ),
      http.get(`${API}/coins/history`, () => HttpResponse.json({ items: [], nextCursor: null })),
      http.get(`${API}/coins/wallet`, () => HttpResponse.json({ balance: 63, firstPurchaseBonus: false })),
    )
    renderUi(<ReceiptPage id="PR-12345678" />)
    expect(await screen.findByText("Refund declined: You already read the episodes.")).toBeInTheDocument()
  })
})
