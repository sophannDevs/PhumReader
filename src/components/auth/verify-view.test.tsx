import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { VerifyView } from "@/components/auth/verify-view"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const me = { id: "u1", displayName: "Sokha", email: "sokha@example.com", emailVerified: true, roles: ["READER"], avatarUrl: null }

function setup(resendAfterSeconds = 0) {
  const onBack = vi.fn()
  const onDone = vi.fn()
  const view = renderUi(<VerifyView pending={{ email: "sokha@example.com", resendAfterSeconds }} onBack={onBack} onDone={onDone} />)
  return { ...view, onBack, onDone }
}
const typeCode = (user: ReturnType<typeof setup>["user"], code: string) => user.type(screen.getByLabelText("Verification code"), code)

describe("VerifyView", () => {
  it("keeps Verify disabled until all six digits are typed", async () => {
    const { user } = setup()
    const button = screen.getByRole("button", { name: "Verify email" })
    expect(button).toBeDisabled()
    await typeCode(user, "12345")
    expect(button).toBeDisabled()
    await typeCode(user, "6")
    expect(button).toBeEnabled()
  })

  it("accepts digits only", async () => {
    const { user } = setup()
    await typeCode(user, "12ab34")
    expect(screen.getByLabelText("Verification code")).toHaveValue("1234")
  })

  it("posts the code, stores the user and calls onDone", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/verify`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(me)
      }),
    )
    const { user, onDone } = setup()
    await typeCode(user, "123456")
    await user.click(screen.getByRole("button", { name: "Verify email" }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(body).toEqual({ email: "sokha@example.com", code: "123456" })
    expect(useAppStore.getState().user?.email).toBe("sokha@example.com")
  })

  it.each([
    ["invalid_code", "That code isn't right. Check the email and try again."],
    ["code_expired", "This code has expired. Ask for a new one."],
    ["too_many_attempts", "Too many wrong codes. Ask for a new one."],
    ["already_verified", "This email is already confirmed. Log in instead."],
    ["internal_error", "Something went wrong"],
  ])("shows the message for %s and keeps the code", async (code, message) => {
    server.use(http.post(`${API}/auth/verify`, () => apiError(400, code)))
    const { user, onDone } = setup()
    await typeCode(user, "123456")
    await user.click(screen.getByRole("button", { name: "Verify email" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message, expect.anything()))
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Verification code")).toHaveValue("123456")
  })

  it("counts down before Resend is offered, then resends and starts the wait again", async () => {
    server.use(http.post(`${API}/auth/resend-code`, () => new HttpResponse(null, { status: 204 })))
    const { user } = setup(0)
    await user.click(screen.getByRole("button", { name: "Resend code" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Code sent"))
    expect(await screen.findByText("Resend in 30s")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument()
  })

  it("hides Resend while the wait is running", () => {
    setup(30)
    expect(screen.getByText("Resend in 30s")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument()
  })

  it("uses the wait the API asks for when resending is rate limited", async () => {
    server.use(http.post(`${API}/auth/resend-code`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 55 })))
    const { user } = setup(0)
    await user.click(screen.getByRole("button", { name: "Resend code" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.anything()))
    expect(await screen.findByText("Resend in 55s")).toBeInTheDocument()
  })

  it("goes back from Use a different email", async () => {
    const { user, onBack } = setup()
    await user.click(screen.getByRole("button", { name: "Use a different email" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
