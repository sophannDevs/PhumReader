import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { DisplayNameEditor, SecuritySection } from "@/components/pr/account-security"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const me = (over: Record<string, unknown> = {}) => ({ id: "u1", displayName: "Sokha", email: "sokha@example.com", emailVerified: true, roles: ["READER"], avatarUrl: null, ...over })
const device = (id: string, current: boolean, over: Record<string, unknown> = {}) => ({ id, browser: "Chrome", system: "macOS", current, lastActiveAt: "2026-11-08T07:00:00Z", ...over })
const devices = (...items: ReturnType<typeof device>[]) => http.get(`${API}/auth/devices`, () => HttpResponse.json({ items }))
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })

describe("DisplayNameEditor", () => {
  it("shows nothing when signed out", () => {
    const { container } = renderUi(<DisplayNameEditor />)
    expect(container).toBeEmptyDOMElement()
  })

  it("opens a form filled with the current name, and Cancel puts the button back", async () => {
    signIn()
    const { user } = renderUi(<DisplayNameEditor />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(screen.getByLabelText("Display name")).toHaveValue("Sokha")
    expect(screen.getByLabelText("Display name")).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("rejects fewer than 2 characters without calling the API", async () => {
    signIn()
    const { user } = renderUi(<DisplayNameEditor />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), " A ")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Use 2 to 60 characters.")
  })

  it("saves the trimmed name, updates the stored user and closes the form", async () => {
    signIn()
    let body: unknown
    server.use(
      http.patch(`${API}/me/profile`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(me({ displayName: "Sokha Chan" }))
      }),
    )
    const { user } = renderUi(<DisplayNameEditor />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "  Sokha Chan ")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Name saved"))
    expect(body).toEqual({ displayName: "Sokha Chan" })
    expect(useAppStore.getState().user?.name).toBe("Sokha Chan")
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("shows the API's name error on the field and a toast for other failures", async () => {
    signIn()
    server.use(http.patch(`${API}/me/profile`, () => apiError(400, "validation_failed", { fields: { displayName: "invalid" } })))
    const { user } = renderUi(<DisplayNameEditor />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Use 2 to 60 characters.")
    server.use(http.patch(`${API}/me/profile`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 10 })))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 10 seconds." })))
  })
})

describe("SecuritySection: change password", () => {
  async function open() {
    signIn()
    server.use(devices(device("d1", true)))
    const view = renderUi(<SecuritySection card="" />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await view.user.click(screen.getByRole("button", { name: "Change password" }))
    await screen.findByRole("dialog", { name: "Change password" })
    return view
  }
  const dialog = () => within(screen.getByRole("dialog"))

  it("opens, and closes with Cancel, Escape and the X", async () => {
    const { user } = await open()
    await user.click(dialog().getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Change password" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Change password" }))
    await user.click(await screen.findByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("needs the current password and a strong new one", async () => {
    const { user } = await open()
    await user.click(dialog().getByRole("button", { name: "Save" }))
    expect(await dialog().findByText("Enter your password.")).toBeInTheDocument()
    expect(dialog().getByText(/Choose a stronger password/)).toBeInTheDocument()
  })

  it("posts both passwords, toasts, and closes", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/change-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "OldPass1!")
    await user.type(dialog().getByLabelText("New password"), "NewPass1!")
    await user.click(dialog().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Password changed. Your other devices were signed out."))
    expect(body).toEqual({ currentPassword: "OldPass1!", newPassword: "NewPass1!" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("marks a wrong current password on its field and keeps the dialog open", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(400, "validation_failed", { fields: { currentPassword: "wrong" } })))
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "nope")
    await user.type(dialog().getByLabelText("New password"), "NewPass1!")
    await user.click(dialog().getByRole("button", { name: "Save" }))
    expect(await dialog().findByText("That password isn't right.")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("marks a weak new password from the API on its field", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(400, "validation_failed", { fields: { newPassword: "weak" } })))
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "OldPass1!")
    await user.type(dialog().getByLabelText("New password"), "NewPass1!")
    await user.click(dialog().getByRole("button", { name: "Save" }))
    expect(await dialog().findByText(/Choose a stronger password/)).toBeInTheDocument()
  })

  it("toasts the wait on a rate limit", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 30 })))
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "OldPass1!")
    await user.type(dialog().getByLabelText("New password"), "NewPass1!")
    await user.click(dialog().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 30 seconds." })))
  })
})

describe("SecuritySection: change email", () => {
  async function open() {
    signIn()
    server.use(devices(device("d1", true)))
    const view = renderUi(<SecuritySection card="" />)
    await view.user.click(screen.getByRole("button", { name: "Change email" }))
    await screen.findByRole("dialog", { name: "Change email" })
    return view
  }
  const dialog = () => within(screen.getByRole("dialog"))
  const fill = async (user: Awaited<ReturnType<typeof open>>["user"], email: string, password = "Secret123!") => {
    if (email) await user.type(dialog().getByLabelText("New email"), email)
    if (password) await user.type(dialog().getByLabelText("Current password"), password)
    await user.click(dialog().getByRole("button", { name: "Send code" }))
  }

  it("validates the new email and the password", async () => {
    const { user } = await open()
    await fill(user, "nope", "")
    expect(await dialog().findByText("Enter a valid email, like you@example.com.")).toBeInTheDocument()
    expect(dialog().getByText("Enter your password.")).toBeInTheDocument()
  })

  it("closes with Cancel and Escape", async () => {
    const { user } = await open()
    await user.click(dialog().getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Change email" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("sends the code, then the code confirms the change, updates the user and closes", async () => {
    let sent: unknown
    let confirmed: unknown
    server.use(
      http.post(`${API}/auth/change-email`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ email: "new@example.com", codeExpiresInSeconds: 600 })
      }),
      http.post(`${API}/auth/change-email/confirm`, async ({ request }) => {
        confirmed = await request.json()
        return HttpResponse.json(me({ email: "new@example.com" }))
      }),
    )
    const { user } = await open()
    await fill(user, " new@example.com ")
    expect(await dialog().findByText("We sent a 6-digit code to new@example.com.")).toBeInTheDocument()
    expect(sent).toEqual({ newEmail: "new@example.com", password: "Secret123!" })
    const confirm = dialog().getByRole("button", { name: "Confirm" })
    expect(confirm).toBeDisabled()
    await user.type(dialog().getByLabelText("Verification code"), "123456")
    await user.click(confirm)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Email changed"))
    expect(confirmed).toEqual({ code: "123456" })
    expect(useAppStore.getState().user?.email).toBe("new@example.com")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each([
    ["email_taken", "That email already has an account."],
    ["same_email", "That is already your email."],
  ])("shows %s on the email field", async (code, message) => {
    server.use(http.post(`${API}/auth/change-email`, () => apiError(409, "conflict", { fields: { newEmail: code } })))
    const { user } = await open()
    await fill(user, "new@example.com")
    expect(await dialog().findByText(message)).toBeInTheDocument()
  })

  it("marks a wrong password on its field", async () => {
    server.use(http.post(`${API}/auth/change-email`, () => apiError(400, "validation_failed", { fields: { password: "wrong" } })))
    const { user } = await open()
    await fill(user, "new@example.com", "bad")
    expect(await dialog().findByText("That password isn't right.")).toBeInTheDocument()
  })

  it("shows a wrong code, clears it for another try, and keeps the step", async () => {
    server.use(
      http.post(`${API}/auth/change-email`, () => HttpResponse.json({ email: "new@example.com", codeExpiresInSeconds: 600 })),
      http.post(`${API}/auth/change-email/confirm`, () => apiError(400, "invalid_code")),
    )
    const { user } = await open()
    await fill(user, "new@example.com")
    await user.type(await dialog().findByLabelText("Verification code"), "000000")
    await user.click(dialog().getByRole("button", { name: "Confirm" }))
    expect(await dialog().findByText("That code isn't right.")).toBeInTheDocument()
    expect(dialog().getByLabelText("Verification code")).toHaveValue("")
  })

  it("starts again from the first step after closing in the code step", async () => {
    server.use(http.post(`${API}/auth/change-email`, () => HttpResponse.json({ email: "new@example.com", codeExpiresInSeconds: 600 })))
    const { user } = await open()
    await fill(user, "new@example.com")
    await dialog().findByLabelText("Verification code")
    await user.click(dialog().getByRole("button", { name: "Cancel" }))
    await user.click(screen.getByRole("button", { name: "Change email" }))
    expect(await dialog().findByLabelText("New email")).toHaveValue("")
  })
})

describe("SecuritySection: delete account", () => {
  async function open() {
    signIn()
    server.use(devices(device("d1", true)))
    const view = renderUi(<SecuritySection card="" />)
    await view.user.click(screen.getByRole("button", { name: "Delete account" }))
    await screen.findByRole("dialog", { name: "Delete your account?" })
    return view
  }
  const dialog = () => within(screen.getByRole("dialog"))

  it("keeps Delete disabled until a password is typed, and closes with Cancel and Escape", async () => {
    const { user } = await open()
    expect(dialog().getByRole("button", { name: "Delete account" })).toBeDisabled()
    await user.click(dialog().getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete account" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("posts the password, says when the account will be erased and signs this device out", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/delete-account`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ deleteAfter: "2026-12-08T07:00:00Z" })
      }),
    )
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "Secret123!")
    await user.click(dialog().getByRole("button", { name: "Delete account" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/will be deleted on .*2026/), { duration: 8000 }))
    expect(body).toEqual({ password: "Secret123!" })
    expect(useAppStore.getState().user).toBeNull()
  })

  it("marks a wrong password, clears the mark when typing again, and keeps the user signed in", async () => {
    server.use(http.post(`${API}/auth/delete-account`, () => apiError(400, "validation_failed", { fields: { password: "wrong" } })))
    const { user } = await open()
    await user.type(dialog().getByLabelText("Current password"), "nope")
    await user.click(dialog().getByRole("button", { name: "Delete account" }))
    expect(await dialog().findByText("That password isn't right.")).toBeInTheDocument()
    expect(useAppStore.getState().user).not.toBeNull()
    await user.type(dialog().getByLabelText("Current password"), "x")
    expect(dialog().queryByText("That password isn't right.")).not.toBeInTheDocument()
  })
})

describe("SecuritySection: devices", () => {
  it("lists the devices, marks this one and offers Sign out only for the others", async () => {
    signIn()
    server.use(devices(device("d1", true), device("d2", false, { browser: "Safari", system: "iOS" }), device("d3", false, { browser: null, system: null })))
    renderUi(<SecuritySection card="" />)
    expect(await screen.findByText("Chrome · macOS")).toBeInTheDocument()
    expect(screen.getByText("This device")).toBeInTheDocument()
    expect(screen.getByText("Safari · iOS")).toBeInTheDocument()
    expect(screen.getByText("Unknown device")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument()
  })

  it("hides Sign out everywhere when this is the only device", async () => {
    signIn()
    server.use(devices(device("d1", true)))
    renderUi(<SecuritySection card="" />)
    await screen.findByText("This device")
    expect(screen.queryByRole("button", { name: "Sign out everywhere" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()
  })

  it("signs one device out and reloads the list", async () => {
    signIn()
    let removed = ""
    let list = [device("d1", true), device("d2", false, { browser: "Safari", system: "iOS" })]
    server.use(
      http.get(`${API}/auth/devices`, () => HttpResponse.json({ items: list })),
      http.delete(`${API}/auth/devices/:id`, ({ params }) => {
        removed = String(params.id)
        list = list.filter((d) => d.id !== removed)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<SecuritySection card="" />)
    await user.click(await screen.findByRole("button", { name: "Sign out" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Device signed out"))
    expect(removed).toBe("d2")
    await waitFor(() => expect(screen.queryByText("Safari · iOS")).not.toBeInTheDocument())
  })

  it("signs out everywhere and logs this device out", async () => {
    signIn()
    server.use(
      devices(device("d1", true), device("d2", false)),
      http.post(`${API}/auth/logout-all`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    )
    const { user } = renderUi(<SecuritySection card="" />)
    await user.click(await screen.findByRole("button", { name: "Sign out everywhere" }))
    await waitFor(() => expect(useAppStore.getState().user).toBeNull())
  })

  it("offers a Retry when the list does not load", async () => {
    signIn()
    server.use(http.get(`${API}/auth/devices`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<SecuritySection card="" />)
    const retry = await screen.findByRole("button", { name: "Couldn't load devices. Retry" })
    server.use(devices(device("d1", true)))
    await user.click(retry)
    expect(await screen.findByText("This device")).toBeInTheDocument()
  })
})
