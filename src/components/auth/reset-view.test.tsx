import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { ResetView } from "@/components/auth/reset-view"
import { useAppStore } from "@/lib/store"
import { router, setSearch } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

type User = ReturnType<typeof renderUi>["user"]
const save = async (user: User, password: string, confirm = password) => {
  if (password) await user.type(screen.getByLabelText("New password"), password)
  if (confirm) await user.type(screen.getByLabelText("Confirm password"), confirm)
  await user.click(screen.getByRole("button", { name: "Save new password" }))
}
const RULES = /doesn’t meet all the rules/

describe("ResetView: the link", () => {
  it("shows the broken-link view when there is no token", () => {
    renderUi(<ResetView />)
    expect(screen.getByText("This link doesn’t work")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Send a new link" })).toHaveAttribute("href", "/login?mode=forgot")
  })

  it("shows the form when there is a token", () => {
    setSearch("token=abc")
    renderUi(<ResetView />)
    expect(screen.getByText("Choose a new password")).toBeInTheDocument()
  })
})

describe("ResetView: the form", () => {
  it("asks for the same password twice", async () => {
    setSearch("token=abc")
    const { user } = renderUi(<ResetView />)
    await save(user, "Abcdef1!", "Abcdef1?")
    expect(await screen.findByText("Passwords don’t match.")).toBeInTheDocument()
  })

  it("rejects a weak password and sends nothing", async () => {
    setSearch("token=abc")
    const { user } = renderUi(<ResetView />)
    await save(user, "abcdefgh")
    expect(await screen.findByText(RULES)).toBeInTheDocument()
  })

  it("rejects an empty password", async () => {
    setSearch("token=abc")
    const { user } = renderUi(<ResetView />)
    await save(user, "")
    expect(await screen.findByText(RULES)).toBeInTheDocument()
  })

  it("posts the token and the new password, signs this device out and shows the done view", async () => {
    setSearch("token=abc")
    useAppStore.getState().login({ name: "Sokha", email: "reader@example.com" })
    let body: unknown
    server.use(
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<ResetView />)
    await save(user, "Abcdef1!")
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?reset=done"))
    expect(body).toEqual({ token: "abc", password: "Abcdef1!" })
    expect(useAppStore.getState().user).toBeNull()
  })

  it("switches to the broken-link view when the API says the token is invalid", async () => {
    setSearch("token=old")
    server.use(http.post(`${API}/auth/reset-password`, () => apiError(400, "invalid_token")))
    const { user } = renderUi(<ResetView />)
    await save(user, "Abcdef1!")
    expect(await screen.findByText("This link doesn’t work")).toBeInTheDocument()
  })

  it("shows the API's weak-password answer on the field", async () => {
    setSearch("token=abc")
    server.use(http.post(`${API}/auth/reset-password`, () => apiError(400, "password_too_weak")))
    const { user } = renderUi(<ResetView />)
    await save(user, "Abcdef1!")
    expect(await screen.findByText(RULES)).toBeInTheDocument()
  })

  it("tells the reader how long to wait, or shows the generic error", async () => {
    setSearch("token=abc")
    server.use(http.post(`${API}/auth/reset-password`, () => apiError(429, "too_many_requests", { retryAfterSeconds: 20 })))
    const { user } = renderUi(<ResetView />)
    await save(user, "Abcdef1!")
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many tries", expect.objectContaining({ description: "Try again in 20 seconds." })))
    server.use(http.post(`${API}/auth/reset-password`, () => apiError(500, "internal_error")))
    await user.click(screen.getByRole("button", { name: "Save new password" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong", expect.anything()))
  })
})
