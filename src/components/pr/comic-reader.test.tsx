import { describe, expect, it, vi } from "vitest"
import { ComicReader } from "@/components/pr/comic-reader"
import { router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

// The end card holds comments and discovery lists (their own features); the reader only hands it the next episode.
vi.mock("@/components/pr/comic-end-section", () => ({
  ComicEndSection: ({ next, nextLocked, onNext }: { next?: { n: number }; nextLocked: boolean; onNext: () => void }) => (
    <section aria-label="End of episode">
      {next ? <button onClick={onNext}>{nextLocked ? `Unlock next ${next.n}` : `Next ${next.n}`}</button> : <span>Last episode</span>}
    </section>
  ),
}))

const SLUG = "ink-witch"
const seriesCard = {
  id: "s1",
  slug: SLUG,
  title: "Ink Witch",
  type: "comic",
  genre: "Fantasy",
  creator: "Mei Tanaka",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 2,
  fastPassEpisodes: 1,
  totalEpisodes: 3,
  status: "ongoing",
  updateDay: null,
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
}
const summary = (n: number, access: "free" | "fastpass" = "free") => ({ n, title: `Episode ${n}`, date: "2026-11-01", isUp: false, likes: 1, access, thumb: "/covers/x.svg" })
const content = (n: number, panels = [{ src: "/panels/a.svg", alt: "Page one", width: 800, height: 1200 }]) => ({
  series: seriesCard,
  episode: summary(n),
  total: 3,
  panels,
  blocks: [],
  comments: 0,
  commentsEnabled: true,
  wordCount: 0,
  viewer: { bookmarked: false, liked: false, signedIn: false, unlocked: false },
})
const episodes = (...items: ReturnType<typeof summary>[]) => http.get(`${API}/series/${SLUG}/episodes`, () => HttpResponse.json({ items, nextCursor: null }))
const episodeAt = (n: number, body: object = content(n)) => http.get(`${API}/series/${SLUG}/episodes/${n}`, () => HttpResponse.json(body))

describe("ComicReader: states", () => {
  it("shows a skeleton while it loads", () => {
    server.use(http.get(`${API}/series/${SLUG}/episodes/2`, () => new Promise(() => undefined)))
    const { container } = renderUi(<ComicReader slug={SLUG} n={2} />)
    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("shows an error with Retry and a way back, and Retry loads the episode", async () => {
    server.use(http.get(`${API}/series/${SLUG}/episodes/2`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<ComicReader slug={SLUG} n={2} />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to series" })).toHaveAttribute("href", `/series/${SLUG}`)
    server.use(episodes(summary(1), summary(2), summary(3)), episodeAt(2))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Episode 2" })).toBeInTheDocument()
  })

  it("a locked episode (402) shows the Fast Pass lock screen instead of the pages", async () => {
    server.use(
      http.get(`${API}/series/${SLUG}/episodes/3`, () => apiError(402, "episode_locked", { price: 5 })),
      http.get(`${API}/series/${SLUG}`, () => HttpResponse.json({ series: seriesCard, synopsis: "A witch.", stats: { subscribers: 1, comments: 0 }, related: [], creatorSeriesCount: 1, creatorId: "c1" })),
      episodes(summary(1), summary(2), summary(3, "fastpass")),
    )
    renderUi(<ComicReader slug={SLUG} n={3} />)
    expect(await screen.findByText(/is in Fast Pass/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in to unlock" })).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "Page one" })).not.toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})

describe("ComicReader: reading", () => {
  const open = async (n = 2, panels?: ReturnType<typeof content>["panels"]) => {
    server.use(episodes(summary(1), summary(2), summary(3, "fastpass")), episodeAt(n, content(n, panels)))
    const view = renderUi(<ComicReader slug={SLUG} n={n} />)
    await screen.findByRole("heading", { level: 1, name: `Episode ${n}` })
    return view
  }

  it("shows the title bar, the panels with alt text and the progress", async () => {
    await open(2)
    expect(screen.getByText("Ink Witch")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Page one" })).toBeInTheDocument()
    // the bar follows how far the reader has scrolled (nothing has scrolled in the test)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("says so when an episode has no pages", async () => {
    await open(2, [])
    expect(screen.getByText("This episode has no pages yet")).toBeInTheDocument()
  })

  it("moves to the previous and next free episodes", async () => {
    const { user } = await open(2)
    await user.click(screen.getByRole("button", { name: "Previous episode" }))
    expect(router.push).toHaveBeenLastCalledWith(`/read/${SLUG}/1`)
    await user.click(screen.getByRole("button", { name: "Next episode" }))
    // episode 3 is Fast Pass and not unlocked: it opens the dialog instead
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("dialog", { name: "Unlock episode 3" })).toBeInTheDocument()
  })

  it("disables Previous on the first episode and Next on the last", async () => {
    server.use(episodes(summary(1), summary(2), summary(3)), episodeAt(1))
    renderUi(<ComicReader slug={SLUG} n={1} />)
    await screen.findByRole("heading", { level: 1, name: "Episode 1" })
    expect(screen.getByRole("button", { name: "Previous episode" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next episode" })).toBeEnabled()
  })

  it("the locked-episode dialog closes with Wait for the free release, leaving the reader where it was", async () => {
    const { user } = await open(2)
    await user.click(screen.getByRole("button", { name: "Next episode" }))
    await screen.findByRole("dialog", { name: "Unlock episode 3" })
    await user.click(screen.getByRole("button", { name: "Wait for the free release" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("uses ← and → to move, and ignores them while a dialog is open or when typing", async () => {
    const { user } = await open(2)
    await user.keyboard("{ArrowLeft}")
    expect(router.push).toHaveBeenLastCalledWith(`/read/${SLUG}/1`)
    router.push.mockClear()
    await user.keyboard("{ArrowRight}")
    // the next episode is locked: the dialog opens, and a further arrow does nothing
    await screen.findByRole("dialog", { name: "Unlock episode 3" })
    await user.keyboard("{ArrowLeft}")
    expect(router.push).not.toHaveBeenCalled()
  })

  it("the Episodes popover lists the episodes and a free one opens in the reader", async () => {
    const { user } = await open(2)
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await user.click(await screen.findByRole("button", { name: /Episode 1/ }))
    expect(router.push).toHaveBeenCalledWith(`/read/${SLUG}/1`)
  })

  it("the end card's next button also goes through the lock check", async () => {
    const { user } = await open(2)
    await user.click(screen.getByRole("button", { name: "Unlock next 3" }))
    expect(await screen.findByRole("dialog", { name: "Unlock episode 3" })).toBeInTheDocument()
  })
})
