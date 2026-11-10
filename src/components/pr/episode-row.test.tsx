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
    expect(screen.getByText("1.2K likes")).toHaveClass("sr-only")
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

  it("marks an episode that is new with UP, whatever its state", () => {
    const first = setup("free", { episode: { isUp: true } })
    expect(screen.getByText("UP")).toBeInTheDocument()
    first.unmount()
    const second = setup("read", { episode: { isUp: true } })
    expect(screen.getByText("UP")).toBeInTheDocument()
    second.unmount()
    setup("free")
    expect(screen.queryByText("UP")).not.toBeInTheDocument()
  })

  it("highlights the episode to read next with an Up next badge", () => {
    renderUi(
      <EpisodeList>
        <EpisodeRow series={{ slug: "ink-witch", type: "comic" }} episode={episode} state="free" upNext />
      </EpisodeList>,
    )
    expect(screen.getByText("Up next")).toBeInTheDocument()
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
    const button = screen.getByRole("button", { name: /The Door, Fast Pass, 8 coins, free on/ })
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
    expect(screen.getByRole("button", { name: /Fast Pass, 5 coins/ })).toBeInTheDocument()
  })
})
