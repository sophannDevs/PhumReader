import { describe, expect, it } from "vitest"
import { NotFoundView } from "@/components/pr/not-found-view"
import { router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"

describe("NotFoundView", () => {
  it("says the page was not found and links Home and Genres", () => {
    renderUi(<NotFoundView />)
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Browse genres" })).toHaveAttribute("href", "/genres")
  })

  it("searches from the search box, with the text trimmed and encoded", async () => {
    const { user } = renderUi(<NotFoundView />)
    await user.type(screen.getByRole("searchbox", { name: "Search series, creators…" }), "  glass & ink ")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(router.push).toHaveBeenCalledWith("/search?q=glass%20%26%20ink")
  })

  it("submits with Enter, and an empty search opens the search page without a query", async () => {
    const { user } = renderUi(<NotFoundView />)
    await user.type(screen.getByRole("searchbox"), "   {Enter}")
    expect(router.push).toHaveBeenCalledWith("/search")
  })

  it("has a search landmark", () => {
    renderUi(<NotFoundView />)
    expect(screen.getByRole("search")).toBeInTheDocument()
  })
})
