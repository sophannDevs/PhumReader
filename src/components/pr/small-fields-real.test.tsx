import { describe, expect, it } from "vitest"
import { HelpPage } from "@/components/pr/help-page"
import { ForYouSection } from "@/components/pr/home/for-you"
import { meKeys } from "@/lib/api/keys"
import { useAppStore } from "@/lib/store"
import { fill } from "@/test/fill"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"
import { selectOption } from "@/test/select"

/** The smaller V2.1 fields on the real API (V21-07): Home picks, the Help contact form and "Was this helpful?" votes. */

const EMAIL = "sokha@example.com"
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: EMAIL })
const account = (genres: string[] | null) => ({
  language: "en",
  theme: "system",
  reader: { font: "sans", size: 18, theme: "light", wide: true },
  notifications: {
    episodes: true,
    fastPass: true,
    types: {
      update: { push: true, email: false },
      comment: { push: true, email: false },
      coins: { push: true, email: true },
      fastpass: { push: true, email: false },
      news: { push: false, email: false },
    },
    quiet: { on: true, from: 22, to: 7 },
    digest: false,
  },
  preferences: { genres, storyLanguages: ["en", "km"] },
  comics: { mode: "scroll", quality: "auto", autoNext: true, dataSaver: false, background: "dark", width: "fit" },
  privacy: { region: "KH", publicLibrary: false, mature: false },
})

describe("Home picks (ForYouSection)", () => {
  it("asks until the account has picks, then saves them to the account", async () => {
    signIn()
    const patches: unknown[] = []
    server.use(
      http.get(`${API}/me/settings`, () => HttpResponse.json(account(null))),
      http.patch(`${API}/me/settings`, async ({ request }) => {
        const body = (await request.json()) as { preferences: { genres: string[] } }
        patches.push(body)
        return HttpResponse.json(account(body.preferences.genres))
      }),
    )
    const { user, client } = renderUi(<ForYouSection genres={["Romance", "Fantasy"]} all={[]} />)
    await user.click(await screen.findByRole("button", { name: "Romance" }))
    await user.click(screen.getByRole("button", { name: /^Show/ }))
    await waitFor(() => expect(patches).toEqual([{ preferences: { genres: ["Romance"] } }]))
    expect(useAppStore.getState().prefs).toEqual(["Romance"])
    await waitFor(() => expect((client.getQueryData(meKeys.settings(EMAIL)) as ReturnType<typeof account>).preferences.genres).toEqual(["Romance"]))
  })

  it("does not ask again on a new device when the account already has picks", async () => {
    signIn()
    server.use(http.get(`${API}/me/settings`, () => HttpResponse.json(account(["Fantasy"]))))
    renderUi(<ForYouSection genres={["Romance", "Fantasy"]} all={[]} />)
    expect(await screen.findByText(/Recommended for you|Popular right now/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Romance" })).not.toBeInTheDocument()
  })
})

// The contact form is filled with `fill` (click + paste): typing its 51 characters key by key took about 1 s of a
// 1.5 s test (five events and a timer tick per key; the message counter re-renders the form on each message key), and
// no test here checks per-key behaviour (validation runs on submit). The timeout is a margin on top of that, not
// instead of it: these tests ran 3–4 times slower in the full suite and timed out at Vitest's default 5 s.
describe("Help: Contact us and votes", { timeout: 15_000 }, () => {
  it("sends the ticket to the API and shows its number", async () => {
    let body: unknown
    server.use(
      http.post(`${API}/help/tickets`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ticket: "T-58214" }, { status: 201 })
      }),
    )
    const { user } = renderUi(<HelpPage />)
    await selectOption(user, screen.getByRole("combobox", { name: /Topic/ }), "other")
    await fill(user, screen.getByLabelText(/^Email/), "dara@example.com")
    await fill(user, screen.getByLabelText(/^Message/), "Where do I find my reading history?")
    await user.click(screen.getByRole("button", { name: "Send message" }))
    expect(await screen.findByText("T-58214")).toBeInTheDocument()
    expect(body).toEqual({ topic: "other", email: "dara@example.com", order: null, message: "Where do I find my reading history?", locale: "en" })
  })

  it("keeps the form and says so when the ticket cannot be sent", async () => {
    server.use(http.post(`${API}/help/tickets`, () => apiError(429, "too_many_requests")))
    const { user } = renderUi(<HelpPage />)
    await selectOption(user, screen.getByRole("combobox", { name: /Topic/ }), "other")
    await fill(user, screen.getByLabelText(/^Email/), "dara@example.com")
    await fill(user, screen.getByLabelText(/^Message/), "Where do I find my reading history?")
    await user.click(screen.getByRole("button", { name: "Send message" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled())
    expect(screen.queryByText(/T-\d+/)).not.toBeInTheDocument()
  })

  it("loads the account's votes and saves a new one", async () => {
    signIn()
    const saved: unknown[] = []
    server.use(
      http.get(`${API}/me/help-votes`, () => HttpResponse.json([{ article: 0, helpful: true }])),
      http.put(`${API}/me/help-votes/:article`, async ({ request, params }) => {
        saved.push([params.article, await request.json()])
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderUi(<HelpPage />)
    await user.click(await waitFor(() => document.querySelector('[data-slot="accordion-trigger"]') as HTMLElement))
    const yes = (await screen.findAllByRole("button", { name: "Yes" }))[0]
    await waitFor(() => expect(yes).toHaveAttribute("aria-pressed", "true"))
    await user.click(screen.getAllByRole("button", { name: "No" })[0])
    await waitFor(() => expect(saved).toEqual([["0", { helpful: false }]]))
    expect(screen.getAllByRole("button", { name: "No" })[0]).toHaveAttribute("aria-pressed", "true")
  })
})
