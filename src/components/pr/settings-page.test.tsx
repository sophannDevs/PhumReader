import { act } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it } from "vitest"
import { SettingsPage } from "@/components/pr/settings-page"
import type { Settings } from "@/lib/api/account"
import { meKeys } from "@/lib/api/keys"
import { useAppStore } from "@/lib/store"
import { THEME_STORAGE_KEY } from "@/lib/theme-script"
import { nav, router } from "@/test/navigation"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const signIn = (over: { name?: string; email?: string } = {}) => useAppStore.getState().login({ name: "Sokha Chan", email: "sokha@example.com", ...over })
const noDevices = http.get(`${API}/auth/devices`, () => HttpResponse.json({ items: [] }))

const save = (user: ReturnType<typeof renderUi>["user"]) => user.click(screen.getByRole("button", { name: "Save changes" }))

describe("SettingsPage: signed out", () => {
  it("asks to log in and remembers the page, and hides the account sections", async () => {
    nav.pathname = "/settings"
    const { user } = renderUi(<SettingsPage />)
    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument()
    expect(screen.getByText("Log in to change your settings")).toBeInTheDocument()
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log out everywhere" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/settings")
  })
})

describe("SettingsPage: signed in", () => {
  it("shows the profile, the section menu and no save bar until something changes", async () => {
    signIn()
    server.use(noDevices)
    renderUi(<SettingsPage />)
    expect(screen.getByLabelText("Display name")).toHaveValue("Sokha Chan")
    expect(screen.getByText("sokha@example.com")).toBeInTheDocument()
    expect(screen.getByText("SC")).toBeInTheDocument()
    const menu = within(screen.getByRole("navigation", { name: "Settings sections" }))
    for (const name of ["Account", "Reading", "Language and region", "Notifications", "Privacy and safety", "Coins and payments", "Account actions"])
      expect(menu.getByRole("link", { name })).toHaveAttribute("href", expect.stringMatching(/^#set-/))
    expect(screen.queryByText("You have unsaved changes")).not.toBeInTheDocument()
  })

  it("saves a new display name through the API, updates the stored user and hides the save bar", async () => {
    signIn()
    let body: unknown
    server.use(
      noDevices,
      http.patch(`${API}/me/profile`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: "u1", displayName: "Sokha K", email: "sokha@example.com", emailVerified: true, roles: ["READER"], avatarUrl: null })
      }),
    )
    const { user } = renderUi(<SettingsPage />)
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "  Sokha K ")
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument()
    await save(user)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"))
    expect(body).toEqual({ displayName: "Sokha K" })
    expect(useAppStore.getState().user?.name).toBe("Sokha K")
    expect(screen.queryByText("You have unsaved changes")).not.toBeInTheDocument()
  })

  it("will not save a name shorter than 2 characters", async () => {
    signIn()
    const { user } = renderUi(<SettingsPage />)
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "A")
    expect(screen.getByText("Enter at least 2 characters.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("shows the API's name error on the field and a toast for other failures", async () => {
    signIn()
    server.use(noDevices, http.patch(`${API}/me/profile`, () => apiError(400, "validation_failed", { fields: { displayName: "invalid" } })))
    const { user } = renderUi(<SettingsPage />)
    await user.type(screen.getByLabelText("Display name"), "x")
    await save(user)
    expect(await screen.findByText("Use 2 to 30 characters.")).toBeInTheDocument()
    server.use(http.patch(`${API}/me/profile`, () => apiError(500, "internal_error")))
    await user.type(screen.getByLabelText("Display name"), "y")
    await save(user)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That didn’t work. Try again."))
  })

  it("Discard puts the saved values back", async () => {
    signIn()
    const { user } = renderUi(<SettingsPage />)
    await user.type(screen.getByLabelText("Display name"), "x")
    await user.click(screen.getByRole("button", { name: "Discard" }))
    expect(screen.getByLabelText("Display name")).toHaveValue("Sokha Chan")
    expect(screen.queryByText("You have unsaved changes")).not.toBeInTheDocument()
  })

  it("logs out of every device through the API and clears the user", async () => {
    signIn()
    const calls: string[] = []
    server.use(
      noDevices,
      http.post(`${API}/auth/logout-all`, () => {
        calls.push("all")
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(`${API}/auth/logout`, () => {
        calls.push("this")
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Log out everywhere" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Logged out on all devices"))
    expect(calls[0]).toBe("all")
    expect(useAppStore.getState().user).toBeNull()
  })

  it("keeps the user signed in and says so when logging out everywhere fails", async () => {
    signIn()
    server.use(noDevices, http.post(`${API}/auth/logout-all`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Log out everywhere" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That didn’t work. Try again."))
    expect(useAppStore.getState().user).not.toBeNull()
  })

  it("opens the delete account dialog", async () => {
    signIn()
    server.use(noDevices)
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Delete account" }))
    expect(await screen.findByRole("alertdialog", { name: "Delete your account?" })).toBeInTheDocument()
  })
})

describe("SettingsPage: language", () => {
  it("has the current language selected", () => {
    signIn()
    server.use(noDevices)
    renderUi(<SettingsPage />)
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "ខ្មែរ" })).toHaveAttribute("lang", "km")
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

  it("does nothing for the current language", async () => {
    signIn()
    server.use(noDevices)
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "English" }))
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("still switches the page when saving the language to the account fails", async () => {
    signIn()
    server.use(noDevices, http.patch(`${API}/me/settings`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "ខ្មែរ" }))
    expect(router.replace).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("keeps at least one story language", async () => {
    signIn()
    server.use(noDevices)
    const { user } = renderUi(<SettingsPage />)
    const english = screen.getByRole("button", { name: "English" })
    const khmer = screen.getByRole("button", { name: /Khmer/ })
    await user.click(english)
    await user.click(khmer)
    expect(await screen.findByText("Choose at least one language.")).toBeInTheDocument()
  })
})

describe("SettingsPage: appearance and reading", () => {
  beforeEach(() => {
    signIn()
    server.use(noDevices)
  })

  it("changes the theme only when saved, then remembers it", async () => {
    const { user } = renderUi(<SettingsPage />)
    expect(await screen.findByRole("radio", { name: "System" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Dark" }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).not.toBe("dark")
    await save(user)
    await waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark"))
  })

  it("saves the web novel text size to the novel settings as well", async () => {
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("radio", { name: "Extra large" }))
    await save(user)
    await waitFor(() => expect(useAppStore.getState().settings.size).toBe("xl"))
    expect(useAppStore.getState().novelSettings.size).toBe(22)
  })

  it("saves the reading switches", async () => {
    const { user } = renderUi(<SettingsPage />)
    const auto = screen.getByRole("switch", { name: "Open the next episode automatically" })
    expect(auto).toBeChecked()
    await user.click(auto)
    await save(user)
    await waitFor(() => expect(useAppStore.getState().settings.autoNext).toBe(false))
  })
})

describe("SettingsPage: privacy", () => {
  it("lists blocked people and unblocks one", async () => {
    signIn()
    server.use(noDevices)
    useAppStore.setState({ blocked: ["Vibol K."] })
    const { user } = renderUi(<SettingsPage />)
    await user.click(screen.getByRole("button", { name: "Unblock Vibol K." }))
    expect(useAppStore.getState().blocked).toEqual([])
    expect(toast.success).toHaveBeenCalled()
  })
})

describe("SettingsPage: real app", () => {
  it("has no demo reset", () => {
    signIn()
    server.use(noDevices)
    renderUi(<SettingsPage />)
    expect(screen.queryByRole("button", { name: "Reset demo data" })).not.toBeInTheDocument()
  })

  it("keeps Download your data with the button off and Coming soon (the API has no export yet)", () => {
    signIn()
    server.use(noDevices)
    renderUi(<SettingsPage />)
    expect(screen.getByText("Download your data")).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Request download" })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription("Coming soon")
  })

  it("lists an account report from the API as the profile it was about", () => {
    signIn()
    server.use(noDevices)
    useAppStore.setState({
      reports: [{ id: "R-20483", kind: "user", target: "Profile of Rude Rithy", who: "Rude Rithy", reason: "harass", details: "", at: Date.parse("2026-11-11T03:00:00Z"), status: "In review" }],
    })
    renderUi(<SettingsPage />)
    expect(screen.getByText("Profile of Rude Rithy")).toBeInTheDocument()
    expect(screen.getByText(/R-20483/)).toBeInTheDocument()
  })
})

/** The account's settings as GET /me/settings answers them (V21-03 alert defaults unless changed). */
const accountSettings = (notifications: Partial<Settings["notifications"]> = {}): Settings => ({
  language: "en",
  theme: "system",
  reader: { font: "sans", size: 18, theme: "light", wide: true },
  notifications: {
    episodes: true,
    fastPass: true,
    types: {
      update: { push: true, email: false },
      comment: { push: true, email: false },
      coins: { push: true, email: true },
      fastpass: { push: true, email: false },
      news: { push: false, email: false },
    },
    quiet: { on: true, from: 22, to: 7 },
    digest: false,
    ...notifications,
  },
  preferences: { genres: null, storyLanguages: ["en", "km"] },
})

describe("SettingsPage: notifications summary (real API)", () => {
  it("sums up the account's alert settings once they are loaded, without a request of its own", async () => {
    signIn()
    server.use(noDevices)
    const { client } = renderUi(<SettingsPage />)
    expect(screen.getByText("New episodes, replies and payments. Push on, email off.")).toBeInTheDocument()
    act(() => {
      client.setQueryData(meKeys.settings("sokha@example.com"), accountSettings({ digest: true }))
    })
    expect(await screen.findByText("Your custom alert choices are on.")).toBeInTheDocument()
  })

  it("follows the account, not choices this browser kept from before", async () => {
    signIn()
    server.use(noDevices)
    useAppStore.setState((s) => ({ notifPrefs: { ...s.notifPrefs, news: [true, true] } }))
    const { client } = renderUi(<SettingsPage />)
    expect(screen.getByText("Your custom alert choices are on.")).toBeInTheDocument()
    act(() => {
      client.setQueryData(meKeys.settings("sokha@example.com"), accountSettings())
    })
    expect(await screen.findByText("New episodes, replies and payments. Push on, email off.")).toBeInTheDocument()
  })
})
