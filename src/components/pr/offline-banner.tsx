"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { WifiIcon, WifiOffIcon } from "lucide-react"
import { useTranslations } from "next-intl"

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

function getServerSnapshot(): boolean {
  return true
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

/**
 * Sticky offline notification banner (P5-04).
 * Appears when browser network connectivity drops, and briefly announces reconnection.
 */
export function OfflineBanner() {
  const t = useTranslations("states")
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot)
  const [showBackOnline, setShowBackOnline] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setShowBackOnline(true)
      const timer = setTimeout(() => {
        setShowBackOnline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
    prevOnlineRef.current = isOnline
  }, [isOnline])

  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-medium text-amber-950 shadow-sm dark:bg-amber-600 dark:text-white"
      >
        <WifiOffIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("offlineBanner")}</span>
      </aside>
    )
  }

  if (showBackOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-center text-xs font-medium text-white shadow-sm transition-opacity duration-300"
      >
        <WifiIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("backOnline")}</span>
      </aside>
    )
  }

  return null
}
