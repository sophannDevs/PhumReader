import { describe, expect, it } from "vitest"
import { useAppStore } from "@/lib/store"
import { SearchPage } from "@/components/pr/search-page"
import { setSearch } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const card = (id: string, title: string) => ({
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
})
const results = (...titles: string[]) => http.get(`${API}/search`, () => HttpResponse.json({ items: titles.map((t, i) => card(`s${i}`, t)) }))

const BOX = "Search series, creators and genres"

describe("SearchPage", () => {
  it("shows every update day of a series: 'Every Mon and Thu' and the hook's full names (V21-02)", async () => {
    setSearch("q=tide")
    server.use(
      http.get(`${API}/search`, () =>
        HttpResponse.json({ items: [{ ...card("a", "Lantern Tide"), updateDay: "Mon", updateDays: ["Mon", "Thu"] }] }),
      ),
    )
    renderUi(<SearchPage />)
    expect(await screen.findByText("Every Mon and Thu")).toBeInTheDocument()
    expect(screen.getByText("An ongoing fantasy story, new every Monday and Thursday.")).toBeInTheDocument()
  })

  it("fills the box from the address, asks the API for that text and shows the matches", async () => {
    setSearch("q=ink")
    let asked = ""
    server.use(
      http.get(`${API}/search`, ({ request }) => {
        asked = new URL(request.url).searchParams.get("q") ?? ""
        return HttpResponse.json({ items: [card("a", "Ink Witch")] })
      }),
    )
    renderUi(<SearchPage />)
    expect(screen.getByRole("searchbox", { name: BOX })).toHaveValue("ink")
    expect(await screen.findByText("1 result")).toBeInTheDocument()
    expect(screen.getByText("for “ink”")).toBeInTheDocument()
    expect(asked).toBe("ink")
    expect(screen.getAllByText(/Witch/).length).toBeGreaterThan(0)
  })

  it("saves a search that arrives in the address as a recent search", async () => {
    setSearch("q=ink")
    server.use(results("Ink Witch"))
    renderUi(<SearchPage />)
    await screen.findByText("1 result")
    expect(useAppStore.getState().recentSearches).toContain("ink")
  })

  it("without a query shows trending searches and genres, and does not ask the API", () => {
    let called = false
    server.use(
      http.get(`${API}/search`, () => {
        called = true
        return HttpResponse.json({ items: [] })
      }),
    )
    renderUi(<SearchPage />)
    expect(screen.getByRole("heading", { name: "Trending searches" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Browse by genre" })).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it("lists recent searches and clears them", async () => {
    useAppStore.setState({ recentSearches: ["glass compass"] })
    const { user } = renderUi(<SearchPage />)
    expect(await screen.findByRole("heading", { name: "Recent searches" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear all" }))
    expect(useAppStore.getState().recentSearches).toEqual([])
  })

  it("shows skeleton rows while it loads", () => {
    setSearch("q=ink")
    server.use(http.get(`${API}/search`, () => new Promise(() => undefined)))
    renderUi(<SearchPage />)
    expect(screen.getByRole("status", { name: "Loading results" })).toBeInTheDocument()
    expect(screen.getByText("Searching…")).toBeInTheDocument()
  })

  it("shows the no-results state with a hint when nothing matches", async () => {
    setSearch("q=zzzzzzzzzzzz")
    server.use(results())
    renderUi(<SearchPage />)
    expect(await screen.findByText("No results for “zzzzzzzzzzzz”")).toBeInTheDocument()
    expect(screen.getByText("Check the spelling, try a shorter word, or search by creator or genre.")).toBeInTheDocument()
  })

  it("shows the error state and Try again loads the results", async () => {
    setSearch("q=ink")
    server.use(http.get(`${API}/search`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SearchPage />)
    expect(await screen.findByText("Search isn’t working right now")).toBeInTheDocument()
    server.use(results("Ink Witch"))
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("1 result")).toBeInTheDocument()
  })

  it("searching with Enter writes the trimmed text to the address and an empty box removes it", async () => {
    server.use(results("Ink Witch"))
    const { user } = renderUi(<SearchPage />)
    await user.type(screen.getByRole("searchbox", { name: BOX }), "  sea light {Enter}")
    expect(window.location.search).toBe("?q=sea+light")
    expect(useAppStore.getState().recentSearches).toContain("sea light")
    await user.clear(screen.getByRole("searchbox", { name: BOX }))
    await user.keyboard("{Enter}")
    expect(window.location.search).toBe("")
  })

  it("filters the matches into tabs with counts", async () => {
    setSearch("q=a")
    server.use(http.get(`${API}/search`, () => HttpResponse.json({ items: [card("a", "Alpha"), { ...card("b", "Beta"), type: "novel" }] })))
    const { user } = renderUi(<SearchPage />)
    await screen.findByText(/results?$/)
    await user.click(screen.getByRole("tab", { name: /Web novels/ }))
    expect(await screen.findByText("1 web novel")).toBeInTheDocument()
  })
})
