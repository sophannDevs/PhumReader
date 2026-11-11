import { describe, expect, it } from "vitest"
import { CreatorPage } from "@/components/pr/creator-page"
import { useAppStore } from "@/lib/store"
import { nav } from "@/test/navigation"
import { renderUi, screen } from "@/test/render"
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
  updateDays: [],
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
const signIn = () => useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com", roles: ["READER", "CREATOR"] })
const serve = (body: object, series: object[] = [{ series: card("a", "Sea Light"), visibility: "published", subscribers: 12, comments: 3 }]) =>
  server.use(
    http.get(`${API}/creator/dashboard`, () => HttpResponse.json(body)),
    http.get(`${API}/creator/series`, () => HttpResponse.json(series)),
  )

describe("CreatorPage: signed out", () => {
  it("asks to log in and remembers this page", async () => {
    nav.pathname = "/creator"
    const { user } = renderUi(<CreatorPage />)
    expect(screen.getByRole("heading", { level: 1, name: "Creator dashboard" })).toBeInTheDocument()
    expect(screen.getByText("Log in to open Creator studio")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "Log in" }))
    expect(useAppStore.getState().returnTo).toBe("/creator")
  })
})

describe("CreatorPage: a creator", () => {
  it("shows the series from the API with links to start a new series and upload an episode", async () => {
    signIn()
    serve(dashboard())
    renderUi(<CreatorPage />)
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "New series" }).some((l) => l.getAttribute("href") === "/creator/new")).toBe(true)
    expect(screen.getAllByRole("link", { name: "Upload episode" }).some((l) => l.getAttribute("href") === "/creator/upload?series=a")).toBe(true)
  })

  it("shows the start guide with a way to create the first series when there are no series", async () => {
    signIn()
    serve(dashboard({ series: [] }), [])
    renderUi(<CreatorPage />)
    expect(await screen.findByText("Publish your first story in 3 steps")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create your first series" })).toHaveAttribute("href", "/creator/new")
    expect(screen.queryByText("Sea Light")).not.toBeInTheDocument()
  })

  it("shows the error state and Retry loads the dashboard", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => apiError(500, "internal_error")), http.get(`${API}/creator/series`, () => apiError(500, "internal_error")))
    const { user } = renderUi(<CreatorPage />)
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
    serve(dashboard())
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
  })

  it("shows a loading skeleton while it loads", () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => new Promise(() => undefined)), http.get(`${API}/creator/series`, () => new Promise(() => undefined)))
    const { container } = renderUi(<CreatorPage />)
    expect(container.querySelector("[aria-hidden=true]")).not.toBeNull()
    expect(screen.queryByText("Sea Light")).not.toBeInTheDocument()
  })

  it("shows the review states from the API: in review with the submitted date, and changes requested linking to Manage", async () => {
    signIn()
    serve(dashboard(), [
      {
        series: card("r", "River Lantern"),
        visibility: "review",
        subscribers: 0,
        comments: 0,
        review: { submittedAt: "2026-11-08T03:00:00Z", decision: null, note: null, items: [] },
      },
      {
        series: card("c", "Glass Compass"),
        visibility: "changes",
        subscribers: 0,
        comments: 0,
        review: { submittedAt: "2026-11-07T03:00:00Z", decision: "changes", note: null, items: [{ item: "contact", fixed: false }] },
      },
    ])
    renderUi(<CreatorPage />)
    expect(await screen.findByText("River Lantern is in review")).toBeInTheDocument()
    expect(screen.getByText("Submitted Nov 8 · usually 1–2 days")).toBeInTheDocument()
    expect(screen.getByText("In review")).toBeInTheDocument()
    expect(screen.getByText("Glass Compass needs changes")).toBeInTheDocument()
    expect(screen.getByText("Changes requested")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Fix and resubmit" })).toHaveAttribute("href", "/creator/series/c")
  })

  it("greets the creator by name", async () => {
    signIn()
    serve(dashboard())
    renderUi(<CreatorPage />)
    expect(await screen.findByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Sokha/ })).toBeInTheDocument()
  })
})

describe("CreatorPage: a reader who is not a creator", () => {
  it("invites them to become a creator, and opens the dialog; Escape gives the focus back", async () => {
    useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
    serve(dashboard({ creator: false, series: [], name: null }), [])
    const { user } = renderUi(<CreatorPage />)
    const start = await screen.findByRole("button", { name: "Become a creator" })
    expect(screen.getByText("Become a creator to publish")).toBeInTheDocument()
    await user.click(start)
    expect(await screen.findByRole("dialog", { name: "Become a creator" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(start).toHaveFocus()
  })
})
