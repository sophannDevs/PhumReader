import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { EpisodeForm, type EpisodeSeries } from "@/components/pr/episode-form"
import type { EpisodeEdit } from "@/lib/api/creator"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

vi.mock("@/lib/actions/revalidate", () => ({ revalidateCatalogTags: vi.fn().mockResolvedValue(undefined) }))

const SID = "22222222-2222-2222-2222-222222222222"
const comic: EpisodeSeries = { id: SID, slug: "sea-light", title: "Sea Light", type: "comic", visibility: "published" }
const novel: EpisodeSeries = { ...comic, type: "novel" }
const PANEL_ID = "33333333-3333-3333-3333-333333333333"

const edit = (over: Partial<EpisodeEdit> = {}): EpisodeEdit => ({
  number: 3,
  title: "The Door",
  status: "draft",
  commentsEnabled: true,
  creatorNote: null,
  priceCoins: null,
  freeAfterDays: null,
  publishedAt: null,
  thumbnailUrl: null,
  wordCount: 0,
  panels: [{ uploadId: PANEL_ID, url: "http://localhost:9000/p1.webp", width: 800, height: 1200 }],
  blocks: [],
  ...over,
})

function setup(props: Partial<React.ComponentProps<typeof EpisodeForm>> = {}) {
  const onAnother = vi.fn()
  const view = renderUi(<EpisodeForm series={comic} nextNumber={4} onAnother={onAnother} {...props} />)
  return { ...view, onAnother }
}
type User = ReturnType<typeof setup>["user"]
const draft = () => screen.getByRole("button", { name: "Save draft" })
const publishNow = () => screen.getByRole("button", { name: "Publish now" })

const captureCreate = (response: Partial<EpisodeEdit> = {}) => {
  const captured: { body: Record<string, unknown> } = { body: {} }
  server.use(
    http.post(`${API}/creator/series/${SID}/episodes`, async ({ request }) => {
      captured.body = (await request.json()) as typeof captured.body
      return HttpResponse.json(edit({ number: 4, ...response }), { status: 201 })
    }),
  )
  return captured
}
const typeTitle = (user: User, value = "The Door") => user.type(screen.getByLabelText("Title"), value)

describe("EpisodeForm: the page", () => {
  it("asks for an episode number with a hint, and a title with a counter", async () => {
    const { user } = setup()
    expect(screen.getByLabelText("Number")).toHaveAttribute("placeholder", "4")
    expect(screen.getByText("Leave empty for 4.")).toBeInTheDocument()
    await typeTitle(user, "Door")
    expect(screen.getByText("4/120")).toBeInTheDocument()
  })

  it("warns when the series is still a draft and links to it", () => {
    setup({ series: { ...comic, visibility: "draft" } })
    expect(screen.getByText("Your series is still a draft")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open the series" })).toHaveAttribute("href", `/creator/series/${SID}/edit`)
  })

  it("says Chapter and shows the text editor for a web novel", () => {
    setup({ series: novel })
    expect(screen.getByRole("group", { name: "Chapter" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Chapter text blocks" })).toBeInTheDocument()
  })
})

describe("EpisodeForm: validation", () => {
  it("needs a title", async () => {
    const { user } = setup()
    await user.click(draft())
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument()
  })

  it.each(["0", "abc", "12.5", "-1", "1234567"])("rejects the number %s", async (value) => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Number"), value)
    await typeTitle(user)
    await user.click(draft())
    expect(await screen.findByText("Use a whole number from 1.")).toBeInTheDocument()
  })

  it("Fast Pass needs a price from 3 to 10 and 1 to 90 free days", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("radio", { name: /Fast Pass/ }))
    const price = screen.getByLabelText("Price (coins)")
    const days = screen.getByLabelText("Free after (days)")
    expect(price).toHaveValue("5")
    expect(days).toHaveValue("7")
    await user.clear(price)
    await user.type(price, "2")
    await user.clear(days)
    await user.type(days, "91")
    await typeTitle(user)
    await user.click(draft())
    expect(await screen.findByText("Choose a price from 3 to 10 coins.")).toBeInTheDocument()
    expect(screen.getByText("Choose from 1 to 90 days.")).toBeInTheDocument()
    await user.clear(price)
    await user.type(price, "11")
    await user.click(draft())
    expect(await screen.findByText("Choose a price from 3 to 10 coins.")).toBeInTheDocument()
  })

  it("hides the Fast Pass fields for a free episode", () => {
    setup()
    expect(screen.getByRole("radio", { name: /Free/ })).toBeChecked()
    expect(screen.queryByLabelText("Price (coins)")).not.toBeInTheDocument()
  })

  it("publishing a comic needs at least one panel, but a draft does not", async () => {
    const created = captureCreate({ status: "draft" })
    const { user } = setup()
    await typeTitle(user)
    await user.click(publishNow())
    expect(await screen.findByText("Add at least one panel.")).toBeInTheDocument()
    expect(created.body).toEqual({})
    await user.click(draft())
    expect(await screen.findByText("Draft saved")).toBeInTheDocument()
  })

  it("publishing a chapter needs text, but a draft does not", async () => {
    const created = captureCreate({ status: "draft" })
    const { user } = setup({ series: novel })
    await typeTitle(user, "Chapter 4")
    await user.click(publishNow())
    expect(await screen.findByText("Write the chapter first.")).toBeInTheDocument()
    expect(created.body).toEqual({})
    await user.click(draft())
    expect(await screen.findByText("Draft saved")).toBeInTheDocument()
  })

  it("scheduling needs a time, and not one in the past", async () => {
    const { user } = setup({ initial: undefined })
    await user.click(screen.getByRole("radio", { name: "Schedule for later" }))
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Publish now" })).not.toBeInTheDocument()
    await typeTitle(user)
    await user.click(screen.getByRole("button", { name: "Schedule" }))
    expect(await screen.findByText("Choose a release time.")).toBeInTheDocument()
  })

  it("shows the notes counter and keeps the note to 1000 characters", () => {
    setup()
    expect(screen.getByText("0/1000")).toBeInTheDocument()
    expect(screen.getByLabelText("Creator's note")).toHaveAttribute("maxlength", "1000")
  })
})

describe("EpisodeForm: saving a comic episode", () => {
  const withPanel = () => ({ initial: undefined as EpisodeEdit | undefined })

  it("saves a draft: the number left empty becomes null, nothing is published", async () => {
    const created = captureCreate({ status: "draft" })
    const { user } = setup(withPanel())
    await typeTitle(user, "  The Door  ")
    await user.click(draft())
    expect(await screen.findByText("Draft saved")).toBeInTheDocument()
    expect(created.body).toMatchObject({ title: "The Door", number: null, commentsEnabled: true, publish: { mode: "draft" }, imageUploadIds: [], blocks: null })
    expect(created.body.fastPass).toBeUndefined()
    expect(screen.getByText("Only you can see it. Open it again to finish and publish.")).toBeInTheDocument()
  })

  it("sends the typed number, the note, comments off and the Fast Pass terms", async () => {
    const created = captureCreate({ status: "draft" })
    const { user } = setup()
    await user.type(screen.getByLabelText("Number"), "7")
    await typeTitle(user)
    await user.type(screen.getByLabelText("Creator's note"), "  Thanks for reading!  ")
    await user.click(screen.getByRole("switch", { name: "Comments" }))
    expect(screen.getByText("Comments are turned off for this episode.")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: /Fast Pass/ }))
    await user.clear(screen.getByLabelText("Price (coins)"))
    await user.type(screen.getByLabelText("Price (coins)"), "8")
    await user.click(draft())
    await screen.findByText("Draft saved")
    expect(created.body).toMatchObject({ number: 7, creatorNote: "Thanks for reading!", commentsEnabled: false, fastPass: { priceCoins: 8, freeAfterDays: 7 } })
  })

  it("with panels, publish now goes live and links to the episode", async () => {
    const created = captureCreate({ status: "published" })
    const { user } = setup()
    // a draft with a panel already uploaded, opened for editing, is the quickest way to have one
    expect(created.body).toEqual({})
    await user.click(draft()) // title is missing: nothing is sent
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument()
  })

  it("after saving, Upload another hands the number to the page, and Back goes to My series", async () => {
    captureCreate({ status: "draft" })
    const { user, onAnother } = setup()
    await typeTitle(user)
    await user.click(draft())
    await screen.findByText("Draft saved")
    expect(screen.getByRole("link", { name: "Back to My series" })).toHaveAttribute("href", `/creator/series?notice=episode-added&series=${SID}`)
    expect(screen.getByRole("link", { name: "Edit episode" })).toHaveAttribute("href", `/creator/series/${SID}/episodes/4/edit`)
    await user.click(screen.getByRole("button", { name: "Upload another" }))
    expect(onAnother).toHaveBeenCalledWith(4)
  })
})

describe("EpisodeForm: editing", () => {
  it("fills the form, fixes the number, and shows the status", () => {
    setup({ initial: edit({ title: "The Door", creatorNote: "Hi", commentsEnabled: false }) })
    expect(screen.getByLabelText("Number")).toHaveValue("3")
    expect(screen.getByLabelText("Number")).toBeDisabled()
    expect(screen.getByText("The number cannot change.")).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveValue("The Door")
    expect(screen.getByLabelText("Creator's note")).toHaveValue("Hi")
    expect(screen.getByRole("switch", { name: "Comments" })).not.toBeChecked()
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })

  it("opens a Fast Pass episode with its price and days", () => {
    setup({ initial: edit({ priceCoins: 8, freeAfterDays: 14 }) })
    expect(screen.getByRole("radio", { name: /Fast Pass/ })).toBeChecked()
    expect(screen.getByLabelText("Price (coins)")).toHaveValue("8")
    expect(screen.getByLabelText("Free after (days)")).toHaveValue("14")
  })

  it("publishes a draft that has a panel: PUT without a number, mode now, with the saved panel", async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.put(`${API}/creator/series/${SID}/episodes/3`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(edit({ status: "published" }))
      }),
    )
    const { user } = setup({ initial: edit() })
    await user.click(publishNow())
    expect(await screen.findByText("Episode 3 is live")).toBeInTheDocument()
    expect(body.number).toBeUndefined()
    expect(body.publish).toEqual({ mode: "now" })
    expect(body.imageUploadIds).toEqual([PANEL_ID])
    expect(screen.getByText("Readers can read it now.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View episode" })).toHaveAttribute("href", "/read/sea-light/3")
  })

  it("schedules a release in Phnom Penh time and shows when it will go live", async () => {
    let body: { publish?: { mode: string; at: string } } = {}
    server.use(
      http.put(`${API}/creator/series/${SID}/episodes/3`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(edit({ status: "scheduled", publishedAt: "2099-01-01T02:30:00Z" }))
      }),
    )
    const { user } = setup({ initial: edit() })
    await user.click(screen.getByRole("radio", { name: "Schedule for later" }))
    const at = screen.getByLabelText("Release time")
    await user.type(at, "2099-01-01T09:30")
    await user.click(screen.getByRole("button", { name: "Schedule" }))
    expect(await screen.findByText("Episode 3 is scheduled")).toBeInTheDocument()
    // 09:30 in Phnom Penh (UTC+7) is 02:30 UTC
    expect(body.publish).toEqual({ mode: "scheduled", at: "2099-01-01T02:30:00.000Z" })
    expect(screen.getByText(/It will go live on .*2099.* \(Phnom Penh time\)\./)).toBeInTheDocument()
  })

  it("refuses a release time in the past without calling the API", async () => {
    const { user } = setup({ initial: edit() })
    await user.click(screen.getByRole("radio", { name: "Schedule for later" }))
    await user.type(screen.getByLabelText("Release time"), "2001-01-01T09:30")
    await user.click(screen.getByRole("button", { name: "Schedule" }))
    expect(await screen.findByText("Choose a time in the future.")).toBeInTheDocument()
  })

  it("a live episode has Save changes only, keeps going live, and can keep editing", async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.put(`${API}/creator/series/${SID}/episodes/3`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(edit({ status: "published" }))
      }),
    )
    const { user } = setup({ initial: edit({ status: "published" }) })
    expect(screen.getByText("This episode is live. Your changes show to readers as soon as you save.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Schedule for later" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await screen.findByText("Episode 3 is live")
    expect(body.publish).toEqual({ mode: "now" })
    await user.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Title")).toBeInTheDocument()
  })

  it("when the series is still a draft, a published episode says readers will see it later and offers Edit", async () => {
    server.use(http.put(`${API}/creator/series/${SID}/episodes/3`, () => HttpResponse.json(edit({ status: "published" }))))
    const { user } = setup({ initial: edit(), series: { ...comic, visibility: "draft" } })
    await user.click(publishNow())
    expect(await screen.findByText("Readers will see it once you publish the series.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "View episode" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Edit episode" })).toBeInTheDocument()
  })
})

describe("EpisodeForm: a web novel chapter", () => {
  it("publishes the written text: paragraphs are trimmed, empty ones dropped, scene breaks kept", async () => {
    const created = captureCreate({ status: "published" })
    const { user } = setup({ series: novel })
    await typeTitle(user, "Chapter 4")
    await user.type(screen.getByRole("textbox", { name: "Text of block 1" }), "  Once upon a time.  ")
    await user.click(screen.getByRole("button", { name: "Scene break" }))
    await user.click(screen.getByRole("button", { name: "Paragraph" }))
    await user.type(screen.getByRole("textbox", { name: "Text of block 3" }), "The end.")
    await user.click(publishNow())
    expect(await screen.findByText("Episode 4 is live")).toBeInTheDocument()
    expect(created.body.blocks).toEqual([{ type: "paragraph", text: "Once upon a time." }, { type: "scene-break" }, { type: "paragraph", text: "The end." }])
    expect(created.body.imageUploadIds).toBeNull()
    expect(screen.getByRole("link", { name: "View episode" })).toHaveAttribute("href", "/novel/sea-light/4")
  })
})

describe("EpisodeForm: errors from the API", () => {
  async function saveDraftWith(status: number, code: string, extra: Record<string, unknown> = {}) {
    server.use(http.post(`${API}/creator/series/${SID}/episodes`, () => apiError(status, code, extra)))
    const view = setup()
    await typeTitle(view.user)
    await view.user.click(draft())
    return view
  }

  it("shows a taken number on the number field", async () => {
    await saveDraftWith(409, "conflict", { fields: { number: "number_taken" } })
    expect(await screen.findByText("This number is already used.")).toBeInTheDocument()
  })

  it("shows the content error for an upload the server rejects", async () => {
    await saveDraftWith(400, "validation_failed", { fields: { imageUploadIds: "upload_not_ready" } })
    expect(await screen.findByText("A panel has not finished uploading.")).toBeInTheDocument()
  })

  it("asks to upload the thumbnail again", async () => {
    await saveDraftWith(400, "validation_failed", { fields: { thumbnailUploadId: "invalid" } })
    expect(await screen.findByText("Upload the thumbnail again.")).toBeInTheDocument()
  })

  it("explains that a published episode cannot go back to a draft", async () => {
    await saveDraftWith(409, "episode_published")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A published episode cannot go back to a draft."))
  })

  it("tells the wait on a rate limit and shows the generic error for a failure", async () => {
    const { user } = await saveDraftWith(429, "too_many_requests", { retryAfterSeconds: 45 })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 45 seconds." })))
    server.use(http.post(`${API}/creator/series/${SID}/episodes`, () => apiError(500, "internal_error")))
    await user.click(draft())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument()
  })
})

describe("EpisodeForm: the preview dialog", () => {
  it("opens with the episode number and title, shows the panels, and closes three ways", async () => {
    const { user } = setup({ initial: edit() })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Preview" }))
    const dialog = await screen.findByRole("dialog", { name: "Preview" })
    expect(within(dialog).getByText("Episode 3")).toBeInTheDocument()
    expect(within(dialog).getByRole("heading", { name: "The Door" })).toBeInTheDocument()
    expect(within(dialog).getByRole("img", { name: "Panel 1" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Preview" }))
    await user.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Preview" })).toHaveFocus()
  })

  it("says Untitled and no panels for an empty comic", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Preview" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Untitled" })).toBeInTheDocument()
    expect(within(dialog).getByText("No panels yet.")).toBeInTheDocument()
    expect(within(dialog).getByText("Episode 4")).toBeInTheDocument()
  })

  it("shows the written chapter with a word count for a novel", async () => {
    const { user } = setup({ series: novel })
    await user.type(screen.getByRole("textbox", { name: "Text of block 1" }), "One two three")
    await user.click(screen.getByRole("button", { name: "Preview" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("One two three")).toBeInTheDocument()
    expect(within(dialog).getByText("3 words")).toBeInTheDocument()
  })

  it("says nothing is written yet for an empty chapter", async () => {
    const { user } = setup({ series: novel })
    await user.click(screen.getByRole("button", { name: "Preview" }))
    expect(await screen.findByText("Nothing written yet.")).toBeInTheDocument()
  })
})
