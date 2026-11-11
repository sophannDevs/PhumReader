import type { QueryClient } from "@tanstack/react-query"
import type { Genre } from "@/data"
import type { Locale } from "@/i18n/routing"
import * as account from "@/lib/api/account"
import { DEMO_MODE } from "@/lib/api/config"
import { meKeys } from "@/lib/api/keys"
import { useAppStore } from "@/lib/store"

/** What the reader picked on /welcome, on Home ("What do you like to read?") and in Settings > Language. */
export type PreferencesChange = { genres?: Genre[]; storyLanguages?: Locale[] }

/** The account's picks as the store keeps them: `prefs` (null = never chosen) and `settings.langs`. */
export function applyPreferences(p: account.Settings["preferences"]) {
  useAppStore.setState((s) => ({
    prefs: (p.genres ?? null) as Genre[] | null,
    settings: { ...s.settings, langs: [...p.storyLanguages] },
  }))
}

/**
 * Keeps the picks in the store at once and, in real mode with a signed-in account (V21-07), saves them with
 * PATCH `/me/settings` (only what changed) and updates the cached account settings. Rejects when the save fails; the
 * picks stay in this browser.
 */
export async function savePreferences(qc: QueryClient, email: string | undefined, change: PreferencesChange): Promise<void> {
  const store = useAppStore.getState()
  if (change.genres) store.setPrefs(change.genres)
  if (change.storyLanguages) store.setSettings({ langs: change.storyLanguages })
  if (DEMO_MODE || !email) return
  const saved = await account.patchSettings({ preferences: change })
  qc.setQueryData<account.Settings>(meKeys.settings(email), (old) => (old ? { ...old, preferences: saved.preferences } : saved))
}
