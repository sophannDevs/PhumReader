import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { AdminDecisions } from "@/components/pr/admin-kit"
import { AdminSeriesReview } from "@/components/pr/admin-series"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/** The admin series review in real mode (V21-01): GET /admin/series-review and the decisions after the Undo window. */

const SUBMITTED = "2026-11-09T09:12:00Z"
const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: `series-${id}`,
  title: `Series ${id}`,
  creator: "Sokha",
  type: "comic",
  genre: "fantasy",
  ageRating: "teen",
  languages: ["en", "km"],
  episodeCount: 3,
  coverUrl: null,
  summary: "A ferry girl finds a lantern that shows lost people the way. Follow @lantern_kh for news.",
  submittedAt: SUBMITTED,
  flags: [{ kind: "contact", detail: "@lantern_kh" }],
  ...over,
})
const page = (items: object[], nextCursor: string | null = null) => HttpResponse.json({ items, nextCursor })
const overview = (seriesInReview: number) => ({
  bannedUsers: 0,
  hiddenComments: 0,
  hiddenEpisodes: 0,
  hiddenSeries: 0,
  openReports: 0,
  refundedOrders: 0,
  seriesInReview,
  oldestReviewAt: SUBMITTED,
})
const signIn = () => useAppStore.getState().login({ name: "Admin", email: "admin@example.com", roles: ["ADMIN"] })
const view = () => (
  <AdminDecisions>
    <AdminSeriesReview />
  </AdminDecisions>
)

describe("AdminSeriesReview: real API", () => {
  it("lists the API's queue with its automatic checks, without the demo-data note", async () => {
    signIn()
    server.use(
      http.get(`${API}/admin/series-review`, () => page([item("a")])),
      http.get(`${API}/admin/overview`, () => HttpResponse.json(overview(1))),
    )
    renderUi(view())
    expect(await screen.findByRole("heading", { level: 2, name: "Series a" })).toBeInTheDocument()
    expect(screen.getByText(/^1 waiting/)).toBeInTheDocument()
    expect(screen.getByText("• Summary may contain a social handle (“@lantern_kh”)")).toBeInTheDocument()
    expect(screen.getByText("Fantasy")).toBeInTheDocument()
    expect(screen.getByText("13+")).toBeInTheDocument()
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument()
  })

  it("Request changes sends the reason keys and the note once the Undo window closes", async () => {
    signIn()
    let body: unknown = null
    server.use(
      http.get(`${API}/admin/series-review`, () => page([item("a")])),
      http.get(`${API}/admin/overview`, () => HttpResponse.json(overview(1))),
      http.post(`${API}/admin/series/a/request-changes`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, unmount } = renderUi(view())
    await screen.findByRole("heading", { level: 2, name: "Series a" })
    await user.click(screen.getByRole("button", { name: "Request changes" }))
    // The contact flag ticks its reason.
    expect(screen.getByRole("checkbox", { name: "Remove contact details or links from the summary" })).toBeChecked()
    await user.click(screen.getByRole("checkbox", { name: "Change the title (too close to an existing series)" }))
    await user.type(screen.getByLabelText(/Note to the creator/), "Please remove the Telegram link.")
    await user.click(screen.getByRole("button", { name: "Send to creator" }))
    expect(toast.success).toHaveBeenCalledWith("Sent to the creator")
    expect(await screen.findByText("Queue is empty")).toBeInTheDocument()
    // Nothing is sent during the Undo window; leaving the admin area sends it at once.
    expect(body).toBeNull()
    unmount()
    await waitFor(() => expect(body).toEqual({ items: ["contact", "title"], note: "Please remove the Telegram link." }))
  })

  it("undoes a decision another admin already made (409 not_in_review), says so and reloads the queue", async () => {
    signIn()
    let reads = 0
    server.use(
      http.get(`${API}/admin/series-review`, () => {
        reads++
        return page(reads === 1 ? [item("a"), item("b")] : [item("b")])
      }),
      http.get(`${API}/admin/overview`, () => HttpResponse.json(overview(2))),
      http.post(`${API}/admin/series/a/reject`, () => apiError(409, "not_in_review")),
      http.post(`${API}/admin/series/b/reject`, () => new HttpResponse(null, { status: 204 })),
    )
    const { user } = renderUi(view())
    await screen.findByRole("heading", { level: 2, name: "Series a" })
    await user.click(screen.getByRole("button", { name: "Reject" }))
    // a leaves the list at once; the next decision sends the waiting one right away.
    await screen.findByRole("heading", { level: 2, name: "Series b" })
    await user.click(screen.getByRole("button", { name: "Reject" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Another admin already decided on this series."))
    await waitFor(() => expect(reads).toBe(2))
    expect(await screen.findByText("Queue is empty")).toBeInTheDocument()
    expect(screen.queryByText("Series a")).not.toBeInTheDocument()
    // b's decision still waits for its Undo window: take it back, so nothing is sent after the test.
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(await screen.findByRole("heading", { level: 2, name: "Series b" })).toBeInTheDocument()
  })

  it("loads more of the queue with the cursor, counting every waiting series", async () => {
    signIn()
    const cursors: (string | null)[] = []
    server.use(
      http.get(`${API}/admin/series-review`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor")
        cursors.push(cursor)
        return cursor ? page([item("b")]) : page([item("a")], "next-1")
      }),
      http.get(`${API}/admin/overview`, () => HttpResponse.json(overview(2))),
    )
    const { user } = renderUi(view())
    await screen.findByRole("heading", { level: 2, name: "Series a" })
    await waitFor(() => expect(screen.getByText(/^2 waiting/)).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByRole("button", { name: /Series b/ })).toBeInTheDocument()
    expect(cursors).toEqual([null, "next-1"])
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows the error state and Retry loads the queue", async () => {
    signIn()
    server.use(
      http.get(`${API}/admin/series-review`, () => apiError(500, "internal_error")),
      http.get(`${API}/admin/overview`, () => HttpResponse.json(overview(1))),
    )
    const { user } = renderUi(view())
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    server.use(http.get(`${API}/admin/series-review`, () => page([item("a")])))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { level: 2, name: "Series a" })).toBeInTheDocument()
  })
})
