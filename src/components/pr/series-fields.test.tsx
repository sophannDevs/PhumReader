import { describe, expect, it } from "vitest"
import { SeriesAbout } from "@/components/pr/series-about"
import { SeriesHero } from "@/components/pr/series-hero"
import { toSeriesDetail } from "@/lib/api/catalog"
import type { Schemas } from "@/lib/api/client"
import { renderUi, screen } from "@/test/render"

/**
 * The series page with the V21-02 fields from the API (real mode): several update days, "On break" with the creator's
 * message, the second genre and the age as a number. Signed out, so the hero needs no other API call.
 */

const card = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  slug: "ink-witch",
  title: "Ink Witch",
  type: "comic",
  genre: "Fantasy",
  creator: "Mei Tanaka",
  cover: "/covers/x.svg",
  views: 1200,
  likes: 300,
  freeEpisodes: 2,
  fastPassEpisodes: 1,
  totalEpisodes: 3,
  status: "ongoing",
  updateDay: "Mon",
  updateDays: ["Mon", "Thu"],
  language: ["en", "km"],
  ageRating: "all",
  badges: { isNew: false, up: false },
  ...over,
})
const detail = (cardOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
  toSeriesDetail({
    series: card(cardOver),
    synopsis: "A witch who draws her spells.",
    stats: { subscribers: 10, comments: 0 },
    related: [],
    creatorSeriesCount: 1,
    creatorId: "c1",
    creatorHandle: "c1",
    secondGenre: null,
    breakMessage: null,
    commentsEnabled: true,
    ...over,
  } as Schemas["SeriesDetail"])

function renderPage(d: ReturnType<typeof detail>, locale: "en" | "km" = "en") {
  return renderUi(
    <>
      <SeriesHero series={d.series} synopsis={d.synopsis} stats={d.stats} secondGenre={d.secondGenre} breakMessage={d.breakMessage} />
      <SeriesAbout series={d.series} synopsis={d.synopsis} secondGenre={d.secondGenre} />
    </>,
    { locale },
  )
}
/** The About tab's value for a details row ("Schedule", "Status", …). */
const row = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling

describe("Series page: V21-02 fields from the API", () => {
  it("shows every update day: 'Every Mon and Thu' in the hero and About, and the full names in the sentence", () => {
    renderPage(detail())
    expect(screen.getAllByText("Every Mon and Thu")).toHaveLength(2)
    expect(row("Schedule")).toHaveTextContent("Every Mon and Thu")
    expect(screen.getByText(/New episodes every Monday and Thursday\./)).toBeInTheDocument()
  })

  it("lists three days with commas", () => {
    renderPage(detail({ updateDay: "Mon", updateDays: ["Mon", "Wed", "Fri"] }))
    expect(row("Schedule")).toHaveTextContent("Every Mon, Wed and Fri")
  })

  it("says the days in Khmer", () => {
    renderPage(detail(), "km")
    expect(screen.getAllByText("រៀងរាល់ថ្ងៃច័ន្ទ និងថ្ងៃព្រហស្បតិ៍").length).toBeGreaterThan(0)
  })

  it("a series on hiatus shows On break and the creator's message, without 'New episodes every …'", () => {
    renderPage(detail({ status: "hiatus" }, { breakMessage: "Back on Dec 6 with season 2!" }))
    expect(screen.getByText("On break", { selector: "[data-slot=badge]" })).toBeInTheDocument()
    expect(screen.getByText("On break: Back on Dec 6 with season 2!")).toBeInTheDocument()
    expect(row("Status")).toHaveTextContent("On break")
    expect(screen.queryByText("Ongoing")).not.toBeInTheDocument()
    expect(screen.queryByText(/New episodes every/)).not.toBeInTheDocument()
  })

  it("an ongoing series keeps no break message, even if one was sent", () => {
    renderPage(detail({}, { breakMessage: "Old message" }))
    expect(screen.queryByText(/Old message/)).not.toBeInTheDocument()
    expect(row("Status")).toHaveTextContent("Ongoing")
  })

  it.each([
    ["all", "All ages"],
    ["teen", "13+"],
    ["teen16", "16+"],
    ["mature", "18+"],
  ])("shows the age rating %s as %s", (ageRating, text) => {
    renderPage(detail({ ageRating }))
    expect(row("Age rating")).toHaveTextContent(text)
  })

  it("shows 16+ with Khmer digits in Khmer", () => {
    renderPage(detail({ ageRating: "teen16" }), "km")
    expect(row("កម្រិតអាយុ")).toHaveTextContent("១៦+")
  })

  it("shows the second genre as a badge, in the Genre row and as a tag", () => {
    renderPage(detail({}, { secondGenre: "slice-of-life" }))
    expect(screen.getByText("Slice of life", { selector: "[data-slot=badge]" })).toBeInTheDocument()
    expect(row("Genre")).toHaveTextContent("Fantasy, Slice of life")
    expect(screen.getByText("#sliceoflife")).toBeInTheDocument()
  })

  it("passes the comments switch on", () => {
    expect(detail().commentsEnabled).toBe(true)
    expect(detail({}, { commentsEnabled: false }).commentsEnabled).toBe(false)
  })
})
