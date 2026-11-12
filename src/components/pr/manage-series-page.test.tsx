import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { ManageSeriesPage } from "@/components/pr/manage-series-page"
import { useAppStore } from "@/lib/store"
import { router, setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"
import { selectOption } from "@/test/select"

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
  breakMessage: null,
  updateDays: ["Sat"],
  secondGenre: null,
  releaseHour: 18,
  fastPass: { on: true, ahead: 3 },
  commentsEnabled: true,
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

// ------------------------------------------------------------------------------------------------ V21-02

/** A live series with every V21-02 field set to something other than its default. */
const live = (over: Record<string, unknown> = {}) =>
  edit({
    visibility: "published",
    review: null,
    secondGenre: "romance",
    ageRating: "teen16",
    languages: ["en", "km"],
    tags: ["river"],
    updateDays: ["Mon", "Thu"],
    releaseHour: 20,
    fastPass: { on: true, ahead: 3 },
    commentsEnabled: true,
    status: "hiatus",
    breakMessage: "Back on Dec 6 with season 2!",
    ...over,
  })
/** The PUT body that keeps `live()` as it is: PUT replaces the whole series, so every save sends all of it. */
const unchanged = {
  title: "Lantern Ferry",
  genre: "fantasy",
  secondGenre: "romance",
  languages: ["en", "km"],
  summary: "A ferry girl on the Kampot river finds a lantern that shows the way to people who are lost.",
  tags: ["river"],
  ageRating: "teen16",
  status: "hiatus",
  breakMessage: "Back on Dec 6 with season 2!",
  updateDays: ["Mon", "Thu"],
  releaseHour: 20,
  fastPass: { on: true, ahead: 3 },
  commentsEnabled: true,
  coverUploadId: null,
  bannerUploadId: null,
}
const episode = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: `Night ${number}`,
  status: "published",
  publishedAt: "2026-11-02T11:00:00Z",
  views: 120,
  likes: 9,
  commentsEnabled: true,
  priceCoins: null,
  freeAt: null,
  hiddenAt: null,
  thumbnailUrl: null,
  ...over,
})
/** Serves the series and its episodes; the PUT answers with the series as sent and is recorded in `puts`. */
function serveLive(series: Record<string, unknown>, episodes: object[] = [], puts: unknown[] = []) {
  server.use(
    http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
    http.get(`${API}/creator/series`, () => HttpResponse.json([])),
    http.get(`${API}/creator/series/s1`, () => HttpResponse.json(series)),
    http.get(`${API}/creator/series/s1/episodes`, () => HttpResponse.json(episodes)),
    http.put(`${API}/creator/series/s1`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      puts.push(body)
      return HttpResponse.json({ ...series, ...body })
    }),
  )
  return puts
}

describe("ManageSeriesPage: series details, Fast Pass and comments are saved (real API)", () => {
  it("loads the break message and every update day, and Save changes sends the whole series", async () => {
    signIn()
    setSearch("tab=details")
    const puts = serveLive(live())
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    const note = await screen.findByLabelText("Message to readers")
    expect(note).toHaveValue("Back on Dec 6 with season 2!")
    expect(screen.getByRole("radio", { name: "On break" })).toHaveAttribute("aria-checked", "true")
    const days = screen.getByRole("group", { name: "Update days" })
    expect(within(days).getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true")
    expect(within(days).getByRole("button", { name: "Thu" })).toHaveAttribute("aria-pressed", "true")
    // The header lists every day.
    expect(screen.getByText(/Every Monday and Thursday/)).toBeInTheDocument()

    await user.clear(note)
    await user.type(note, "Back on Dec 13")
    await user.click(within(days).getByRole("button", { name: "Sat" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Series details saved"))
    expect(puts).toEqual([{ ...unchanged, breakMessage: "Back on Dec 13", updateDays: ["Mon", "Thu", "Sat"] }])
  })

  it("leaving the break drops the message", async () => {
    signIn()
    setSearch("tab=details")
    const puts = serveLive(live())
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await screen.findByLabelText("Message to readers")
    await user.click(screen.getByRole("radio", { name: "Ongoing" }))
    expect(screen.queryByLabelText("Message to readers")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ ...unchanged, status: "ongoing", breakMessage: null })
  })

  it("Fast Pass tab: shows the series' switch and its free date rule, and saves it with the rest of the series", async () => {
    signIn()
    setSearch("tab=fast-pass")
    const puts = serveLive(live())
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    const fastPass = await screen.findByRole("switch", { name: "Fast Pass" })
    expect(fastPass).toBeChecked()
    // Two update days, 3 ahead: free after ceil(3 × 7 ÷ 2) = 11 days.
    expect(screen.getByText(/free for everyone 11 days after release/)).toBeInTheDocument()
    expect(screen.getByLabelText("How many episodes ahead")).toHaveAttribute("data-value", "3")
    const save = screen.getByRole("button", { name: "Save Fast Pass settings" })
    expect(save).toBeDisabled()

    await selectOption(user, screen.getByLabelText("How many episodes ahead"), "5")
    expect(screen.getByText(/free for everyone 18 days after release/)).toBeInTheDocument()
    await user.click(save)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Fast Pass: 5 episodes ahead"))
    expect(puts).toEqual([{ ...unchanged, fastPass: { on: true, ahead: 5 } }])
  })

  it("Fast Pass tab: turning it off is saved too, and a failed save says so", async () => {
    signIn()
    setSearch("tab=fast-pass")
    const puts = serveLive(live())
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await user.click(await screen.findByRole("switch", { name: "Fast Pass" }))
    await user.click(screen.getByRole("button", { name: "Save Fast Pass settings" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Fast Pass turned off"))
    expect(puts).toEqual([{ ...unchanged, fastPass: { on: false, ahead: 3 } }])

    server.use(http.put(`${API}/creator/series/s1`, () => apiError(500, "internal_error")))
    await user.click(await screen.findByRole("switch", { name: "Fast Pass" }))
    await user.click(screen.getByRole("button", { name: "Save Fast Pass settings" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "Save Fast Pass settings" })).toBeEnabled()
  })

  it("Settings: the comments switch starts from the series and is saved at once", async () => {
    signIn()
    setSearch("tab=settings")
    const puts = serveLive(live({ commentsEnabled: false }))
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    const comments = await screen.findByRole("switch", { name: "Allow comments" })
    expect(comments).not.toBeChecked()
    await user.click(comments)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Comments turned on"))
    expect(puts).toEqual([{ ...unchanged, commentsEnabled: true }])
  })

  it("Settings: a comments switch the API refuses goes back", async () => {
    signIn()
    setSearch("tab=settings")
    serveLive(live())
    server.use(http.put(`${API}/creator/series/s1`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    const comments = await screen.findByRole("switch", { name: "Allow comments" })
    expect(comments).toBeChecked()
    await user.click(comments)
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByRole("switch", { name: "Allow comments" })).toBeChecked()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe("ManageSeriesPage: hide / show one episode and delete the series (real API)", () => {
  it("Hide calls the API, Show puts a hidden episode back, and an admin's takedown has no Show", async () => {
    signIn()
    const calls: string[] = []
    serveLive(live({ status: "ongoing", breakMessage: null }), [
      episode(1),
      episode(2, { hiddenAt: "2026-11-05T03:00:00Z" }),
      episode(3, { status: "hidden" }),
    ])
    server.use(
      http.post(`${API}/creator/series/s1/episodes/:n/hide`, ({ params }) => {
        calls.push(`hide ${String(params.n)}`)
        return HttpResponse.json(episode(Number(params.n), { hiddenAt: "2026-11-11T03:00:00Z" }))
      }),
      http.post(`${API}/creator/series/s1/episodes/:n/show`, ({ params }) => {
        calls.push(`show ${String(params.n)}`)
        return HttpResponse.json(episode(Number(params.n)))
      }),
    )
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByText("Hidden from readers since Nov 5")).toBeInTheDocument()
    expect(screen.getByText("Taken down by PhumiReader")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Show episode 3" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hide episode 1" }))
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Hide episode" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Episode 1 hidden"))
    expect(screen.getByRole("button", { name: "Show episode 1" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show episode 2" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Episode 2 is visible again"))
    expect(screen.getByRole("button", { name: "Hide episode 2" })).toBeInTheDocument()
    expect(calls).toEqual(["hide 1", "show 2"])
  })

  it("explains a Show the API refuses because an admin took the episode down", async () => {
    signIn()
    serveLive(live({ status: "ongoing", breakMessage: null }), [episode(2, { hiddenAt: "2026-11-05T03:00:00Z" })])
    server.use(http.post(`${API}/creator/series/s1/episodes/2/show`, () => apiError(409, "episode_hidden")))
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await user.click(await screen.findByRole("button", { name: "Show episode 2" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("PhumiReader took this down. Contact creator support to show it again."))
  })

  it("Delete series calls DELETE and goes back to the dashboard", async () => {
    signIn()
    setSearch("tab=settings")
    let deleted = false
    serveLive(live({ visibility: "draft", status: "ongoing", breakMessage: null }), [episode(1, { status: "draft", publishedAt: null })])
    server.use(
      http.delete(`${API}/creator/series/s1`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByText("Deletes the series and all drafts. This can’t be undone.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete series" }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText("Delete Lantern Ferry?")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Delete series" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/creator"))
    expect(deleted).toBe(true)
    expect(toast.success).toHaveBeenCalledWith("Series deleted")
  })

  it("Delete stays blocked once an episode was published, also a hidden one", async () => {
    signIn()
    setSearch("tab=settings")
    serveLive(live({ status: "ongoing", breakMessage: null }), [episode(1, { hiddenAt: "2026-11-05T03:00:00Z" })])
    renderUi(<ManageSeriesPage id="s1" />)
    expect(await screen.findByText(/Series with published episodes can’t be deleted/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete series" })).toBeDisabled()
  })

  it("explains a Delete the API refuses (an episode came out meanwhile) and stays on the page", async () => {
    signIn()
    setSearch("tab=settings")
    serveLive(live({ visibility: "draft", status: "ongoing", breakMessage: null }), [episode(1, { status: "scheduled", publishedAt: "2026-11-20T11:00:00Z" })])
    server.use(http.delete(`${API}/creator/series/s1`, () => apiError(409, "has_published_episodes")))
    const { user } = renderUi(<ManageSeriesPage id="s1" />)
    await user.click(await screen.findByRole("button", { name: "Delete series" }))
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete series" }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This series has published episodes or chapters, so it can’t be deleted. Hide it instead.")
    )
    expect(router.push).not.toHaveBeenCalled()
  })
})
