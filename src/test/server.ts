import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

/** Every call goes to the API under this base (the website calls it same-origin through the /api rewrite). */
export const API = "http://localhost:3000/api/v1"

/** The API's error body (docs/BACKEND.md): `{ error: { code, message, fields?, retryAfterSeconds? } }`. */
export const apiError = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ error: { code, message: code, ...extra } }, { status })

/**
 * Handlers every test starts with: the CSRF cookie call the client makes before any write.
 * A test adds or replaces what it needs with `server.use(http.post(`${API}/...`, ...))`.
 * Anything not handled fails the test (`onUnhandledFrame: "error"` in setup.tsx).
 */
export const defaultHandlers = [http.get(`${API}/auth/csrf`, () => new HttpResponse(null, { status: 204 }))]

export const server = setupServer(...defaultHandlers)
export { http, HttpResponse }
