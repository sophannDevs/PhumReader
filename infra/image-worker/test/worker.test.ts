import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import worker, { decodeKey, type Env } from "../src/index.ts"
import { signToken, verifyToken } from "../src/token.ts"

const SECRET = "test-secret-for-vectors"
const PATH = "/uploads/panel/11111111-2222-3333-4444-555555555555/w800.webp"
const now = () => Math.floor(Date.now() / 1000)

// The same vector is asserted by the API's ImageUrlSignerTest: the two sides must agree.
describe("token format (shared with the API)", () => {
  it("matches the vector the Java signer is tested against", async () => {
    assert.equal(await signToken(SECRET, PATH, 1893456000), "1893456000.OqzLHg13SPK07ExM9Jy5YvxQnKMovjZtFsoFp0LOQuM")
  })

  it("rejects missing, malformed, expired, forged and moved tokens", async () => {
    const exp = now() + 300
    const good = await signToken(SECRET, PATH, exp)
    assert.deepEqual(await verifyToken([SECRET], PATH, good, now()), { ok: true, expiresAt: exp })
    assert.deepEqual(await verifyToken([SECRET], PATH, null, now()), { ok: false, reason: "missing" })
    for (const bad of ["", "abc", "123", "123.", ".abc", "x.y", `${exp}.not*base64`, `${exp}.AAAA`]) {
      const result = await verifyToken([SECRET], PATH, bad, now())
      assert.equal(result.ok, false, bad)
    }
    // Another image, another secret, another expiry: all "bad_signature".
    assert.equal((await verifyToken([SECRET], PATH.replace("w800", "w320"), good, now())).ok, false)
    assert.equal((await verifyToken(["other-secret"], PATH, good, now())).ok, false)
    const [, sig] = good.split(".")
    assert.equal((await verifyToken([SECRET], PATH, `${exp + 1}.${sig}`, now())).ok, false)
    // Expired but genuine.
    const old = await signToken(SECRET, PATH, now() - 1)
    assert.deepEqual(await verifyToken([SECRET], PATH, old, now()), { ok: false, reason: "expired" })
    // A rotated secret still accepts the previous one.
    assert.equal((await verifyToken(["new-secret", SECRET], PATH, good, now())).ok, true)
  })
})

describe("image Worker", () => {
  let gets = 0
  let env: Env
  const stored = new Map<string, Response>()
  const edge = {
    async match(request: Request) {
      return stored.get(request.url)?.clone()
    },
    async put(request: Request, response: Response) {
      stored.set(request.url, response)
    },
  }
  const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined) }
  const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://img.test${path}`, init), env, ctx, edge)

  beforeEach(() => {
    gets = 0
    stored.clear()
    env = {
      SIGNING_SECRET: SECRET,
      IMAGES: {
        async get(key) {
          gets++
          return key === PATH.slice(1)
            ? { body: new Response("PIXELS").body!, httpEtag: '"abc"', httpMetadata: { contentType: "image/webp" } }
            : null
        },
      },
    }
  })

  const url = async (exp: number, path = PATH) => `${path}?t=${await signToken(SECRET, path, exp)}`

  it("serves an image to a valid token for at most 5 minutes in the browser", async () => {
    const response = await call(await url(now() + 120))
    assert.equal(response.status, 200)
    assert.equal(await response.text(), "PIXELS")
    assert.equal(response.headers.get("Content-Type"), "image/webp")
    const control = response.headers.get("Cache-Control") ?? ""
    assert.match(control, /^private, max-age=(\d+)$/)
    assert.ok(Number(/max-age=(\d+)/.exec(control)![1]) <= 120)
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff")
  })

  it("answers 403 after the token has expired, and for a missing, forged or moved token", async () => {
    assert.equal((await call(await url(now() - 1))).status, 403)
    assert.equal((await call(PATH)).status, 403)
    assert.equal((await call(`${PATH}?t=${now() + 300}.${"A".repeat(43)}`)).status, 403)
    const other = "/uploads/panel/99999999-2222-3333-4444-555555555555/w800.webp"
    assert.equal((await call(`${other}?t=${(await url(now() + 300)).split("t=")[1]}`)).status, 403)
    assert.equal(gets, 0, "nothing is read from the bucket without a valid token")
  })

  it("keeps the token out of the cache key: the second reader hits the cache, not the bucket", async () => {
    assert.equal((await call(await url(now() + 100))).status, 200)
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal(gets, 1)
    assert.deepEqual([...stored.keys()], [`https://img.test${PATH}`])
    // A different reader with a different token (different expiry).
    const second = await call(await url(now() + 250))
    assert.equal(second.status, 200)
    assert.equal(await second.text(), "PIXELS")
    assert.equal(gets, 1, "served from the cache")
  })

  it("still checks the token when the image is already cached", async () => {
    await call(await url(now() + 100))
    await new Promise((resolve) => setTimeout(resolve))
    assert.equal((await call(`${PATH}?t=${now() + 100}.${"B".repeat(43)}`)).status, 403)
    assert.equal((await call(await url(now() - 5))).status, 403)
  })

  it("answers 404 for an unknown image with a valid token, and refuses odd paths and methods", async () => {
    const missing = "/uploads/panel/00000000-0000-0000-0000-000000000000/w800.webp"
    assert.equal((await call(await url(now() + 60, missing))).status, 404)
    assert.equal((await call("/")).status, 404)
    // The URL parser resolves "/a/../b.webp" to "/b.webp" before the Worker sees it; that path needs its own token.
    assert.equal((await call("/a/../b.webp")).status, 403)
    assert.equal((await call(await url(now() + 60), { method: "POST" })).status, 405)
  })

  it("HEAD returns headers without a body", async () => {
    const response = await call(await url(now() + 60), { method: "HEAD" })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), "")
  })

  it("decodeKey accepts image keys only", () => {
    assert.equal(decodeKey("/uploads/panel/x/w800.webp"), "uploads/panel/x/w800.webp")
    for (const bad of ["/", "", "/..", "/a/../b", "//a", "/a//b", "/a b", "/a?b"]) assert.equal(decodeKey(bad), null, bad)
  })
})
