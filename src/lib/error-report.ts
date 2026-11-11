import { ApiError } from "@/lib/api/client"

export interface ErrorReportContext {
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
  user?: { id?: string; email?: string }
}

/**
 * Report an error to Sentry (or the console in dev), attaching the backend X-Request-Id.
 * Part of plan P5-04: Sentry capture with the request id.
 */
export function reportError(error: unknown, context?: ErrorReportContext) {
  const requestId =
    error instanceof ApiError
      ? error.requestId
      : typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
        ? (error as { digest: string }).digest
        : undefined

  const tags = {
    ...context?.tags,
    ...(requestId ? { requestId } : {}),
    ...(error instanceof ApiError ? { statusCode: error.status, errorCode: error.code } : {}),
  }

  // Sentry SDK may be loaded globally on window or through @sentry/nextjs
  const globalSentry =
    typeof window !== "undefined"
      ? (window as unknown as { Sentry?: { captureException: (err: unknown, ctx?: unknown) => void } }).Sentry
      : undefined

  if (globalSentry?.captureException) {
    globalSentry.captureException(error, {
      tags,
      extra: {
        ...context?.extra,
        fields: error instanceof ApiError ? error.fields : undefined,
      },
      user: context?.user,
    })
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[ErrorReport]", error, { requestId, tags, extra: context?.extra })
  }
}
