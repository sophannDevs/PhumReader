import { describe, expect, it } from "vitest"
import { CreatorPage } from "@/components/pr/creator-page"
import { useAppStore } from "@/lib/store"
import { nav, router } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const card = (id: string, title: string) => ({
  id,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  type: "comic",
  genre: "Fantasy",
  creator: "Sokha",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 1,
  fastPassEpisodes: 0,
  totalEpisodes: 1,
  status: "ongoing",
  updateDay: null,
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
})
const dashboard = (over: Record<string, unknown> = {}) => ({
  creator: true,
  name: "Sokha",
  series: [{ series: card("a", "Sea Light") }],
  totals: { views: 1200, likes: 340, earnedCoins: 90 },
  ...over,
})
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
const serve = (body: object) => server.use(http.get(`${API}/creator/dashboard`, () => HttpResponse.json(body)))

describe("CreatorPage: signed out", () => {
  it("asks to log in and remembers this page", async () => {
    nav.pathname = "/creator"
    const { user } = renderUi(<CreatorPage />)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(screen.getByText("Log in to open your dashboard")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/creator")
  })
})

describe("CreatorPage: a creator", () => {
  it("shows the stats, the series and a Start publishing link to the new series form", async () => {
    signIn()
    serve(dashboard())
    renderUi(<CreatorPage />)
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
    expect(screen.getByText("90 coins")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start publishing" })).toHaveAttribute("href", "/creator/series/new")
    expect(screen.getAllByRole("link", { name: "My series" })[0]).toHaveAttribute("href", "/creator/series")
    expect(screen.getByRole("link", { name: "Creator guidelines" })).toHaveAttribute("href", "#guidelines")
  })

  it("shows the empty state with a way to start when there are no series", async () => {
    signIn()
    serve(dashboard({ series: [] }))
    renderUi(<CreatorPage />)
    expect(await screen.findByText("No series yet")).toBeInTheDocument()
    // the header button and the empty state both lead to the new-series form
    const starts = screen.getAllByRole("link", { name: "Start publishing" })
    expect(starts).toHaveLength(2)
    starts.forEach((link) => expect(link).toHaveAttribute("href", "/creator/series/new"))
  })

  it("shows the error state and Retry loads the dashboard", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CreatorPage />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    serve(dashboard())
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
  })

  it("shows a loading skeleton and placeholders for the numbers while it loads", () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => new Promise(() => undefined)))
    const { container } = renderUi(<CreatorPage />)
    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull()
    expect(screen.getAllByText("…").length).toBeGreaterThan(0)
  })
})

describe("CreatorPage: a reader who is not a creator", () => {
  it("opens the Become a creator dialog from the main button, and goes to My series once done", async () => {
    signIn()
    serve(dashboard({ creator: false, series: [], name: null }))
    server.use(
      http.post(`${API}/creator`, () => HttpResponse.json({ penName: "Sokha" }, { status: 201 })),
      http.get(`${API}/me`, () => HttpResponse.json({ id: "u1", displayName: "Sokha", email: "sokha@example.com", emailVerified: true, roles: ["READER", "CREATOR"], avatarUrl: null })),
    )
    const { user } = renderUi(<CreatorPage />)
    const start = await screen.findByRole("button", { name: /Start/ })
    await waitFor(() => expect(start).toBeEnabled())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(start)
    const dialog = await screen.findByRole("dialog", { name: "Become a creator" })
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Accept and continue" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/creator/series"))
  })

  it("the dialog closes with Escape and gives the focus back to the button", async () => {
    signIn()
    serve(dashboard({ creator: false, series: [], name: null }))
    const { user } = renderUi(<CreatorPage />)
    const start = await screen.findByRole("button", { name: /Start/ })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(start).toHaveFocus()
  })
})
