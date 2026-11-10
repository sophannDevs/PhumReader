import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { NotFoundView } from "@/components/pr/not-found-view"
import { router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"

describe("NotFoundView", () => {
  it("says the page was not found and links Home", () => {
    renderUi(<NotFoundView />)
    expect(screen.getByRole("heading", { level: 1, name: "We can’t find that page" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Go to Home|Home/ })).toHaveAttribute("href", "/")
  })

  it("lets the reader report a broken link", async () => {
    const { user } = renderUi(<NotFoundView />)
    await user.click(screen.getByRole("button", { name: "Report a broken link" }))
    expect(toast.success).toHaveBeenCalledWith("Thanks. We’ll look at this link.")
  })

  it("searches from the search box, with the text trimmed and encoded", async () => {
    const { user } = renderUi(<NotFoundView />)
    await user.type(screen.getByRole("searchbox", { name: "Search PhumiReader" }), "  glass & ink ")
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
