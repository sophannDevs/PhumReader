import { describe, expect, it } from "vitest"
import { CreatorProfilePage } from "@/components/pr/creator-profile-page"
import { EarningsPage } from "@/components/pr/earnings-page"
import { useAppStore } from "@/lib/store"
import { renderUi, screen, waitFor, within } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

/** The earnings page and the public profile on the real API (V21-05). */

const signIn = () => useAppStore.getState().login({ name: "Dara Vann", email: "dara@example.com", roles: ["READER", "CREATOR"] })
const dashboard = (handle: string | null = "dara-vann") => ({
  creator: true,
  name: "Dara Vann",
  handle,
  series: [],
  totals: { series: 0, views: 0, likes: 0, subscribers: 0, comments: 0, unlocks: 0, earnedCoins: 0 },
})

const earnings = (over: Record<string, unknown> = {}) => ({
  months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month, i) => ({
    month,
    coins: [0, 0, 0, 100, 200, 300][i],
    unlocks: [0, 0, 0, 20, 40, 60][i],
    readers: [0, 0, 0, 10, 15, 25][i],
  })),
  series: [
    { id: "s1", slug: "sea-light", title: "Sea Light", cover: null, visibility: "published", coins: [0, 0, 0, 100, 200, 300], unlocks: 120 },
    { id: "s2", slug: "tide", title: "Tide", cover: null, visibility: "review", coins: [0, 0, 0, 0, 0, 0], unlocks: 0 },
  ],
  history: [
    { month: "2026-10", coins: 200 },
    { month: "2026-09", coins: 100 },
  ],
  payoutMethod: null,
  ...over,
})

describe("EarningsPage (real API)", () => {
  it("shows the coins, unlocks and readers of the API, by series, and asks for a payout method", async () => {
    signIn()
    server.use(http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard())), http.get(`${API}/creator/earnings`, () => HttpResponse.json(earnings())))
    renderUi(<EarningsPage />)
    expect(await screen.findByText("Sea Light")).toBeInTheDocument()
    // The whole 6 months: 600 coins, 120 unlocks, 50 readers added up by month.
    expect(screen.getByText("600")).toBeInTheDocument()
    expect(screen.getByText("120")).toBeInTheDocument()
    expect(screen.getByText("50")).toBeInTheDocument()
    expect(screen.getByText("Tide")).toBeInTheDocument()
    expect(screen.getByText("Add a payout method to get paid")).toBeInTheDocument()
    expect(screen.getAllByText("On hold").length).toBe(2)
  })

  it("saves the kind of payout account with the account (no bank details)", async () => {
    signIn()
    const saved: unknown[] = []
    let method: string | null = null
    server.use(
      http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard())),
      http.get(`${API}/creator/earnings`, () => HttpResponse.json(earnings({ payoutMethod: method }))),
      http.put(`${API}/creator/payout-method`, async ({ request }) => {
        const body = (await request.json()) as { method: string }
        saved.push(body)
        method = body.method
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<EarningsPage />)
    await user.click((await screen.findAllByRole("button", { name: "Add payout method" }))[0])
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("[PAYOUT PROVIDER FORM]")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Save payout method" }))
    await waitFor(() => expect(saved).toEqual([{ method: "aba" }]))
    await waitFor(() => expect(screen.queryByText("Add a payout method to get paid")).not.toBeInTheDocument())
    expect(screen.getAllByText("Paid").length).toBe(2)
  })

  it("shows the error state with Retry", async () => {
    signIn()
    server.use(
      http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard())),
      http.get(`${API}/creator/earnings`, () => apiError(500, "internal_error")),
    )
    renderUi(<EarningsPage />)
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})

const profile = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  handle: "dara-vann",
  name: "Dara Vann",
  avatarUrl: null,
  bio: "I draw maps.",
  location: "Siem Reap",
  since: "2025-03-01T00:00:00Z",
  followers: 41,
  views: 1000,
  likes: 250,
  following: false,
  owner: false,
  series: [],
  ...over,
})

describe("CreatorProfilePage (real API)", () => {
  it("shows the profile of the API and follows with the creator's account", async () => {
    signIn()
    let following = false
    server.use(
      http.get(`${API}/creators/dara-vann`, () => HttpResponse.json(profile({ following, followers: following ? 42 : 41 }))),
      http.put(`${API}/creators/c-1/follow`, () => {
        following = true
        return HttpResponse.json({ following: true })
      }),
    )
    const { user } = renderUi(<CreatorProfilePage handle="dara-vann" name={null} ownerView={false} />)
    expect(await screen.findByRole("heading", { level: 1, name: "Dara Vann" })).toBeInTheDocument()
    expect(screen.getByText("I draw maps.")).toBeInTheDocument()
    expect(screen.getByText("41")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Follow" }))
    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("is a 404 page for a handle nobody has", async () => {
    server.use(http.get(`${API}/creators/nobody`, () => apiError(404, "creator_not_found")))
    renderUi(<CreatorProfilePage handle="nobody" name={null} ownerView={false} />)
    expect(await screen.findByText(/Page not found|Error 404/)).toBeInTheDocument()
  })

  it("lets the owner edit the profile and saves it with the account", async () => {
    signIn()
    const patches: unknown[] = []
    let current = profile({ owner: true })
    server.use(
      http.get(`${API}/creator/dashboard`, () => HttpResponse.json(dashboard())),
      http.get(`${API}/creators/dara-vann`, () => HttpResponse.json(current)),
      http.patch(`${API}/creator/profile`, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>
        patches.push(body)
        current = profile({ owner: true, name: body.name, bio: body.bio, location: body.location })
        return HttpResponse.json(current)
      }),
    )
    const { user } = renderUi(<CreatorProfilePage handle="dara-vann" name={null} ownerView />)
    await user.click(await screen.findByRole("button", { name: "Edit profile" }))
    const bio = screen.getByLabelText("Bio")
    await user.clear(bio)
    await user.type(bio, "New bio")
    await user.click(screen.getByRole("button", { name: "Save profile" }))
    await waitFor(() => expect(patches).toEqual([{ name: "Dara Vann", location: "Siem Reap", bio: "New bio" }]))
    expect(await screen.findByText("New bio")).toBeInTheDocument()
  })
})
