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
  // V21-08: not the defaults, so the test sees them applied.
  comics: { mode: "page", quality: "saver", autoNext: false, dataSaver: true, background: "light", width: "narrow" },
  privacy: { region: "VN", publicLibrary: true, mature: true },
}

/** The answers of an API from before V21-08: no `comics` / `privacy` group. */
const OLD_ACCOUNT: Omit<Settings, "comics" | "privacy"> = {
  language: ACCOUNT.language,
  theme: ACCOUNT.theme,
  reader: ACCOUNT.reader,
  notifications: ACCOUNT.notifications,
  preferences: ACCOUNT.preferences,
}

/**
 * GET and PATCH /me/settings; returns the PATCH bodies. `old`: the GET answer has no comics / privacy group;
 * `oldPatch`: the PATCH answer has none.
 */
function account({ old = false, oldPatch = old }: { old?: boolean; oldPatch?: boolean } = {}) {
  const patches: unknown[] = []
  server.use(
    http.get(`${API}/me/settings`, () => HttpResponse.json(old ? OLD_ACCOUNT : ACCOUNT)),
    http.patch(`${API}/me/settings`, async ({ request }) => {
      const body = (await request.json()) as Partial<Settings>
      patches.push(body)
      const reader = { ...ACCOUNT.reader, ...body.reader }
      if (oldPatch) return HttpResponse.json({ ...OLD_ACCOUNT, ...(body.theme ? { theme: body.theme } : {}), reader })
      return HttpResponse.json({
        ...ACCOUNT,
        ...body,
        reader,
        comics: { ...ACCOUNT.comics, ...body.comics },
        privacy: { ...ACCOUNT.privacy, ...body.privacy },
      })
    }),
  )
  return patches
}

const settle = () => new Promise((r) => setTimeout(r, 700))

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
    // V21-08: the comic reading choices, region and privacy switches follow the account; the rest stays local.
    const { settings, readerBg, readerWidth } = useAppStore.getState()
    const before = useAppStore.getInitialState().settings
    expect(settings).toEqual({
      ...before,
      langs: ["km"],
      mode: "page",
      quality: "saver",
      autoNext: false,
      saveData: true,
      region: "VN",
      publicLib: true,
      mature: true,
    })
    expect([settings.google, settings.facebook]).toEqual([before.google, before.facebook])
    expect(readerBg).toBe("light")
    expect(readerWidth).toBe("narrow")
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

  it("saves only the comic choices that changed, in one request", async () => {
    signIn()
    const patches = account()
    renderUi(<SettingsSync />)
    await waitFor(() => expect(useAppStore.getState().readerWidth).toBe("narrow"))
    act(() => useAppStore.getState().setReaderBg("dark"))
    act(() => useAppStore.getState().setSettings({ saveData: false, google: false, langs: ["en"] }))
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2000 })
    await settle()
    expect(patches).toEqual([{ comics: { background: "dark", dataSaver: false } }])
  })

  it("saves a changed region in the privacy group", async () => {
    signIn()
    const patches = account()
    renderUi(<SettingsSync />)
    await waitFor(() => expect(useAppStore.getState().settings.region).toBe("VN"))
    act(() => useAppStore.getState().setSettings({ region: "TH" }))
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2000 })
    await settle()
    expect(patches).toEqual([{ privacy: { region: "TH" } }])
  })

  it("leaves the comic and privacy choices alone and sends none of them when the account has no such groups", async () => {
    signIn()
    const patches = account({ old: true })
    const before = useAppStore.getState()
    const { client } = renderUi(<SettingsSync />)
    await waitFor(() => expect(useAppStore.getState().novelSettings).toEqual(ACCOUNT.reader))
    const { settings, readerBg, readerWidth } = useAppStore.getState()
    expect({ ...settings, langs: before.settings.langs }).toEqual(before.settings)
    expect([readerBg, readerWidth]).toEqual([before.readerBg, before.readerWidth])
    act(() => useAppStore.getState().setReaderBg("light"))
    act(() => useAppStore.getState().setSettings({ region: "TH" }))
    await settle()
    expect(patches).toEqual([])
    expect(client.getQueryData(meKeys.settings(EMAIL))).toEqual(OLD_ACCOUNT)
  })

  it("keeps the cached comic choices when the save's answer has no comics group", async () => {
    signIn()
    const patches = account({ oldPatch: true })
    const { client } = renderUi(<SettingsSync />)
    await waitFor(() => expect(useAppStore.getState().readerWidth).toBe("narrow"))
    act(() => useAppStore.getState().setReaderBg("dark"))
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2000 })
    await settle()
    // One request only, and the cache keeps a whole comics group (with what was sent).
    expect(patches).toEqual([{ comics: { background: "dark" } }])
    const cached = client.getQueryData<Settings>(meKeys.settings(EMAIL))
    expect(cached?.comics).toEqual({ ...ACCOUNT.comics, background: "dark" })
    expect(cached?.privacy).toEqual(ACCOUNT.privacy)
  })
})
