import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { AuditTab, ContentTab, OrdersTab, UsersTab } from "@/components/pr/admin-lists"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"
import { selectOption } from "@/test/select"

const NOW = "2026-11-08T07:00:00Z"
const user = (id: string, over: Record<string, unknown> = {}) => ({ id, displayName: `User ${id}`, email: `${id}@example.com`, roles: ["READER"], status: "active", createdAt: NOW, lastLoginAt: null, ...over })
const page = <T,>(items: T[], nextCursor: string | null = null) => HttpResponse.json({ items, nextCursor })
const signIn = () => useAppStore.getState().login({ name: "Admin", email: "admin@example.com", roles: ["ADMIN"] })

describe("lists: loading, empty and error states", () => {
  it("shows a loading skeleton, then the rows", async () => {
    signIn()
    let release!: () => void
    server.use(
      http.get(`${API}/admin/users`, async () => {
        await new Promise<void>((r) => (release = r))
        return page([user("a")])
      }),
    )
    renderUi(<UsersTab />)
    expect(document.querySelector("[aria-hidden=true]")).not.toBeNull()
    expect(screen.queryByRole("list", { name: "Users" })).not.toBeInTheDocument()
    await waitFor(() => expect(release).toBeTypeOf("function"))
    release()
    expect(await screen.findByText("User a")).toBeInTheDocument()
  })

  it("shows the empty state with no search, and a no-match state when filtering", async () => {
    signIn()
    server.use(http.get(`${API}/admin/users`, () => page([])))
    const { user: u } = renderUi(<UsersTab />)
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument()
    await selectOption(u, screen.getByLabelText("Status"), "banned")
    expect(await screen.findByText("No matches")).toBeInTheDocument()
  })

  it("shows the error state and Retry loads the list", async () => {
    signIn()
    server.use(http.get(`${API}/admin/users`, () => apiError(500, "internal_error")))
    const { user: u } = renderUi(<UsersTab />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    server.use(http.get(`${API}/admin/users`, () => page([user("a")])))
    await u.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("User a")).toBeInTheDocument()
  })

  it("loads more pages with the cursor, and hides the button on the last page", async () => {
    signIn()
    const cursors: (string | null)[] = []
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor")
        cursors.push(cursor)
        return cursor ? page([user("b")]) : page([user("a")], "next-1")
      }),
    )
    const { user: u } = renderUi(<UsersTab />)
    await screen.findByText("User a")
    await u.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByText("User b")).toBeInTheDocument()
    expect(cursors).toEqual([null, "next-1"])
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})

describe("UsersTab", () => {
  it("lists users with their roles and joined date, and no Suspend for an admin", async () => {
    signIn()
    server.use(http.get(`${API}/admin/users`, () => page([user("a"), user("c", { roles: ["READER", "CREATOR"] }), user("d", { roles: ["READER", "ADMIN"] })])))
    renderUi(<UsersTab />)
    await screen.findByText("User a")
    expect(screen.getByText("creator")).toBeInTheDocument()
    expect(screen.getByText("a@example.com", { exact: false })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Suspend" })).toHaveLength(2)
  })

  it("searches after typing stops, and filters by status", async () => {
    signIn()
    const seen: string[] = []
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return page([user("a")])
      }),
    )
    const { user: u } = renderUi(<UsersTab />)
    await screen.findByText("User a")
    await u.type(screen.getByRole("searchbox", { name: "Search by name or email" }), "sok")
    await waitFor(() => expect(seen.some((s) => s.includes("q=sok"))).toBe(true))
    await selectOption(u, screen.getByLabelText("Status"), "banned")
    await waitFor(() => expect(seen.some((s) => s.includes("status=banned"))).toBe(true))
    // one request per settled search, not one per key press
    expect(seen.filter((s) => s.includes("q=s")).length).toBeLessThanOrEqual(2)
  })

  it("Suspend asks for a reason in a dialog, then bans with it and says so", async () => {
    signIn()
    let body: unknown
    server.use(
      http.get(`${API}/admin/users`, () => page([user("a")])),
      http.post(`${API}/admin/users/a/ban`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(user("a", { status: "banned" }))
      }),
    )
    const { user: u } = renderUi(<UsersTab />)
    await u.click(await screen.findByRole("button", { name: "Suspend" }))
    const dialog = await screen.findByRole("dialog", { name: "Suspend User a?" })
    await u.click(within(dialog).getByRole("button", { name: "Suspend" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Write a reason.")
    await u.type(within(dialog).getByLabelText("Reason"), "spam")
    await u.click(within(dialog).getByRole("button", { name: "Suspend" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("User a was suspended."))
    expect(body).toEqual({ reason: "spam" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("Cancel leaves the user untouched", async () => {
    signIn()
    server.use(http.get(`${API}/admin/users`, () => page([user("a")])))
    const { user: u } = renderUi(<UsersTab />)
    await u.click(await screen.findByRole("button", { name: "Suspend" }))
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("Restore unbans without asking for a reason", async () => {
    signIn()
    let called = false
    server.use(
      http.get(`${API}/admin/users`, () => page([user("a", { status: "banned" })])),
      http.post(`${API}/admin/users/a/unban`, () => {
        called = true
        return HttpResponse.json(user("a"))
      }),
    )
    const { user: u } = renderUi(<UsersTab />)
    await u.click(await screen.findByRole("button", { name: "Restore" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("User a was restored."))
    expect(called).toBe(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("ContentTab", () => {
  const item = (id: string, over: Record<string, unknown> = {}) => ({ id, type: "series", title: `Series ${id}`, owner: "Mei", status: "published", openReports: 0, seriesSlug: `slug-${id}`, episodeNumber: null, createdAt: NOW, ...over })

  it("lists series with open reports, a View link and a Hide button", async () => {
    signIn()
    server.use(http.get(`${API}/admin/content`, () => page([item("a", { openReports: 2 })])))
    renderUi(<ContentTab />)
    await screen.findByText("Series a")
    expect(screen.getByText("2 open reports")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/series/slug-a")
  })

  it("asks the API for the chosen type", async () => {
    signIn()
    const types: string[] = []
    server.use(
      http.get(`${API}/admin/content`, ({ request }) => {
        types.push(new URL(request.url).searchParams.get("type") ?? "")
        return page([])
      }),
    )
    const { user: u } = renderUi(<ContentTab />)
    await screen.findByText("Nothing here yet")
    await selectOption(u, screen.getByLabelText("Type"), "comment")
    await waitFor(() => expect(types).toContain("comment"))
  })

  it("Hide asks for a reason, then hides the item", async () => {
    signIn()
    let body: unknown
    server.use(
      http.get(`${API}/admin/content`, () => page([item("a")])),
      http.post(`${API}/admin/content/series/a/hide`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user: u } = renderUi(<ContentTab />)
    await u.click(await screen.findByRole("button", { name: "Hide" }))
    const dialog = await screen.findByRole("dialog", { name: "Hide “Series a”?" })
    await u.type(within(dialog).getByLabelText("Reason"), "copyright")
    await u.click(within(dialog).getByRole("button", { name: "Hide" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Hidden. Open reports on it were resolved."))
    expect(body).toEqual({ reason: "copyright" })
  })

  it("a hidden item has Restore, which needs no reason", async () => {
    signIn()
    server.use(
      http.get(`${API}/admin/content`, () => page([item("a", { status: "hidden" })])),
      http.post(`${API}/admin/content/series/a/restore`, () => new HttpResponse(null, { status: 204 })),
    )
    const { user: u } = renderUi(<ContentTab />)
    await u.click(await screen.findByRole("button", { name: "Restore" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Restored."))
    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument()
  })
})

describe("OrdersTab", () => {
  const order = (id: string, over: Record<string, unknown> = {}) => ({ id, orderNumber: `PR-${id}`, coins: 100, displayName: "Sokha", email: "sokha@example.com", method: "aba_pay", status: "paid", refundable: true, createdAt: NOW, userId: "u1", ...over })

  it("lists orders and offers Refund only when the order can be refunded", async () => {
    signIn()
    server.use(http.get(`${API}/admin/orders`, () => page([order("1"), order("2", { status: "refunded", refundable: false })])))
    renderUi(<OrdersTab />)
    await screen.findByText("PR-1")
    expect(screen.getAllByText("100 coins", { selector: "span" })).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Refund" })).toHaveLength(1)
  })

  it("Refund asks for a reason naming the order and the coins, then refunds", async () => {
    signIn()
    let body: unknown
    server.use(
      http.get(`${API}/admin/orders`, () => page([order("1")])),
      http.post(`${API}/admin/orders/1/refund`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({})
      }),
    )
    const { user: u } = renderUi(<OrdersTab />)
    await u.click(await screen.findByRole("button", { name: "Refund" }))
    const dialog = await screen.findByRole("dialog", { name: "Refund order PR-1?" })
    expect(dialog).toHaveAccessibleDescription(/100 coins of this order are taken back from Sokha/)
    await u.type(within(dialog).getByLabelText("Reason"), "duplicate")
    await u.click(within(dialog).getByRole("button", { name: "Refund" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Order PR-1 refunded."))
    expect(body).toEqual({ reason: "duplicate" })
  })

  it("explains a refund the API refuses because the coins were spent", async () => {
    signIn()
    server.use(
      http.get(`${API}/admin/orders`, () => page([order("1")])),
      http.post(`${API}/admin/orders/1/refund`, () => apiError(409, "coins_spent")),
    )
    const { user: u } = renderUi(<OrdersTab />)
    await u.click(await screen.findByRole("button", { name: "Refund" }))
    const dialog = await screen.findByRole("dialog")
    await u.type(within(dialog).getByLabelText("Reason"), "x")
    await u.click(within(dialog).getByRole("button", { name: "Refund" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already spent some of these coins")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})

describe("AuditTab", () => {
  it("lists actions with the actor and details, and filters by area", async () => {
    signIn()
    const actions: (string | null)[] = []
    server.use(
      http.get(`${API}/admin/audit`, ({ request }) => {
        actions.push(new URL(request.url).searchParams.get("action"))
        return page([{ id: 1, action: "user.ban", targetType: "USER", targetId: "abcdef1234", actorName: "Admin Sok", createdAt: NOW, details: { reason: "spam" } }])
      }),
    )
    const { user: u } = renderUi(<AuditTab />)
    expect(await screen.findByText("user.ban")).toBeInTheDocument()
    expect(screen.getByText(/Admin Sok/)).toBeInTheDocument()
    expect(screen.getByText("reason: spam")).toBeInTheDocument()
    await selectOption(u, screen.getByLabelText("Area"), "user.")
    await waitFor(() => expect(actions).toContain("user."))
  })
})
