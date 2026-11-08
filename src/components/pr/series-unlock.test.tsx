import { toast } from "sonner"
import { describe, expect, it } from "vitest"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import { getSeries, type Episode, type Series } from "@/data"
import { useEpisodes } from "@/lib/queries"
import { useAppStore } from "@/lib/store"
import { nav, router } from "@/test/navigation"
import { renderUi, screen, waitFor } from "@/test/render"
import { API, apiError, http, HttpResponse, server } from "@/test/server"

const comic = getSeries().find((s) => s.type === "comic") as Series
const novel = getSeries().find((s) => s.type === "novel") as Series

const summary = (n: number, access: "free" | "fastpass") => ({ n, title: `Episode ${n}`, date: "2026-11-01", isUp: false, likes: 10, access, thumb: "/covers/x.svg" })
const listFor = (slug: string) =>
  http.get(`${API}/series/${slug}/episodes`, () =>
    HttpResponse.json({ items: [summary(1, "free"), summary(2, "fastpass"), summary(3, "fastpass")], nextCursor: null }),
  )

/** What a series page does: a row per Fast Pass episode that calls `request`, and the dialog the hook owns. */
function Page({ series }: { series: Series }) {
  const { request, dialog } = useSeriesUnlock(series)
  const episodes = useEpisodes(series.slug)
  return (
    <>
      {episodes.data
        ?.filter((e: Episode) => e.access === "fastpass")
        .map((e: Episode) => (
          <button key={e.n} onClick={() => request(e)}>
            Row {e.n}
          </button>
        ))}
      {dialog}
    </>
  )
}

const signIn = (coins: number) => {
  useAppStore.getState().login({ name: "Sokha", email: "sokha@example.com" })
  useAppStore.setState({ coins })
}
const unlockUrl = (slug: string, n: number) => `${API}/series/${slug}/episodes/${n}/unlock`

async function openRow(series: Series, n: number) {
  const view = renderUi(<Page series={series} />)
  await view.user.click(await screen.findByRole("button", { name: `Row ${n}` }))
  return view
}

describe("useSeriesUnlock: logged out", () => {
  it("asks to log in, remembers the page and the episode, and goes to /login", async () => {
    server.use(listFor(comic.slug))
    nav.pathname = `/series/${comic.slug}`
    const { user } = await openRow(comic, 2)
    expect(await screen.findByRole("dialog", { name: "Unlock Episode 2" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Log in to unlock" }))
    expect(useAppStore.getState().returnTo).toBe(`/series/${comic.slug}`)
    expect(useAppStore.getState().pendingUnlock).toEqual({ seriesId: comic.id, episode: 2 })
    expect(router.push).toHaveBeenCalledWith("/login")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes with Wait for the free release and changes nothing", async () => {
    server.use(listFor(comic.slug))
    const { user } = await openRow(comic, 2)
    await user.click(await screen.findByRole("button", { name: "Wait for the free release" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useAppStore.getState().pendingUnlock).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe("useSeriesUnlock: not enough coins", () => {
  it("shows what is missing and sends the reader to /coins with a way back", async () => {
    signIn(3)
    server.use(listFor(comic.slug))
    const { user } = await openRow(comic, 3)
    expect(await screen.findByText("You need 2 more coins.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Get coins" }))
    expect(useAppStore.getState().shopReturn).toEqual({ page: `/series/${comic.slug}`, episode: 3, title: comic.title })
    expect(useAppStore.getState().pendingUnlock).toEqual({ seriesId: comic.id, episode: 3 })
    expect(router.push).toHaveBeenCalledWith("/coins")
  })
})

describe("useSeriesUnlock: unlocking", () => {
  it("spends the coins, updates the balance, thanks the reader and opens the reader", async () => {
    signIn(12)
    let key = ""
    server.use(
      listFor(comic.slug),
      http.post(unlockUrl(comic.slug, 2), ({ request }) => {
        key = request.headers.get("Idempotency-Key") ?? ""
        return HttpResponse.json({ alreadyUnlocked: false, balance: 7, coins: 5, episode: 2 })
      }),
      http.get(`${API}/me/coins`, () => HttpResponse.json({ balance: 7, firstPurchaseBonus: false })),
    )
    const { user } = await openRow(comic, 2)
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/read/${comic.slug}/2`))
    expect(key).not.toBe("")
    expect(toast.success).toHaveBeenCalledWith("Episode 2 unlocked")
    expect(useAppStore.getState().coins).toBe(7)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("says Chapter and opens the novel reader for a web novel", async () => {
    signIn(12)
    server.use(
      listFor(novel.slug),
      http.post(unlockUrl(novel.slug, 2), () => HttpResponse.json({ alreadyUnlocked: false, balance: 7, coins: 5, episode: 2 })),
      http.get(`${API}/me/coins`, () => HttpResponse.json({ balance: 7, firstPurchaseBonus: false })),
    )
    const { user } = await openRow(novel, 2)
    expect(await screen.findByRole("dialog", { name: "Unlock Chapter 2" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/novel/${novel.slug}/2`))
    expect(toast.success).toHaveBeenCalledWith("Chapter 2 unlocked")
  })

  it("keeps the dialog open on a failure and reuses the same key on the retry, so it never charges twice", async () => {
    signIn(12)
    const keys: string[] = []
    let calls = 0
    server.use(
      listFor(comic.slug),
      http.post(unlockUrl(comic.slug, 2), ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key") ?? "")
        calls++
        return calls === 1 ? apiError(500, "internal_error") : HttpResponse.json({ alreadyUnlocked: false, balance: 7, coins: 5, episode: 2 })
      }),
      http.get(`${API}/me/coins`, () => HttpResponse.json({ balance: 7, firstPurchaseBonus: false })),
    )
    const { user } = await openRow(comic, 2)
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't unlock. Please try again."))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
    expect(useAppStore.getState().coins).toBe(12)
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it("uses a new key for a different episode", async () => {
    signIn(30)
    const keys: Record<number, string> = {}
    server.use(
      listFor(comic.slug),
      ...[2, 3].map((n) =>
        http.post(unlockUrl(comic.slug, n), ({ request }) => {
          keys[n] = request.headers.get("Idempotency-Key") ?? ""
          return HttpResponse.json({ alreadyUnlocked: false, balance: 20, coins: 5, episode: n })
        }),
      ),
      http.get(`${API}/me/coins`, () => HttpResponse.json({ balance: 20, firstPurchaseBonus: false })),
    )
    const { user } = await openRow(comic, 2)
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole("button", { name: "Row 3" }))
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2))
    expect(keys[2]).not.toBe(keys[3])
  })

  it("keeps the balance, the dialog and the page after a 402 (not enough coins)", async () => {
    signIn(12)
    server.use(listFor(comic.slug), http.post(unlockUrl(comic.slug, 2), () => apiError(402, "insufficient_coins", { price: 5 })))
    const { user } = await openRow(comic, 2)
    await user.click(await screen.findByRole("button", { name: "Unlock for 5 coins" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't unlock. Please try again."))
    expect(toast.success).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(useAppStore.getState().coins).toBe(12)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unlock for 5 coins" })).toBeEnabled()
  })
})

describe("useSeriesUnlock: coming back from /login or /coins", () => {
  it("reopens the dialog for the waiting episode once, then forgets it", async () => {
    signIn(12)
    useAppStore.getState().setPendingUnlock({ seriesId: comic.id, episode: 3 })
    nav.pathname = `/series/${comic.slug}`
    server.use(listFor(comic.slug))
    renderUi(<Page series={comic} />)
    expect(await screen.findByRole("dialog", { name: "Unlock Episode 3" })).toBeInTheDocument()
    expect(useAppStore.getState().pendingUnlock).toBeNull()
  })

  it("ignores a request that is for another series", async () => {
    signIn(12)
    useAppStore.getState().setPendingUnlock({ seriesId: "other-series", episode: 3 })
    nav.pathname = `/series/${comic.slug}`
    server.use(listFor(comic.slug))
    renderUi(<Page series={comic} />)
    await screen.findByRole("button", { name: "Row 3" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useAppStore.getState().pendingUnlock).not.toBeNull()
  })

  it("does not reopen for a logged-out reader", async () => {
    useAppStore.getState().setPendingUnlock({ seriesId: comic.id, episode: 3 })
    nav.pathname = `/series/${comic.slug}`
    server.use(listFor(comic.slug))
    renderUi(<Page series={comic} />)
    await screen.findByRole("button", { name: "Row 3" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
