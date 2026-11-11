import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { DeleteAccountDialog, Devices, EmailField, PasswordRow } from "@/components/pr/account-security"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const me = (over: Record<string, unknown> = {}) => ({ id: "u1", displayName: "Sokha", email: "sokha@example.com", emailVerified: true, roles: ["READER"], avatarUrl: null, ...over })
const device = (id: string, current: boolean, over: Record<string, unknown> = {}) => ({ id, browser: "Chrome", system: "macOS", current, lastActiveAt: "2026-11-08T07:00:00Z", ...over })
const devices = (...items: ReturnType<typeof device>[]) => http.get(`${API}/auth/devices`, () => HttpResponse.json({ items }))
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })

/** Display name editing lives in the profile card of Settings (see settings-page.test.tsx). */

describe("PasswordRow: change password", () => {
  async function open() {
    signIn()
    const view = renderUi(<PasswordRow />)
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()
    await view.user.click(screen.getByRole("button", { name: "Change password" }))
    await screen.findByLabelText("Current password")
    return view
  }
  const fill = async (user: Awaited<ReturnType<typeof open>>["user"], cur: string, nw: string, again = nw) => {
    if (cur) await user.type(screen.getByLabelText("Current password"), cur)
    if (nw) await user.type(screen.getByLabelText("New password"), nw)
    if (again) await user.type(screen.getByLabelText("Confirm new password"), again)
    await user.click(screen.getByRole("button", { name: "Update password" }))
  }

  it("opens inline, and closes with Cancel and with the toggle button", async () => {
    const { user } = await open()
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Change password" }))
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()
  })

  it("checks the form before sending anything", async () => {
    const { user } = await open()
    await user.click(screen.getByRole("button", { name: "Update password" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your current password.")
    await fill(user, "OldPass1!", "short")
    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 8 characters, with a letter and a number.")
  })

  it("asks for the same new password twice, and a different one from the current", async () => {
    const { user } = await open()
    await fill(user, "OldPass1!", "NewPass1!", "NewPass2!")
    expect(await screen.findByRole("alert")).toHaveTextContent("The new passwords don’t match.")
    await user.clear(screen.getByLabelText("Current password"))
    await user.clear(screen.getByLabelText("New password"))
    await user.clear(screen.getByLabelText("Confirm new password"))
    await fill(user, "SamePass1", "SamePass1")
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a password you haven’t used here.")
  })

  it("posts both passwords, toasts, and closes", async () => {
    let body: unknown
    server.use(
      devices(device("d1", true)),
      http.post(`${API}/auth/change-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await open()
    await fill(user, "OldPass1!", "NewPass1!")
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Password changed. Your other devices were signed out."))
    expect(body).toEqual({ currentPassword: "OldPass1!", newPassword: "NewPass1!" })
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()
  })

  it("marks a wrong current password and keeps the form open", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(400, "validation_failed", { fields: { currentPassword: "wrong" } })))
    const { user } = await open()
    await fill(user, "nope1234", "NewPass1!")
    expect(await screen.findByRole("alert")).toHaveTextContent("That password isn't right.")
    expect(screen.getByLabelText("Current password")).toBeInTheDocument()
  })

  it("shows the API's weak new password answer", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(400, "validation_failed", { fields: { newPassword: "weak" } })))
    const { user } = await open()
    await fill(user, "OldPass1!", "NewPass1!")
    expect(await screen.findByRole("alert")).toHaveTextContent(/Choose a stronger password/)
  })

  it("toasts the wait on a rate limit", async () => {
    server.use(http.post(`${API}/auth/change-password`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 30 })))
    const { user } = await open()
    await fill(user, "OldPass1!", "NewPass1!")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 30 seconds." })))
  })
})

describe("EmailField: change email", () => {
  async function open() {
    signIn()
    const view = renderUi(<EmailField email="sokha@example.com" />)
    expect(screen.getByText("sokha@example.com")).toBeInTheDocument()
    expect(screen.getByText("Verified")).toBeInTheDocument()
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

describe("DeleteAccountDialog", () => {
  function open() {
    signIn()
    const view = renderUi(<DeleteAccountDialog open onOpenChange={() => {}} />)
    return { ...view, dialog: () => within(screen.getByRole("alertdialog", { name: "Delete your account?" })) }
  }

  it("keeps Delete disabled until DELETE and a password are typed", async () => {
    const { user, dialog } = open()
    const button = dialog().getByRole("button", { name: "Delete account" })
    expect(button).toBeDisabled()
    await user.type(dialog().getByLabelText("Type DELETE to confirm"), "DELETE")
    expect(button).toBeDisabled()
    await user.type(dialog().getByLabelText("Current password"), "Secret123!")
    expect(button).toBeEnabled()
  })

  it("closes with Cancel and Escape", async () => {
    const onOpenChange = vi.fn()
    signIn()
    const { user } = renderUi(<DeleteAccountDialog open onOpenChange={onOpenChange} />)
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledTimes(2)
  })

  it("posts the password, says when the account will be erased and signs this device out", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/delete-account`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ deleteAfter: "2026-12-08T07:00:00Z" })
      }),
    )
    const { user, dialog } = open()
    await user.type(dialog().getByLabelText("Type DELETE to confirm"), "DELETE")
    await user.type(dialog().getByLabelText("Current password"), "Secret123!")
    await user.click(dialog().getByRole("button", { name: "Delete account" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/will be deleted on .*2026/), { duration: 8000 }))
    expect(body).toEqual({ password: "Secret123!" })
    expect(useAppStore.getState().user).toBeNull()
  })

  it("marks a wrong password, clears the mark when typing again, and keeps the user signed in", async () => {
    server.use(http.post(`${API}/auth/delete-account`, () => apiError(400, "validation_failed", { fields: { password: "wrong" } })))
    const { user, dialog } = open()
    await user.type(dialog().getByLabelText("Type DELETE to confirm"), "DELETE")
    await user.type(dialog().getByLabelText("Current password"), "nope")
    await user.click(dialog().getByRole("button", { name: "Delete account" }))
    expect(await dialog().findByText("That password isn't right.")).toBeInTheDocument()
    expect(useAppStore.getState().user).not.toBeNull()
    await user.type(dialog().getByLabelText("Current password"), "x")
    expect(dialog().queryByText("That password isn't right.")).not.toBeInTheDocument()
  })
})

describe("Devices", () => {
  it("lists the devices, marks this one and offers Sign out only for the others", async () => {
    signIn()
    server.use(devices(device("d1", true), device("d2", false, { browser: "Safari", system: "iOS" }), device("d3", false, { browser: null, system: null })))
    renderUi(<Devices />)
    expect(await screen.findByText("Chrome · macOS")).toBeInTheDocument()
    expect(screen.getByText("This device")).toBeInTheDocument()
    expect(screen.getByText("Safari · iOS")).toBeInTheDocument()
    expect(screen.getByText("Unknown device")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(2)
  })

  it("offers no Sign out when this is the only device", async () => {
    signIn()
    server.use(devices(device("d1", true)))
    renderUi(<Devices />)
    await screen.findByText("This device")
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
    const { user } = renderUi(<Devices />)
    await user.click(await screen.findByRole("button", { name: "Sign out" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Device signed out"))
    expect(removed).toBe("d2")
    await waitFor(() => expect(screen.queryByText("Safari · iOS")).not.toBeInTheDocument())
  })

  it("offers a Retry when the list does not load", async () => {
    signIn()
    server.use(http.get(`${API}/auth/devices`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<Devices />)
    const retry = await screen.findByRole("button", { name: "Couldn't load devices. Retry" })
    server.use(devices(device("d1", true)))
    await user.click(retry)
    expect(await screen.findByText("This device")).toBeInTheDocument()
  })
})
