import { describe, expect, it } from "vitest"
import { SearchPage } from "@/components/pr/search-page"
import { router, setSearch } from "@/test/navigation"
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
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
})
const results = (...titles: string[]) => http.get(`${API}/search`, () => HttpResponse.json({ items: titles.map((t, i) => card(`s${i}`, t)) }))

describe("SearchPage", () => {
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
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("ink")
    expect(await screen.findByText("Ink Witch")).toBeInTheDocument()
    expect(asked).toBe("ink")
    expect(screen.getByRole("heading", { level: 2, name: "1 result for “ink”" })).toBeInTheDocument()
  })

  it("shows Popular now when there is no query", async () => {
    server.use(results("Ink Witch", "Glass Compass"))
    renderUi(<SearchPage />)
    expect(await screen.findByRole("heading", { level: 2, name: "Popular now" })).toBeInTheDocument()
    expect(screen.getByText("Glass Compass")).toBeInTheDocument()
  })

  it("shows skeleton cards while it loads", () => {
    server.use(http.get(`${API}/search`, () => new Promise(() => undefined)))
    const { container } = renderUi(<SearchPage />)
    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull()
  })

  it("shows the empty state with a link to the genres when nothing matches", async () => {
    setSearch("q=zzz")
    server.use(results())
    renderUi(<SearchPage />)
    expect(await screen.findByText("No results found")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Browse genres" })).toHaveAttribute("href", "/genres")
  })

  it("shows the error state and Retry loads the results", async () => {
    setSearch("q=ink")
    server.use(http.get(`${API}/search`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SearchPage />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    server.use(results("Ink Witch"))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Ink Witch")).toBeInTheDocument()
  })

  it("searching updates the address with the trimmed, encoded text, and an empty box goes back to /search", async () => {
    server.use(results("Ink Witch"))
    const { user } = renderUi(<SearchPage />)
    await screen.findByText("Ink Witch")
    await user.type(screen.getByRole("searchbox"), "  sea light ")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(router.push).toHaveBeenLastCalledWith("/search?q=sea%20light")
    await user.clear(screen.getByRole("searchbox"))
    await user.keyboard("{Enter}")
    expect(router.push).toHaveBeenLastCalledWith("/search")
  })
})
