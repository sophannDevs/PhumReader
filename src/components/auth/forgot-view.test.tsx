import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import { ForgotView, SentView } from "@/components/auth/forgot-view"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

function setup() {
  const onBack = vi.fn()
  const onSent = vi.fn()
  return { ...renderUi(<ForgotView onBack={onBack} onSent={onSent} />), onBack, onSent }
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

  it("posts the trimmed email and tells the flow the link was sent", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/auth/forgot-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, onSent } = setup()
    await send(user, " reader@example.com ")
    // Real API: a link, not a code (withCode is false).
    await waitFor(() => expect(onSent).toHaveBeenCalledWith("reader@example.com", false))
    expect(body).toEqual({ email: "reader@example.com" })
  })

  it("goes back to log in from the form", async () => {
    const { user, onBack } = setup()
    await user.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("tells the reader how long to wait after too many requests", async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 30 })))
    const { user, onSent } = setup()
    await send(user, "reader@example.com")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 30 seconds." })))
    expect(onSent).not.toHaveBeenCalled()
  })

  it("shows the generic error for a server failure and stays on the form", async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => apiError(500, "internal_error")))
    const { user } = setup()
    await send(user, "reader@example.com")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
  })
})

describe("SentView", () => {
  it("says where the link went and goes back to log in", async () => {
    const onBack = vi.fn()
    const { user } = renderUi(<SentView email="reader@example.com" onBack={onBack} />)
    expect(screen.getByText("Check your inbox")).toBeInTheDocument()
    expect(screen.getByText("reader@example.com")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
