import { API_BASE } from "@/lib/api/config"
import type { components } from "@/lib/api/schema"

/**
 * The one way the browser calls the API (plan P5-01): same-origin cookies, the CSRF header on
 * every write, one silent refresh on 401 and a retry, and a typed {@link ApiError} for every
 * failure. Response types come from the generated `schema.d.ts`.
 */

export type Schemas = components["schemas"]

type ErrorDetail = Schemas["ErrorDetail"]

export class ApiError extends Error {
  /** HTTP status; 0 when the API could not be reached. */
  readonly status: number
  /** Stable machine-readable code, e.g. "invalid_credentials" (same idea as DemoApiError.code). */
  readonly code: string
  /** Field name -> error code, for validation errors. */
  readonly fields: Record<string, string>
  /** 429: seconds until the action may be tried again. */
  readonly retryAfterSeconds?: number
  /** 402: the episode's price in coins. */
  readonly price?: number
  /** 402: the day the episode becomes free (ISO date). */
  readonly freeOn?: string
  /** The API's X-Request-Id, to find the request in the logs. */
  readonly requestId?: string

  constructor(status: number, detail: Partial<ErrorDetail> & { code: string }, requestId?: string) {
    super(detail.message ?? detail.code)
    this.name = "ApiError"
    this.status = status
    this.code = detail.code
    this.fields = detail.fields ?? {}
    this.retryAfterSeconds = detail.retryAfterSeconds ?? undefined
    this.price = detail.price ?? undefined
    this.freeOn = detail.freeOn ?? undefined
    this.requestId = requestId
  }
}

/** Sign-in endpoints answer 401 for wrong details, not for an expired access token: never refresh on them. */
const NO_REFRESH = new Set([
  "/auth/csrf",
  "/auth/login",
  "/auth/signup",
  "/auth/verify",
  "/auth/resend-code",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
])

const CSRF_COOKIE = "XSRF-TOKEN"

type Query = Record<string, string | number | boolean | null | undefined>

export type RequestOptions = {
  body?: unknown
  query?: Query
  headers?: Record<string, string>
  signal?: AbortSignal
}

// ---------------------------------------------------------------- session lost

const sessionLostListeners = new Set<() => void>()

/** Called when a signed-in call fails with 401 even after a refresh (the session ended). */
export function onSessionLost(listener: () => void): () => void {
  sessionLostListeners.add(listener)
  return () => sessionLostListeners.delete(listener)
}

// ---------------------------------------------------------------- CSRF and refresh

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  const found = document.cookie.split("; ").find((c) => c.startsWith(prefix))
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined
}

let csrfLoading: Promise<string | undefined> | null = null

/** The XSRF-TOKEN cookie, asking the API to set it first when the browser has none. */
async function csrfToken(fresh = false): Promise<string | undefined> {
  const existing = fresh ? undefined : readCookie(CSRF_COOKIE)
  if (existing) return existing
  csrfLoading ??= fetch(`${API_BASE}/auth/csrf`, { credentials: "same-origin", cache: "no-store" })
    .then(() => readCookie(CSRF_COOKIE))
    .catch(() => undefined)
    .finally(() => {
      csrfLoading = null
    })
  return csrfLoading
}

let refreshing: Promise<boolean> | null = null

/** One refresh for all calls that got 401 at the same time. */
function refreshSession(): Promise<boolean> {
  refreshing ??= send("POST", "/auth/refresh", {})
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// ---------------------------------------------------------------- requests

function url(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`
}

async function send(method: string, path: string, options: RequestOptions, freshCsrf = false): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")
  if (method !== "GET") {
    const token = await csrfToken(freshCsrf)
    if (token) headers.set("X-XSRF-TOKEN", token)
  }
  let body: string | undefined
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.body)
  }
  return fetch(url(path, options.query), {
    method,
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  })
}

async function sendOrThrow(method: string, path: string, options: RequestOptions, freshCsrf = false) {
  try {
    return await send(method, path, options, freshCsrf)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError(0, { code: "network_error", message: "The server could not be reached." })
  }
}

async function toError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get("X-Request-Id") ?? undefined
  try {
    const body = (await res.json()) as Partial<Schemas["ErrorResponse"]>
    if (body.error?.code) return new ApiError(res.status, body.error, requestId)
  } catch {
    // Not JSON: the API is down behind the Next.js rewrite, or a proxy answered.
  }
  const code = res.status >= 500 ? "server_error" : `http_${res.status}`
  return new ApiError(res.status, { code, message: res.statusText || code }, requestId)
}

/** Calls the API and returns the JSON body (undefined for 204); throws {@link ApiError}. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let res = await sendOrThrow(method, path, options)

  if (res.status === 403 && method !== "GET") {
    // The CSRF cookie was missing or replaced: get a new one and try once more.
    const error = await toError(res.clone())
    if (error.code === "invalid_csrf_token") res = await sendOrThrow(method, path, options, true)
  }

  if (res.status === 401 && !NO_REFRESH.has(path)) {
    if (await refreshSession()) res = await sendOrThrow(method, path, options)
    if (res.status === 401) sessionLostListeners.forEach((listener) => listener())
  }

  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
}

/** A new Idempotency-Key for one money or access action; reuse it when retrying that same action. */
export function idempotencyKey(): string {
  // randomUUID needs a secure context (https or localhost); a phone on the LAN uses plain http.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")
}
