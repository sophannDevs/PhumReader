"use client"

import { BookOpenIcon } from "@/components/animate-ui/icons/book-open"
import { CopyIcon } from "@/components/animate-ui/icons/copy"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { useTranslations } from "@/i18n/translations"
import { startTransition, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { recoverDemoCrash } from "@/components/pr/demo-crash"
import { ErrorHelp, ErrorHero, ErrorStatus, StatusLink, errorActions } from "@/components/pr/error-page"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/pr/error-state"
import { Link, useRouter } from "@/i18n/navigation"
import { ApiError } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import { retryAfterSeconds } from "@/lib/api/errors"
import { reportError } from "@/lib/error-report"
import { useWaitText } from "@/lib/use-wait-text"

/** Set when Retry re-renders the route; a boundary that mounts again soon after says "Still not working". */
let retried = false
let retriedTimer: ReturnType<typeof setTimeout> | undefined

/** "TW-500-…": the server's error digest, or a short code made from the message (same on server and client). */
function referenceOf(error: Error & { digest?: string }): string {
  if (error.digest) return `TW-500-${error.digest}`
  let h = 0
  for (const ch of error.message ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `TW-500-${h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`
}

/**
 * 500 (spec §9, screens 09-error-500-*), the body of the error.tsx boundaries: Try again, Go to Home, My library,
 * the reference number with copy, Help center · Service status.
 * Try again shows "Trying…", then re-renders the route (router.refresh + reset). If the error comes back, the new
 * boundary says "Still not working…". In the demo the first retry fails and the second works, like the prototype.
 */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors")
  const ts = useTranslations("states")
  const tAuth = useTranslations("auth")
  const waitText = useWaitText()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<"" | "still" | "ok">(() => (retried ? "still" : ""))
  const tries = useRef(retried ? 1 : 0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const reference = referenceOf(error)

  useEffect(() => {
    reportError(error)
  }, [error])

  useEffect(() => {
    reportError(error)
  }, [error])

  useEffect(() => {
    retried = false
    const list = timers.current
    return () => list.forEach(clearTimeout)
  }, [])

  function later(ms: number, fn: () => void) {
    timers.current.push(setTimeout(fn, ms))
  }

  /**
   * Re-renders the route. On success this boundary unmounts (its timers are cleared). If the error comes back, React
   * either mounts a new boundary (it reads `retried`) or keeps this one: the timer then says "Still not working".
   */
  function rerender() {
    retried = true
    clearTimeout(retriedTimer)
    retriedTimer = setTimeout(() => {
      retried = false
    }, 10_000)
    later(1500, () => {
      setBusy(false)
      setStatus("still")
    })
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  function retry() {
    if (busy || status === "ok") return
    setBusy(true)
    setStatus("")
    later(1200, () => {
      tries.current += 1
      if (!DEMO_MODE) {
        rerender()
        return
      }
      // Demo (prototype): the first retry still fails, the second one works.
      setBusy(false)
      if (tries.current < 2) {
        setStatus("still")
        return
      }
      setStatus("ok")
      later(1500, () => {
        recoverDemoCrash()
        rerender()
      })
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      toast.success(t("server.copied"))
    } catch {
      toast.error(t("server.copyFailed", { ref: reference }))
    }
  }

  if (error instanceof ApiError) {
    // Expected API failures get their own message instead of the generic 500 page.
    const full = "container flex-1 justify-center py-24"
    if (error.status === 401) {
      return (
        <ErrorState
          className={full}
          title={ts("unauthorizedTitle")}
          description={ts("unauthorizedDesc")}
          extra={
            <Button asChild>
              <Link href="/login">{ts("login")}</Link>
            </Button>
          }
        />
      )
    }
    if (error.status === 403 || error.status === 404) {
      const forbidden = error.status === 403
      return (
        <ErrorState
          className={full}
          title={ts(forbidden ? "forbiddenTitle" : "notFoundTitle")}
          description={ts(forbidden ? "forbiddenDesc" : "notFoundDesc")}
          extra={
            <Button asChild variant="outline">
              <Link href="/">{ts("emptyAction")}</Link>
            </Button>
          }
        />
      )
    }
    if (error.status === 429) {
      return (
        <ErrorState className={full} title={tAuth("tooManyTitle")} description={waitText(retryAfterSeconds(error) ?? 60)} onRetry={reset} />
      )
    }
  }

  return (
    <ErrorHero kind="server" title={t("server.title")} body={t("server.body")}>
      <ErrorStatus status={status} message={status === "ok" ? t("server.ok") : t("server.still")} />
      <div className={errorActions}>
        <Button variant="brand" size="lg" onClick={retry} loading={busy} disabled={status === "ok"}>
          {busy ? null : <RefreshCwIcon />}
          {busy ? t("trying") : t("retry")}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <HomeIcon />
            {t("home")}
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/library">
            <BookOpenIcon />
            {t("library")}
          </Link>
        </Button>
      </div>
      <ErrorHelp extra={<StatusLink />}>
        <p className="flex flex-wrap items-center gap-1.5">
          <span>{t("server.ref")}</span>
          <code className="rounded-md bg-muted px-2 py-[3px] font-mono text-xs break-all text-foreground">{reference}</code>
          <Button variant="ghost" size="icon-sm" className="size-[26px]" onClick={copy} aria-label={t("server.copy")}>
            <CopyIcon className="size-3.5" />
          </Button>
        </p>
      </ErrorHelp>
    </ErrorHero>
  )
}
