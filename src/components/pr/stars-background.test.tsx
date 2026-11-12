import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StarsBackground } from "@/components/pr/stars-background"

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => motion.reduced,
}))

function finePointer() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: query === "(pointer: fine)", media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  )
}

describe("StarsBackground", () => {
  beforeEach(() => {
    motion.reduced = false
  })

  it("is decorative: hidden from assistive tech, no pointer events, three star layers", () => {
    const { container } = render(<StarsBackground className="text-foreground/60" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute("aria-hidden", "true")
    expect(root).toHaveClass("pointer-events-none", "absolute", "inset-0", "-z-10", "text-foreground/60")
    expect(root.querySelectorAll('[data-slot="star-layer"]')).toHaveLength(3)
  })

  it("draws the same stars every time (server and browser match)", () => {
    const a = render(<StarsBackground />).container.innerHTML
    const b = render(<StarsBackground />).container.innerHTML
    expect(a).toBe(b)
  })

  it("follows a mouse pointer", () => {
    finePointer()
    const add = vi.spyOn(window, "addEventListener")
    render(<StarsBackground />)
    expect(add).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true })
  })

  it("stays still with reduced motion: no drift, no parallax", () => {
    motion.reduced = true
    finePointer()
    const add = vi.spyOn(window, "addEventListener")
    const { container } = render(<StarsBackground />)
    expect(container.firstElementChild).toHaveAttribute("data-still", "true")
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.anything(), expect.anything())
  })
})
