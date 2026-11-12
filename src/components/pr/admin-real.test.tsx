import { afterEach, describe, expect, it, vi } from "vitest"
import { AdminShell } from "@/components/layout/admin-shell"
import { AdminDecisions } from "@/components/pr/admin-kit"
import { AdminPage } from "@/components/pr/admin-page"
import { AdminReports } from "@/components/pr/admin-reports"
import { useAppStore, type AdminDecision } from "@/lib/store"
import { nav } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/**
 * The admin area on the real API: the overview never loads the demo data (no demo wait, ?demo= flags ignored), the
 * payments counts are the overview's open refund requests and "Paid but no coins" without the ones decided here (an
 * older API without those counts: the loaded rows, "N+" while more pages wait), and the report queue loads more pages.
 */

// Counts the demo data loads (demo-api's `withDemo`): real mode must never run one.
const demo = vi.hoisted(() => ({ calls: 0 }))
vi.mock("@/lib/demo-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-api")>()
  return {
    ...actual,
    withDemo: (...args: Parameters<typeof actual.withDemo>) => {
      demo.calls++
      return actual.withDemo(...args)
    },
  }
})

const NOW = "2026-11-10T02:00:00Z"
type Paged = { items: object[]; nextCursor?: string | null }
const overview = (over: Record<string, unknown> = {}) => ({
  bannedUsers: 4,
  hiddenComments: 0,
  hiddenEpisodes: 0,
  hiddenSeries: 0,
  openReports: 0,
  openRefundRequests: 0,
  openStuckPayments: 0,
  refundedOrders: 9,
  seriesInReview: 0,
  oldestReviewAt: null,
  ...over,
})
const order = (number: string) => ({ id: `o-${number}`, orderNumber: number, userId: "u1", email: "dara@example.com", displayName: "Dara", coins: 63, method: "khqr", paidAt: NOW })
const refund = (id: string) => ({
  id,
  status: "open",
  reason: "Wrong pack.",
  requestedAt: NOW,
  order: order(`PR-${id}`),
  eligibility: { kind: "unused", duplicate: false, unused: 63, spent: 0 },
})
const stuck = (id: string) => ({ id, status: "open", order: order(`PR-${id}`), paidAmount: 1, currency: "USD", orderStatus: "expired", foundAt: NOW })
const report = (id: string) => ({
  id,
  caseNumber: Number(id.replace(/\D/g, "")),
  createdAt: NOW,
  reason: "spam",
  reporter: "Vibol",
  status: "open",
  target: { id: `t-${id}`, type: "comment", title: `Comment ${id}` },
})
const none: Paged = { items: [], nextCursor: null }

/** Everything the admin overview and side menu read, with empty lists unless given. */
function serve(lists: { overview?: object; refunds?: Paged; stuck?: Paged; reports?: Paged } = {}) {
  server.use(
    http.get(`${API}/admin/overview`, () => HttpResponse.json(lists.overview ?? overview())),
    http.get(`${API}/admin/series-review`, () => HttpResponse.json(none)),
    http.get(`${API}/admin/reports`, () => HttpResponse.json(lists.reports ?? none)),
    http.get(`${API}/admin/refund-requests`, () => HttpResponse.json(lists.refunds ?? none)),
    http.get(`${API}/admin/stuck-payments`, () => HttpResponse.json(lists.stuck ?? none)),
    http.get(`${API}/admin/audit`, () => HttpResponse.json(none)),
  )
}
const signIn = () => useAppStore.getState().login({ name: "Admin", email: "admin@example.com", roles: ["ADMIN"] })
const decided = (...ids: string[]) =>
  useAppStore.setState({
    adminLog: ids.map((id): AdminDecision => ({ id, queue: id.startsWith("report") ? "reports" : "payments", label: id, action: "refund", at: Date.now() })),
  })
/** A StatCard of the overview (a link to its queue), by its label. */
const card = (label: string) => screen.getByRole("link", { name: new RegExp(`^${label}`) })

afterEach(() => {
  demo.calls = 0
  window.history.replaceState(null, "", "/")
})

describe("AdminPage: real API", () => {
  it("loads the overview from the API without the demo data's wait", async () => {
    signIn()
    serve({ overview: overview({ openReports: 2 }), reports: { items: [report("r1"), report("r2")], nextCursor: null } })
    renderUi(<AdminPage />)
    expect(await screen.findByRole("link", { name: /^Open reports/ })).toBeInTheDocument()
    expect(within(card("Open reports")).getByText("2")).toBeInTheDocument()
    expect(demo.calls).toBe(0)
  })

  it("ignores ?demo=error (a demo-only flag)", async () => {
    window.history.replaceState(null, "", "/admin?demo=error")
    signIn()
    serve()
    renderUi(<AdminPage />)
    expect(await screen.findByRole("link", { name: /^Series to review/ })).toBeInTheDocument()
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument()
    expect(demo.calls).toBe(0)
  })

  it("shows the design's payment cards with the overview's exact counts, without the ones decided here", async () => {
    signIn()
    decided("refund:f1")
    serve({
      overview: overview({ openRefundRequests: 3, openStuckPayments: 25 }),
      // f1 was decided here and the API still lists it (its call waits out the Undo window): 3 - 1.
      refunds: { items: [refund("f1"), refund("f2"), refund("f3")], nextCursor: null },
      // More pages wait, but the overview knows the total: 25, not "2+".
      stuck: { items: [stuck("s1"), stuck("s2")], nextCursor: "next" },
    })
    renderUi(<AdminPage />)
    await screen.findByRole("link", { name: /^Refund requests/ })
    await waitFor(() => expect(within(card("Refund requests")).getByText("2")).toBeInTheDocument())
    expect(card("Refund requests")).toHaveAttribute("href", "/admin/payments")
    expect(within(card("Paid, no coins")).getByText("25")).toBeInTheDocument()
    expect(within(card("Paid, no coins")).getByText("Fix today")).toBeInTheDocument()
    expect(screen.queryByText("Refunded orders")).not.toBeInTheDocument()
    expect(screen.queryByText("Suspended users")).not.toBeInTheDocument()
  })

  it("says All done when no payment is stuck", async () => {
    signIn()
    serve()
    renderUi(<AdminPage />)
    await screen.findByRole("link", { name: /^Paid, no coins/ })
    expect(within(card("Paid, no coins")).getByText("0")).toBeInTheDocument()
    expect(within(card("Paid, no coins")).getByText("All done")).toBeInTheDocument()
  })
})

describe("AdminShell: the side menu's Payments count (real API): refund requests only, as in the prototype", () => {
  const payments = () => screen.findByRole("link", { name: /^Payments and refunds/ })

  it("counts the overview's open refund requests without the ones decided here, and leaves stuck payments out", async () => {
    signIn()
    nav.pathname = "/admin"
    decided("refund:f1")
    serve({
      overview: overview({ openRefundRequests: 3, openStuckPayments: 5 }),
      refunds: { items: [refund("f1"), refund("f2"), refund("f3")], nextCursor: null },
      stuck: { items: [stuck("s1")], nextCursor: null },
    })
    renderUi(
      <AdminShell>
        <p>Page</p>
      </AdminShell>,
    )
    const link = await payments()
    await waitFor(() => expect(within(link).getByText("2")).toBeInTheDocument())
    expect(within(link).queryByText("7")).not.toBeInTheDocument()
  })

  it("is exact even when more pages wait", async () => {
    signIn()
    nav.pathname = "/admin"
    serve({
      overview: overview({ openRefundRequests: 30, openStuckPayments: 1 }),
      refunds: { items: [refund("f1")], nextCursor: "next" },
      stuck: { items: [stuck("s1")], nextCursor: null },
    })
    renderUi(
      <AdminShell>
        <p>Page</p>
      </AdminShell>,
    )
    const link = await payments()
    await waitFor(() => expect(within(link).getByText("30")).toBeInTheDocument())
  })

  it("an older API without the overview's counts: the loaded rows, N+ while more pages wait", async () => {
    signIn()
    nav.pathname = "/admin"
    serve({
      overview: overview({ openRefundRequests: undefined, openStuckPayments: undefined }),
      refunds: { items: [refund("f1")], nextCursor: "next" },
      stuck: { items: [stuck("s1")], nextCursor: null },
    })
    renderUi(
      <AdminShell>
        <p>Page</p>
      </AdminShell>,
    )
    const link = await payments()
    await waitFor(() => expect(within(link).getByText("1+")).toBeInTheDocument())
  })
})

describe("AdminReports: more than one page (real API)", () => {
  const first = Array.from({ length: 20 }, (_, i) => report(`r${i + 1}`))
  const second = [report("r21"), report("r22")]
  function serveReports() {
    serve({ overview: overview({ openReports: 22 }) })
    server.use(
      http.get(`${API}/admin/reports`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get("cursor") === "p2" ? { items: second, nextCursor: null } : { items: first, nextCursor: "p2" }),
      ),
    )
  }
  const view = () => (
    <AdminDecisions>
      <AdminReports />
    </AdminDecisions>
  )
  const rows = () => within(screen.getByRole("list", { name: "Open reports" })).getAllByRole("listitem")

  it("counts every open report, shows the first 20 and loads the rest with Load more", async () => {
    signIn()
    serveReports()
    const { user } = renderUi(view())
    expect(await screen.findByText("22 open · urgent first · target 24 hours")).toBeInTheDocument()
    expect(rows()).toHaveLength(20)
    await user.click(screen.getByRole("button", { name: "Load more" }))
    await waitFor(() => expect(rows()).toHaveLength(22))
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(screen.getByText("22 open · urgent first · target 24 hours")).toBeInTheDocument()
  })

  it("leaves the reports decided here out of the count", async () => {
    signIn()
    decided("report:r3")
    serveReports()
    renderUi(view())
    expect(await screen.findByText("21 open · urgent first · target 24 hours")).toBeInTheDocument()
    expect(rows()).toHaveLength(19)
  })
})

describe("AdminReports: account reports (real API)", () => {
  const accountReport = {
    id: "u1",
    caseNumber: 31,
    createdAt: NOW,
    reason: "harass",
    reporter: "Vibol",
    status: "open",
    accusedId: "acc-1",
    accusedName: "Rude Rithy",
    target: { id: "acc-1", type: "user", title: "Rude Rithy", status: "active", seriesSlug: null, episodeNumber: null },
  }
  const view = () => (
    <AdminDecisions>
      <AdminReports />
    </AdminDecisions>
  )

  it("shows the account's name and status, with no link, and only warn / suspend / no violation", async () => {
    signIn()
    serve({ overview: overview({ openReports: 1 }), reports: { items: [accountReport], nextCursor: null } })
    renderUi(view())
    expect(await screen.findByText("Reported account")).toBeInTheDocument()
    expect(screen.getAllByText("Rude Rithy").length).toBeGreaterThan(0)
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "View" })).not.toBeInTheDocument()
    const actions = screen.getAllByRole("radio").map((r) => r.textContent)
    expect(actions).toEqual([
      expect.stringContaining("Warn the account"),
      expect.stringContaining("Suspend 7 days"),
      expect.stringContaining("No violation"),
    ])
    expect(screen.queryByRole("radio", { name: /Remove content/ })).not.toBeInTheDocument()
  })

  it("sends warn (not hide) once the Undo window closes", async () => {
    signIn()
    let body: unknown = null
    serve({ overview: overview({ openReports: 1 }), reports: { items: [accountReport], nextCursor: null } })
    server.use(
      http.post(`${API}/admin/reports/u1/settle`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...accountReport, status: "resolved" })
      }),
    )
    const { user, unmount } = renderUi(view())
    await user.click(await screen.findByRole("radio", { name: /Warn the account/ }))
    await user.click(screen.getByRole("button", { name: "Confirm" }))
    // Leaving the admin area sends the waiting decision at once.
    unmount()
    await waitFor(() => expect(body).toMatchObject({ action: "warn" }))
  })

  it("keeps the four content actions for a comment report", async () => {
    signIn()
    serve({ overview: overview({ openReports: 1 }), reports: { items: [report("r1")], nextCursor: null } })
    renderUi(view())
    expect(await screen.findByRole("radio", { name: /Remove content/ })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(4)
    expect(screen.queryByText("Reported account")).not.toBeInTheDocument()
  })
})
