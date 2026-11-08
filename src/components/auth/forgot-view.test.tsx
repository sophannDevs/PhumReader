import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { ForgotView } from "@/components/auth/forgot-view"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

function setup() {
  const onBack = vi.fn()
  return { ...renderUi(<ForgotView onBack={onBack} />), onBack }
}
type User = ReturnType<typeof setup>["user"]
const send = async (user: User, email: string) => {
  if (email) await user.type(screen.getByLabelText("Email"), email)
  await user.click(screen.getByRole("button", { name: "Send reset link" }))
}

describe("ForgotView", () => {
  it("asks for an email and sends nothing when it is empty", async () => {
    const { user } = setup()
    await send(user, "")
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument()
  })

  it("rejects an invalid email", async () => {
    const { user } = setup()
    await send(user, "nope")
    expect(await screen.findByText("Enter a valid email, like you@example.com.")).toBeInTheDocument()
  })

  it("posts the trimmed email and shows the check-your-inbox view", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = setup()
    await send(user, " reader@example.com ")
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument()
    expect(body).toEqual({ email: "reader@example.com" })
    expect(screen.getByText("reader@example.com")).toBeInTheDocument()
  })

  it("goes back to log in from the form and from the sent view", async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => new HttpResponse(null, { status: 204 })))
    const { user, onBack } = setup()
    await user.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(onBack).toHaveBeenCalledTimes(1)
    await send(user, "reader@example.com")
    await screen.findByText("Check your inbox")
    await user.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it("tells the reader how long to wait after too many requests", async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 30 })))
    const { user } = setup()
    await send(user, "reader@example.com")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 30 seconds." })))
    expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument()
  })

  it("shows the generic error for a server failure and stays on the form", async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => apiError(500, "internal_error")))
    const { user } = setup()
    await send(user, "reader@example.com")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
  })
})
