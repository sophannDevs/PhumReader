import { describe, expect, it, vi } from "vitest"
import { NovelBody, NovelReader, readMinutes } from "@/components/pr/novel-reader"
import type { NovelBlock } from "@/data"
import { useAppStore } from "@/lib/store"
import { router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

vi.mock("@/components/pr/novel-end-section", () => ({
  NovelEndSection: ({ nextLocked, onNext, commentsEnabled = true }: { nextLocked: boolean; onNext: () => void; commentsEnabled?: boolean }) => (
    <section aria-label="End of chapter">
      <button onClick={onNext}>{nextLocked ? "Unlock next chapter" : "Next chapter link"}</button>
      <span>{commentsEnabled ? "Comment box" : "Comments off"}</span>
    </section>
  ),
}))

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ")

describe("readMinutes", () => {
  it("is at least 1 minute, even for an empty chapter", () => {
    expect(readMinutes([])).toBe(1)
    expect(readMinutes([{ type: "paragraph", text: "Hi" }])).toBe(1)
  })

  it("counts about 200 English words a minute, rounding up", () => {
    expect(readMinutes([{ type: "paragraph", text: words(200) }])).toBe(1)
    expect(readMinutes([{ type: "paragraph", text: words(201) }])).toBe(2)
    expect(readMinutes([{ type: "paragraph", text: words(500) }, { type: "scene-break" }, { type: "paragraph", text: words(100) }])).toBe(3)
  })

  it("counts Khmer letters, about 1000 a minute", () => {
    const khmer = "ក".repeat(1500)
    expect(readMinutes([{ type: "paragraph", text: khmer }])).toBe(2)
  })
})

describe("NovelBody", () => {
  const blocks: NovelBlock[] = [
    { type: "heading", text: "The Tide" },
    { type: "paragraph", text: "She walked **fast** and *quietly*." },
    { type: "quote", text: "Stay low." },
    { type: "scene-break" },
    { type: "paragraph", text: "Morning." },
  ]

  it("renders headings, paragraphs, quotes and scene breaks", () => {
    renderUi(<NovelBody blocks={blocks} />)
    expect(screen.getByRole("heading", { level: 2, name: "The Tide" })).toBeInTheDocument()
    expect(screen.getByText("Stay low.").closest("blockquote")).not.toBeNull()
    expect(screen.getByRole("separator")).toHaveTextContent("* * *")
    expect(screen.getByText("Morning.")).toBeInTheDocument()
  })

  it("turns **bold** and *italic* marks into styled text, and drops the asterisks", () => {
    renderUi(<NovelBody blocks={blocks} />)
    expect(screen.getByText("fast").tagName).toBe("STRONG")
    expect(screen.getByText("quietly").tagName).toBe("EM")
    expect(document.body.textContent).not.toContain("**")
  })
})

const SLUG = "the-last-archivist"
const seriesCard = {
  id: "s2",
  slug: SLUG,
  title: "The Last Archivist",
  type: "novel",
  genre: "Drama",
  creator: "Sokha Chan",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 2,
  fastPassEpisodes: 1,
  totalEpisodes: 3,
  status: "ongoing",
  updateDay: null,
  updateDays: [],
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
}
const summary = (n: number, access: "free" | "fastpass" = "free") => ({ n, title: `Chapter ${n}: Name ${n}`, date: "2026-11-01", isUp: false, likes: 1, access, thumb: "/covers/x.svg" })
const chapterBody = (n: number, blocks: unknown[] = [{ type: "paragraph", text: words(450) }]) => ({
  series: seriesCard,
  episode: summary(n),
  total: 3,
  panels: [],
  blocks,
  comments: 0,
  commentsEnabled: true,
  wordCount: 450,
  viewer: { bookmarked: false, liked: false, signedIn: false, unlocked: false },
})
const list = () => http.get(`${API}/series/${SLUG}/episodes`, () => HttpResponse.json({ items: [summary(1), summary(2), summary(3, "fastpass")], nextCursor: null }))
const chapterAt = (n: number, body: object = chapterBody(n)) => http.get(`${API}/series/${SLUG}/episodes/${n}`, () => HttpResponse.json(body))

async function open(n = 2, blocks?: unknown[]) {
  server.use(list(), chapterAt(n, chapterBody(n, blocks)))
  const view = renderUi(<NovelReader slug={SLUG} n={n} />)
  expect(await screen.findByRole("heading", { level: 1, name: `Name ${n}` })).toBeInTheDocument()
  return view
}

describe("NovelReader", () => {
  it("shows the chapter with its eyebrow, author, reading time and text", async () => {
    await open(2)
    expect(screen.getByText("Chapter 2", { selector: "p" })).toBeInTheDocument()
    expect(screen.getByText(/Sokha Chan · .*2026 · 3 min read/)).toBeInTheDocument()
    expect(screen.getAllByText(/word word/).length).toBeGreaterThan(0)
  })

  it("follows the stored reading settings", async () => {
    // the reader's own choice (before that it follows Settings)
    useAppStore.getState().chooseNovelSettings({ size: 22, theme: "sepia", font: "serif", wide: false })
    const { container } = await open(2)
    const root = container.querySelector("[data-reader-theme]") as HTMLElement
    expect(root).toHaveAttribute("data-reader-theme", "sepia")
    expect(root.style.getPropertyValue("--novel-size")).toBe("22px")
    expect(root.style.getPropertyValue("--novel-leading")).toBe("1.6")
  })

  it("changing the theme in the Aa popover updates the page at once", async () => {
    const { user, container } = await open(2)
    await user.click(screen.getByRole("button", { name: "Reading settings" }))
    await user.click(await screen.findByRole("radio", { name: "Dark" }))
    expect(container.querySelector("[data-reader-theme]")).toHaveAttribute("data-reader-theme", "dark")
  })

  it("says so when a chapter has no text", async () => {
    await open(2, [])
    expect(screen.getByText("This chapter has no text yet")).toBeInTheDocument()
  })

  it("has no previous/next arrows but the end buttons and the Chapters popover work", async () => {
    const { user } = await open(2)
    expect(screen.queryByRole("button", { name: "Previous chapter" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Chapters" }))
    await user.click(await screen.findByRole("button", { name: /Name 1/ }))
    expect(router.push).toHaveBeenCalledWith(`/novel/${SLUG}/1`)
  })

  it("a locked next chapter opens the unlock dialog from the end button and from →", async () => {
    const { user } = await open(2)
    await user.click(screen.getByRole("button", { name: "Unlock next chapter" }))
    expect(await screen.findByRole("dialog", { name: "Unlock chapter 3" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Wait for the free release" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.keyboard("{ArrowRight}")
    expect(await screen.findByRole("dialog", { name: "Unlock chapter 3" })).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("hands the end of the chapter the API's commentsEnabled (chapter and series switches)", async () => {
    server.use(list(), chapterAt(2, { ...chapterBody(2), commentsEnabled: false }))
    renderUi(<NovelReader slug={SLUG} n={2} />)
    expect(await screen.findByText("Comments off")).toBeInTheDocument()
  })

  it("keeps the comment box when comments are on", async () => {
    await open(2)
    expect(screen.getByText("Comment box")).toBeInTheDocument()
  })

  it("shows an error with Retry and a way back", async () => {
    server.use(http.get(`${API}/series/${SLUG}/episodes/2`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<NovelReader slug={SLUG} n={2} />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to series" })).toHaveAttribute("href", `/series/${SLUG}`)
    server.use(list(), chapterAt(2))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect((await screen.findAllByRole("heading", { level: 1, name: "Name 2" })).length).toBeGreaterThan(0)
  })
})
