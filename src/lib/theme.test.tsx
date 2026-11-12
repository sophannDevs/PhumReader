import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { novelVars, comicVars } from "@/components/pr/reader-theme"
import { ThemeProvider, useTheme, type Theme } from "@/lib/theme"
import { THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme-script"

/** A matchMedia stub whose "(prefers-color-scheme: dark)" answer is `dark`. */
function mockSystem(dark: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("dark") ? dark : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  )
}

function Probe() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <>
      <span data-testid="resolved">{resolvedTheme ?? "none"}</span>
      {(["light", "dark", "system"] as Theme[]).map((t) => (
        <button key={t} type="button" onClick={() => setTheme(t)}>
          {`pick-${t}`}
        </button>
      ))}
    </>
  )
}
const pick = (t: Theme) => screen.getByRole("button", { name: `pick-${t}` }).click()

const html = () => document.documentElement

afterEach(() => {
  html().style.colorScheme = ""
})

describe("ThemeProvider", () => {
  it("dark adds the dark class to <html>", async () => {
    mockSystem(false)
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    expect(await screen.findByText("dark")).toBeInTheDocument()
    expect(html()).toHaveClass("dark")
    expect(html().style.colorScheme).toBe("dark")
  })

  it("light removes it again", async () => {
    mockSystem(false)
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    expect(await screen.findByText("dark")).toBeInTheDocument()
    act(() => pick("light"))
    expect(html()).not.toHaveClass("dark")
    expect(html().style.colorScheme).toBe("light")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })

  it("system follows the device setting", async () => {
    mockSystem(true)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    expect(await screen.findByText("dark")).toBeInTheDocument()
    expect(html()).toHaveClass("dark")
    act(() => pick("light"))
    expect(html()).not.toHaveClass("dark")
    act(() => pick("system"))
    expect(html()).toHaveClass("dark")
  })

  it("system on a light device stays light", async () => {
    mockSystem(false)
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    )
    expect(await screen.findByText("light")).toBeInTheDocument()
    expect(html()).not.toHaveClass("dark")
  })
})

describe("themeInitScript (first paint)", () => {
  const run = () => new Function(themeInitScript)()

  it("sets dark before React for a stored dark theme, and for system on a dark device", () => {
    mockSystem(false)
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    run()
    expect(html()).toHaveClass("dark")
    html().classList.remove("dark")

    mockSystem(true)
    localStorage.removeItem(THEME_STORAGE_KEY)
    run()
    expect(html()).toHaveClass("dark")
    html().classList.remove("dark")
  })

  it("leaves light alone", () => {
    mockSystem(true)
    localStorage.setItem(THEME_STORAGE_KEY, "light")
    run()
    expect(html()).not.toHaveClass("dark")
    expect(html().style.colorScheme).toBe("light")
  })
})

describe("reader themes stay independent of the site theme", () => {
  it("light readers carry a full light token set", () => {
    for (const vars of [novelVars("light"), comicVars("light")] as Record<string, string>[]) {
      expect(vars).toBeDefined()
      expect(vars.colorScheme).toBe("light")
      expect(vars["--background"]).toBe("#ffffff")
      expect(vars["--foreground"]).toBe("#09090b")
      expect(vars["--brand-ink"]).toBe("#047a3a")
    }
  })

  it("sepia sets its own text colours", () => {
    const sepia = novelVars("sepia") as Record<string, string>
    expect(sepia.colorScheme).toBe("light")
    expect(sepia["--foreground"]).toBeDefined()
    expect(sepia["--brand-ink"]).toBe("#047a3a")
    expect(sepia["--background"]).toBe("#fbf6ec")
  })
})
