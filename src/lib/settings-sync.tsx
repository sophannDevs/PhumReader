"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { DEMO_MODE } from "@/lib/api/config"
import * as account from "@/lib/api/account"
import { useAccountEmail } from "@/lib/me"
import { useAppStore } from "@/lib/store"
import { useTheme } from "@/lib/theme"

const SAVE_DELAY_MS = 500

/**
 * Real API only. Signed in: loads the account's settings once and applies the appearance, reading
 * defaults and notifications to this browser; afterwards every change to them is saved to the
 * account (only what changed, half a second after the last change). The language is saved when it
 * is chosen (Settings), not here: the address decides the language of a page.
 */
export function SettingsSync() {
  const tt = useTranslations("toasts")
  const email = useAccountEmail()
  const { theme, setTheme } = useTheme()
  const reader = useAppStore((s) => s.novelSettings)
  const notifications = useAppStore((s) => s.notifications)
  /** What the account has now; null until loaded. */
  const saved = useRef<account.Settings | null>(null)

  useEffect(() => {
    if (DEMO_MODE) return
    saved.current = null
    if (!email) return
    let cancelled = false
    account
      .fetchSettings()
      .then((s) => {
        if (cancelled) return
        saved.current = s
        useAppStore.setState({ novelSettings: s.reader, notifications: s.notifications })
        setTheme(s.theme)
      })
      .catch(() => undefined) // Keep this browser's settings; the next visit tries again.
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setTheme is stable enough; load once per account
  }, [email])

  useEffect(() => {
    const base = saved.current
    if (DEMO_MODE || !base || !theme) return
    const change: account.SettingsChange = {}
    if (theme !== base.theme) change.theme = theme
    if (JSON.stringify(reader) !== JSON.stringify(base.reader)) change.reader = reader
    if (JSON.stringify(notifications) !== JSON.stringify(base.notifications)) change.notifications = notifications
    if (Object.keys(change).length === 0) return
    const timer = setTimeout(() => {
      account.patchSettings(change).then(
        (s) => {
          saved.current = s
        },
        () => toast.error(tt("actionFailed"))
      )
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [theme, reader, notifications, tt])

  return null
}
