import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CreateSeriesPage } from "@/components/pr/create-series-page"
import { useAppStore } from "@/lib/store"
import { setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/** Create series in real mode (V21-01): Submit saves the series and submits it for review instead of publishing it. */

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
  coverUrl: "/covers/x.svg",
  bannerUrl: null,
  visibility: "draft",
  review: null,
  ...over,
})
const dashboard = { creator: true, name: "Sokha", series: [], totals: { views: 0, likes: 0, earnedCoins: 0 } }
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com", roles: ["READER", "CREATOR"] })

/** `?draft=s1`: a saved draft with every step but the last filled in, so the form opens at Publishing. */
function serveDraft(submit: () => Response, calls: string[]) {
  setSearch("draft=s1")
  server.use(
    http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
    http.get(`${API}/creator/series`, () => HttpResponse.json([])),
    http.get(`${API}/creator/series/s1`, () => HttpResponse.json(edit())),
    http.put(`${API}/creator/series/s1`, () => {
      calls.push("save")
      return HttpResponse.json(edit())
    }),
    http.post(`${API}/creator/series/s1/submit`, () => {
      calls.push("submit")
      return submit()
    }),
    http.post(`${API}/creator/series/s1/publish`, () => {
      calls.push("publish")
      return HttpResponse.json(edit({ visibility: "published" }))
    }),
  )
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

describe("CreateSeriesPage: Submit for review (real API)", () => {
  it("saves the series, submits it for review (no publish) and shows the in-review screen with Upload episode 1", async () => {
    signIn()
    const calls: string[] = []
    serveDraft(
      () =>
        HttpResponse.json(
          edit({ visibility: "review", review: { submittedAt: "2026-11-10T03:00:00Z", decision: null, note: null, items: [] } })
        ),
      calls
    )
    const { user } = renderUi(<CreateSeriesPage />)
    await user.click(await screen.findByRole("checkbox", { name: /original work/ }))
    await user.click(screen.getByRole("button", { name: "Submit for review" }))
    expect(await screen.findByRole("heading", { name: "Lantern Ferry is in review" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Upload episode 1" })).toHaveAttribute("href", "/creator/upload?series=s1")
    expect(calls).toEqual(["save", "submit"])
  })

  it("explains a submit the API refuses and stays on the form", async () => {
    signIn()
    const calls: string[] = []
    serveDraft(() => apiError(400, "required", { fields: { coverUploadId: "required" } }), calls)
    const { user } = renderUi(<CreateSeriesPage />)
    await user.click(await screen.findByRole("checkbox", { name: /original work/ }))
    await user.click(screen.getByRole("button", { name: "Submit for review" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Add a cover image."))
    expect(screen.queryByRole("heading", { name: "Lantern Ferry is in review" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled()
    expect(calls).toEqual(["save", "submit"])
  })
})
