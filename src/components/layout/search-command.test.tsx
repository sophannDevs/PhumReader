import { useState } from "react"
import { describe, expect, it } from "vitest"
import { SearchCommand } from "@/components/layout/search-command"
import { router } from "@/test/navigation"
import { renderUi, screen, within } from "@/test/render"

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

describe("SearchCommand: open and close", () => {
  it("opens with the search box focused and the Popular now list", async () => {
    await open()
    expect(screen.getByPlaceholderText("Search series, creators…")).toHaveFocus()
    expect(screen.getByText("Popular now")).toBeInTheDocument()
    expect(results()).toHaveLength(6)
  })

  it("is described for screen readers", async () => {
    await open()
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Search series by title, creator or genre.")
  })

  it("closes with Escape and gives the focus back to the opener", async () => {
    const { user } = await open()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open search" })).toHaveFocus()
  })

  it("forgets the query when it is closed and opened again", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "glass")
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Open search" }))
    expect(await screen.findByPlaceholderText("Search series, creators…")).toHaveValue("")
  })
})

describe("SearchCommand: searching", () => {
  it("finds a series by title", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "glass comp")
    expect(screen.getByText("Series")).toBeInTheDocument()
    expect(results().map((r) => r.textContent)).toEqual([expect.stringContaining("Glass Compass"), expect.stringContaining("See all results")])
  })

  it("finds a series by creator, ignoring case", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "OWEN blake")
    expect(screen.getByText("Glass Compass")).toBeInTheDocument()
  })

  it("finds series by genre", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "fantasy")
    expect(screen.getByText("Glass Compass")).toBeInTheDocument()
    expect(screen.getByText("Ink Witch")).toBeInTheDocument()
  })

  it("shows at most 8 results (plus the See all row) for a broad query", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "a")
    expect(results()).toHaveLength(9)
  })

  it("shows the empty message when nothing matches, without a See all row", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "zzzzqqq")
    expect(await screen.findByText("No results. Try a title, creator or genre.")).toBeInTheDocument()
    expect(screen.queryByText(/See all results/)).not.toBeInTheDocument()
  })

  it("treats a query of only spaces as empty", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "   ")
    expect(screen.getByText("Popular now")).toBeInTheDocument()
  })
})

describe("SearchCommand: choosing", () => {
  it("opens the series page on click and closes", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "glass comp")
    await user.click(screen.getByText("Glass Compass"))
    expect(router.push).toHaveBeenCalledWith("/series/glass-compass")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("chooses with the arrow keys and Enter", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "ink witch")
    await user.keyboard("{Enter}")
    expect(router.push).toHaveBeenCalledWith("/series/ink-witch")
  })

  it("moves down to the See all row and opens the search page with the encoded query", async () => {
    const { user } = await open()
    await user.type(screen.getByPlaceholderText("Search series, creators…"), "glass comp")
    await user.keyboard("{ArrowDown}{Enter}")
    expect(router.push).toHaveBeenCalledWith("/search?q=glass%20comp")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
