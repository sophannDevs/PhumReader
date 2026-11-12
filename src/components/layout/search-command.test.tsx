import { useState } from "react"
import { describe, expect, it } from "vitest"
import { SearchCommand } from "@/components/layout/search-command"
import { router } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/** The ⌘K search on the real API (Vitest runs in real mode): GET /search. The demo catalogue is covered by e2e/pages.spec.ts. */

const card = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  type: "comic",
  genre: "Fantasy",
  creator: "Mei Tanaka",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 1,
  fastPassEpisodes: 0,
  totalEpisodes: 1,
  status: "ongoing",
  updateDay: null,
  updateDays: [],
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
  ...over,
})
const POPULAR = ["Sea Light", "River Lantern", "Ink Witch", "Glass Compass", "Sunday Sword", "Tiny Dragon"].map((t, i) => card(`p${i}`, t))

type Asked = { q: string; limit: string }
/** Popular series for an empty query, `found` for any other; records what was asked. */
function serveSearch(found: object[] = [card("g", "Glass Compass", { creator: "Owen Blake" })]) {
  const asked: Asked[] = []
  server.use(
    http.get(`${API}/search`, ({ request }) => {
      const url = new URL(request.url)
      const q = url.searchParams.get("q") ?? ""
      asked.push({ q, limit: url.searchParams.get("limit") ?? "" })
      return HttpResponse.json({ items: q ? found : POPULAR })
    }),
  )
  return asked
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open search</button>
      <SearchCommand open={open} onOpenChange={setOpen} />
    </>
  )
}

async function open() {
  const view = renderUi(<Harness />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await view.user.click(screen.getByRole("button", { name: "Open search" }))
  await screen.findByRole("dialog", { name: "Search" })
  return view
}
const results = () => within(screen.getByRole("listbox")).queryAllByRole("option")
const BOX = "Search series, creators…"
/** The popular list stays on screen during the 250 ms pause (keepPrevious); wait until the typed text's answer replaces it. */
const answered = (count: number) => waitFor(() => expect(results()).toHaveLength(count))

describe("SearchCommand: open and close", () => {
  it("opens with the search box focused and the API's popular series (6) under Popular now", async () => {
    const asked = serveSearch()
    await open()
    expect(screen.getByPlaceholderText(BOX)).toHaveFocus()
    expect(screen.getByText("Popular now")).toBeInTheDocument()
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
    expect(results()).toHaveLength(6)
    expect(asked).toEqual([{ q: "", limit: "6" }])
  })

  it("does not ask the API while it is closed", async () => {
    const asked = serveSearch()
    renderUi(<Harness />)
    await pause(300)
    expect(asked).toEqual([])
  })

  it("is described for screen readers", async () => {
    serveSearch()
    await open()
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Search series by title, creator or genre.")
  })

  it("closes with Escape and gives the focus back to the opener", async () => {
    serveSearch()
    const { user } = await open()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open search" })).toHaveFocus()
  })

  it("forgets the query when it is closed and opened again", async () => {
    serveSearch()
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "glass")
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Open search" }))
    expect(await screen.findByPlaceholderText(BOX)).toHaveValue("")
  })
})

describe("SearchCommand: searching", () => {
  it("asks the API for the typed text (8 at most) once typing stops, and lists the matches with See all", async () => {
    const asked = serveSearch()
    const { user } = await open()
    await screen.findByText("Sea Light")
    await user.type(screen.getByPlaceholderText(BOX), "glass comp")
    expect(screen.getByText("Series")).toBeInTheDocument()
    await screen.findByText(/See all results/)
    await answered(2)
    expect(results().map((r) => r.textContent)).toEqual([expect.stringContaining("Glass Compass"), expect.stringContaining("See all results")])
    // One request for the whole text, after the pause (not one per letter).
    expect(asked).toEqual([
      { q: "", limit: "6" },
      { q: "glass comp", limit: "8" },
    ])
  })

  it("keeps the last results on screen while the next ones load", async () => {
    serveSearch()
    const { user } = await open()
    await screen.findByText("Sea Light")
    server.use(http.get(`${API}/search`, () => new Promise(() => undefined)))
    await user.type(screen.getByPlaceholderText(BOX), "x")
    await pause(400)
    expect(screen.getByText("Sea Light")).toBeInTheDocument()
    expect(screen.queryByText("Searching…")).not.toBeInTheDocument()
  })

  it("says it is searching while the first answer loads, in a polite live region outside the list", async () => {
    server.use(http.get(`${API}/search`, () => new Promise(() => undefined)))
    await open()
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Searching…")
    expect(status).toHaveAttribute("aria-live", "polite")
    // A listbox holds options only.
    expect(within(screen.getByRole("listbox")).queryByText("Searching…")).not.toBeInTheDocument()
    expect(screen.queryByText("No results. Try a title, creator or genre.")).not.toBeInTheDocument()
    expect(results()).toHaveLength(0)
  })

  it("empties the live region once the results are in", async () => {
    serveSearch()
    await open()
    await screen.findByText("Sea Light")
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("shows the empty message when nothing matches, without a See all row", async () => {
    serveSearch([])
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "zzzzqqq")
    expect(await screen.findByText("No results. Try a title, creator or genre.")).toBeInTheDocument()
    expect(screen.queryByText(/See all results/)).not.toBeInTheDocument()
  })

  it("says search is not working when the API fails, as an alert outside the list", async () => {
    server.use(http.get(`${API}/search`, () => apiError(500, "internal_error")))
    await open()
    expect(await screen.findByRole("alert")).toHaveTextContent("Search isn’t working right now")
    expect(within(screen.getByRole("listbox")).queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText("No results. Try a title, creator or genre.")).not.toBeInTheDocument()
  })

  it("treats a query of only spaces as empty", async () => {
    const asked = serveSearch()
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "   ")
    expect(screen.getByText("Popular now")).toBeInTheDocument()
    await pause(400)
    expect(asked.every((a) => a.q === "")).toBe(true)
  })
})

describe("SearchCommand: choosing", () => {
  it("opens the series page on click and closes", async () => {
    serveSearch()
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "glass comp")
    await screen.findByText(/See all results/)
    await user.click(screen.getByText("Glass Compass"))
    expect(router.push).toHaveBeenCalledWith("/series/glass-compass")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("chooses with Enter", async () => {
    serveSearch([card("i", "Ink Witch")])
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "ink witch")
    await screen.findByText(/See all results/)
    await answered(2)
    // The highlight moved to the new first result by itself, so Enter needs no arrow key first.
    expect(results()[0]).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{Enter}")
    expect(router.push).toHaveBeenCalledWith("/series/ink-witch")
  })

  it("moves down to the See all row and opens the search page with the encoded query", async () => {
    serveSearch()
    const { user } = await open()
    await user.type(screen.getByPlaceholderText(BOX), "glass comp")
    await screen.findByText(/See all results/)
    await answered(2)
    await user.keyboard("{ArrowDown}{Enter}")
    expect(router.push).toHaveBeenCalledWith("/search?q=glass%20comp")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
