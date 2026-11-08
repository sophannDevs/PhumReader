import { ApiError } from "@/lib/api/client"

/** The machine-readable code of an API or demo error (e.g. "invalid_credentials"). */
export function errorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) return error.code
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  return undefined
}

/** The field errors of a 400 answer (field name -> code); empty for anything else. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {}
}

/** For a 429 answer: seconds until the action may be tried again. */
export function retryAfterSeconds(error: unknown): number | undefined {
  return error instanceof ApiError && error.status === 429 ? (error.retryAfterSeconds ?? 60) : undefined
}

/**
 * How long to wait, for the "Try again in …" messages: whole minutes from 60 seconds on
 * (rounded up), seconds below.
 */
export function waitParts(seconds: number): { unit: "seconds" | "minutes"; count: number } {
  return seconds >= 60 ? { unit: "minutes", count: Math.ceil(seconds / 60) } : { unit: "seconds", count: Math.max(1, seconds) }
}
