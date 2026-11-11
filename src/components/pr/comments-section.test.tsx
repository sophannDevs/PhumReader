import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { CommentsSection } from "@/components/pr/comments-section"
import { useAppStore } from "@/lib/store"
import { nav } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

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
const thread = (...items: object[]) => http.get(`${API}/series/ink-witch/comments`, () => HttpResponse.json({ items, nextCursor: null }))
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: "sokha@example.com" })

describe("CommentsSection (page)", () => {
  it("shows a loading skeleton, then the comments with the author, age, top badge and likes", async () => {
    signIn()
    server.use(thread(comment("1", { top: true }), comment("2")))
    const { container } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull()
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
    expect(screen.getAllByText("Dara Vann")).toHaveLength(2)
    expect(screen.getByText("Top")).toBeInTheDocument()
    expect(screen.getAllByText("· now")).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ })).toHaveLength(2)
  })

  it("shows the empty state when nobody has commented", async () => {
    server.use(thread())
    renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    expect(await screen.findByText("Be the first to comment")).toBeInTheDocument()
  })

  it("shows the error state and Retry loads the comments", async () => {
    server.use(http.get(`${API}/series/ink-witch/comments`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    expect(await screen.findByText("Couldn’t load the comments")).toBeInTheDocument()
    server.use(thread(comment("1")))
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
  })

  it("uses the episode's own thread for an episode", async () => {
    let path = ""
    server.use(
      http.get(`${API}/series/ink-witch/episodes/3/comments`, ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ items: [comment("e1")], nextCursor: null })
      }),
    )
    renderUi(<CommentsSection kind="episode" slug="ink-witch:3" />)
    expect(await screen.findByText("Comment e1")).toBeInTheDocument()
    expect(path).toBe("/api/v1/series/ink-witch/episodes/3/comments")
  })

  it("posting adds the new comment on top, clears the box and sends the trimmed text", async () => {
    signIn()
    let body: unknown
    server.use(
      thread(comment("1")),
      http.post(`${API}/series/ink-witch/comments`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(comment("new", { body: "Loved it", author: { name: "Sokha Chan" }, mine: true, canDelete: true, likes: 0 }), { status: 201 })
      }),
    )
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await screen.findByText("Comment 1")
    await user.type(screen.getByLabelText("Add a comment"), "  Loved it  ")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(await screen.findByText("Loved it")).toBeInTheDocument()
    expect(body).toEqual({ body: "Loved it" })
    expect(screen.getByLabelText("Add a comment")).toHaveValue("")
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Loved it")
  })

  it("logged out: posting asks to log in and keeps what was typed", async () => {
    server.use(thread(comment("1")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await screen.findByText("Comment 1")
    await user.type(screen.getByLabelText("Add a comment"), "Hello")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(toast.message).toHaveBeenCalledWith("Log in to comment")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Hello")
  })

  it("a failed post says so and keeps what was typed", async () => {
    signIn()
    server.use(thread(), http.post(`${API}/series/ink-witch/comments`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await screen.findByText("Be the first to comment")
    await user.type(screen.getByLabelText("Add a comment"), "Hello")
    await user.click(screen.getByRole("button", { name: "Post" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."))
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Hello")
  })

  it("Reply fills the box with @Name and moves the focus there", async () => {
    signIn()
    server.use(thread(comment("1")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: "Reply" }))
    expect(screen.getByLabelText("Add a comment")).toHaveValue("@Dara Vann ")
    expect(screen.getByLabelText("Add a comment")).toHaveFocus()
  })
})

describe("CommentsSection: comments turned off (V21-02)", () => {
  it("shows the comments without a comment box when the creator turned them off", async () => {
    signIn()
    server.use(thread(comment("1")))
    renderUi(<CommentsSection kind="series" slug="ink-witch" closed />)
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
    expect(screen.getByText("The creator turned off comments here.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Add a comment")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Post" })).not.toBeInTheDocument()
  })

  it("a post the API refuses with 403 comments_disabled says comments are off and keeps the text", async () => {
    signIn()
    server.use(thread(), http.post(`${API}/series/ink-witch/comments`, () => apiError(403, "comments_disabled")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await screen.findByText("Be the first to comment")
    await user.type(screen.getByLabelText("Add a comment"), "Hello")
    await user.click(screen.getByRole("button", { name: "Post" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The creator turned off comments here."))
    expect(toast.error).not.toHaveBeenCalledWith("Something went wrong. Please try again.")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Hello")
  })
})

// jsdom has no CSS, so the screen-reader text and the count join without a space ("likes:3"); a browser reads "likes: 3".
describe("CommentsSection: likes, delete and report", () => {
  it("liking shows the change at once, sends PUT, and settles on the server's count", async () => {
    signIn()
    let put = false
    server.use(
      thread(comment("1", { likes: 3 })),
      http.put(`${API}/comments/1/like`, () => {
        put = true
        return HttpResponse.json({ liked: true, likes: 4 })
      }),
    )
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    const like = await screen.findByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ })
    await user.click(like)
    await waitFor(() => expect(screen.getByRole("button", { name: /^Like comment by Dara Vann, likes:\s*4$/ })).toHaveAttribute("aria-pressed", "true"))
    expect(put).toBe(true)
  })

  it("unliking sends DELETE", async () => {
    signIn()
    let deleted = false
    server.use(
      thread(comment("1", { likes: 4, liked: true })),
      http.delete(`${API}/comments/1/like`, () => {
        deleted = true
        return HttpResponse.json({ liked: false, likes: 3 })
      }),
    )
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: /^Like comment by Dara Vann, likes:\s*4$/ }))
    await waitFor(() => expect(screen.getByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ })).toHaveAttribute("aria-pressed", "false"))
    expect(deleted).toBe(true)
  })

  it("a failed like goes back to the old count and says so", async () => {
    signIn()
    server.use(thread(comment("1", { likes: 3 })), http.put(`${API}/comments/1/like`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."))
    expect(screen.getByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("logged out: liking asks to log in and remembers the page", async () => {
    nav.pathname = "/series/ink-witch"
    server.use(thread(comment("1")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: /^Like comment by Dara Vann, likes:\s*3$/ }))
    expect(toast.success).toHaveBeenCalledWith("Log in to do this")
    expect(useAppStore.getState().returnTo).toBe("/series/ink-witch")
  })

  it("shows Delete only on the reader's own comment and Report only on other people's", async () => {
    signIn()
    server.use(thread(comment("mine", { mine: true, canDelete: true }), comment("other")))
    renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    const mine = (await screen.findByText("Comment mine")).closest("li") as HTMLElement
    const other = screen.getByText("Comment other").closest("li") as HTMLElement
    expect(within(mine).getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(within(mine).queryByRole("button", { name: "Report comment by Dara Vann" })).not.toBeInTheDocument()
    expect(within(other).getByRole("button", { name: "Report comment by Dara Vann" })).toBeInTheDocument()
    expect(within(other).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
  })

  it("deleting removes the comment and says so", async () => {
    signIn()
    server.use(thread(comment("mine", { mine: true, canDelete: true })), http.delete(`${API}/comments/mine`, () => new HttpResponse(null, { status: 204 })))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: "Delete" }))
    await waitFor(() => expect(screen.queryByText("Comment mine")).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith("Comment deleted")
  })

  it("a failed delete puts the comment back", async () => {
    signIn()
    server.use(thread(comment("mine", { mine: true, canDelete: true })), http.delete(`${API}/comments/mine`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: "Delete" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(await screen.findByText("Comment mine")).toBeInTheDocument()
  })

  it("reporting asks for a reason, sends the report and thanks the reader", async () => {
    signIn()
    let body: unknown
    server.use(
      thread(comment("other")),
      http.post(`${API}/comments/other/report`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: "Report comment by Dara Vann" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /Send report/ }))
    expect(await within(dialog).findByText("Choose a reason.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: /Spam or scam/ }))
    await user.click(within(dialog).getByRole("button", { name: /Send report/ }))
    expect(await within(dialog).findByText("Thanks. We’ll review it.")).toBeInTheDocument()
    expect(body).toEqual({ reason: "spam" })
    expect(useAppStore.getState().reports).toContainEqual(expect.objectContaining({ kind: "comment", reason: "spam", who: "Dara Vann" }))
  })

  it("logged out: reporting asks to log in instead of opening the dialog", async () => {
    nav.pathname = "/series/ink-witch"
    server.use(thread(comment("other")))
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" />)
    await user.click(await screen.findByRole("button", { name: "Report comment by Dara Vann" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith("Log in to do this")
  })
})

describe("CommentsSection (reader card)", () => {
  it("is a one-line composer with the title, the count and Post, and shows the log-in prompt when signed out", async () => {
    server.use(thread(comment("1")))
    renderUi(<CommentsSection kind="series" slug="ink-witch" variant="reader" count="1.2K" />)
    expect(screen.getByRole("heading", { name: /Comments/ })).toHaveTextContent("1.2K")
    expect(screen.getByRole("textbox", { name: "Add a comment" })).toHaveAttribute("placeholder", "Log in to comment")
    expect(await screen.findByText("Comment 1")).toBeInTheDocument()
  })

  it("posts from the one-line box when signed in", async () => {
    signIn()
    server.use(
      thread(),
      http.post(`${API}/series/ink-witch/comments`, () => HttpResponse.json(comment("n", { body: "Nice", mine: true }), { status: 201 })),
    )
    const { user } = renderUi(<CommentsSection kind="series" slug="ink-witch" variant="novel" />)
    const box = screen.getByRole("textbox", { name: "Add a comment" })
    expect(box).toHaveAttribute("placeholder", "Add a comment")
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled()
    await user.type(box, "Nice")
    await user.click(screen.getByRole("button", { name: "Post" }))
    expect(await screen.findByText("Nice")).toBeInTheDocument()
    expect(box).toHaveValue("")
  })

  it("says so when there are no comments", async () => {
    server.use(thread())
    renderUi(<CommentsSection kind="series" slug="ink-witch" variant="reader" />)
    expect(await screen.findByText("Be the first to comment")).toBeInTheDocument()
  })
})
