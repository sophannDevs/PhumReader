"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useTranslations } from "@/i18n/translations"
import { DEMO_MODE } from "@/lib/api/config"
import * as account from "@/lib/api/account"
import { meKeys } from "@/lib/api/keys"
import { useAccountEmail } from "@/lib/me"
import { prefsFromApi, useAccountSettings } from "@/lib/notifications"
import { applyPreferences } from "@/lib/preferences"
import { type AppSettings, type AppState, REGIONS, type Region, useAppStore } from "@/lib/store"
import { useTheme } from "@/lib/theme"

const SAVE_DELAY_MS = 500

type Comics = account.Settings["comics"]
type Privacy = account.Settings["privacy"]
/** The part of the store the account's `comics` and `privacy` groups hold (V21-08). */
type Synced = {
  settings: Pick<AppSettings, "mode" | "quality" | "autoNext" | "saveData" | "region" | "publicLib" | "mature">
  readerBg: AppState["readerBg"]
  readerWidth: AppState["readerWidth"]
}

/**
 * The account's settings as the API may really answer them: an older backend (or a cached answer from before V21-08)
 * has no `comics` / `privacy` group, although the schema marks both as required.
 */
type AccountGroups = { comics?: Comics; privacy?: Privacy }

/**
 * The account's comics and privacy settings as store values: only the keys of the groups the answer has (a missing
 * group leaves the store's own values alone).
 */
export function syncedFromAccount(s: AccountGroups): Partial<Omit<Synced, "settings">> & { settings: Partial<Synced["settings"]> } {
  const { comics, privacy } = s
  return {
    settings: {
      ...(comics
        ? { mode: comics.mode, quality: comics.quality, autoNext: comics.autoNext, saveData: comics.dataSaver }
        : {}),
      ...(privacy ? { region: privacy.region, publicLib: privacy.publicLibrary, mature: privacy.mature } : {}),
    },
    ...(comics ? { readerBg: comics.background, readerWidth: comics.width } : {}),
  }
}

/** The store's values in the account's shape; `region` only when the account accepts it (one of REGIONS). */
export function accountFromSynced(s: Synced): { comics: Comics; privacy: Omit<Privacy, "region"> & { region?: Region } } {
  const region = (REGIONS as readonly string[]).includes(s.settings.region) ? (s.settings.region as Region) : undefined
  return {
    comics: {
      mode: s.settings.mode,
      quality: s.settings.quality,
      autoNext: s.settings.autoNext,
      dataSaver: s.settings.saveData,
      background: s.readerBg,
      width: s.readerWidth,
    },
    privacy: { ...(region ? { region } : {}), publicLibrary: s.settings.publicLib, mature: s.settings.mature },
  }
}

/** The keys of `now` that differ from `was` (undefined ones are left out); undefined when nothing differs. */
function changed<T extends object>(now: Partial<T>, was: T): Partial<T> | undefined {
  const out: Partial<T> = {}
  for (const k of Object.keys(now) as (keyof T)[]) {
    if (now[k] !== undefined && now[k] !== was[k]) out[k] = now[k]
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** `was` with the keys of `sent` that have a value (null and undefined are left out). */
function withSent<T extends object>(was: T, sent: { [K in keyof T]?: T[K] | null } | undefined): T {
  const out = { ...was }
  for (const k of Object.keys(sent ?? {}) as (keyof T)[]) {
    const v = sent?.[k]
    if (v !== undefined && v !== null) out[k] = v as T[keyof T]
  }
  return out
}

/**
 * Real API only. Signed in: loads the account's settings (`useAccountSettings`, GET /me/settings) and applies the
 * reader theme, reading defaults, comic reading choices, region and privacy switches and alert settings to this
 * browser once per account; afterwards every change to the theme, reading defaults, comic choices (`comics`: mode,
 * quality, auto-next, data saver, reader background and width) and region / privacy (`privacy`) is saved to the account
 * (only the keys that changed, half a second after the last change). The Google / Facebook links stay on this device.
 * The language is saved when it is chosen (Settings), not here: the address decides the language of a page; the story
 * languages are saved by `savePreferences`.
 * The alert settings (V21-03: push and email per type, quiet hours, digest; `notifPrefs`) are saved where they are
 * changed, by `saveAlertPrefs` (Notifications page, /welcome), which keeps the cached account settings up to date.
 */
export function SettingsSync() {
  const tt = useTranslations("toasts")
  const qc = useQueryClient()
  const email = useAccountEmail()
  const { theme, setTheme } = useTheme()
  const reader = useAppStore((s) => s.novelSettings)
  const settings = useAppStore((s) => s.settings)
  const readerBg = useAppStore((s) => s.readerBg)
  const readerWidth = useAppStore((s) => s.readerWidth)
  /** What the account has now (the cache follows every save). */
  const saved = useAccountSettings().data
  /** The account whose settings were applied to this browser. */
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (DEMO_MODE) return
    if (!email) {
      applied.current = null
      return
    }
    if (!saved || applied.current === email) return
    applied.current = email
    const synced = syncedFromAccount(saved)
    useAppStore.setState((s) => ({
      novelSettings: saved.reader,
      notifications: { episodes: saved.notifications.episodes, fastPass: saved.notifications.fastPass },
      notifPrefs: prefsFromApi(saved.notifications),
      settings: { ...s.settings, ...synced.settings },
      readerBg: synced.readerBg ?? s.readerBg,
      readerWidth: synced.readerWidth ?? s.readerWidth,
    }))
    applyPreferences(saved.preferences)
    setTheme(saved.theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setTheme is stable enough; apply once per account
  }, [email, saved])

  useEffect(() => {
    if (DEMO_MODE || !email || !saved || applied.current !== email || !theme) return
    const change: account.SettingsChange = {}
    if (theme !== saved.theme) change.theme = theme
    if (JSON.stringify(reader) !== JSON.stringify(saved.reader)) change.reader = reader
    // Key by key against the account: a change to anything else in `settings` (langs, Google…) sends nothing.
    const now = accountFromSynced({ settings, readerBg, readerWidth })
    // Only the groups the account answered with: an older API without them would never take the change, and the
    // save would repeat after every answer.
    const has: AccountGroups = saved
    const comics = has.comics ? changed(now.comics, has.comics) : undefined
    const privacy = has.privacy ? changed(now.privacy, has.privacy) : undefined
    if (comics) change.comics = comics
    if (privacy) change.privacy = privacy
    if (Object.keys(change).length === 0) return
    // The debounce also drops the save scheduled in the render that applied the account's values.
    const timer = setTimeout(() => {
      account.patchSettings(change).then(
        // Only the groups this sent: an alert switch or preference saved meanwhile keeps its own answer.
        // A group missing from the answer (older API) is never written as undefined: the cached group keeps its
        // values plus the keys just sent, so the same change is not sent again after every answer.
        (s) =>
          qc.setQueryData<account.Settings>(meKeys.settings(email), (old) => {
            const answer: AccountGroups = s
            const was: AccountGroups = old ?? {}
            const comics = answer.comics ?? (was.comics && withSent(was.comics, change.comics))
            const privacy = answer.privacy ?? (was.privacy && withSent(was.privacy, change.privacy))
            return {
              ...(old ?? s),
              theme: s.theme,
              reader: s.reader,
              ...(change.comics && comics ? { comics } : {}),
              ...(change.privacy && privacy ? { privacy } : {}),
            }
          }),
        () => toast.error(tt("actionFailed"))
      )
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [theme, reader, settings, readerBg, readerWidth, saved, email, qc, tt])

  return null
}
