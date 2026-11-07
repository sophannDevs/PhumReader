/**
 * Signed image tokens (plan P3-08). The API signs an image address; the Worker checks it.
 *
 * A token is `<exp>.<sig>` in the `t` query parameter:
 *   exp = Unix time in seconds after which the address stops working
 *   sig = base64url(HMAC-SHA256(secret, `${pathname}\n${exp}`)), no padding
 *
 * The token is tied to the exact path, so it cannot be moved to another image, and it is not part
 * of the cache key, so every reader shares one cached copy of each image.
 * The Java side is `ImageUrlSigner` in the API; both are tested against the same vector.
 */

const encoder = new TextEncoder()

export type TokenResult = { ok: true; expiresAt: number } | { ok: false; reason: "missing" | "malformed" | "expired" | "bad_signature" }

function toBase64Url(bytes: ArrayBuffer): string {
  let text = ""
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4)
  try {
    const raw = atob(padded)
    const bytes = new Uint8Array(new ArrayBuffer(raw.length))
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage])
}

const message = (pathname: string, exp: number) => encoder.encode(`${pathname}\n${exp}`)

/** The token for an address (used by tests; the API has the same code in Java). */
export async function signToken(secret: string, pathname: string, exp: number): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), message(pathname, exp))
  return `${exp}.${toBase64Url(signature)}`
}

/**
 * Checks a token against the current secret and, while a secret is being rotated, the previous one.
 * The comparison is done by `crypto.subtle.verify`, which does not leak where a signature differs.
 */
export async function verifyToken(secrets: string[], pathname: string, token: string | null, nowSeconds: number): Promise<TokenResult> {
  if (!token) return { ok: false, reason: "missing" }
  const dot = token.indexOf(".")
  if (dot < 1 || !/^\d{1,12}$/.test(token.slice(0, dot))) return { ok: false, reason: "malformed" }
  const exp = Number(token.slice(0, dot))
  const signature = fromBase64Url(token.slice(dot + 1))
  if (!signature || signature.length !== 32) return { ok: false, reason: "malformed" }
  // Check the signature first, so an expired but forged token is "bad_signature" and tells nothing.
  for (const secret of secrets) {
    if (!secret) continue
    if (await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), signature, message(pathname, exp))) {
      return exp > nowSeconds ? { ok: true, expiresAt: exp } : { ok: false, reason: "expired" }
    }
  }
  return { ok: false, reason: "bad_signature" }
}
