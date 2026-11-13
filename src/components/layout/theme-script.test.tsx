import { render } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ThemeScript } from "@/components/layout/theme-script"
import { themeInitScript } from "@/lib/theme-script"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ThemeScript", () => {
  it("renders an inert text/plain copy on the client, without React's script-tag warning", () => {
    const error = vi.spyOn(console, "error")
    const { container } = render(<ThemeScript />)
    const script = container.querySelector("script")
    expect(script).not.toBeNull()
    expect(script).toHaveAttribute("type", "text/plain")
    expect(script?.innerHTML).toBe(themeInitScript)
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining("Encountered a script tag"))
  })

  it("renders a runnable text/javascript script in the server HTML", () => {
    // No `window` on the server: the helper picks the executable type there.
    vi.stubGlobal("window", undefined)
    const html = renderToString(<ThemeScript />)
    expect(html).toContain('type="text/javascript"')
    expect(html).toContain(themeInitScript)
  })
})
