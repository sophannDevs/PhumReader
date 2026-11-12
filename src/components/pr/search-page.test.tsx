import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { useAppStore } from "@/lib/store"
import { SearchPage } from "@/components/pr/search-page"
import { setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
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

describe("SearchPage: following a creator (real API)", () => {
  const profile = (over: Record<string, unknown> = {}) => ({
    id: "c-1",
    handle: "mei-tanaka",
    name: "Mei Tanaka",
    avatarUrl: null,
    bio: null,
    location: null,
    since: "2025-03-01T00:00:00Z",
    followers: 41,
    views: 1000,
    likes: 250,
    following: false,
    owner: false,
    series: [],
    ...over,
  })
  /** The cards name the creator's account and profile handle (B1). */
  const withCreator = (...titles: string[]) =>
    http.get(`${API}/search`, () =>
      HttpResponse.json({ items: titles.map((t, i) => ({ ...card(`s${i}`, t), creatorId: "c-1", creatorHandle: "mei-t" })) }),
    )
  const followed = (ids: string[]) => ({
    items: ids.map((id) => ({ id, name: "Mei Tanaka", seriesCount: 1, followedAt: "2026-11-01T00:00:00Z" })),
    nextCursor: null,
  })
  /** Signed in: the result rows' Subscribe buttons read the reader's subscriptions too. */
  const signIn = () => {
    useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
    server.use(http.get(`${API}/me/subscriptions`, () => HttpResponse.json({ items: [], nextCursor: null })))
  }
  const followButton = () => screen.findByRole("button", { name: "Follow" })
  /** Fails the test if the page looks the creator up by a handle guessed from the name. */
  const noProfileLookup = () => {
    let asked = false
    server.use(
      http.get(`${API}/creators/:handle`, () => {
        asked = true
        return HttpResponse.json(profile())
      }),
    )
    return () => asked
  }

  it("follows the card's creator account (PUT /creators/{id}/follow), reading the state from /me/follows", async () => {
    signIn()
    setSearch("q=mei")
    const asked = noProfileLookup()
    let following: string[] = []
    let calls = 0
    server.use(
      withCreator("Ink Witch"),
      http.get(`${API}/me/follows`, () => HttpResponse.json(followed(following))),
      http.put(`${API}/creators/c-1/follow`, () => {
        calls++
        following = ["c-1"]
        return HttpResponse.json({ following: true })
      }),
    )
    const { user } = renderUi(<SearchPage />)
    const button = await followButton()
    await waitFor(() => expect(button).toBeEnabled())
    expect(button).toHaveAttribute("aria-pressed", "false")
    await user.click(button)
    expect(await screen.findByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true")
    expect(calls).toBe(1)
    expect(toast.success).toHaveBeenCalledWith("Following Mei Tanaka")
    expect(useAppStore.getState().follows).toEqual([])
    expect(asked()).toBe(false)
  })

  it("waits for one Follow to finish before taking another click (no PUT and DELETE racing)", async () => {
    signIn()
    setSearch("q=mei")
    let release = () => {}
    const calls: string[] = []
    server.use(
      withCreator("Ink Witch"),
      http.get(`${API}/me/follows`, () => HttpResponse.json(followed(calls.includes("put") ? ["c-1"] : []))),
      http.put(`${API}/creators/c-1/follow`, async () => {
        calls.push("put")
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({ following: true })
      }),
      http.delete(`${API}/creators/c-1/follow`, () => {
        calls.push("delete")
        return HttpResponse.json({ following: false })
      }),
    )
    const { user } = renderUi(<SearchPage />)
    const button = await followButton()
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    // Shown at once, but off until the API answers.
    const pending = await screen.findByRole("button", { name: "Following" })
    expect(pending).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(pending).toBeDisabled())
    expect(calls).toEqual(["put"])
    release()
    await waitFor(() => expect(screen.getByRole("button", { name: "Following" })).toBeEnabled())
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true")
    expect(calls).toEqual(["put"])
  })

  it("links the creator to the API's handle", async () => {
    signIn()
    setSearch("q=mei")
    server.use(withCreator("Ink Witch"), http.get(`${API}/me/follows`, () => HttpResponse.json(followed([]))))
    renderUi(<SearchPage />)
    expect(await screen.findByRole("link", { name: "Mei Tanaka" })).toHaveAttribute("href", "/creators/mei-t")
  })

  it("shows Following for a creator in /me/follows, and unfollows with DELETE", async () => {
    signIn()
    setSearch("q=mei")
    let following = ["c-1"]
    let deleted = false
    server.use(
      withCreator("Ink Witch"),
      http.get(`${API}/me/follows`, () => HttpResponse.json(followed(following))),
      http.delete(`${API}/creators/c-1/follow`, () => {
        deleted = true
        following = []
        return HttpResponse.json({ following: false })
      }),
    )
    const { user } = renderUi(<SearchPage />)
    await user.click(await screen.findByRole("button", { name: "Following" }))
    expect(await followButton()).toHaveAttribute("aria-pressed", "false")
    expect(deleted).toBe(true)
  })

  it("shows the change at once and puts it back when the API refuses", async () => {
    signIn()
    setSearch("q=mei")
    server.use(
      withCreator("Ink Witch"),
      http.get(`${API}/me/follows`, () => HttpResponse.json(followed([]))),
      http.put(`${API}/creators/c-1/follow`, () => apiError(500, "internal_error")),
    )
    const { user } = renderUi(<SearchPage />)
    const button = await followButton()
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(await followButton()).toHaveAttribute("aria-pressed", "false")
  })

  it("asks a logged-out reader to log in, without asking the API", async () => {
    setSearch("q=mei")
    let asked = false
    server.use(
      withCreator("Ink Witch"),
      http.get(`${API}/me/follows`, () => {
        asked = true
        return HttpResponse.json(followed([]))
      }),
    )
    const { user } = renderUi(<SearchPage />)
    await user.click(await followButton())
    expect(toast.success).toHaveBeenCalledWith("Log in to do this")
    expect(asked).toBe(false)
  })

  describe("cards without the creator's account (an older API)", () => {
    it("finds the account through the profile and follows it", async () => {
      signIn()
      setSearch("q=mei")
      let following = false
      server.use(
        results("Ink Witch"),
        http.get(`${API}/me/follows`, () => HttpResponse.json(followed([]))),
        http.get(`${API}/creators/mei-tanaka`, () => HttpResponse.json(profile({ following }))),
        http.put(`${API}/creators/c-1/follow`, () => {
          following = true
          return HttpResponse.json({ following: true })
        }),
      )
      const { user } = renderUi(<SearchPage />)
      const button = await followButton()
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)
      expect(await screen.findByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true")
    })

    it("hides Follow when the name has no creator profile", async () => {
      signIn()
      setSearch("q=mei")
      server.use(
        results("Ink Witch"),
        http.get(`${API}/me/follows`, () => HttpResponse.json(followed([]))),
        http.get(`${API}/creators/mei-tanaka`, () => apiError(404, "not_found")),
      )
      renderUi(<SearchPage />)
      expect(await screen.findByRole("link", { name: "Mei Tanaka" })).toHaveAttribute("href", "/creators/mei-tanaka")
      await waitFor(() => expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument())
    })
  })
})
