import { describe, expect, it } from "vitest"
import { TopComments } from "@/components/pr/top-comments"
import { getSeriesBySlug, type Series } from "@/data"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const series = getSeriesBySlug("ink-witch") as Series
const PATH = `${API}/series/ink-witch/episodes/1/comments`
const NOW = new Date().toISOString()
const comment = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  author: { name: "Dara Vann" },
  body: `Comment ${id}`,
  createdAt: NOW,
  likes: 3,
  liked: false,
  top: false,
  canDelete: false,
  mine: false,
  ...over,
})
const thread = (...items: object[]) => http.get(PATH, () => HttpResponse.json({ items, nextCursor: null }))
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: "sokha@example.com" })
const view = (closed = false) => renderUi(<TopComments series={series} episode={{ n: 1, likes: "47K" }} closed={closed} />)

describe("TopComments", () => {
  it("shows a loading skeleton, then the top threads, the count and a See all link scoped to the chapter", async () => {
    server.use(thread(comment("1"), comment("2", { likes: 9 })))
    const { container } = view()
    expect(container.querySelector("[data-slot=skeleton]")).not.toBeNull()
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
    expect(container.querySelector("[data-slot=skeleton]")).toBeNull()
    expect(screen.getByRole("heading", { level: 2, name: /Comments\s*1\.2K/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/series/ink-witch/comments?ep=1")
    // the most liked thread first
    const items = within(screen.getByRole("list", { name: "Comments" })).getAllByText(/^Comment \d$/)
    expect(items.map((el) => el.textContent)).toEqual(["Comment 2", "Comment 1"])
  })

  it("shows an error with Try again, which loads the comments", async () => {
    server.use(http.get(PATH, () => apiError(500, "internal_error")))
    const { user } = view()
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load the comments.")
    server.use(thread(comment("1")))
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
  })

  it("says nobody has commented yet", async () => {
    server.use(thread())
    view()
    expect(await screen.findByText("No comments yet. Be the first.")).toBeInTheDocument()
  })

  it("posting puts the reader's comment first and clears the box", async () => {
    signIn()
    server.use(
      thread(comment("1", { likes: 20 })),
      http.post(PATH, () =>
        HttpResponse.json(comment("new", { body: "Great chapter", author: { name: "Sokha Chan" }, mine: true, canDelete: true, likes: 0 }), { status: 201 }),
      ),
    )
    const { user } = view()
    await screen.findByText("Comment 1")
    const box = screen.getByRole("textbox", { name: "Add a comment" })
    expect(box).toHaveAttribute("placeholder", "Add a comment…")
    await user.type(box, "Great chapter")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(await screen.findByText("Great chapter")).toBeInTheDocument()
    const items = within(screen.getByRole("list", { name: "Comments" })).getAllByText(/^(Comment 1|Great chapter)$/)
    expect(items.map((el) => el.textContent)).toEqual(["Great chapter", "Comment 1"])
    expect(box).toHaveValue("")
  })

  it("comments turned off: says so and has no comment box", async () => {
    server.use(thread())
    view(true)
    expect(screen.getByText("The creator turned off comments here.")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Add a comment" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Post" })).not.toBeInTheDocument()
  })

  it("asks a logged-out reader to log in", async () => {
    server.use(thread())
    view()
    expect(screen.getByRole("textbox", { name: "Add a comment" })).toHaveAttribute("placeholder", "Log in to comment")
    await screen.findByText("No comments yet. Be the first.")
  })
})
