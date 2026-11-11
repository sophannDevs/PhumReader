import { act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Settings } from "@/lib/api/account"
import { meKeys } from "@/lib/api/keys"
import { SettingsSync } from "@/lib/settings-sync"
import { useAppStore } from "@/lib/store"
import { renderUi, waitFor } from "@/test/render"
import { API, http, HttpResponse, server } from "@/test/server"

/** SettingsSync (real API): the account's settings applied to this browser, and reading changes saved back. */

const EMAIL = "sokha@example.com"
const signIn = () => useAppStore.getState().login({ name: "Sokha Chan", email: EMAIL })

const ACCOUNT: Settings = {
  language: "en",
  theme: "system",
  reader: { font: "serif", size: 20, theme: "sepia", wide: false },
  notifications: {
    episodes: false,
    fastPass: true,
    types: {
      update: { push: false, email: true },
      comment: { push: true, email: true },
      coins: { push: false, email: false },
      fastpass: { push: true, email: true },
      news: { push: true, email: false },
    },
    quiet: { on: false, from: 21, to: 6 },
    digest: true,
  },
  preferences: { genres: ["Romance", "Fantasy"], storyLanguages: ["km"] },
}

/** GET and PATCH /me/settings; returns the PATCH bodies. */
function account() {
  const patches: unknown[] = []
  server.use(
    http.get(`${API}/me/settings`, () => HttpResponse.json(ACCOUNT)),
    http.patch(`${API}/me/settings`, async ({ request }) => {
      const body = (await request.json()) as Partial<Settings>
      patches.push(body)
      return HttpResponse.json({ ...ACCOUNT, ...body, reader: { ...ACCOUNT.reader, ...body.reader } })
    }),
  )
  return patches
}

describe("SettingsSync", () => {
  it("does nothing for a logged-out visitor", () => {
    renderUi(<SettingsSync />)
    expect(useAppStore.getState().notifPrefs).toEqual(useAppStore.getInitialState().notifPrefs)
  })

  it("loads every alert setting of the account into this browser, with the reading settings", async () => {
    signIn()
    account()
    const { client } = renderUi(<SettingsSync />)
    await waitFor(() =>
      expect(useAppStore.getState().notifPrefs).toEqual({
        update: [false, true],
        comment: [true, true],
        coins: [false, false],
        fastpass: [true, true],
        news: [true, false],
        quiet: false,
        from: 21,
        to: 6,
        digest: true,
      }),
    )
    expect(useAppStore.getState().notifications).toEqual({ episodes: false, fastPass: true })
    expect(useAppStore.getState().novelSettings).toEqual(ACCOUNT.reader)
    // V21-07: the welcome picks follow the account.
    expect(useAppStore.getState().prefs).toEqual(["Romance", "Fantasy"])
    expect(useAppStore.getState().settings.langs).toEqual(["km"])
    // Shared with the alert settings and Settings (one request).
    expect(client.getQueryData(meKeys.settings(EMAIL))).toEqual(ACCOUNT)
  })

  it("saves a changed reading setting, but not the alert settings (the page that changes them saves them)", async () => {
    signIn()
    const patches = account()
    renderUi(<SettingsSync />)
    await waitFor(() => expect(useAppStore.getState().novelSettings).toEqual(ACCOUNT.reader))
    act(() => useAppStore.getState().setNotifPrefs({ digest: false }))
    act(() => useAppStore.getState().setNovelSettings({ size: 22 }))
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2000 })
    expect(patches[0]).toEqual({ reader: { ...ACCOUNT.reader, size: 22 } })
  })
})
