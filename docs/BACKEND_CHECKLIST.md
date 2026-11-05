# PhumReader backend: implementation checklist (Spring Boot)

Phase 2. The frontend (docs/CHECKLIST.md, T01–T53) is finished and runs on demo data. This list builds a separate **Spring Boot** API in `backend/` and then connects the frontend to it, step by step.

Sources of truth: `CLAUDE.md`, `docs/BACKEND.md` (design and decisions), `docs/CHECKLIST.md` (frontend assumptions 1–102), `design/spec.md` ("Simulated state"), `design/demo-data.json`, `src/lib/demo-api.ts`, `src/lib/store.ts`, `src/data/types.ts`.

## Stack (decided in B01, see docs/BACKEND.md)

- Java 21, Spring Boot (latest stable, pinned in B02), Gradle Kotlin DSL
- Spring Web, Security, Validation, Data JPA, Session (Redis), Mail, Actuator
- PostgreSQL 16 + Flyway, Redis 7, Cloudflare R2 (AWS SDK v2)
- springdoc-openapi → `backend/openapi/openapi.json` → `openapi-typescript` in the frontend
- JUnit 5, MockMvc, Testcontainers, ArchUnit, Spotless; Playwright for end-to-end
- Payments: KHQR (Bakong) + ABA PayWay. Readers only at launch (Part 6 postponed).

## How to work through this list

- One task at a time, in order. Each task is sized for about 30–60 minutes.
- Backend task done when: `cd backend && ./gradlew check` passes (tests + Spotless + ArchUnit). If the task also changes the frontend: `npm run lint && npm run typecheck && npm run build` as well. Then tick the box and commit `Bxx: <short description>`.
- After any controller or DTO change: regenerate `backend/openapi/openapi.json` and run `npm run api:gen` (from B07 on), and commit both.
- Never break demo mode: with `NEXT_PUBLIC_DEMO=1` the frontend runs on `demo-api.ts` and the local store until B52.
- Never put secrets in the repo. `.env.example` and `application-dev.yml` hold dev-only values.
- Money: coin balances change only through the ledger (B26), in one transaction with a wallet row lock, and every payment or unlock call is idempotent.
- Never build card number fields. Card payments use the provider-hosted page.
- Each API task adds tests: success path, validation errors, permission errors, and (where relevant) a double submit.
- Do not move the frontend out of the repo root. The backend lives in `backend/`.

Progress: 1 / 52

---

## Part 1: Foundation

- [x] **B01 Architecture and stack decision** (≈30 min)
  - Build: decisions recorded in `docs/BACKEND.md`; `CLAUDE.md` Scope rules updated for Phase 2. Revised to a separate Spring Boot service (this file and BACKEND.md rewritten).
  - Done when: `docs/BACKEND.md` exists and the user has approved it.

- [ ] **B02 Spring Boot project scaffold** (≈45 min)
  - Build: create `backend/` with Spring Initializr (Java 21, Gradle Kotlin DSL, packaging jar): Web, Validation, Security, Data JPA, PostgreSQL driver, Flyway, Data Redis, Session, Mail, Actuator, Lombok-free (use records). Package `app.phumreader`, feature folders from BACKEND.md, `PhumReaderApplication`, profiles `dev` / `prod` / `test`, Spotless, ArchUnit dependency, a `GET /api/v1/health` endpoint, `backend/README.md`, `backend/Dockerfile` (multi-stage, non-root). Add `backend/` entries to `.gitignore` (build, .gradle).
  - Done when: `./gradlew bootRun` starts on :8080 with the dev profile and `./gradlew check` passes with one smoke test.

- [ ] **B03 Local environment** (≈45 min)
  - Build: `docker-compose.yml` at the repo root with PostgreSQL 16, Redis 7 and Mailpit (dev email inbox), `.env.example`, `application-dev.yml` reading env with safe defaults, npm scripts `backend:up`, `backend:down`, `backend:dev` (wraps `./gradlew bootRun`). Add the `/api` rewrite to `next.config` (`BACKEND_URL`, default `http://localhost:8080`) so the browser stays same-origin.
  - Done when: `docker compose up -d` + `bootRun` run, `http://localhost:3000/api/v1/health` returns the backend response through the Next.js rewrite.

- [ ] **B04 Database schema and Flyway migrations** (≈60 min)
  - Build: `V1__init.sql` with tables: users, auth_identities, verification_codes, password_reset_tokens, genres, series, series_translations, series_genres, episodes, chapters, comments, likes, bookmarks, subscriptions, reading_progress, unlocks, coin_wallets, coin_ledger, coin_packs, orders, fast_pass, user_settings, idempotency_keys, shedlock. UUID keys, foreign keys, indexes, check constraints (e.g. ledger amount ≠ 0), `created_at` / `updated_at`. JPA entities and repositories for the catalog tables only (others come with their tasks). `ddl-auto=validate`.
  - Done when: migrations run on an empty database via Testcontainers, JPA validation passes, and the schema is summarised in `docs/BACKEND.md`.

- [ ] **B05 Seed from demo data** (≈45 min)
  - Build: copy `src/data/demo-data.json` to `backend/seed/demo-data.json`; a `seed` profile `ApplicationRunner` loads genres, series, episodes, chapters, comments, coin packs and the demo reader account (`reader@toonwave.app`, password hashed). Idempotent: running twice changes nothing.
  - Done when: after seeding the counts match the demo data (41 comics, 7 novels, 8 genres) and an integration test asserts them.

- [ ] **B06 Shared API layer** (≈45 min)
  - Build: `@RestControllerAdvice` returning `{ "error": { "code", "message" } }` for validation, not found, conflict, forbidden, unauthorized and unexpected errors; `Page`/cursor helper `{ items, nextCursor }`; request-id filter (`X-Request-Id`, MDC, JSON logs in prod); CORS config limited to configured origins; Jackson settings (ISO dates, no nulls in errors).
  - Done when: a bad request returns the standard 400 body, an unknown id returns the standard 404, and the log line carries the request id.

- [ ] **B07 OpenAPI contract and generated TypeScript client** (≈60 min)
  - Build: springdoc-openapi, a Gradle task that writes `backend/openapi/openapi.json`, `openapi-typescript` as a frontend dev dependency, `npm run api:gen` → `src/lib/api/schema.d.ts`, a small typed `fetch` client `src/lib/api/client.ts` (base `/api/v1`, JSON errors mapped to one `ApiError`, CSRF header added automatically, `credentials: "same-origin"`). CI step fails if either generated file is stale.
  - Done when: the health endpoint is called from the frontend through the typed client and `npm run typecheck` passes.

- [ ] **B08 Tests and CI** (≈45 min)
  - Build: base test classes with Testcontainers (PostgreSQL, Redis) and `@ServiceConnection`, test data builders, ArchUnit rules (controllers do not use repositories, no entity in a controller signature, features do not depend on each other's internals), GitHub Actions workflows: backend (`./gradlew check`) and frontend (lint, typecheck, build), plus the OpenAPI drift check.
  - Done when: both workflows are green on a pull request.

---

## Part 2: Auth and accounts

- [ ] **B09 Sign up and email verification** (≈60 min)
  - Build: `POST /auth/signup`, `POST /auth/verify` (6-digit code, 10 min expiry, 5 attempts, stored hashed), Argon2id via Spring Security `Argon2PasswordEncoder`, the same password rules as the frontend (3 of 4), email-taken error `email_taken`. `MailSender` interface: console/Mailpit in dev, SMTP in prod (choose the provider here).
  - Done when: tests cover a valid sign up, a wrong code, an expired code, too many attempts and a duplicate email.

- [ ] **B10 Log in, log out and sessions** (≈60 min)
  - Build: Spring Security filter chain, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, Spring Session in Redis (httpOnly, Secure, SameSite=Lax cookie), cookie-to-header CSRF, wrong credentials always `invalid_credentials`, login rate limit (Bucket4j).
  - Done when: a session survives a backend restart (Redis), logout removes it, and a POST without the CSRF header gets 403.

- [ ] **B11 Forgot and reset password** (≈45 min)
  - Build: `POST /auth/forgot`, `POST /auth/reset` with a single-use hashed token (30 min expiry), same response whether or not the email exists, all sessions of the user revoked after a reset.
  - Done when: tests cover a valid reset, a reused token, an expired token and an unknown email.

- [ ] **B12 Social login (Google, Facebook)** (≈60 min)
  - Build: Spring Security OAuth2 client, account linking by verified email, `auth_identities` rows, a provider adapter that tests replace with a fake, redirect back to `returnTo`.
  - Done when: both buttons on `/login` sign in a test user in the providers' sandbox.

- [ ] **B13 Profile and account endpoints** (≈45 min)
  - Build: `PATCH /me` (name, language), `DELETE /me` (soft delete, scheduled purge), `GET /me/export` (JSON), rate limits on all `/auth` routes.
  - Done when: Settings > Profile and Language can save to the server (wired in B25).

- [ ] **B14 Roles and permissions** (≈30 min)
  - Build: roles READER / CREATOR / ADMIN, `@PreAuthorize`, method security on, tests for forbidden access.
  - Done when: a reader gets 403 on creator and admin routes.

---

## Part 3: Content (read side)

- [ ] **B15 Series and episode API** (≈60 min)
  - Build: endpoints replacing every `demo-api.ts` read: home feed, hero, daily schedule, new, trending, rankings (comics / novels), genres and genre page, series detail, episode list with lock state per user. Same JSON shapes as `src/data/types.ts`.
  - Done when: every `demo-api` read has an endpoint and contract tests compare the shapes with the demo data.

- [ ] **B16 Search** (≈45 min)
  - Build: `GET /search?q=` with PostgreSQL full-text search plus `pg_trgm` (Flyway migration), matching titles, creators and Khmer text.
  - Done when: "gl" finds Glass Compass and a Khmer query returns results.

- [ ] **B17 Reader content endpoints** (≈60 min)
  - Build: comic episode pages (panel list) and novel chapter text. Locked episodes return 403 `episode_locked` unless free, unlocked or covered by Fast Pass; panel URLs for locked content are never sent.
  - Done when: opening a locked episode by URL fails on the server, not only in the UI.

- [ ] **B18 Image storage and delivery** (≈60 min)
  - Build: `ImageStorage` interface with R2 (AWS SDK v2) and local-disk implementations, CDN URLs for covers, short-lived pre-signed URLs for panels of paid episodes, upload of the demo artwork by the seed task.
  - Done when: covers and panels load from storage and a paid panel URL expires.

- [ ] **B19 Khmer and English content fields** (≈45 min)
  - Build: `series_translations` and chapter translations, fallback to English, locale from `?locale=` or `Accept-Language`.
  - Done when: `/km` pages receive Khmer titles from the database where they exist.

---

## Part 4: Reader state

- [ ] **B20 Reading progress and history** (≈45 min)
  - Build: `PUT /progress`, `GET /library/continue`, last-read episode per series (replaces `lastRead` in the store).
  - Done when: opening an episode updates Continue reading for the same account in another browser.

- [ ] **B21 Subscriptions and library** (≈45 min)
  - Build: subscribe / unsubscribe, `GET /library` (continue, subscribed, unlocked), notification preferences endpoint.
  - Done when: all three Library tabs and the Settings switches have server data.

- [ ] **B22 Likes and bookmarks** (≈45 min)
  - Build: like and bookmark endpoints for series, episodes and comments, counters kept consistent, idempotent toggles.
  - Done when: a like survives reload and double clicks do not double count.

- [ ] **B23 Comments** (≈60 min)
  - Build: list (cursor), post, delete own, report, length limit and rate limit, a spam-filter hook.
  - Done when: a comment posted by one reader is visible to others after reload (frontend assumption 75 is retired).

- [ ] **B24 Reader settings sync** (≈30 min)
  - Build: `GET/PUT /me/reading-settings` (size, theme, serif, line spacing).
  - Done when: settings follow the account to another browser; guests still use localStorage.

- [ ] **B25 Frontend: connect to the API** (≈90 min, may be split in two commits)
  - Build: replace `demo-api.ts` calls with the typed client when `NEXT_PUBLIC_DEMO` is not `1`; login/sign-up/verify/forgot views call the auth endpoints; logged-in users read and write progress, subscriptions, unlocks, likes, comments and settings through the API (TanStack Query, optimistic updates, `ApiError` → the existing ErrorState); guests keep the persisted local store; on login, guest state is merged. `?demo=` flags still work in demo mode.
  - Done when: the six key flows pass in demo mode and with the real backend, and `npm run lint && npm run typecheck && npm run build` pass.

---

## Part 5: Coins and payments

- [ ] **B26 Coin wallet and ledger** (≈60 min)
  - Build: append-only `coin_ledger`, `WalletService.credit()` / `debit()` in one `@Transactional` unit with `PESSIMISTIC_WRITE` on the wallet row, balance never negative, ledger reasons (PURCHASE, UNLOCK, BONUS, REFUND).
  - Done when: a concurrent debit test (many threads) never overspends.

- [ ] **B27 Unlock episode** (≈45 min)
  - Build: `POST /episodes/{id}/unlock` with `Idempotency-Key` (stored in `idempotency_keys`), spends coins and creates the unlock in one transaction, returns the new balance; errors `insufficient_coins`, `already_unlocked`.
  - Done when: a double submit charges once and the frontend's three unlock outcomes (log in / get coins / unlocked) all work.

- [ ] **B28 Coin packs and bonuses** (≈30 min)
  - Build: packs, bonuses and the first-purchase bonus rule in the database, `GET /coins/packs`, `GET /coins/offer`.
  - Done when: the Coins page totals match the server calculation.

- [ ] **B29 KHQR (Bakong) payment** (≈90 min)
  - Build: `PaymentProvider` interface, KHQR implementation: create order, generate the KHQR payload, 10 minute expiry, status endpoint, confirmation by webhook or polling. Replaces the placeholder QR.
  - Done when: a sandbox payment credits coins once and an expired order does not.

- [ ] **B30 ABA PayWay** (≈90 min)
  - Build: PayWay checkout creation, return and callback handling, hash verification.
  - Done when: a sandbox payment credits coins once.

- [ ] **B31 Card payment (PayWay hosted page)** (≈60 min)
  - Build: redirect to the PayWay hosted card page. No card fields in this app.
  - Done when: a test card payment credits coins and `[PAYMENT PROVIDER FORM]` is replaced by the redirect.

- [ ] **B32 Webhooks and order states** (≈60 min)
  - Build: one webhook endpoint per provider (outside the CSRF rule, signature checked), idempotent processing, order states PENDING / PAID / FAILED / CANCELLED / EXPIRED, an expiry job.
  - Done when: replaying a webhook never credits coins twice.

- [ ] **B33 Purchase history and receipts** (≈45 min)
  - Build: `GET /purchases`, order ids `PR-########`, receipt data; replaces the seeded demo rows.
  - Done when: the history table lists real orders including Failed and Cancelled.

- [ ] **B34 Fast Pass subscription** (≈60 min)
  - Build: time-limited or recurring Fast Pass plan, status endpoint, free access to Fast Pass episodes while active.
  - Done when: an active pass opens locked episodes and an expired one does not.

- [ ] **B35 Refunds and reconciliation** (≈60 min)
  - Build: admin refund action writing a negative ledger entry, a daily scheduled reconciliation of provider records against orders.
  - Done when: a refund reduces the balance and mismatches are reported.

---

## Part 6: Creator side (postponed: readers only at launch)

- [ ] **B36 Creator onboarding** (≈45 min)
  - Build: application form, admin approval, creator profile (replaces the stand-in creator Chan Sreyleak).
  - Done when: an approved user sees their own series on `/creator`.

- [ ] **B37 Series and episode CRUD with uploads** (≈90 min)
  - Build: create and edit series, upload panels (validate type and size, resize, WebP, order), novel chapter endpoints.
  - Done when: a creator uploads an episode and it renders in the reader.

- [ ] **B38 Draft, schedule and publish** (≈45 min)
  - Build: states DRAFT / SCHEDULED / PUBLISHED, scheduled publishing job, Fast Pass flag and coin price.
  - Done when: a scheduled episode appears at its time.

- [ ] **B39 Creator dashboard stats** (≈45 min)
  - Build: views, likes, subscribers and earnings per series, replacing the `[AMOUNT]` placeholders.
  - Done when: numbers match the underlying events.

- [ ] **B40 Creator payouts** (≈60 min)
  - Build: payout details, monthly statement, payout request, admin approval, replacing `[PAYOUT DETAILS]`.
  - Done when: a statement balances against ledger earnings.

---

## Part 7: Admin and operations

- [ ] **B41 Admin API and panel** (≈90 min)
  - Build: `/api/v1/admin/**` (ADMIN only) for content review, comment moderation (reports queue), user management, takedown; a minimal `/admin` UI in the frontend using existing components.
  - Done when: an admin can hide a comment and unpublish a series.

- [ ] **B42 Analytics and view counting** (≈60 min)
  - Build: view events with de-duplication, Redis counters flushed to PostgreSQL, a scheduled ranking recompute (replaces the static order).
  - Done when: rankings change after views are recorded.

- [ ] **B43 Notifications** (≈60 min)
  - Build: email templates (new episode, Fast Pass, payment receipt), respect the Settings switches, unsubscribe link.
  - Done when: publishing an episode emails subscribers who enabled it (checked in Mailpit).

- [ ] **B44 Background jobs** (≈45 min)
  - Build: `@Scheduled` jobs with ShedLock for scheduled publishing, ranking, order expiry, soft-delete purge, idempotency-key cleanup; job metrics.
  - Done when: two running instances execute each job once, and failures are logged.

---

## Part 8: Hardening and launch

- [ ] **B45 Security review** (≈90 min)
  - Build: OWASP checklist, CORS, CSRF, rate limits, upload validation, secret handling, `dependencyCheck` / dependency audit for both services, PII review. Run `/security-review`. Write `docs/SECURITY.md`.
  - Done when: no high findings remain.

- [ ] **B46 Legal and compliance** (≈45 min)
  - Build: terms and privacy pages (English and Khmer), cookie notice if needed, data export and deletion flows linked from Settings, age rules.
  - Done when: the pages exist and Settings links to them.

- [ ] **B47 Performance** (≈60 min)
  - Build: query review (N+1, indexes), HikariCP sizing, Redis / HTTP caching for public reads, load test of home feed, unlock and checkout.
  - Done when: p95 of public reads is under 300 ms in the test setup.

- [ ] **B48 Observability** (≈45 min)
  - Build: Actuator health / metrics, Micrometer → Prometheus format, Sentry on backend and frontend, uptime check, alerts for payment failures.
  - Done when: a thrown test error appears in Sentry with the request id.

- [ ] **B49 Backups and restore** (≈45 min)
  - Build: automated PostgreSQL backups, a documented and tested restore, Flyway rollback notes (forward-only migrations policy).
  - Done when: a restore into a fresh database is verified.

- [ ] **B50 Deployment** (≈90 min)
  - Build: hosting and region, staging and production for both services, backend Docker image in CI, `/api` routing on one domain, domain, SSL, secrets, Postgres and Redis managed services.
  - Done when: `main` deploys to staging and production is promoted by hand.

- [ ] **B51 End-to-end tests on the real backend** (≈60 min)
  - Build: run the Playwright flows against a seeded backend (no `?demo=`), add payment sandbox flows, and a manual QA list.
  - Done when: all flows pass in CI.

- [ ] **B52 Remove demo pieces from production** (≈30 min)
  - Build: production build excludes `demo-api.ts`, the "simulate payment" buttons and the demo credentials; development keeps demo mode behind `NEXT_PUBLIC_DEMO=1`. Update README files.
  - Done when: a production build contains no demo account and no simulated payment.

---

## Assumptions

(To be filled while working, in the same style as docs/CHECKLIST.md.)
