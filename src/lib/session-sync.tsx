"use client"

import { useEffect } from "react"
import { DEMO_MODE } from "@/lib/api/config"
import { onSessionLost } from "@/lib/api/client"
import { currentUser } from "@/lib/session"
import { useAppStore, useHydrated } from "@/lib/store"
import { useWalletSync } from "@/lib/wallet"

/**
 * Real API only: once the stored state is loaded, asks `GET /me` who is signed in (the stored
 * user is only a hint so the header does not flash), and logs the header out when a signed-in
 * call fails with 401 even after a silent refresh.
 */
export function SessionSync() {
  const hydrated = useHydrated()
  useWalletSync()

  useEffect(() => {
    if (DEMO_MODE) return
    return onSessionLost(() => {
      if (useAppStore.getState().user) useAppStore.getState().logout()
    })
  }, [])

  useEffect(() => {
    if (DEMO_MODE || !hydrated) return
    let cancelled = false
    currentUser()
      .then((user) => {
        if (cancelled) return
        const store = useAppStore.getState()
        if (user) store.login(user)
        else if (store.user) store.logout()
      })
      // The API could not be reached: keep the stored hint; pages show their own errors.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [hydrated])

  return null
}
