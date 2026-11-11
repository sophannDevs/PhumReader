import { describe, expect, it } from "vitest"
import type { BlockedAccount, MyReport } from "@/lib/api/me"
import { blockUser, ModerationSync, unblockUser } from "@/lib/moderation"
import { useAppStore } from "@/lib/store"
import { renderUi, waitFor } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/** ModerationSync, blockUser and unblockUser (real API): the account keeps blocks and reports; the store follows. */

const EMAIL = "sokha@example.com"
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: EMAIL })

const BLOCKS: BlockedAccount[] = [{ userId: "u-1", name: "Rude Rithy", avatarUrl: null, blockedAt: "2026-11-10T03:00:00Z" }]
const REPORTS: MyReport[] = [
  { caseNumber: 20481, targetType: "comment", seriesTitle: "Glass Compass", episodeNumber: null, accusedName: "Rude Rithy", reason: "harass", status: "removed", createdAt: "2026-11-09T03:00:00Z" },
  { caseNumber: 20482, targetType: "episode", seriesTitle: "Glass Compass", episodeNumber: 12, accusedName: "Mina", reason: "spam", status: "in_review", createdAt: "2026-11-10T03:00:00Z" },
]

describe("ModerationSync", () => {
  it("does nothing for a logged-out visitor", () => {
    renderUi(<ModerationSync />)
    expect(useAppStore.getState().blocked).toEqual([])
    expect(useAppStore.getState().reports).toEqual([])
  })

  it("loads the blocked accounts and the reader's reports into the store (a new device has them too)", async () => {
    signIn()
    server.use(
      http.get(`${API}/me/blocks`, () => HttpResponse.json(BLOCKS)),
      http.get(`${API}/me/reports`, () => HttpResponse.json(REPORTS)),
    )
    renderUi(<ModerationSync />)
    await waitFor(() => expect(useAppStore.getState().blocked).toEqual(["Rude Rithy"]))
    expect(useAppStore.getState().blockedIds).toEqual({ "Rude Rithy": "u-1" })
    await waitFor(() => expect(useAppStore.getState().reports).toHaveLength(2))
    const [removed, review] = useAppStore.getState().reports
    expect(removed).toMatchObject({ id: "R-20481", kind: "comment", who: "Rude Rithy", status: "Removed" })
    expect(review).toMatchObject({ id: "R-20482", kind: "series", status: "In review" })
    expect(review.target).toContain("Glass Compass")
  })
})

describe("blockUser and unblockUser", () => {
  it("blocks in the store and saves it to the account", async () => {
    const calls: string[] = []
    server.use(
      http.put(`${API}/users/u-2/block`, () => {
        calls.push("put")
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete(`${API}/users/u-2/block`, () => {
        calls.push("delete")
        return new HttpResponse(null, { status: 204 })
      }),
    )
    expect(await blockUser("Mina", "u-2")).toBe(true)
    expect(useAppStore.getState().blocked).toEqual(["Mina"])
    expect(useAppStore.getState().blockedIds).toEqual({ Mina: "u-2" })

    expect(await unblockUser("Mina")).toBe(true)
    expect(useAppStore.getState().blocked).toEqual([])
    expect(calls).toEqual(["put", "delete"])
  })

  it("goes back when the API refuses", async () => {
    server.use(http.put(`${API}/users/u-3/block`, () => HttpResponse.json({ error: { code: "x", message: "x" } }, { status: 500 })))
    expect(await blockUser("Mina", "u-3", "Failed")).toBe(false)
    expect(useAppStore.getState().blocked).toEqual([])
  })

  it("puts the block back when unblocking fails", async () => {
    useAppStore.getState().block("Mina", "u-4")
    server.use(http.delete(`${API}/users/u-4/block`, () => HttpResponse.json({ error: { code: "x", message: "x" } }, { status: 500 })))
    expect(await unblockUser("Mina", "Failed")).toBe(false)
    expect(useAppStore.getState().blocked).toEqual(["Mina"])
    expect(useAppStore.getState().blockedIds).toEqual({ Mina: "u-4" })
  })
})
