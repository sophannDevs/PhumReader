"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/pr/error-state"
import { Link } from "@/i18n/navigation"
import { ApiError } from "@/lib/api/client"
import { retryAfterSeconds } from "@/lib/api/errors"
import { reportError } from "@/lib/error-report"
import { useWaitText } from "@/lib/use-wait-text"

/**
 * Route error boundary body (P5-04):
 * - Reports unhandled exceptions with Sentry/logger and backend X-Request-Id.
 * - Handles 401 (login prompt), 403 (access denied), 404 (not found), 429 (rate limit retry).
 * - Shows ErrorState with Retry calling Next.js `reset()` on 5xx / unexpected failures.
 */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("states")
  const tAuth = useTranslations("auth")
  const waitText = useWaitText()

  useEffect(() => {
    reportError(error)
  }, [error])

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return (
        <ErrorState
          className="container flex-1 justify-center py-24"
          title={t("unauthorizedTitle")}
          description={t("unauthorizedDesc")}
          extra={
            <Button asChild>
              <Link href="/login">{t("login")}</Link>
            </Button>
          }
        />
      )
    }

    if (error.status === 403) {
      return (
        <ErrorState
          className="container flex-1 justify-center py-24"
          title={t("forbiddenTitle")}
          description={t("forbiddenDesc")}
          extra={
            <Button asChild variant="outline">
              <Link href="/">{t("emptyAction")}</Link>
            </Button>
          }
        />
      )
    }

    if (error.status === 404) {
      return (
        <ErrorState
          className="container flex-1 justify-center py-24"
          title={t("notFoundTitle")}
          description={t("notFoundDesc")}
          extra={
            <Button asChild variant="outline">
              <Link href="/">{t("emptyAction")}</Link>
            </Button>
          }
        />
      )
    }

    if (error.status === 429) {
      const wait = retryAfterSeconds(error) ?? 60
      return (
        <ErrorState
          className="container flex-1 justify-center py-24"
          title={tAuth("tooManyTitle")}
          description={waitText(wait)}
          onRetry={reset}
        />
      )
    }
  }

  return <ErrorState className="container flex-1 justify-center py-24" onRetry={reset} />
}
