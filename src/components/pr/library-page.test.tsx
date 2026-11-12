import { describe, expect, it } from "vitest"
import { LibraryPage } from "@/components/pr/library-page"
import { useAppStore } from "@/lib/store"
import { renderUi, screen } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/** The Library on the real API: the Unlocked tab says what the reader actually paid (B3: UnlockedEntry.coins). */

const card = {
  id: "s1",
  slug: "lantern-ferry",
  title: "Lantern Ferry",
  type: "comic",
  genre: "Fantasy",
  creator: "Mei Tanaka",
  creatorId: "c-1",
  creatorHandle: "mei-tanaka",
  cover: "/covers/x.svg",
  views: 10,
  likes: 5,
  freeEpisodes: 10,
  fastPassEpisodes: 3,
  totalEpisodes: 13,
  status: "ongoing",
  updateDay: null,
  updateDays: [],
  language: ["en"],
  ageRating: "all",
  badges: { isNew: false, up: false },
}
const summary = (n: number) => ({ n, title: `Episode ${n}`, date: "2026-12-01", isUp: false, likes: 1, access: "fastpass", thumb: null, price: 7 })
const none = { items: [], nextCursor: null }

function serve(unlocked: object[]) {
  server.use(
    http.get(`${API}/me/history`, () => HttpResponse.json(none)),
    http.get(`${API}/me/subscriptions`, () => HttpResponse.json(none)),
    http.get(`${API}/me/unlocked`, () => HttpResponse.json({ items: unlocked, nextCursor: null })),
  )
}

describe("LibraryPage: Unlocked (real API)", () => {
  it("adds up the coins each unlock really cost, not the demo's 5 per episode", async () => {
    useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
    // Two episodes of one series, unlocked at 7 and 4 coins.
    serve([
      { series: card, episode: summary(12), coins: 7, unlockedAt: "2026-11-10T03:00:00Z" },
      { series: card, episode: summary(11), coins: 4, unlockedAt: "2026-11-09T03:00:00Z" },
    ])
    const { user } = renderUi(<LibraryPage />)
    await user.click(await screen.findByRole("tab", { name: /Unlocked/ }))
    expect(await screen.findByText(/^11 coins · /)).toBeInTheDocument()
    expect(screen.queryByText(/^10 coins · /)).not.toBeInTheDocument()
  })
})
