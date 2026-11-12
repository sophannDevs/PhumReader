import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { ParticleBurst, SuccessBurst, useBurstOnPress } from "@/components/pr/particle-burst"

/** A like toggle the way the app uses it: arm() in onClick, then the toggle. */
function Toggle({ initial = false, armOnPress = true }: { initial?: boolean; armOnPress?: boolean }) {
  const [on, setOn] = useState(initial)
  const [burst, arm] = useBurstOnPress(on)
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => {
          if (armOnPress) arm()
          setOn((v) => !v)
        }}
      >
        <ParticleBurst burst={burst}>
          <svg aria-hidden />
        </ParticleBurst>
        Like
      </button>
      {/* State that changes without a press (data loading later). */}
      <button type="button" onClick={() => setOn(true)}>
        Load
      </button>
    </>
  )
}

const dots = (container: HTMLElement) => container.querySelectorAll("[data-particle]").length

describe("ParticleBurst", () => {
  it("stays quiet when the toggle is on at the first render", () => {
    const { container } = render(<Toggle initial />)
    expect(dots(container)).toBe(0)
  })

  it("stays quiet when the toggle turns on without a press", async () => {
    const { container } = render(<Toggle />)
    await userEvent.click(screen.getByRole("button", { name: "Load" }))
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "true")
    expect(dots(container)).toBe(0)
  })

  it("stays quiet when the press is not armed", async () => {
    const { container } = render(<Toggle armOnPress={false} />)
    await userEvent.click(screen.getByRole("button", { name: "Like" }))
    expect(dots(container)).toBe(0)
  })

  it("bursts 8 dots when the reader's press turns it on, and keeps focus and the name", async () => {
    const { container } = render(<Toggle />)
    const button = screen.getByRole("button", { name: "Like" })
    await userEvent.click(button)
    expect(dots(container)).toBe(8)
    expect(button).toHaveFocus()
    expect(screen.getByRole("button", { name: "Like" })).toBe(button)
    // Switching off does not play another burst.
    await userEvent.click(button)
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveFocus()
  })

  it("SuccessBurst plays 10 dots on mount", () => {
    const { container } = render(
      <SuccessBurst>
        <span aria-hidden>ok</span>
      </SuccessBurst>
    )
    expect(dots(container)).toBe(10)
    container.querySelectorAll("[data-particle]").forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"))
  })
})
