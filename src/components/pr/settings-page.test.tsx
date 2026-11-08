import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { SettingsPage } from "@/components/pr/settings-page"
import { useAppStore } from "@/lib/store"
import { THEME_STORAGE_KEY } from "@/lib/theme-script"
import { nav, router } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const signIn = (over: { name?: string; email?: string } = {}) => useAppStore.getState().login({ name: "Sokha Chan", email: "sokha@example.com", ...over })
const noDevices = http.get(`${API}/auth/devices`, () => HttpResponse.json({ items: [] }))

describe("SettingsPage: signed out", () => {
  it("asks to log in and remembers the page, and hides the account sections", async () => {
    nav.pathname = "/settings"
    const { user } = renderUi(<SettingsPage />)
    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument()
    expect(screen.getByText("Log in to see your profile.")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Security" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/settings")
  })

  it("says notification choices are saved on this device only", () => {
    renderUi(<SettingsPage />)
    expect(screen.getByText("Saved on this device only.")).toBeInTheDocument()
  })
})

describe("SettingsPage: signed in", () => {
  it("shows the profile with the name and email, the Edit button and the security section", async () => {
    signIn()
    server.use(noDevices)
    renderUi(<SettingsPage />)
    expect(screen.getByText("Sokha Chan", { selector: "dd" })).toBeInTheDocument()
    expect(screen.getByText("sokha@example.com")).toBeInTheDocument()
    expect(screen.getByText("SC")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument()
    expect(screen.getByText("Saved to your account.")).toBeInTheDocument()
  })

  it("logs out through the API, clears the user and says so", async () => {
    signIn()
    let called = false
    server.use(
      noDevices,
      http.post(`${API}/auth/logout`, () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Log out" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("You're logged out"))
    expect(called).toBe(true)
    expect(useAppStore.getState().user).toBeNull()
  })

  it("still logs out on this device when the API call fails", async () => {
    signIn()
    server.use(noDevices, http.post(`${API}/auth/logout`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Log out" }))
    await waitFor(() => expect(useAppStore.getState().user).toBeNull())
  })
})

describe("SettingsPage: language", () => {
  it("has the current language selected", () => {
    renderUi(<SettingsPage />)
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked()
    expect(screen.getByText("ខ្មែរ")).toHaveAttribute("lang", "km")
  })

  it("switches to Khmer: stores it, tells the account and moves to the Khmer address", async () => {
    signIn()
    let body: unknown
    server.use(
      noDevices,
      http.patch(`${API}/me/settings`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({})
      }),
    )
    nav.pathname = "/settings"
    nav.search = "?tab=a"
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "ខ្មែរ" }))
    expect(useAppStore.getState().lang).toBe("km")
    expect(router.replace).toHaveBeenCalledWith("/settings", { locale: "km" })
    await waitFor(() => expect(body).toEqual({ language: "km" }))
  })

  it("does not call the account when signed out, and does nothing for the current language", async () => {
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "English" }))
    expect(router.replace).not.toHaveBeenCalled()
    await user.click(screen.getByRole("radio", { name: "ខ្មែរ" }))
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it("still switches the page when saving the language to the account fails", async () => {
    signIn()
    server.use(noDevices, http.patch(`${API}/me/settings`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "ខ្មែរ" }))
    expect(router.replace).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe("SettingsPage: appearance, reading and notifications", () => {
  it("switches the theme and remembers it", async () => {
    const { user } = renderUi(<SettingsPage />)
    expect(await screen.findByRole("radio", { name: "System" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Dark" }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
    expect(document.documentElement).toHaveClass("dark")
    await user.click(screen.getByRole("radio", { name: "Light" }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
    expect(document.documentElement).not.toHaveClass("dark")
  })

  it("shows the reading controls and a preview that follows them", async () => {
    const { user } = renderUi(<SettingsPage />)
    const preview = screen.getByText("Preview").closest("[data-reader-theme]") as HTMLElement
    expect(preview).toHaveAttribute("data-reader-theme", "light")
    await user.click(screen.getByRole("tab", { name: "Sepia" }))
    expect(preview).toHaveAttribute("data-reader-theme", "sepia")
    await user.click(screen.getByRole("button", { name: "Increase text size" }))
    expect(preview.style.getPropertyValue("--novel-size")).toBe("20px")
  })

  it("toggles each notification and stores it", async () => {
    const { user } = renderUi(<SettingsPage />)
    const episodes = screen.getByRole("switch", { name: "New-episode alerts" })
    const fastPass = screen.getByRole("switch", { name: "Fast Pass reminders" })
    expect(episodes).toBeChecked()
    expect(fastPass).not.toBeChecked()
    await user.click(episodes)
    await user.click(fastPass)
    expect(useAppStore.getState().notifications).toEqual({ episodes: false, fastPass: true })
    expect(within(document.body).getByRole("switch", { name: "Fast Pass reminders" })).toBeChecked()
  })

  it("has no demo reset in the real app", () => {
    renderUi(<SettingsPage />)
    expect(screen.queryByRole("button", { name: "Reset demo data" })).not.toBeInTheDocument()
  })
})
