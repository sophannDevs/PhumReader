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
import { useAppStore } from "@/lib/store"
import { useTheme } from "@/lib/theme"

const SAVE_DELAY_MS = 500

/**
 * Real API only. Signed in: loads the account's settings (`useAccountSettings`, GET /me/settings) and applies the
 * reader theme, reading defaults and alert settings to this browser once per account; afterwards every change to the
 * theme and reading defaults is saved to the account (only what changed, half a second after the last change). The
 * language is saved when it is chosen (Settings), not here: the address decides the language of a page.
 * The alert settings (V21-03: push and email per type, quiet hours, digest; `notifPrefs`) are saved where they are
 * changed, by `saveAlertPrefs` (Notifications page, /welcome), which keeps the cached account settings up to date.
 */
export function SettingsSync() {
  const tt = useTranslations("toasts")
  const qc = useQueryClient()
  const email = useAccountEmail()
  const { theme, setTheme } = useTheme()
  const reader = useAppStore((s) => s.novelSettings)
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
    useAppStore.setState({
      novelSettings: saved.reader,
      notifications: { episodes: saved.notifications.episodes, fastPass: saved.notifications.fastPass },
      notifPrefs: prefsFromApi(saved.notifications),
    })
    setTheme(saved.theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setTheme is stable enough; apply once per account
  }, [email, saved])

  useEffect(() => {
    if (DEMO_MODE || !email || !saved || applied.current !== email || !theme) return
    const change: account.SettingsChange = {}
    if (theme !== saved.theme) change.theme = theme
    if (JSON.stringify(reader) !== JSON.stringify(saved.reader)) change.reader = reader
    if (Object.keys(change).length === 0) return
    const timer = setTimeout(() => {
      account.patchSettings(change).then(
        // Only what this sent: an alert switch saved meanwhile keeps its own answer.
        (s) => qc.setQueryData<account.Settings>(meKeys.settings(email), (old) => ({ ...(old ?? s), theme: s.theme, reader: s.reader })),
        () => toast.error(tt("actionFailed"))
      )
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [theme, reader, saved, email, qc, tt])

  return null
}
