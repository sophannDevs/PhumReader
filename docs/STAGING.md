# Free test setup ("staging for $0")

Goal: let other people open the real site (website + API + database) before anything is paid for. This is **not**
the production plan (P7-01); it is a throw-away test that also proves P3-01 (migrations and seed on a second
database). Free-tier terms change: check each service's pricing page before you sign up.

```
browser -> Vercel (website, free "Hobby")  -- /api/... rewrite -->  tunnel  -->  API on your computer  -->  Supabase (free)
```

What is checked in this guide: the settings below map to the right properties (secure cookies, a fixed signing
key), the login cookies come back `Secure; HttpOnly; SameSite=Lax`, and `npm run build` with `BACKEND_URL` set
bakes the `/api` rewrite to that address. Not tried here: Vercel itself and a real tunnel.

## 1. Database (Supabase free)

1. supabase.com > New project `phumreader-staging`, region Singapore, a strong password (save it). Free plan is fine
   for a test; the plan wants Pro (point-in-time recovery) for the real staging.
2. Project Settings > API: turn the **Data API off**. Do not use Supabase Auth or Storage.
3. Project Settings > Database > Connection string > **Session pooler** (port 5432, not 6543).
4. Make `backend/.env.staging` (git-ignored by `.env*`):

   ```
   DB_URL=jdbc:postgresql://aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
   DB_USER=postgres.<project-ref>
   DB_PASSWORD=<password>
   FRONTEND_URL=https://<your-site>.vercel.app
   PHUMREADER_AUTH_SECURE_COOKIES=true
   PHUMREADER_JWT_PRIVATE_KEY=<one line, see below>
   ```

   Make the signing key once and keep it (without it everybody is signed out at every restart):
   `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | tr -d '\n'` (paste the output; the base64 body
   alone also works).

## 2. Migrate, seed and check (this is P3-01's "staging" half)

```
cd backend
set -a; source .env.staging; set +a
./gradlew bootRun --args='--spring.profiles.active=dev,seed'
```

Environment variables beat `backend/.env`, so your local dev settings are untouched. Flyway builds all tables (V1 to
V8) on the empty database, then the seed loads the demo (about 20 seconds). Check:

- http://localhost:8080/api/v1/health shows `"database":"UP"`.
- SQL editor: `select count(*) from flyway_schema_history;` is 8, `select count(*) from series;` is 48.

Then stop and start it without `seed` (the seed is safe to repeat but not needed again).

> The seed creates `reader@toonwave.app` / `Toonwave1!` and the dev profile sends every email code as `123456`.
> Fine for a private test; anyone who finds the address could sign up with any email. Never use this profile or the
> seed for production.

## 3. API on your computer + a tunnel

Keep the API running (step 2, without `seed`), then in another terminal:

```
cloudflared tunnel --url http://localhost:8080
```

(`brew install cloudflared`; no account needed.) It prints `https://<random>.trycloudflare.com`. Check
`https://<random>.trycloudflare.com/api/v1/health`.

The address changes every run, and **the website bakes it in at build time** (`BACKEND_URL` in `next.config.ts`),
so each new address needs a new Vercel deploy. For a stable address use a free ngrok static domain
(`ngrok http --domain=<yours>.ngrok-free.app 8080`) or a named Cloudflare tunnel on your own domain.

## 4. Website on Vercel (free Hobby)

Hobby is for non-commercial use: fine for a test, not for launch.

1. vercel.com > Add New > Project > import the GitHub repository (root directory = the repo root).
2. Environment variables (Production): `BACKEND_URL` = the tunnel address (no trailing slash); leave
   `NEXT_PUBLIC_DEMO` unset (real API) or set it to `1` to publish the old demo that needs no API at all.
3. Deploy. The site is `https://<project>.vercel.app`. Put that exact address in `FRONTEND_URL` in
   `backend/.env.staging` and restart the API (links in emails and the Google / Facebook redirect use it).

Because the browser only ever talks to the Vercel address (Vercel forwards `/api/...` to the tunnel), the login
cookies belong to the Vercel site: no CORS settings and no cookie-domain settings are needed.

## What works and what does not in this setup

| Works | Not there (or needs another account) |
|---|---|
| Browse, read, sign up and log in (code `123456`), library, coins with the payment **simulator**, comments, creator pages without uploads, search (PostgreSQL) | Image uploads (need R2 or MinIO; the demo artwork needs neither), real email (the code is fixed; reset links are printed in the API console), Google / Facebook login (P3-04 apps), real payments (ABA PayWay), push, Redis-backed limits (they stay in memory, one API only) |

The test only works while your computer and the tunnel are running. When you are happy, the next step is a small
always-on host for the API (an Oracle Cloud Always Free VM, or a paid host) and the real P7-01 plan.

## Troubleshooting

- `502` or "Failed to proxy" on `/api/...`: the tunnel is not running, or Vercel was built with an old address.
- Logged in, then logged out a minute later: `PHUMREADER_JWT_PRIVATE_KEY` is missing (a new key every start), or
  `PHUMREADER_AUTH_SECURE_COOKIES` is not `true` while the site is on https.
- "Connection refused" at start-up: you used the transaction pooler (port 6543); use the session pooler (5432).
