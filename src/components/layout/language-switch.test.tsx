import { afterEach, describe, expect, it } from "vitest"
import { LangPills } from "@/components/layout/language-switch"
import { useAppStore } from "@/lib/store"
import { nav, router } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"

/** LangPills: the English / ខ្មែរ toggle on the error pages, the auth card and the unavailable series page. */
describe("LangPills", () => {
  afterEach(() => window.history.replaceState(null, "", "/"))

  it("presses the current language and switches to the other one on the same page, query kept", async () => {
    nav.pathname = "/series/glass-compass"
    window.history.replaceState(null, "", "/series/glass-compass?tab=details")
    const { user } = renderUi(<LangPills label="Language" />)

    const group = screen.getByRole("group", { name: "Language" })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true")
    const khmer = screen.getByRole("button", { name: "ខ្មែរ" })
    expect(khmer).toHaveAttribute("aria-pressed", "false")
    expect(khmer).toHaveAttribute("lang", "km")

    await user.click(khmer)
    expect(router.replace).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith("/series/glass-compass?tab=details", { locale: "km" })
    expect(useAppStore.getState().lang).toBe("km")
  })

  it("does nothing when the current language is picked", async () => {
    const { user } = renderUi(<LangPills label="ភាសា" />, { locale: "km" })
    const khmer = screen.getByRole("button", { name: "ខ្មែរ" })
    expect(khmer).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false")

    await user.click(khmer)
    expect(router.replace).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "English" }))
    expect(router.replace).toHaveBeenCalledWith("/", { locale: "en" })
  })

  it("adds data-locale-switch only when asked (the offline page's script needs it)", () => {
    const { unmount } = renderUi(<LangPills label="Language" />)
    expect(screen.getByRole("button", { name: "English" })).not.toHaveAttribute("data-locale-switch")
    unmount()

    renderUi(<LangPills label="Language" localeSwitchAttr />)
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("data-locale-switch", "en")
    expect(screen.getByRole("button", { name: "ខ្មែរ" })).toHaveAttribute("data-locale-switch", "km")
  })
})
