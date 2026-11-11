import { beforeEach, describe, expect, it, vi } from "vitest"
import { UploadEpisodePage } from "@/components/pr/upload-episode-page"
import { onOrAfter } from "@/lib/creator-studio"
import { addDays, formatShortDate, ictDate, weekdayOf } from "@/lib/format"
import { useAppStore } from "@/lib/store"
import { setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/**
 * Upload episode in real mode (V21-02): a new chapter starts from the series' next update day, release hour and Fast
 * Pass switch, and one left at the series' Fast Pass takes it from the series (`useSeriesFastPass`).
 */

const card = {
  id: "s1",
  slug: "night-market",
  title: "Night Market",
  type: "novel",
  genre: "Drama",
  creator: "Sokha",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 0,
  fastPassEpisodes: 0,
  totalEpisodes: 0,
  status: "ongoing",
  updateDay: "Mon",
  updateDays: ["Mon", "Thu"],
  language: ["km"],
  ageRating: "all",
  badges: { isNew: false, up: false },
}
const edit = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  slug: "night-market",
  title: "Night Market",
  type: "novel",
  genre: "drama",
  secondGenre: null,
  languages: ["km"],
  summary: "Stalls open at dusk in Phnom Penh, and one of them sells memories instead of noodles.",
  tags: [],
  ageRating: "all",
  status: "ongoing",
  breakMessage: null,
  updateDays: ["Mon", "Thu"],
  releaseHour: 20,
  fastPass: { on: true, ahead: 3 },
  commentsEnabled: true,
  coverUrl: "/covers/x.svg",
  bannerUrl: null,
  visibility: "published",
  review: null,
  ...over,
})
const dashboard = { creator: true, name: "Sokha", series: [], totals: { views: 0, likes: 0, earnedCoins: 0 } }
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com", roles: ["READER", "CREATOR"] })

/** Serves the creator's one series; the new chapter's body is handed to `onCreate`. */
function serve(series: object, onCreate: (body: Record<string, unknown>) => void) {
  setSearch("series=s1")
  server.use(
    http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard)),
    http.get(`${API}/creator/series`, () => HttpResponse.json([{ series: card, visibility: "published", subscribers: 0, comments: 0, review: null }])),
    http.get(`${API}/creator/series/s1`, () => HttpResponse.json(series)),
    http.get(`${API}/creator/series/s1/episodes`, () => HttpResponse.json([])),
    http.post(`${API}/creator/series/s1/episodes`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      onCreate(body)
      const publish = body.publish as { mode: string; at?: string }
      return HttpResponse.json(
        { number: 1, title: body.title, status: publish.mode, publishedAt: publish.at ?? null, panels: [], blocks: [], commentsEnabled: true },
        { status: 201 },
      )
    }),
  )
}

/** "Mon, Nov 23" as the form shows a date. */
const dayDate = (iso: string) => `${weekdayOf(iso)}, ${formatShortDate(iso, "en")}`
/** The first Monday or Thursday from tomorrow (ICT): the date the form starts with. */
const nextUpdate = () => {
  const tomorrow = addDays(ictDate(Date.now()), 1)
  return [onOrAfter("Mon", tomorrow), onOrAfter("Thu", tomorrow)].sort()[0]
}

async function fillChapter(user: ReturnType<typeof renderUi>["user"]) {
  await user.type(await screen.findByLabelText(/Chapter title/), "The Memory Stall")
  await user.click(screen.getByLabelText("Chapter text"))
  await user.paste("word ".repeat(320))
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

describe("UploadEpisodePage: defaults from the series (real API)", () => {
  it("starts on the next update day at the series' release hour with its Fast Pass, and sends useSeriesFastPass", async () => {
    signIn()
    let body: Record<string, unknown> | undefined
    serve(edit(), (b) => (body = b))
    const { user } = renderUi(<UploadEpisodePage />)
    const date = nextUpdate()
    expect(await screen.findByLabelText("Date")).toHaveValue(date)
    expect(screen.getByLabelText("Time (ICT)")).toHaveValue("20")
    expect(screen.getByRole("switch", { name: "Fast Pass" })).toBeChecked()
    // Two update days, 3 ahead: free after ceil(3 × 7 ÷ 2) = 11 days, the same rule the API uses.
    expect(screen.getByText(`Readers pay 5 coins to read early. Free for everyone on ${dayDate(addDays(date, 11))}.`)).toBeInTheDocument()

    await fillChapter(user)
    await user.click(screen.getByRole("button", { name: `Schedule for ${dayDate(date)}` }))
    expect(await screen.findByRole("heading", { name: "Chapter 1 is scheduled" })).toBeInTheDocument()
    expect(body?.useSeriesFastPass).toBe(true)
    expect(body?.fastPass).toBeUndefined()
    // 8:00 PM in Cambodia is 13:00 UTC.
    expect(body?.publish).toEqual({ mode: "scheduled", at: `${date}T13:00:00.000Z` })
  })

  it("a series with Fast Pass off starts with the switch off; turning it on sends 5 coins and the series' days", async () => {
    signIn()
    let body: Record<string, unknown> | undefined
    serve(edit({ fastPass: { on: false, ahead: 2 }, releaseHour: 12 }), (b) => (body = b))
    const { user } = renderUi(<UploadEpisodePage />)
    const fastPass = await screen.findByRole("switch", { name: "Fast Pass" })
    expect(fastPass).not.toBeChecked()
    expect(screen.getByText("Free for everyone when it’s released.")).toBeInTheDocument()
    expect(screen.getByLabelText("Time (ICT)")).toHaveValue("12")

    await user.click(fastPass)
    await fillChapter(user)
    await user.click(screen.getByRole("button", { name: /^Schedule for / }))
    await waitFor(() => expect(body).toBeDefined())
    // Two update days, 2 ahead: ceil(2 × 7 ÷ 2) = 7 days.
    expect(body?.fastPass).toEqual({ priceCoins: 5, freeAfterDays: 7 })
    expect(body?.useSeriesFastPass).toBeNull()
  })

  it("Publish now with the switch left as the series has it (off) is a free chapter from the series", async () => {
    signIn()
    let body: Record<string, unknown> | undefined
    serve(edit({ fastPass: { on: false, ahead: 3 } }), (b) => (body = b))
    const { user } = renderUi(<UploadEpisodePage />)
    await user.click(await screen.findByRole("radio", { name: /Publish now/ }))
    await fillChapter(user)
    await user.click(screen.getByRole("button", { name: "Publish chapter" }))
    await waitFor(() => expect(body).toBeDefined())
    expect(body?.useSeriesFastPass).toBe(true)
    expect(body?.fastPass).toBeUndefined()
    expect(body?.publish).toEqual({ mode: "now" })
  })
})
