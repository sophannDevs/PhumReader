"use client"

import { CheckIcon } from "@/components/animate-ui/icons/check"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { useTranslations } from "@/i18n/translations"
import { useCallback, useEffect, useRef, useState } from "react"
import { ErrorHelp, ErrorHero, ErrorStatus, errorActions } from "@/components/pr/error-page"
import { Button } from "@/components/ui/button"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"

declare global {
  interface Window {
    /** Set once React runs the offline page; the inline fallback script (offline/page.tsx) then stands down. */
    __prOfflineReady?: boolean
  }
}

/**
 * Offline (spec §9, screens 09-error-offline-*): Try again, Go to Home, tips, Help center. It goes back by itself on
 * the browser's `online` event. The service worker (public/sw.js) shows this page in place of any page that can't
 * load, so "back" reloads that address; on /offline itself it goes Home.
 */
export function OfflineView() {
  const t = useTranslations("errors")
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<"" | "still" | "ok">("")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const tips = t.raw("offline.tips") as string[]

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  const backOnline = useCallback(() => {
    setBusy(false)
    setStatus("ok")
    later(1500, () => {
      if (pathname === "/offline") router.replace("/")
      else window.location.reload()
    })
  }, [later, pathname, router])

  useEffect(() => {
    window.__prOfflineReady = true
    const list = timers.current
    return () => list.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    window.addEventListener("online", backOnline)
    return () => window.removeEventListener("online", backOnline)
  }, [backOnline])

  function retry() {
    if (busy || status === "ok") return
    setBusy(true)
    setStatus("")
    later(1200, () => {
      if (navigator.onLine) backOnline()
      else {
        setBusy(false)
        setStatus("still")
      }
    })
  }

  return (
    <ErrorHero kind="offline" title={t("offline.title")} body={t("offline.body")}>
      <ErrorStatus status={status} message={status === "ok" ? t("offline.ok") : t("offline.still")} />
      <div className={errorActions}>
        <Button animateIcon variant="brand" size="lg" onClick={retry} loading={busy} disabled={status === "ok"} data-offline-retry="">
          {busy ? null : <RefreshCwIcon />}
          {busy ? t("trying") : t("retry")}
        </Button>
        <Button animateIcon asChild variant="outline" size="lg">
          <Link href="/">
            <HomeIcon />
            {t("home")}
          </Link>
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm leading-5 text-soft-foreground">
            <span aria-hidden className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <CheckIcon className="size-3" />
            </span>
            {tip}
          </li>
        ))}
      </ul>
      {DEMO_MODE ? (
        <button
          type="button"
          onClick={backOnline}
          className="self-start rounded-sm text-xs text-muted-foreground underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("offline.simulate")}
        </button>
      ) : null}
      <ErrorHelp />
    </ErrorHero>
  )
}
