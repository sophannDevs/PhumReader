import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { LoginView } from "@/components/auth/login-view"
import { useAppStore } from "@/lib/store"
import { setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const me = { id: "u1", displayName: "Sokha", email: "reader@example.com", emailVerified: true, roles: ["READER"], avatarUrl: null }

function setup() {
  const onForgot = vi.fn()
  const onDone = vi.fn()
  const onNeedsCode = vi.fn()
  const view = renderUi(<LoginView onForgot={onForgot} onSignup={vi.fn()} onDone={onDone} onNeedsCode={onNeedsCode} />)
  return { ...view, onForgot, onDone, onNeedsCode }
}

const fill = async (user: ReturnType<typeof setup>["user"], email: string, password: string) => {
  if (email) await user.type(screen.getByLabelText("Email"), email)
  if (password) await user.type(screen.getByLabelText("Password"), password)
  await user.click(screen.getByRole("button", { name: "Log in" }))
}

describe("LoginView: validation", () => {
  it("shows both required messages and sends nothing when the form is empty", async () => {
    const { user } = setup()
    await fill(user, "", "")
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument()
    expect(screen.getByText("Enter your password.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true")
  })

  it("rejects an email without a domain", async () => {
    const { user } = setup()
    await fill(user, "reader@", "secret")
    expect(await screen.findByText("Enter a valid email, like you@example.com.")).toBeInTheDocument()
    expect(screen.queryByText("Enter your password.")).not.toBeInTheDocument()
  })

  it("links each error to its field for screen readers", async () => {
    const { user } = setup()
    await fill(user, "", "")
    await screen.findByText("Enter your email.")
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-describedby", "login-email-error")
    expect(document.getElementById("login-email-error")).toHaveTextContent("Enter your email.")
  })
})

describe("LoginView: signing in", () => {
  it("posts the trimmed email, stores the user and calls onDone", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(me)
      }),
    )
    const { user, onDone } = setup()
    await fill(user, "  reader@example.com ", "Secret123!")
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(body).toEqual({ email: "reader@example.com", password: "Secret123!", remember: true })
    // The view hands the user to the flow (AuthFlow stores it and shows "Welcome back").
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ name: "Sokha", email: "reader@example.com", roles: ["READER"] }))
  })

  it("sends remember: false when the box is unticked", async () => {
    let body: { remember?: boolean } = {}
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json(me)
      }),
    )
    const { user, onDone } = setup()
    await user.click(screen.getByRole("checkbox", { name: "Remember me" }))
    await fill(user, "reader@example.com", "Secret123!")
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(body.remember).toBe(false)
  })

  it("shows the wrong-details message and stays on the form", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError(401, "invalid_credentials")))
    const { user, onDone } = setup()
    await fill(user, "reader@example.com", "wrong")
    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument()
    // Like the prototype: the password is cleared and asked for again.
    expect(screen.getByLabelText("Password")).toHaveValue("")
    expect(screen.getByText("Enter your password.")).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect(useAppStore.getState().user).toBeNull()
  })

  it("moves to the code step when the email is not confirmed", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError(403, "email_not_verified")))
    const { user, onNeedsCode } = setup()
    await fill(user, "New@Example.com", "Secret123!")
    await waitFor(() => expect(onNeedsCode).toHaveBeenCalledWith("new@example.com"))
    expect(toast.info).toHaveBeenCalled()
  })

  it("tells the reader how long to wait after too many tries", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 42 })))
    const { user } = setup()
    await fill(user, "reader@example.com", "Secret123!")
    expect(await screen.findByText("Too many tries")).toBeInTheDocument()
    expect(screen.getByText("Try again in 42 seconds.")).toBeInTheDocument()
  })

  it("says the account is suspended", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError(403, "account_banned")))
    const { user } = setup()
    await fill(user, "reader@example.com", "Secret123!")
    expect(await screen.findByText(/suspended/)).toBeInTheDocument()
  })

  it("falls back to the generic error for anything else", async () => {
    server.use(http.post(`${API}/auth/login`, () => apiError(500, "internal_error")))
    const { user } = setup()
    await fill(user, "reader@example.com", "Secret123!")
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
  })

  it("disables the button while the request is running", async () => {
    let release!: () => void
    server.use(
      http.post(`${API}/auth/login`, async () => {
        await new Promise<void>((r) => (release = r))
        return HttpResponse.json(me)
      }),
    )
    const { user, onDone } = setup()
    await fill(user, "reader@example.com", "Secret123!")
    await waitFor(() => expect(screen.getByRole("button", { name: /log in/i })).toBeDisabled())
    release()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})

describe("LoginView: other controls", () => {
  it("calls onForgot from the Forgot password link", async () => {
    const { user, onForgot } = setup()
    await user.click(screen.getByRole("button", { name: "Forgot password?" }))
    expect(onForgot).toHaveBeenCalledOnce()
  })

  it("shows the password only while the eye button is on", async () => {
    const { user } = setup()
    const field = screen.getByLabelText("Password")
    expect(field).toHaveAttribute("type", "password")
    await user.click(screen.getByRole("button", { name: /show password/i }))
    expect(field).toHaveAttribute("type", "text")
  })
})

describe("LoginView: coming back from Google", () => {
  it("finishes the sign-in when the API says done", async () => {
    setSearch("social=done")
    server.use(http.get(`${API}/me`, () => HttpResponse.json(me)))
    const { onDone } = setup()
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ email: "reader@example.com" }))
  })

  it.each([
    ["cancelled", "info", "cancelled"],
    ["unavailable", "info", "not set up yet"],
    ["social_no_email", "error", undefined],
    ["account_banned", "error", "suspended"],
    ["something_else", "error", undefined],
  ])("shows a message for ?social=%s", async (result, level, text) => {
    setSearch(`social=${result}`)
    setup()
    const fn = toast[level as "info" | "error"]
    await waitFor(() => expect(fn).toHaveBeenCalled())
    if (text) expect(JSON.stringify(vi.mocked(fn).mock.calls[0])).toContain(text)
  })
})
