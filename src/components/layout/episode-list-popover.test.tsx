import { describe, expect, it, vi } from "vitest"
import { EpisodeListPopover, type ListEpisode } from "@/components/layout/episode-list-popover"
import { renderUi, screen, within } from "@/test/render"

const make = (count: number, lockedFrom = 1000): ListEpisode[] =>
  Array.from({ length: count }, (_, i) => ({ n: i + 1, title: `Episode ${i + 1}`, date: "2026-10-01", thumb: "/covers/x.svg", locked: i + 1 >= lockedFrom }))

function setup(props: Partial<React.ComponentProps<typeof EpisodeListPopover>> = {}) {
  const onSelect = vi.fn()
  const view = renderUi(<EpisodeListPopover episodes={make(20)} current={10} coins={30} price={5} onSelect={onSelect} {...props} />)
  return { ...view, onSelect }
}
const rows = () => within(screen.getByRole("list")).getAllByRole("button")

describe("EpisodeListPopover", () => {
  it("is closed until the Episodes button is pressed, then closes with Escape and returns the focus", async () => {
    const { user } = setup()
    const trigger = screen.getByRole("button", { name: "Episodes" })
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    await user.click(trigger)
    expect(await screen.findByRole("list")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it("says Chapters for a web novel", async () => {
    const { user } = setup({ readerTheme: "light" })
    await user.click(screen.getByRole("button", { name: "Chapters" }))
    expect(await screen.findByText(/20 chapters/)).toBeInTheDocument()
  })

  it("shows the totals in the header", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    expect(await screen.findByText(/20 episodes/)).toBeInTheDocument()
  })

  it("lists the 9 episodes around the current one, newest first", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    expect(rows().map((r) => within(r).getByText(/^Episode \d+$/).textContent?.replace("Episode ", ""))).toEqual(["14", "13", "12", "11", "10", "9", "8", "7", "6"])
  })

  it("starts at the newest when the current is the latest, and ends at the oldest for the first", async () => {
    const latest = setup({ current: 20 })
    await latest.user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    expect(rows()[0]).toHaveTextContent("Episode 20")
    expect(rows()).toHaveLength(9)
    latest.unmount()
    const first = setup({ current: 1 })
    await first.user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    expect(rows().at(-1)).toHaveTextContent("Episode 1")
  })

  it("shows every episode when there are fewer than 9", async () => {
    const { user } = setup({ episodes: make(3), current: 2 })
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    expect(rows()).toHaveLength(3)
  })

  it("marks the current episode with Now and aria-current", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    const current = rows().find((r) => r.getAttribute("aria-current") === "true")
    expect(current).toHaveTextContent("Episode 10")
    expect(current).toHaveTextContent("Now")
    expect(screen.getAllByText("Now")).toHaveLength(1)
  })

  it("announces locked episodes to screen readers", async () => {
    const { user } = setup({ episodes: make(20, 15), current: 16 })
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await screen.findByRole("list")
    const locked = rows().filter((r) => within(r).queryByText("Locked"))
    expect(locked.length).toBeGreaterThan(0)
    expect(rows().find((r) => r.textContent?.includes("Episode 14"))).not.toHaveTextContent("Locked")
  })

  it("novel: shows each locked chapter's own price (real API), else the popover's", async () => {
    const episodes = make(5, 4).map((e) => (e.n === 5 ? { ...e, price: 8 } : e))
    const { user } = setup({ readerTheme: "light", episodes, current: 3 })
    await user.click(screen.getByRole("button", { name: "Chapters" }))
    await screen.findByRole("list")
    expect(rows().find((r) => r.textContent?.includes("Episode 4"))).toHaveTextContent(/5\s*Locked/)
    expect(rows().find((r) => r.textContent?.includes("Episode 5"))).toHaveTextContent(/8\s*Locked/)
  })

  it("calls onSelect with the episode number, also from the keyboard", async () => {
    const { user, onSelect } = setup()
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    await user.click(await screen.findByRole("button", { name: /Episode 12/ }))
    expect(onSelect).toHaveBeenCalledWith(12)
    // picking a row closes the popover; the page then navigates or opens the unlock dialog
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Episodes" }))
    ;(await screen.findByRole("button", { name: /Episode 8/ })).focus()
    await user.keyboard("{Enter}")
    expect(onSelect).toHaveBeenLastCalledWith(8)
  })
})
