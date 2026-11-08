import { describe, expect, it, vi } from "vitest"
import { EpisodeList, EpisodeRow, type EpisodeState } from "@/components/pr/episode-row"
import type { Episode } from "@/data/types"
import { renderUi, screen } from "@/test/render"

const episode: Episode = { n: 4, title: "The Door", date: "Nov 5, 2026", likes: "1.2K", thumb: "/covers/x.svg", access: "free", isUp: false }

function setup(state: EpisodeState, over: { episode?: Partial<Episode>; type?: "comic" | "novel"; price?: number } = {}) {
  const onLockedClick = vi.fn()
  const view = renderUi(
    <EpisodeList>
      <EpisodeRow
        series={{ slug: "ink-witch", type: over.type ?? "comic" }}
        episode={{ ...episode, ...over.episode }}
        state={state}
        price={over.price}
        onLockedClick={onLockedClick}
      />
    </EpisodeList>,
  )
  return { ...view, onLockedClick }
}

describe("EpisodeRow", () => {
  it("shows the title, date and likes", () => {
    setup("free")
    expect(screen.getByText("The Door")).toBeInTheDocument()
    expect(screen.getByText("Nov 5, 2026")).toBeInTheDocument()
    expect(screen.getByLabelText("1.2K likes")).toBeInTheDocument()
  })

  it.each([
    ["free", "comic", "/read/ink-witch/4"],
    ["read", "comic", "/read/ink-witch/4"],
    ["unlocked", "comic", "/read/ink-witch/4"],
    ["free", "novel", "/novel/ink-witch/4"],
  ] as const)("a %s %s row links to the reader", (state, type, href) => {
    setup(state, { type })
    expect(screen.getByRole("link")).toHaveAttribute("href", href)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("marks a free row that is new with UP, and only a free one", () => {
    const { unmount } = setup("free", { episode: { isUp: true } })
    expect(screen.getByText("UP")).toBeInTheDocument()
    unmount()
    setup("read", { episode: { isUp: true } })
    expect(screen.queryByText("UP")).not.toBeInTheDocument()
  })

  it("shows Read for a read row and Unlocked for an unlocked one", () => {
    const { unmount } = setup("read")
    expect(screen.getByText("Read")).toBeInTheDocument()
    unmount()
    setup("unlocked")
    expect(screen.getByText("Unlocked")).toBeInTheDocument()
  })

  it("a locked row is a button with the price, not a link, and tells screen readers the price", async () => {
    const { user, onLockedClick } = setup("locked", { price: 8 })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    const button = screen.getByRole("button", { name: /Locked. Unlock for 8 coins/ })
    expect(button).toHaveTextContent("8 coins")
    await user.click(button)
    expect(onLockedClick).toHaveBeenCalledWith(expect.objectContaining({ n: 4 }))
  })

  it("a locked row opens from the keyboard", async () => {
    const { user, onLockedClick } = setup("locked")
    await user.tab()
    expect(screen.getByRole("button")).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onLockedClick).toHaveBeenCalledOnce()
  })

  it("uses the default price of 5 coins", () => {
    setup("locked")
    expect(screen.getByRole("button", { name: /Unlock for 5 coins/ })).toBeInTheDocument()
  })
})
