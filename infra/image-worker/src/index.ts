import { verifyToken } from "./token.ts"

/**
 * Image access Worker (plan P3-08). Serves comic panels of paid episodes from the R2 bucket, but
 * only to addresses the API signed a few minutes ago (`?t=<exp>.<sig>`, see token.ts).
 *
 * Caching: the token is checked on every request, then the image is looked up in the edge cache
 * under its address WITHOUT the query string, so all readers share one cached copy and the hit rate
 * stays high. The browser gets `private` caching for no longer than the token still lives.
 */

type R2Object = { body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } }
export interface Env {
  /** The R2 bucket with the processed images. */
  IMAGES: { get(key: string): Promise<R2Object | null> }
  /** Shared with the API (`IMAGE_SIGNING_SECRET`). */
  SIGNING_SECRET: string
  /** Optional: the secret before the last rotation, accepted until its tokens have expired. */
  SIGNING_SECRET_PREVIOUS?: string
}
type Context = { waitUntil(promise: Promise<unknown>): void }
type EdgeCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> }

/** The longest the browser keeps an image: the API's tokens last 5 minutes. */
const MAX_BROWSER_SECONDS = 300

const deny = (status: number, text: string) =>
  new Response(text, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } })

export default {
  async fetch(request: Request, env: Env, ctx: Context, edge?: EdgeCache): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return deny(405, "Method not allowed")
    const url = new URL(request.url)
    const key = decodeKey(url.pathname)
    if (!key) return deny(404, "Not found")

    const verdict = await verifyToken(
      [env.SIGNING_SECRET, env.SIGNING_SECRET_PREVIOUS ?? ""],
      url.pathname,
      url.searchParams.get("t"),
      Math.floor(Date.now() / 1000)
    )
    if (!verdict.ok) return deny(403, "Forbidden")

    const cache = edge ?? (globalThis as unknown as { caches: { default: EdgeCache } }).caches.default
    // Same address for everyone: no token in the cache key.
    const cacheKey = new Request(url.origin + url.pathname)
    let stored = await cache.match(cacheKey)
    if (!stored) {
      const object = await env.IMAGES.get(key)
      if (!object) return deny(404, "Not found")
      stored = new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
          // Panels are never overwritten (a new upload gets a new address), so the edge may keep them.
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(object.httpEtag ? { ETag: object.httpEtag } : {}),
        },
      })
      ctx.waitUntil(cache.put(cacheKey, stored.clone()))
    }

    const remaining = Math.max(0, verdict.expiresAt - Math.floor(Date.now() / 1000))
    const headers = new Headers(stored.headers)
    headers.set("Cache-Control", `private, max-age=${Math.min(remaining, MAX_BROWSER_SECONDS)}`)
    headers.set("X-Content-Type-Options", "nosniff")
    return new Response(request.method === "HEAD" ? null : stored.body, { status: 200, headers })
  },
}

/** The R2 key for a request path, or null for a path that is not an image key (empty, `..`, odd characters). */
export function decodeKey(pathname: string): string | null {
  const key = pathname.startsWith("/") ? pathname.slice(1) : pathname
  return /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) && !key.includes("..") && !key.includes("//") ? key : null
}
