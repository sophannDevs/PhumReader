import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { SignupView } from "@/components/auth/signup-view"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"
import { selectOption } from "@/test/select"

function setup(locale: "en" | "km" = "en") {
  const onSubmitted = vi.fn()
  const view = renderUi(<SignupView onLogin={vi.fn()} onSubmitted={onSubmitted} />, { locale })
  return { ...view, onSubmitted }
}
type User = ReturnType<typeof setup>["user"]

const NAME_ERROR = "Enter a display name (2 to 20 characters)."
const RULES = /doesn’t meet all the rules/

async function fillAll(user: User, over: Partial<Record<"name" | "email" | "password" | "confirm", string>> = {}, terms = true) {
  const password = over.password ?? "Abcdef1!"
  await user.type(screen.getByLabelText("Display name"), over.name ?? "Sokha")
  await user.type(screen.getByLabelText("Email"), over.email ?? "sokha@example.com")
  await user.type(screen.getByLabelText("Password"), password)
  await user.type(screen.getByLabelText("Confirm password"), over.confirm ?? password)
  await selectOption(user, screen.getByLabelText("Birth year"), "1998")
  if (terms) await user.click(screen.getByRole("checkbox"))
}
const submit = (user: User) => user.click(screen.getByRole("button", { name: "Create account" }))

describe("SignupView: validation", () => {
  it("shows every required message on an empty form and sends nothing", async () => {
    const { user, onSubmitted } = setup()
    await submit(user)
    expect(await screen.findByText(NAME_ERROR)).toBeInTheDocument()
    expect(screen.getByText("Enter your email.")).toBeInTheDocument()
    expect(screen.getByText(RULES)).toBeInTheDocument()
    expect(screen.getByText("Choose your birth year.")).toBeInTheDocument()
    expect(screen.getByText("Accept the terms to continue.")).toBeInTheDocument()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it("rejects a one-letter name and an invalid email", async () => {
    const { user } = setup()
    await fillAll(user, { name: "A", email: "sokha@" })
    await submit(user)
    expect(await screen.findByText(NAME_ERROR)).toBeInTheDocument()
    expect(screen.getByText("Enter a valid email, like you@example.com.")).toBeInTheDocument()
  })

  it("rejects a password that does not meet all four rules", async () => {
    const { user } = setup()
    await fillAll(user, { password: "abcdefgh" })
    await submit(user)
    expect(await screen.findByText(RULES)).toBeInTheDocument()
  })

  it("shows the mismatch when the two passwords differ", async () => {
    const { user, onSubmitted } = setup()
    await fillAll(user, { confirm: "Abcdef1?" })
    await submit(user)
    expect(await screen.findByText("Passwords don’t match.")).toBeInTheDocument()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it("blocks the submit when only the terms box is unticked", async () => {
    const { user, onSubmitted } = setup()
    await fillAll(user, {}, false)
    await submit(user)
    expect(await screen.findByText("Accept the terms to continue.")).toBeInTheDocument()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it("lists the four password rules", () => {
    setup()
    for (const rule of ["8+ characters", "Upper and lower case", "A number", "A symbol"]) expect(screen.getByText(rule)).toBeInTheDocument()
  })

  it("links the errors to their fields", async () => {
    const { user } = setup()
    await submit(user)
    await screen.findByText(NAME_ERROR)
    expect(screen.getByLabelText("Display name")).toHaveAttribute("aria-describedby", expect.stringContaining("signup-name-note"))
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-describedby", expect.stringContaining("signup-email-error"))
  })
})

describe("SignupView: creating the account", () => {
  it("posts the trimmed values with the site language and passes the pending code on", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/signup`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ email: "sokha@example.com", codeExpiresInSeconds: 600, resendAfterSeconds: 45 }, { status: 201 })
      }),
    )
    const { user, onSubmitted } = setup()
    await fillAll(user, { name: "  Sokha  " })
    await submit(user)
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce())
    expect(body).toEqual({ name: "Sokha", email: "sokha@example.com", password: "Abcdef1!", birthYear: 1998, language: "en" })
    expect(onSubmitted.mock.calls[0][0]).toMatchObject({ email: "sokha@example.com", resendAfterSeconds: 45 })
    expect(onSubmitted.mock.calls[0][1]).toBe("en")
  })

  it("sends language km from the Khmer site", async () => {
    let body: { language?: string } = {}
    server.use(
      http.post(`${API}/auth/signup`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json({ email: "sokha@example.com", codeExpiresInSeconds: 600, resendAfterSeconds: 30 }, { status: 201 })
      }),
    )
    const { user, onSubmitted } = setup("km")
    // Khmer labels differ, so reach the fields by id; the structure is the same as English.
    await user.type(document.getElementById("signup-name") as HTMLElement, "Sokha")
    await user.type(document.getElementById("signup-email") as HTMLElement, "sokha@example.com")
    await user.type(document.getElementById("signup-password") as HTMLElement, "Abcdef1!")
    await user.type(document.getElementById("signup-confirm") as HTMLElement, "Abcdef1!")
    await selectOption(user, document.getElementById("signup-year") as HTMLElement, "1998")
    await user.click(screen.getByRole("checkbox"))
    await user.click(document.querySelector("button[type=submit]") as HTMLElement)
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(body.language).toBe("km")
  })

  it("puts the API's too_young answer on the birth year field", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(400, "too_young", { fields: { birthYear: "too_young" } })))
    const { user, onSubmitted } = setup()
    await fillAll(user)
    await submit(user)
    expect(await screen.findByText(/13 or older/)).toBeInTheDocument()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it("puts the email_taken answer on the email field", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(409, "email_taken")))
    const { user, onSubmitted } = setup()
    await fillAll(user)
    await submit(user)
    expect(await screen.findByText("This email already has an account.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveFocus()
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it("maps the API's own password check onto the password field", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(400, "password_too_weak")))
    const { user } = setup()
    await fillAll(user)
    await submit(user)
    expect(await screen.findByText(RULES)).toBeInTheDocument()
  })

  it("maps API field errors for the email and the name", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(400, "validation_failed", { fields: { email: "invalid" } })))
    const { user } = setup()
    await fillAll(user)
    await submit(user)
    expect(await screen.findByText("Enter a valid email, like you@example.com.")).toBeInTheDocument()
  })

  it("tells the reader how long to wait after too many tries", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 90 })))
    const { user } = setup()
    await fillAll(user)
    await submit(user)
    // 90 seconds is rounded up to whole minutes
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 2 minutes." })))
  })

  it("shows the generic error for a server failure", async () => {
    server.use(http.post(`${API}/auth/signup`, () => apiError(500, "internal_error")))
    const { user } = setup()
    await fillAll(user)
    await submit(user)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
  })
})
