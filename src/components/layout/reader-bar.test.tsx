import { describe, expect, it, vi } from "vitest"
import { ComicReaderBar, NovelReaderBar } from "@/components/layout/reader-bar"
import { renderUi, screen } from "@/test/render"

const base = { backHref: "/series/ink-witch", seriesTitle: "Ink Witch", itemTitle: "Episode 3", progress: 0.5 }

describe("ReaderBar", () => {
  it("shows the series, the episode title as the page heading, and a back link", () => {
    renderUi(<ComicReaderBar {...base} />)
    expect(screen.getByText("Ink Witch")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Episode 3" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to series" })).toHaveAttribute("href", "/series/ink-witch")
  })

  it("reports the progress as a progress bar, clamped to 0 to 100", () => {
    const { rerender } = renderUi(<ComicReaderBar {...base} progress={0.456} />)
    expect(screen.getByRole("progressbar", { name: "Reading progress" })).toHaveAttribute("aria-valuenow", "46")
    rerender(<ComicReaderBar {...base} progress={3} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    rerender(<ComicReaderBar {...base} progress={-1} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("calls onPrev and onNext from the arrow buttons", async () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    const { user } = renderUi(<ComicReaderBar {...base} onPrev={onPrev} onNext={onNext} />)
    await user.click(screen.getByRole("button", { name: "Previous episode" }))
    await user.click(screen.getByRole("button", { name: "Next episode" }))
    expect(onPrev).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
  })

  it("disables an arrow at the first or last episode", async () => {
    const onPrev = vi.fn()
    const { user } = renderUi(<ComicReaderBar {...base} prevDisabled nextDisabled onPrev={onPrev} />)
    expect(screen.getByRole("button", { name: "Previous episode" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next episode" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Previous episode" }))
    expect(onPrev).not.toHaveBeenCalled()
  })

  it("shows the slots it is given before the arrows", () => {
    renderUi(<ComicReaderBar {...base} listSlot={<button>List slot</button>} trailingSlot={<button>Trailing slot</button>} />)
    expect(screen.getByRole("button", { name: "List slot" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trailing slot" })).toBeInTheDocument()
  })
})

describe("NovelReaderBar", () => {
  it("has no arrows and says chapter", () => {
    renderUi(<NovelReaderBar {...base} itemTitle="Chapter 3" />)
    expect(screen.queryByRole("button", { name: /Previous|Next/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Chapter 3" })).toBeInTheDocument()
  })
})
