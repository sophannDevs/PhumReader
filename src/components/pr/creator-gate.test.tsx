import { describe, expect, it } from "vitest"
import { CreatorGate } from "@/components/pr/creator-gate"
import { useAppStore } from "@/lib/store"
import { nav } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const dashboard = (creator: boolean) => ({ creator, name: creator ? "Sokha" : null, series: [], totals: { views: 0, likes: 0, earnedCoins: 0 } })
const gate = () => (
  <CreatorGate title="My series" eyebrow="Creator">
    <p>Creator content</p>
  </CreatorGate>
)
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })

describe("CreatorGate", () => {
  it("asks a signed-out visitor to log in, under the page title, and remembers the page", async () => {
    nav.pathname = "/creator/series"
    const { user } = renderUi(gate())
    expect(screen.getByRole("heading", { name: "My series" })).toBeInTheDocument()
    expect(screen.getByText("Log in to see your series")).toBeInTheDocument()
    expect(screen.queryByText("Creator content")).not.toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Log in" })
    expect(link).toHaveAttribute("href", "/login")
    await user.click(link)
    expect(useAppStore.getState().returnTo).toBe("/creator/series")
  })

  it("shows a loading skeleton while the dashboard loads", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, async () => new Promise(() => undefined)))
    renderUi(gate())
    expect(screen.getByRole("heading", { name: "My series" })).toBeInTheDocument()
    expect(screen.queryByText("Creator content")).not.toBeInTheDocument()
    expect(document.querySelector("[aria-hidden=true]")).not.toBeNull()
  })

  it("shows the content to a creator", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard(true))))
    renderUi(gate())
    expect(await screen.findByText("Creator content")).toBeInTheDocument()
  })

  it("invites a reader who is not a creator, and opens the Become a creator dialog", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard(false))))
    const { user } = renderUi(gate())
    expect(await screen.findByText("Become a creator to publish")).toBeInTheDocument()
    expect(screen.queryByText("Creator content")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Become a creator" }))
    expect(await screen.findByRole("dialog", { name: "Become a creator" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows the error state with a working Retry", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => apiError(500, "internal_error")))
    const { user } = renderUi(gate())
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    server.use(http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard(true))))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(screen.getByText("Creator content")).toBeInTheDocument())
  })
})
