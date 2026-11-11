import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { ManageSeriesPage } from "@/components/pr/manage-series-page"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/** Manage series in real mode (V21-01): the reviewer's changes from the API, Mark fixed / Undo and Resubmit. */

const review = (items: { item: string; fixed: boolean }[]) => ({
  submittedAt: "2026-11-08T03:00:00Z",
  decision: "changes",
  note: "Please remove the Telegram link.",
  items,
})
const edit = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  slug: "lantern-ferry",
  title: "Lantern Ferry",
  type: "comic",
  genre: "fantasy",
  languages: ["km"],
  summary: "A ferry girl on the Kampot river finds a lantern that shows the way to people who are lost.",
  tags: [],
  ageRating: "all",
  status: "ongoing",
  updateDay: "Sat",
  coverUrl: null,
  bannerUrl: null,
  visibility: "changes",
  review: review([
    { item: "contact", fixed: false },
    { item: "cover", fixed: false },
  ]),
  ...over,
})
const dashboard = { creator: true, name: "Sokha", series: [], totals: { views: 0, likes: 0, earnedCoins: 0 } }
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com", roles: ["READER", "CREATOR"] })
const serve = (series: object) =>
  server.use(
    http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
    http.get(`${API}/creator/series`, () => HttpResponse.json([])),
    http.get(`${API}/creator/series/s1`, () => HttpResponse.json(series)),
    http.get(`${API}/creator/series/s1/episodes`, () => HttpResponse.json([])),
  )

describe("ManageSeriesPage: the review in real mode", () => {
  it("shows the reviewer's changes and note, saves Mark fixed and Undo, and resubmits once all are fixed", async () => {
    signIn()
    serve(edit())
    const calls: string[] = []
    server.use(
      http.put(`${API}/creator/series/s1/review/items/:item`, ({ params }) => {
        calls.push(`PUT ${String(params.item)}`)
        return HttpResponse.json(edit())
      }),
      http.delete(`${API}/creator/series/s1/review/items/:item`, ({ params }) => {
        calls.push(`DELETE ${String(params.item)}`)
        return HttpResponse.json(edit())
      }),
      http.post(`${API}/creator/series/s1/submit`, () => {
        calls.push("submit")
        return HttpResponse.json(edit({ visibility: "review", review: { ...review([]), decision: null, note: null } }))
      }),
    )
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByRole("heading", { name: "Changes needed before this series can go live" })).toBeInTheDocument()
    expect(screen.getByText("Changes requested")).toBeInTheDocument()
    expect(screen.getByText(/Submitted Nov 8/)).toBeInTheDocument()
    // The items are keys, shown in the creator's language; the note goes with the first one.
    expect(screen.getByText("Remove contact details or links from the summary")).toBeInTheDocument()
    expect(screen.getByText("Replace the cover (watermark or unreadable)")).toBeInTheDocument()
    expect(screen.getByText("Note from the reviewer: “Please remove the Telegram link.”")).toBeInTheDocument()
    const resubmit = screen.getByRole("button", { name: "Resubmit for review" })
    expect(resubmit).toBeDisabled()

    await user.click(screen.getAllByRole("button", { name: "Mark fixed" })[0])
    const undo = await screen.findByRole("button", { name: "Undo Mark fixed: Remove contact details or links from the summary" })
    await waitFor(() => expect(undo).toBeEnabled())
    expect(screen.getByText("1 of 2 fixed")).toBeInTheDocument()
    await user.click(undo)
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Mark fixed" })).toHaveLength(2))

    for (let i = 0; i < 2; i++) {
      const next = screen.getAllByRole("button", { name: "Mark fixed" })[0]
      await waitFor(() => expect(next).toBeEnabled())
      await user.click(next)
    }
    await waitFor(() => expect(resubmit).toBeEnabled())
    expect(calls).toEqual(["PUT contact", "DELETE contact", "PUT contact", "PUT cover"])

    await user.click(resubmit)
    expect(await screen.findByText("Resubmitted. We’ll review your changes within 1–2 days and send you a notification.")).toBeInTheDocument()
    expect(calls.at(-1)).toBe("submit")
    expect(toast.success).toHaveBeenCalledWith("Resubmitted for review")
    expect(screen.getByText("In review")).toBeInTheDocument()
  })

  it("starts with the items already marked fixed on another device", async () => {
    signIn()
    serve(edit({ review: review([{ item: "title", fixed: true }]) }))
    renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByText("Change the title (too close to an existing series)")).toBeInTheDocument()
    expect(screen.getByText("1 of 1 fixed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Resubmit for review" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Mark fixed" })).not.toBeInTheDocument()
  })

  it("puts Mark fixed back and explains when the review moved on, then loads the latest", async () => {
    signIn()
    let reads = 0
    server.use(
      http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
      http.get(`${API}/creator/series`, () => HttpResponse.json([])),
      http.get(`${API}/creator/series/s1`, () => {
        reads++
        return HttpResponse.json(edit())
      }),
      http.get(`${API}/creator/series/s1/episodes`, () => HttpResponse.json([])),
      http.put(`${API}/creator/series/s1/review/items/:item`, () => apiError(409, "no_changes_requested")),
    )
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await user.click((await screen.findAllByRole("button", { name: "Mark fixed" }))[0])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The review of this series changed in the meantime. The page now shows the latest.")
    )
    await waitFor(() => expect(reads).toBe(2))
    expect(await screen.findAllByRole("button", { name: "Mark fixed" })).toHaveLength(2)
  })

  it("explains a refused Resubmit (changes not fixed)", async () => {
    signIn()
    serve(edit({ review: review([{ item: "contact", fixed: true }]) }))
    server.use(http.post(`${API}/creator/series/s1/submit`, () => apiError(409, "changes_not_fixed")))
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await user.click(await screen.findByRole("button", { name: "Resubmit for review" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Mark every requested change fixed, then resubmit."))
    expect(screen.queryByText(/^Resubmitted\. /)).not.toBeInTheDocument()
  })

  it("shows a series in review with its submitted date and an Upload button, and no changes box", async () => {
    signIn()
    serve(edit({ visibility: "review", review: { ...review([]), decision: null, note: null } }))
    renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByText("In review")).toBeInTheDocument()
    expect(screen.getByText(/Submitted Nov 8/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Upload episode" }).some((l) => l.getAttribute("href") === "/creator/upload?series=s1")).toBe(true)
    expect(screen.queryByRole("heading", { name: "Changes needed before this series can go live" })).not.toBeInTheDocument()
  })
})
