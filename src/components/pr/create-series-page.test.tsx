import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CreateSeriesPage } from "@/components/pr/create-series-page"
import { useAppStore } from "@/lib/store"
import { setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"
import { selectOption } from "@/test/select"

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
  breakMessage: null,
  updateDays: ["Sat"],
  secondGenre: null,
  releaseHour: 18,
  fastPass: { on: true, ahead: 3 },
  commentsEnabled: true,
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

/** V21-02: every field the form shows is saved, and the ones only Manage series shows are carried over (PUT replaces). */
describe("CreateSeriesPage: every field round-trips (real API)", () => {
  const saved = edit({
    secondGenre: "romance",
    ageRating: "teen16",
    languages: ["en", "km"],
    updateDays: ["Mon", "Thu"],
    releaseHour: 20,
    fastPass: { on: false, ahead: 4 },
    commentsEnabled: false,
    status: "hiatus",
    breakMessage: "Back on Dec 6 with season 2!",
    tags: ["river"],
  })
  const everything = {
    title: "Lantern Ferry",
    genre: "fantasy",
    secondGenre: "romance",
    languages: ["en", "km"],
    summary: "A ferry girl on the Kampot river finds a lantern that shows the way to people who are lost.",
    ageRating: "teen16",
    updateDays: ["Mon", "Thu"],
    releaseHour: 20,
    fastPass: { on: false, ahead: 4 },
    commentsEnabled: false,
    status: "hiatus",
    breakMessage: "Back on Dec 6 with season 2!",
    tags: ["river"],
    coverUploadId: null,
    bannerUploadId: null,
  }
  function serveSaved(onPut: (body: unknown) => void) {
    setSearch("draft=s1")
    server.use(
      http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
      http.get(`${API}/creator/series`, () => HttpResponse.json([])),
      http.get(`${API}/creator/series/s1`, () => HttpResponse.json(saved)),
      http.put(`${API}/creator/series/s1`, async ({ request }) => {
        onPut(await request.json())
        return HttpResponse.json(saved)
      }),
    )
  }

  it("opens a saved draft with its update days, release time and Fast Pass, and Save draft sends every field back", async () => {
    signIn()
    let body: unknown
    serveSaved((b) => (body = b))
    const { user } = renderUi(<CreateSeriesPage />)
    const days = await screen.findByRole("group", { name: /Update days/ })
    expect(within(days).getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true")
    expect(within(days).getByRole("button", { name: "Thu" })).toHaveAttribute("aria-pressed", "true")
    expect(within(days).getByRole("button", { name: "Tue" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByLabelText("Release time")).toHaveAttribute("data-value", "20")
    expect(screen.getByRole("switch", { name: "Fast Pass" })).not.toBeChecked()

    await user.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Draft saved"))
    // The type is fixed once saved (left out); the rest is the whole series, including what only Manage series shows.
    expect(body).toEqual(everything)
  })

  it("shows the second genre and 16+ on Basics, and sends the changed days, time, Fast Pass, age and genre", async () => {
    signIn()
    let body: unknown
    serveSaved((b) => (body = b))
    const { user } = renderUi(<CreateSeriesPage />)
    const days = await screen.findByRole("group", { name: /Update days/ })
    await user.click(within(days).getByRole("button", { name: "Tue" }))
    await selectOption(user, screen.getByLabelText("Release time"), "21")
    await user.click(screen.getByRole("switch", { name: "Fast Pass" }))

    await user.click(screen.getByRole("button", { name: /^Basics/ }))
    expect(await screen.findByLabelText(/Second genre/)).toHaveAttribute("data-value", "Romance")
    expect(screen.getByRole("radio", { name: "16+" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "18+" }))
    await selectOption(user, screen.getByLabelText(/Second genre/), "Drama")

    await user.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      ...everything,
      secondGenre: "drama",
      ageRating: "mature",
      updateDays: ["Mon", "Tue", "Thu"],
      releaseHour: 21,
      fastPass: { on: true, ahead: 4 },
    })
  })
})
