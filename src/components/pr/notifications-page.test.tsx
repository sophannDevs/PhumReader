import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotificationsPage } from "@/components/pr/notifications-page"
import type { Settings } from "@/lib/api/account"
import type { NotificationItem } from "@/lib/api/notifications"
import { useUnreadCount } from "@/lib/notifications"
import { useAppStore } from "@/lib/store"
import { router } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/**
 * The Notifications page in real mode (V21-03): the inbox from GET /me/notifications (MSW keeps a small inbox that
 * the read / remove / restore calls change), the text written per type in English and Khmer, the Today / This week /
 * Earlier groups in Cambodia time, the actions, the bell's count and the alert settings saved to /me/settings.
 */

const EMAIL = "sokha@example.com"
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: EMAIL })

/** Thursday 5 November 2026, 12:00 in Phnom Penh (05:00 UTC). */
const NOW = new Date("2026-11-05T05:00:00Z")

const GLASS = { id: "s-glass", slug: "glass-compass", title: "Glass Compass", type: "comic" as const }
const COURIER = { id: "s-courier", slug: "midnight-courier", title: "Midnight Courier", type: "comic" as const }
const LETTERS = { id: "s-letters", slug: "letters-to-tuesday", title: "Letters to Tuesday", type: "novel" as const }
const RAIN = { id: "s-rain", slug: "rain-market", title: "Rain Market", type: "comic" as const }

const item = (id: string, over: Partial<NotificationItem> & Pick<NotificationItem, "type" | "kind" | "createdAt">): NotificationItem => ({
  id,
  read: true,
  series: null as unknown as undefined,
  episode: null,
  data: {},
  ...over,
})

/** The inbox newest first: two today, two this week, three earlier (one from last year). */
const INBOX: NotificationItem[] = [
  item("e1", { type: "episode_published", kind: "episode", createdAt: "2026-11-05T02:12:00Z", read: false, series: GLASS, episode: 65 }),
  item("o1", { type: "order_paid", kind: "coins", createdAt: "2026-11-05T00:05:00Z", read: false, data: { orderNumber: "TW-48213377", coins: 33 } }),
  item("c1", { type: "comment_liked", kind: "comment", createdAt: "2026-11-02T03:00:00Z", series: COURIER, episode: 39, data: { commentId: "k1", count: 12 } }),
  item("n1", { type: "episode_published", kind: "episode", createdAt: "2026-11-01T05:00:00Z", series: LETTERS, episode: 88 }),
  item("r1", {
    type: "report_resolved",
    kind: "system",
    createdAt: "2026-10-28T03:00:00Z",
    series: GLASS,
    episode: 12,
    data: { reportId: "rp1", targetType: "comment", hidden: true },
  }),
  item("w1", { type: "welcome", kind: "system", createdAt: "2026-10-20T03:00:00Z" }),
  item("x1", { type: "series_approved", kind: "system", createdAt: "2025-12-30T03:00:00Z", series: RAIN }),
]

const KIND_OF_TAB: Record<string, NotificationItem["kind"]> = { episodes: "episode", comments: "comment", coins: "coins" }

/** An inbox on the "server": the list per tab with paging, the unread count and every change call. */
function inbox(items: NotificationItem[] = INBOX, pageSize = 50) {
  const state = { items: items.map((x) => ({ ...x })), removed: new Set<string>(), calls: [] as string[] }
  const visible = () => state.items.filter((x) => !state.removed.has(x.id))
  const find = (id: unknown) => state.items.find((x) => x.id === id)
  server.use(
    http.get(`${API}/me/notifications/unread-count`, () => {
      state.calls.push("count")
      return HttpResponse.json({ count: visible().filter((x) => !x.read).length })
    }),
    http.get(`${API}/me/notifications`, ({ request }) => {
      const url = new URL(request.url)
      const tab = url.searchParams.get("tab") ?? "all"
      const cursor = url.searchParams.get("cursor")
      state.calls.push(`list ${tab}${cursor ? ` ${cursor}` : ""}`)
      const list = visible().filter((x) => (tab === "all" ? true : tab === "unread" ? !x.read : KIND_OF_TAB[tab] === x.kind))
      const start = cursor ? Number(cursor) : 0
      const end = start + pageSize
      return HttpResponse.json({ items: list.slice(start, end), nextCursor: end < list.length ? String(end) : null })
    }),
    http.put(`${API}/me/notifications/:id/read`, ({ params }) => {
      state.calls.push(`read ${String(params.id)}`)
      const x = find(params.id)
      if (!x) return apiError(404, "notification_not_found")
      x.read = true
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(`${API}/me/notifications/:id/read`, ({ params }) => {
      state.calls.push(`unread ${String(params.id)}`)
      const x = find(params.id)
      if (!x) return apiError(404, "notification_not_found")
      x.read = false
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/me/notifications/read-all`, () => {
      state.calls.push("read-all")
      state.items.forEach((x) => (x.read = true))
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(`${API}/me/notifications/:id`, ({ params }) => {
      state.calls.push(`remove ${String(params.id)}`)
      state.removed.add(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/me/notifications/:id/restore`, ({ params }) => {
      state.calls.push(`restore ${String(params.id)}`)
      state.removed.delete(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return state
}

type Alerts = Settings["notifications"]
const DEFAULT_ALERTS: Alerts = {
  episodes: true,
  fastPass: true,
  types: {
    update: { push: true, email: false },
    comment: { push: true, email: false },
    coins: { push: true, email: true },
    fastpass: { push: true, email: false },
    news: { push: false, email: false },
  },
  quiet: { on: true, from: 22, to: 7 },
  digest: false,
}

/** GET / PATCH /me/settings: the account's settings, merged like the API does; `patches` are the bodies sent. */
function accountSettings(alerts: Alerts = DEFAULT_ALERTS) {
  const state = {
    settings: {
      language: "en",
      theme: "system",
      reader: { font: "sans", size: 18, theme: "light", wide: true },
      notifications: structuredClone(alerts),
    } as Settings,
    patches: [] as unknown[],
  }
  server.use(
    http.get(`${API}/me/settings`, () => HttpResponse.json(state.settings)),
    http.patch(`${API}/me/settings`, async ({ request }) => {
      const body = (await request.json()) as { notifications?: Record<string, unknown> }
      state.patches.push(body)
      const n = state.settings.notifications
      const change = (body.notifications ?? {}) as {
        types?: Record<string, { push?: boolean; email?: boolean }>
        quiet?: { on?: boolean; from?: number; to?: number }
        digest?: boolean
      }
      for (const [type, sw] of Object.entries(change.types ?? {})) Object.assign(n.types[type as keyof Alerts["types"]], sw)
      Object.assign(n.quiet, change.quiet ?? {})
      if (change.digest !== undefined) n.digest = change.digest
      n.episodes = n.types.update.push
      n.fastPass = n.types.fastpass.push
      return HttpResponse.json(state.settings)
    }),
  )
  return state
}

/** Signs in, serves `items` and the default alert settings, and renders the page. */
function setup(items: NotificationItem[] = INBOX, { locale = "en" as "en" | "km", pageSize = 50 } = {}) {
  signIn()
  const inboxState = inbox(items, pageSize)
  const settingsState = accountSettings()
  const ui = renderUi(<NotificationsPage />, { locale })
  return { ...ui, inbox: inboxState, settings: settingsState }
}

/** The row (list item) of a notification, by its title. */
const row = (title: string) => screen.getByText(title).closest("li") as HTMLElement
/** The rows of a group (Today, This week, Earlier), in order, as their text. */
const groupRows = (heading: string) =>
  within(screen.getByRole("heading", { name: heading }).parentElement as HTMLElement)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")

/** The bell as the header shows it. */
function Bell() {
  return <output aria-label="bell">{useUnreadCount()}</output>
}

beforeEach(() => {
  // Only the clock: timers stay real (user-event, MSW and the Undo bar use them).
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe("NotificationsPage (real API): the inbox", () => {
  it("asks a logged-out visitor to log in, without calling the API", async () => {
    const { user } = renderUi(<NotificationsPage />)
    expect(screen.getByText("Log in to see your notifications")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/")
  })

  it("loads the inbox into Today / This week / Earlier with the time in Cambodia, unread first marked", async () => {
    setup()
    expect(screen.getAllByLabelText("Loading").length).toBeGreaterThan(0)
    expect(await screen.findByText("Glass Compass · Episode 65 is out")).toBeInTheDocument()

    const today = groupRows("Today")
    expect(today).toHaveLength(2)
    expect(today[0]).toContain("Glass Compass · Episode 65 is out")
    expect(today[0]).toContain("9:12 AM")
    expect(today[1]).toContain("Payment received · +33 coins")
    expect(today[1]).toContain("7:05 AM")

    const week = groupRows("This week")
    expect(week).toHaveLength(2)
    expect(week[0]).toContain("12 people liked your comment")
    expect(week[0]).toContain("Mon")
    expect(week[1]).toContain("Letters to Tuesday · Chapter 88 is out")
    expect(week[1]).toContain("Sun")

    const earlier = groupRows("Earlier")
    expect(earlier).toHaveLength(3)
    expect(earlier[0]).toContain("Oct 28")
    expect(earlier[1]).toContain("Oct 20")
    expect(earlier[2]).toContain("Dec 30, 2025")

    // Unread: the dot's screen-reader text, the "N unread" line and the Unread tab's count come from the API's count.
    expect(within(row("Glass Compass · Episode 65 is out")).getByText("Unread.")).toBeInTheDocument()
    expect(within(row("Welcome to PhumiReader")).queryByText("Unread.")).not.toBeInTheDocument()
    expect(await screen.findByText("2 unread")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Unread/ })).toHaveTextContent("2")
    expect(screen.queryByText(/API has no notifications/)).not.toBeInTheDocument()
  })

  it("writes every type's title and body in English", async () => {
    const at = "2026-11-05T03:00:00Z"
    setup([
      item("t1", { type: "episode_published", kind: "episode", createdAt: at, series: GLASS, episode: 65 }),
      item("t2", { type: "episode_published", kind: "episode", createdAt: at, series: LETTERS, episode: 88 }),
      item("t3", { type: "comment_liked", kind: "comment", createdAt: at, series: COURIER, episode: 39, data: { commentId: "k", count: 12 } }),
      item("t4", { type: "comment_liked", kind: "comment", createdAt: at, series: RAIN, data: { commentId: "k2", count: 1 } }),
      item("t5", { type: "order_paid", kind: "coins", createdAt: at, data: { orderNumber: "TW-48213377", coins: 33 } }),
      item("t6", { type: "order_refunded", kind: "coins", createdAt: at, data: { orderNumber: "TW-48190012", coins: 110 } }),
      item("t7", { type: "report_resolved", kind: "system", createdAt: at, series: GLASS, episode: 12, data: { reportId: "r", targetType: "comment", hidden: true } }),
      item("t8", { type: "report_resolved", kind: "system", createdAt: at, series: COURIER, data: { reportId: "r", targetType: "series", hidden: false } }),
      item("t9", { type: "report_dismissed", kind: "system", createdAt: at, series: LETTERS, episode: 4, data: { reportId: "r", targetType: "episode", hidden: false } }),
      item("t10", { type: "report_resolved", kind: "system", createdAt: at, series: LETTERS, episode: 5, data: { reportId: "r", targetType: "episode", hidden: true } }),
      item("t11", { type: "series_approved", kind: "system", createdAt: at, series: RAIN }),
      item("t12", { type: "series_changes", kind: "system", createdAt: at, series: GLASS, data: { items: ["cover", "title"], note: "Please use a cover without text." } }),
      item("t13", { type: "series_changes", kind: "system", createdAt: at, series: COURIER, data: { items: [], note: null } }),
      item("t14", { type: "series_rejected", kind: "system", createdAt: at, series: LETTERS, data: { note: "Copied from another site." } }),
      item("t15", { type: "welcome", kind: "system", createdAt: at }),
    ])
    const lines: [string, string][] = [
      ["Glass Compass · Episode 65 is out", "Your subscribed series has a new episode."],
      ["Letters to Tuesday · Chapter 88 is out", "A new chapter is ready to read."],
      ["12 people liked your comment", "On Midnight Courier · Episode 39"],
      ["1 person liked your comment", "On Rain Market"],
      ["Payment received · +33 coins", "Order TW-48213377 is paid. Your balance was updated."],
      ["Order refunded · 110 coins taken back", "Order TW-48190012 was refunded. Your balance was updated."],
      ["The comment you reported was removed", "Your report about a comment on Glass Compass · Episode 12"],
      ["We took action on your report", "Your report about Midnight Courier"],
      ["We reviewed your report: no violation found", "Your report about Letters to Tuesday · Chapter 4"],
      ["The chapter you reported was removed", "Your report about Letters to Tuesday · Chapter 5"],
      ["Rain Market was approved", "Your series is published. Readers can find it now."],
      ["Changes requested for Glass Compass", "To fix: cover, title · “Please use a cover without text.”"],
      ["Changes requested for Midnight Courier", "Open Manage series to see what to change."],
      ["Letters to Tuesday was not approved", "“Copied from another site.”"],
      ["Welcome to PhumiReader", "Subscribe to series to get new-episode alerts here."],
    ]
    await screen.findByText(lines[0][0])
    for (const [title, body] of lines) expect(within(row(title)).getByText(body)).toBeInTheDocument()
  })

  it("writes the items, groups and times in Khmer with Khmer digits (order numbers and titles stay as they are)", async () => {
    setup(INBOX, { locale: "km" })
    expect(await screen.findByText("Glass Compass · ភាគ ៦៥ ចេញហើយ")).toBeInTheDocument()
    expect(within(row("Glass Compass · ភាគ ៦៥ ចេញហើយ")).getByText("រឿងដែលអ្នកតាមដានមានភាគថ្មី។")).toBeInTheDocument()
    expect(within(row("Glass Compass · ភាគ ៦៥ ចេញហើយ")).getByText("៩:១២ ព្រឹក")).toBeInTheDocument()
    expect(
      within(row("បានទទួលការបង់ប្រាក់ · +៣៣ កាក់")).getByText(
        "ការបញ្ជាទិញ TW-48213377 បានបង់រួចហើយ។ សមតុល្យរបស់អ្នកត្រូវបានធ្វើបច្ចុប្បន្នភាព។",
      ),
    ).toBeInTheDocument()
    expect(within(row("មនុស្ស ១២ នាក់បានចូលចិត្តមតិរបស់អ្នក")).getByText("លើ Midnight Courier · ភាគ ៣៩")).toBeInTheDocument()
    expect(within(row("មនុស្ស ១២ នាក់បានចូលចិត្តមតិរបស់អ្នក")).getByText("ច")).toBeInTheDocument()
    expect(within(row("Letters to Tuesday · ជំពូក ៨៨ ចេញហើយ")).getByText("ជំពូកថ្មីរួចរាល់សម្រាប់អានហើយ។")).toBeInTheDocument()
    expect(within(row("មតិដែលអ្នកបានរាយការណ៍ត្រូវបានដកចេញ")).getByText("របាយការណ៍របស់អ្នកអំពីមតិមួយលើ Glass Compass · ភាគ ១២")).toBeInTheDocument()
    expect(within(row("សូមស្វាគមន៍មកកាន់ ភូមិReader")).getByText("២០ តុលា")).toBeInTheDocument()
    expect(within(row("Rain Market ត្រូវបានអនុម័ត")).getByText("៣០ ធ្នូ ២០២៥")).toBeInTheDocument()
    for (const heading of ["ថ្ងៃនេះ", "សប្តាហ៍នេះ", "មុននេះ"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    expect(await screen.findByText("មិនទាន់អាន ២")).toBeInTheDocument()
  })

  it("writes a series review decision in Khmer with the review items", async () => {
    setup(
      [
        item("s1", {
          type: "series_changes",
          kind: "system",
          createdAt: "2026-11-05T03:00:00Z",
          series: RAIN,
          data: { items: ["cover", "title"], note: "Please use a cover without text." },
        }),
      ],
      { locale: "km" },
    )
    expect(await screen.findByText("Rain Market ត្រូវកែប្រែ")).toBeInTheDocument()
    expect(screen.getByText("ត្រូវកែ៖ គម្រប ចំណងជើង · “Please use a cover without text.”")).toBeInTheDocument()
  })

  it("loads each tab from the API (New episodes = episodes) and keeps system items out of the kind tabs", async () => {
    const { user, inbox: state } = setup()
    await screen.findByText("Glass Compass · Episode 65 is out")
    expect(state.calls).toContain("list all")

    await user.click(screen.getByRole("tab", { name: "New episodes" }))
    expect(await screen.findByText("Letters to Tuesday · Chapter 88 is out")).toBeInTheDocument()
    expect(state.calls).toContain("list episodes")
    expect(screen.queryByText("Welcome to PhumiReader")).not.toBeInTheDocument()
    expect(screen.queryByText("Payment received · +33 coins")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Comments" }))
    expect(await screen.findByText("12 people liked your comment")).toBeInTheDocument()
    expect(state.calls).toContain("list comments")
    expect(screen.queryByText("Glass Compass · Episode 65 is out")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Coins" }))
    expect(await screen.findByText("Payment received · +33 coins")).toBeInTheDocument()
    expect(state.calls).toContain("list coins")

    await user.click(screen.getByRole("tab", { name: /Unread/ }))
    await waitFor(() => expect(state.calls).toContain("list unread"))
    expect(await screen.findByText("Glass Compass · Episode 65 is out")).toBeInTheDocument()
    expect(screen.getByText("Payment received · +33 coins")).toBeInTheDocument()
    expect(screen.queryByText("Welcome to PhumiReader")).not.toBeInTheDocument()
  })

  it.each([
    ["Glass Compass · Episode 65 is out", "/read/glass-compass/65", "e1"],
    ["Payment received · +33 coins", "/coins/orders/TW-48213377", "o1"],
    ["12 people liked your comment", "/series/midnight-courier/comments?ep=39", null],
    ["Letters to Tuesday · Chapter 88 is out", "/novel/letters-to-tuesday/88", null],
    ["The comment you reported was removed", "/series/glass-compass", null],
    ["Welcome to PhumiReader", "/", null],
    ["Rain Market was approved", "/creator/series/s-rain", null],
  ])("opening “%s” goes to %s (and marks an unread item read)", async (title, href, readId) => {
    const { user, inbox: state } = setup()
    await screen.findByText(title)
    await user.click(screen.getByText(title))
    expect(router.push).toHaveBeenCalledWith(href)
    if (readId) await waitFor(() => expect(state.calls).toContain(`read ${readId}`))
    else expect(state.calls.some((c) => c.startsWith("read "))).toBe(false)
  })

  it("links a coin order without a number to Coins, and a refund to its receipt", async () => {
    const { user } = setup([
      item("p1", { type: "order_paid", kind: "coins", createdAt: "2026-11-05T03:00:00Z", data: { coins: 33 } }),
      item("p2", { type: "order_refunded", kind: "coins", createdAt: "2026-11-05T02:00:00Z", data: { orderNumber: "TW-1", coins: 5 } }),
    ])
    await user.click(await screen.findByText("Payment received · +33 coins"))
    expect(router.push).toHaveBeenLastCalledWith("/coins")
    await user.click(screen.getByText("Order refunded · 5 coins taken back"))
    expect(router.push).toHaveBeenLastCalledWith("/coins/orders/TW-1")
  })

  it("marks an item read and unread through the API, and the count and the bell follow", async () => {
    signIn()
    const state = inbox()
    accountSettings()
    const { user } = renderUi(
      <>
        <Bell />
        <NotificationsPage />
      </>,
    )
    await screen.findByText("Glass Compass · Episode 65 is out")
    await waitFor(() => expect(screen.getByLabelText("bell")).toHaveTextContent("2"))

    await user.click(within(row("Glass Compass · Episode 65 is out")).getByRole("button", { name: "Mark as read" }))
    // At once, before the API answers: the dot goes and the bell counts one less.
    await waitFor(() => expect(within(row("Glass Compass · Episode 65 is out")).queryByText("Unread.")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByLabelText("bell")).toHaveTextContent("1"))
    await waitFor(() => expect(state.calls).toContain("read e1"))
    expect(await screen.findByText("1 unread")).toBeInTheDocument()

    const countsBefore = state.calls.filter((c) => c === "count").length
    await user.click(within(row("Welcome to PhumiReader")).getByRole("button", { name: "Mark as unread" }))
    await waitFor(() => expect(within(row("Welcome to PhumiReader")).getByText("Unread.")).toBeInTheDocument())
    await waitFor(() => expect(state.calls).toContain("unread w1"))
    // The count is read again after the change: the bell and the page stay in step with the API.
    await waitFor(() => expect(state.calls.filter((c) => c === "count").length).toBeGreaterThan(countsBefore))
    await waitFor(() => expect(screen.getByLabelText("bell")).toHaveTextContent("2"))
    expect(screen.getByText("2 unread")).toBeInTheDocument()
  })

  it("an item marked read leaves the Unread tab at once", async () => {
    const { user } = setup()
    await screen.findByText("Glass Compass · Episode 65 is out")
    await user.click(screen.getByRole("tab", { name: /Unread/ }))
    await screen.findByText("Payment received · +33 coins")
    await user.click(within(row("Payment received · +33 coins")).getByRole("button", { name: "Mark as read" }))
    await waitFor(() => expect(screen.queryByText("Payment received · +33 coins")).not.toBeInTheDocument())
  })

  it("puts the item back and says so when marking it read fails", async () => {
    const { user } = setup()
    await screen.findByText("Glass Compass · Episode 65 is out")
    server.use(http.put(`${API}/me/notifications/:id/read`, () => apiError(500, "internal_error")))
    await user.click(within(row("Glass Compass · Episode 65 is out")).getByRole("button", { name: "Mark as read" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."))
    await waitFor(() => expect(within(row("Glass Compass · Episode 65 is out")).getByText("Unread.")).toBeInTheDocument())
  })

  it("removes an item, and Undo restores it", async () => {
    const { user, inbox: state } = setup()
    await screen.findByText("Glass Compass · Episode 65 is out")
    await user.click(within(row("Glass Compass · Episode 65 is out")).getByRole("button", { name: "Remove notification" }))
    expect(screen.getByText("Notification removed")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Glass Compass · Episode 65 is out")).not.toBeInTheDocument())
    await waitFor(() => expect(state.calls).toContain("remove e1"))
    await waitFor(() => expect(screen.getByText("1 unread")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(await screen.findByText("Glass Compass · Episode 65 is out")).toBeInTheDocument()
    expect(screen.queryByText("Notification removed")).not.toBeInTheDocument()
    await waitFor(() => expect(state.calls).toContain("restore e1"))
    expect(state.calls.indexOf("restore e1")).toBeGreaterThan(state.calls.indexOf("remove e1"))
    expect(groupRows("Today")[0]).toContain("Glass Compass · Episode 65 is out")
    await waitFor(() => expect(screen.getByText("2 unread")).toBeInTheDocument())
  })

  it("brings a removed item back and says so when the API refuses", async () => {
    const { user } = setup()
    await screen.findByText("Welcome to PhumiReader")
    server.use(http.delete(`${API}/me/notifications/:id`, () => apiError(500, "internal_error")))
    await user.click(within(row("Welcome to PhumiReader")).getByRole("button", { name: "Remove notification" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."))
    expect(await screen.findByText("Welcome to PhumiReader")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Notification removed")).not.toBeInTheDocument())
  })

  it("marks everything read: the page, the Unread count and the bell go to zero", async () => {
    signIn()
    const state = inbox()
    accountSettings()
    const { user } = renderUi(
      <>
        <Bell />
        <NotificationsPage />
      </>,
    )
    await screen.findByText("2 unread")
    await user.click(screen.getByRole("button", { name: "Mark all as read" }))
    await waitFor(() => expect(screen.getByLabelText("bell")).toHaveTextContent("0"))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("All marked as read"))
    expect(state.calls).toContain("read-all")
    await waitFor(() => expect(screen.queryByText("Unread.")).not.toBeInTheDocument())
    expect(await screen.findByText("You’re all caught up")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mark all as read" })).not.toBeInTheDocument()
  })

  it("loads older items with Load more", async () => {
    const { user, inbox: state } = setup(INBOX, { pageSize: 4 })
    await screen.findByText("Glass Compass · Episode 65 is out")
    expect(screen.queryByText("Welcome to PhumiReader")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByText("Welcome to PhumiReader")).toBeInTheDocument()
    expect(state.calls).toContain("list all 4")
    expect(groupRows("Earlier")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows the empty state", async () => {
    setup([])
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Find series to subscribe to" })).toHaveAttribute("href", "/rankings")
    expect(await screen.findByText("You’re all caught up")).toBeInTheDocument()
  })

  it("shows the error state, and Try again loads the inbox", async () => {
    signIn()
    accountSettings()
    server.use(
      http.get(`${API}/me/notifications/unread-count`, () => HttpResponse.json({ count: 0 })),
      http.get(`${API}/me/notifications`, () => apiError(500, "internal_error")),
    )
    const { user } = renderUi(<NotificationsPage />)
    expect(await screen.findByText("Your notifications didn’t load")).toBeInTheDocument()
    inbox()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Glass Compass · Episode 65 is out")).toBeInTheDocument()
  })
})

describe("NotificationsPage (real API): alert settings", () => {
  it("shows the account's alert settings", async () => {
    signIn()
    inbox([])
    accountSettings({
      ...DEFAULT_ALERTS,
      types: {
        update: { push: false, email: true },
        comment: { push: false, email: false },
        coins: { push: true, email: false },
        fastpass: { push: false, email: false },
        news: { push: true, email: true },
      },
      quiet: { on: true, from: 23, to: 6 },
      digest: true,
    })
    renderUi(<NotificationsPage />)
    const push = await screen.findByRole("switch", { name: "New episodes: push" })
    expect(push).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "New episodes: email" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Replies and likes: push" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "Coins and payments: email" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "PhumiReader news: push" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "PhumiReader news: email" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Quiet hours" })).toBeChecked()
    expect(screen.getByLabelText("From")).toHaveValue("23")
    expect(screen.getByLabelText("To")).toHaveValue("6")
    expect(screen.getByRole("switch", { name: "Daily digest" })).toBeChecked()
  })

  it.each([
    ["New episodes: push", { types: { update: { push: false } } }],
    ["New episodes: email", { types: { update: { email: true } } }],
    ["Fast Pass is free: push", { types: { fastpass: { push: false } } }],
    ["Fast Pass is free: email", { types: { fastpass: { email: true } } }],
    ["Replies and likes: push", { types: { comment: { push: false } } }],
    ["Replies and likes: email", { types: { comment: { email: true } } }],
    ["Coins and payments: push", { types: { coins: { push: false } } }],
    ["Coins and payments: email", { types: { coins: { email: false } } }],
    ["PhumiReader news: push", { types: { news: { push: true } } }],
    ["PhumiReader news: email", { types: { news: { email: true } } }],
    ["Quiet hours", { quiet: { on: false } }],
    ["Daily digest", { digest: true }],
  ])("saves “%s” to the account at once, with only what changed", async (name, notifications) => {
    signIn()
    inbox([])
    const state = accountSettings()
    const { user } = renderUi(<NotificationsPage />)
    const toggle = await screen.findByRole("switch", { name })
    const was = toggle.getAttribute("aria-checked") === "true"
    expect(screen.getByText("Changes save automatically")).toBeInTheDocument()
    await user.click(toggle)
    await waitFor(() => expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", String(!was)))
    expect(await screen.findByText("Saved")).toBeInTheDocument()
    expect(state.patches).toEqual([{ notifications }])
    expect(screen.getByRole("switch", { name })).toHaveAttribute("aria-checked", String(!was))
  })

  it("saves the quiet hours", async () => {
    signIn()
    inbox([])
    const state = accountSettings()
    const { user } = renderUi(<NotificationsPage />)
    await user.selectOptions(await screen.findByLabelText("From"), "21")
    await waitFor(() => expect(state.patches).toEqual([{ notifications: { quiet: { from: 21 } } }]))
    await user.selectOptions(screen.getByLabelText("To"), "8")
    await waitFor(() => expect(state.patches).toHaveLength(2))
    expect(state.patches[1]).toEqual({ notifications: { quiet: { to: 8 } } })
    expect(screen.getByLabelText("From")).toHaveValue("21")
    expect(screen.getByLabelText("To")).toHaveValue("8")
    expect(useAppStore.getState().notifPrefs).toMatchObject({ from: 21, to: 8 })
  })

  it("keeps the store in step, so Settings shows the same choices", async () => {
    signIn()
    inbox([])
    accountSettings()
    const { user } = renderUi(<NotificationsPage />)
    await user.click(await screen.findByRole("switch", { name: "PhumiReader news: email" }))
    await screen.findByText("Saved")
    expect(useAppStore.getState().notifPrefs.news).toEqual([false, true])
  })

  it("puts the switch back and says so when saving fails", async () => {
    signIn()
    inbox([])
    accountSettings()
    server.use(http.patch(`${API}/me/settings`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<NotificationsPage />)
    const toggle = await screen.findByRole("switch", { name: "Daily digest" })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn’t save. Try again."))
    await waitFor(() => expect(screen.getByRole("switch", { name: "Daily digest" })).not.toBeChecked())
    expect(screen.getByText("Couldn’t save. Try again.")).toBeInTheDocument()
    expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    expect(useAppStore.getState().notifPrefs.digest).toBe(false)
  })

  it("shows an error with Try again when the settings don't load", async () => {
    signIn()
    inbox([])
    accountSettings()
    server.use(http.get(`${API}/me/settings`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<NotificationsPage />)
    expect(await screen.findByText("Your alert settings didn’t load.")).toBeInTheDocument()
    accountSettings()
    const panel = screen.getByText("Your alert settings didn’t load.").closest("aside") as HTMLElement
    await user.click(within(panel).getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("switch", { name: "Daily digest" })).toBeInTheDocument()
  })
})
