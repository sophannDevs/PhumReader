# PhumReader backend: implementation checklist

Phase 2. The frontend (docs/CHECKLIST.md, T01–T53) is finished and runs on demo data. This list replaces the fake API and the persisted zustand store with a real backend, step by step.

Sources of truth: `CLAUDE.md`, `docs/CHECKLIST.md` (the frontend assumptions 1–102), `design/spec.md` ("Simulated state"), `design/demo-data.json`, `src/lib/demo-api.ts`, `src/lib/store.ts`.

> `CLAUDE.md` still says "NO backend". Before B01 starts, update its Scope rules to say Phase 2 is allowed, and keep the demo mode for development (B50).

## Proposed stack (confirm in B01)

- PostgreSQL + Drizzle ORM (or Prisma), migrations in `drizzle/`
- Next.js route handlers under `src/app/api/v1/` (or a separate service, see Open decisions)
- Redis for rate limits, sessions and counters
- S3-compatible storage (Cloudflare R2) for covers and panels
- zod for every request and response, TanStack Query on the frontend (already used)
- Vitest for unit and API tests, Playwright for end-to-end (already installed)
- Package manager: npm. Node 22 LTS or newer.

## Decisions (answered in B01, see docs/BACKEND.md)

1. Backend inside this Next.js app.
2. Payments: KHQR (Bakong) + ABA PayWay. No Stripe.
3. Launch with readers only; Part 6 (B34–B38) is postponed.
4. Hosting and region: decide in B48.

## How to work through this list

- One task at a time, in order. Each task is sized for about 30–60 minutes.
- Every task ends with `npm run lint && npm run typecheck && npm run build && npm test` passing, the box ticked, and a commit `Bxx: <short description>`.
- Never break the demo mode: with `NEXT_PUBLIC_DEMO=1` the app still runs on `demo-api.ts` and the local store until B50.
- Never put secrets in the repo. Only `.env.example` is committed.
- Money: coin balances change only through the ledger (B24), in a database transaction, and every payment or unlock call is idempotent.
- Never build card number fields. Card payments use a provider-hosted page.
- Each API task adds tests for the success path, validation errors, permission errors and (where relevant) double submit.

Progress: 1 / 50

---

## Part 1: Foundation

- [x] **B01 Architecture and stack decision** (≈30 min)
  - Build: answer the open decisions above, then write `docs/BACKEND.md` (stack, folder layout `src/server/`, API style and versioning, environments, naming, how demo mode and real mode coexist). Update `CLAUDE.md` Scope rules for Phase 2.
  - Done when: `docs/BACKEND.md` exists and the user has approved it.

- [ ] **B02 Local environment** (≈45 min)
  - Build: `docker-compose.yml` with Postgres and Redis, `.env.example`, `src/server/env.ts` (zod-validated env, fails fast), npm scripts `db:up`, `db:down`.
  - Done when: `npm run db:up` starts both services and the app boots with a valid `.env`.

- [ ] **B03 Database schema and migrations** (≈60 min)
  - Build: tables for users, sessions, series, series_translations, episodes, chapters, genres, series_genres, comments, likes, bookmarks, subscriptions, reading_progress, unlocks, coin_wallets, coin_ledger, coin_packs, purchases, user_settings. Indexes and foreign keys. Migration scripts.
  - Done when: `npm run db:migrate` builds an empty database and the schema is documented in `docs/BACKEND.md`.

- [ ] **B04 Seed from demo data** (≈45 min)
  - Build: `scripts/seed.ts` loads `src/data/demo-data.json` (series, episodes, chapters, comments, coin packs, the demo reader account) so the real app shows the same content as the demo. Re-runnable.
  - Done when: after `npm run db:seed` the counts match the demo data (41 comics, 7 novels, 8 genres).

- [ ] **B05 Shared API layer** (≈45 min)
  - Build: route helper with zod validation, a single error format `{ error: { code, message } }`, pagination (cursor), request id, structured logging, `GET /api/v1/health`.
  - Done when: the health route works and a bad request returns the standard 400 body.

- [ ] **B06 Test setup and CI** (≈45 min)
  - Build: Vitest with a separate test database, factory helpers, a GitHub Actions workflow running lint, typecheck, build, unit and API tests.
  - Done when: the workflow is green on a pull request.

---

## Part 2: Auth and accounts

- [ ] **B07 Sign up and email verification** (≈60 min)
  - Build: `POST /auth/signup`, `POST /auth/verify` (6-digit code, 10 min expiry, 5 attempts), argon2 password hashing, the same password rules as the frontend (3 of 4), email-taken error. Email sending through an adapter (console in dev, a provider in production).
  - Done when: tests cover a valid sign up, a wrong code, an expired code and a duplicate email.

- [ ] **B08 Log in, log out and sessions** (≈60 min)
  - Build: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, httpOnly secure cookie session in Redis or the database, CSRF protection, wrong-password error without revealing which field.
  - Done when: a session survives a reload and logout removes it server side.

- [ ] **B09 Forgot and reset password** (≈45 min)
  - Build: `POST /auth/forgot`, `POST /auth/reset` with a single-use token, same response whether or not the email exists, sessions revoked after a reset.
  - Done when: tests cover a valid reset, a reused token and an unknown email.

- [ ] **B10 Social login (Google, Facebook)** (≈60 min)
  - Build: OAuth flows, account linking by verified email, a provider adapter so tests do not call the real services.
  - Done when: both buttons on `/login` sign in a test user in a sandbox.

- [ ] **B11 Profile and account endpoints** (≈45 min)
  - Build: `PATCH /me` (name, language), `DELETE /me` (soft delete, then purge job), data export `GET /me/export`, rate limits on all auth routes.
  - Done when: Settings > Profile and Language save to the server.

- [ ] **B12 Roles and permissions** (≈30 min)
  - Build: roles reader / creator / admin, a `requireRole()` guard, tests for forbidden access.
  - Done when: a reader gets 403 on creator and admin routes.

---

## Part 3: Content (read side)

- [ ] **B13 Series and episode API** (≈60 min)
  - Build: endpoints replacing `demo-api.ts` reads: home feed, hero, daily schedule, new, trending, rankings (comics / novels), genres and genre page, series detail, episode list with lock state. Same response shapes as the demo API so the frontend only changes its fetch layer.
  - Done when: every `demo-api` read has an endpoint and contract tests compare shapes with the demo data.

- [ ] **B14 Search** (≈45 min)
  - Build: `GET /search?q=` with Postgres full-text search plus trigram, matching titles, creators and Khmer text.
  - Done when: "gl" finds Glass Compass and Khmer queries return results.

- [ ] **B15 Reader content endpoints** (≈60 min)
  - Build: comic episode pages (panel list) and novel chapter text. Locked episodes return 403 unless unlocked or free, and the server never sends panel URLs for locked content.
  - Done when: opening a locked episode by URL fails on the server, not only in the UI.

- [ ] **B16 Image storage and delivery** (≈60 min)
  - Build: bucket setup, CDN URLs for covers, signed short-lived URLs for panels of paid episodes, an `images` adapter with a local-disk version for development.
  - Done when: covers and panels load from storage and a paid panel URL expires.

- [ ] **B17 Khmer and English content fields** (≈45 min)
  - Build: translations per locale for title, blurb and chapter text, fallback to English, `Accept-Language` or `?locale=`.
  - Done when: `/km` pages read Khmer titles from the database where they exist.

---

## Part 4: Reader state

- [ ] **B18 Reading progress and history** (≈45 min)
  - Build: `PUT /progress`, `GET /library/continue`, last-read episode per series (replaces `lastRead` in the store).
  - Done when: opening an episode updates Continue reading on another device.

- [ ] **B19 Subscriptions and library** (≈45 min)
  - Build: subscribe and unsubscribe, `GET /library` (continue, subscribed, unlocked), notification preferences endpoint.
  - Done when: all three Library tabs and the Settings switches come from the server.

- [ ] **B20 Likes and bookmarks** (≈45 min)
  - Build: like and bookmark endpoints for series, episodes and comments, counters kept consistent, idempotent toggles.
  - Done when: a like survives reload and double clicks do not double count.

- [ ] **B21 Comments** (≈60 min)
  - Build: list (cursor), post, delete own, report, length and rate limits, basic profanity or spam hook.
  - Done when: comments posted by a reader are visible to others after reload (frontend assumption 75 is retired).

- [ ] **B22 Reader settings sync** (≈30 min)
  - Build: `GET/PUT /me/reading-settings` (size, theme, serif, line spacing).
  - Done when: settings follow the account to another browser; guests still use localStorage.

- [ ] **B23 Frontend: move the store to server state** (≈60 min)
  - Build: logged-in users read and write progress, subscriptions, unlocks, likes and settings through the API (TanStack Query, optimistic updates); guests keep the persisted local store; login merges guest state.
  - Done when: the six key flows still pass in demo mode and with the real backend.

---

## Part 5: Coins and payments

- [ ] **B24 Coin wallet and ledger** (≈60 min)
  - Build: append-only `coin_ledger`, balance derived or cached under a row lock, helpers `credit()` and `debit()` that run in a transaction and refuse a negative balance.
  - Done when: concurrent debit tests never overspend.

- [ ] **B25 Unlock episode** (≈45 min)
  - Build: `POST /episodes/:id/unlock` with an `Idempotency-Key`, spends coins and creates the unlock in one transaction, returns the new balance.
  - Done when: a double submit charges once and an insufficient balance returns the error the frontend expects.

- [ ] **B26 Coin packs and bonuses** (≈30 min)
  - Build: packs, bonuses and the first-purchase bonus rule stored in the database, `GET /coins/packs`, `GET /coins/offer`.
  - Done when: the Coins page totals match the server calculation.

- [ ] **B27 KHQR (Bakong) payment** (≈90 min)
  - Build: create an order, generate a KHQR payload with the provider, 10 minute expiry, status polling endpoint, confirmation through webhook or polling. Replaces the placeholder QR.
  - Done when: a sandbox payment credits coins and an expired order does not.

- [ ] **B28 ABA Pay (PayWay)** (≈90 min)
  - Build: PayWay checkout creation, return and callback handling, hash verification.
  - Done when: a sandbox payment credits coins.

- [ ] **B29 Card payment (hosted page)** (≈60 min)
  - Build: redirect to the PayWay hosted card page. No card fields in this app.
  - Done when: a test card payment credits coins and `[PAYMENT PROVIDER FORM]` is replaced by the redirect.

- [ ] **B30 Webhooks and order states** (≈60 min)
  - Build: one webhook route per provider, signature check, idempotent processing, order states Pending / Paid / Failed / Cancelled / Expired, retries.
  - Done when: replaying a webhook never credits coins twice.

- [ ] **B31 Purchase history and receipts** (≈45 min)
  - Build: `GET /purchases`, order ids `PR-########`, receipt data, replaces the seeded demo rows.
  - Done when: the history table lists real orders including Failed and Cancelled.

- [ ] **B32 Fast Pass subscription** (≈60 min)
  - Build: time-limited or recurring Fast Pass plan, status endpoint, free access to Fast Pass episodes while active.
  - Done when: an active pass opens locked episodes and an expired one does not.

- [ ] **B33 Refunds and reconciliation** (≈60 min)
  - Build: admin refund action writing a negative ledger entry, a daily job comparing provider records with orders.
  - Done when: a refund reduces the balance and mismatches are reported.

---

## Part 6: Creator side (postponed: readers only at launch)

- [ ] **B34 Creator onboarding** (≈45 min)
  - Build: application form, admin approval, creator profile (replaces the stand-in creator Chan Sreyleak).
  - Done when: an approved user sees their own series on `/creator`.

- [ ] **B35 Series and episode CRUD with uploads** (≈90 min)
  - Build: create and edit series, upload panels (validate type and size, resize, convert to WebP, order), novel chapter editor endpoints.
  - Done when: a creator uploads an episode and it renders in the reader.

- [ ] **B36 Draft, schedule and publish** (≈45 min)
  - Build: states Draft / Scheduled / Published, scheduled publishing job, Fast Pass flag and price in coins.
  - Done when: a scheduled episode appears at its time.

- [ ] **B37 Creator dashboard stats** (≈45 min)
  - Build: views, likes, subscribers and earnings per series, replacing the `[AMOUNT]` placeholders.
  - Done when: numbers match the underlying events.

- [ ] **B38 Creator payouts** (≈60 min)
  - Build: payout details, monthly statement, payout request, admin approval, replacing `[PAYOUT DETAILS]`.
  - Done when: a statement balances against ledger earnings.

---

## Part 7: Admin and operations

- [ ] **B39 Admin panel** (≈90 min)
  - Build: protected `/admin` with content review, comment moderation (reports queue), user management, takedown.
  - Done when: an admin can hide a comment and unpublish a series.

- [ ] **B40 Analytics and view counting** (≈60 min)
  - Build: view events with de-duplication, Redis counters flushed to the database, ranking recompute job (replaces the static order).
  - Done when: rankings change after views are recorded.

- [ ] **B41 Notifications** (≈60 min)
  - Build: email templates (new episode, Fast Pass, payment receipt), respect the Settings switches, unsubscribe link.
  - Done when: publishing an episode emails subscribers who enabled it.

- [ ] **B42 Background jobs** (≈45 min)
  - Build: a queue (BullMQ or similar) and a worker process for scheduled publishing, ranking, expiry cleanup, soft-delete purge.
  - Done when: jobs run, retry and are visible in logs.

---

## Part 8: Hardening and launch

- [ ] **B43 Security review** (≈90 min)
  - Build: OWASP checklist, CORS, CSRF, rate limits, upload validation, secret handling, dependency audit, PII review. Run `/security-review`.
  - Done when: no high findings remain and the review is written to `docs/SECURITY.md`.

- [ ] **B44 Legal and compliance** (≈45 min)
  - Build: terms and privacy pages (English and Khmer), cookie notice if needed, data export and deletion flows linked from Settings, age rules.
  - Done when: the pages exist and Settings links to them.

- [ ] **B45 Performance** (≈60 min)
  - Build: query review with indexes, Redis and CDN caching for public reads, a load test of the home feed, unlock and checkout.
  - Done when: p95 of public reads is under 300 ms in the test setup.

- [ ] **B46 Observability** (≈45 min)
  - Build: Sentry on server and client, metrics, uptime check, alerts for payment failures.
  - Done when: a thrown test error appears in Sentry with the request id.

- [ ] **B47 Backups and restore** (≈45 min)
  - Build: automated database backups, a documented and tested restore, migration rollback notes.
  - Done when: a restore into a fresh database is verified.

- [ ] **B48 Deployment** (≈90 min)
  - Build: hosting, staging and production environments, CI/CD, domain, SSL, secrets, worker process, region choice.
  - Done when: `main` deploys to staging and production is promoted by hand.

- [ ] **B49 End-to-end tests on the real backend** (≈60 min)
  - Build: run the Playwright flows against a seeded backend (no `?demo=`), add payment sandbox flows, plus a manual QA list.
  - Done when: all flows pass in CI.

- [ ] **B50 Remove demo pieces from production** (≈30 min)
  - Build: production build excludes `demo-api.ts`, the "simulate payment" buttons and the demo credentials; development keeps demo mode behind `NEXT_PUBLIC_DEMO=1`. Update README.
  - Done when: a production build contains no demo account and no simulated payment.

---

## Assumptions

(To be filled while working, in the same style as docs/CHECKLIST.md.)
