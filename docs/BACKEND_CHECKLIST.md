# PhumReader backend: implementation checklist (Spring Boot)

Phase 2 of this repo. The frontend (docs/CHECKLIST.md, T01–T53) is finished and runs on demo data. This list follows
the plan doc **"Toonwave V2 – Implementation plan"** (https://claude.ai/artifact/9bbCmhSxqAbRZeTbjU8QVT, 2026-11-05):
same task ids, same "depends on" and the same acceptance criteria. "Toonwave" in the plan means PhumReader.
It replaces the earlier B01–B52 list.

Sources of truth: the plan doc, `CLAUDE.md`, `docs/BACKEND.md` (decisions and local adaptations),
`docs/CHECKLIST.md` (frontend assumptions), `design/spec.md`, `design/demo-data.json`, `src/lib/demo-api.ts`,
`src/lib/store.ts`, `src/data/types.ts`.

## Local adaptations of the plan

- **No Docker anywhere in this project**: not on development machines (company policy), not in CI, no Dockerfile,
  no Testcontainers. P1-02 runs every plan service without Docker (table in `docs/BACKEND.md`); tests use
  Zonky embedded PostgreSQL and in-memory fakes.
- **Spring Boot 4.1.2** instead of the plan's Spring Boot 3 (3.5 left free support in June 2026).
- **Layout**: frontend stays in the repo root (npm, never pnpm); the plan's `apps/api` is `backend/`, its
  `packages/api-client` is `src/lib/api/`, its `infra/` keeps the Cloudflare Worker and deploy files.
- **Phase 2 and most of Phase 4** are already built by the frontend checklist (see "Plan coverage"). Only the
  Phase 4 pages the frontend does not have are listed below.

## How to work through this list

- One task at a time, in order, and only when the tasks it depends on are done. Large tasks (for example P3-02,
  P3-11, P3-14) may be split into several commits with the same id.
- A backend task is done when its acceptance criteria pass and `cd backend && ./gradlew check` passes. If it
  changes the frontend: `npm run lint && npm run typecheck && npm run build` as well. Then tick the box and commit
  `<id>: <short description>`, for example `P3-02: sign-in core`.
- After any controller or DTO change: regenerate `backend/openapi/openapi.json` and run `npm run api:gen`
  (from P1-07 on), and commit both.
- Every API task adds tests: success path, validation errors, permission errors, and a double submit where
  relevant.
- Demo mode (`NEXT_PUBLIC_DEMO=1`, demo-api.ts, local store) keeps working until P5-07 removes it.
- No secrets in the repo. `.env.example` files hold names and dev-only values; real values live in `backend/.env`
  and `.env.local` (git-ignored) and in each platform's secret store.
- Money: balances change only through the ledger, in one transaction with a wallet row lock; every payment and
  unlock call is idempotent. Never build card number fields: cards use the PayWay hosted page.

Progress: 3 / 51 tasks (P1-05, P1-07, P1-08) · Stage 1: step 4 of 5, parts 1–3 of 5 done · milestones M1, M3, M4, M5, M6, M7

---

## Stage 1 (current): project setup, database, every existing page on the real API

Agreed with the user on 2026-11-06. Five steps, done in order; stop and report after each one. Stage 1 has no
deployment and no Docker. A step is done when its checks pass; tick the plan tasks it completes.

- [x] **Step 1: Spring Boot project setup** (P1-01, P1-05, P1-06, P1-07, P1-08)
  - `backend/` with Spring Boot 4.1.2, Java 21, Gradle wrapper; one package per feature with a `package-info.java`
    per area; `.env.example` + typed settings that name a missing value; shared error format, request id,
    cursor page; `GET /api/v1/health`; OpenAPI export + drift test; `npm run api:gen` / `api:check`;
    `/api/:path*` rewrite to `BACKEND_URL`; Spotless and ArchUnit.
  - Check: `./gradlew check` passes (the app boots on embedded PostgreSQL, no Docker, no network), and
    `npm run lint && npm run typecheck && npm run build` pass.
  - Done 2026-11-06: 27 tests green; `bootRun` against Supabase `phumreader-dev` (Flyway off) answers
    `http://localhost:3000/api/v1/health` with the database UP through the rewrite. Carried over: Flyway's first
    run on Supabase (P1-05) to Step 2; ESLint import rules for the website's API client (P1-06) to Step 5.
- [x] **Step 2: Database setup** (P1-02 database part, P3-01)
  - Supabase `phumreader-dev` through the session pooler; Flyway V1 with every table; seed from
    `demo-data.json` (48 series, 8 genres, episodes, comments, coin packs, demo reader and demo creators).
  - Check: `bootRun` connects and migrates; `/api/v1/health` through `http://localhost:3000/api/v1/health` shows
    the database UP; seed counts tested; running the seed twice changes nothing.
  - Done 2026-11-06: V1 (34 tables) applied on Supabase in 8.6 s; seed in 20 s: 8 genres, 12 creators, 48 series
    (41 comics, 7 novels), 3,956 episodes, 30,303 panels, 589 chapters, 12,012 comments, 5 packs, 3 hero slides,
    48 ranking rows; a second run changed nothing (18 users, 1 ledger row). Health through the website: UP.
    41 backend tests green. Staging (P3-01's second half) waits for P1-10.
- [ ] **Step 3: Other local services** (P1-02 rest) — **moved after Step 4, to be done on the home PC**
  - Upstash Redis, Meilisearch (`meilisearch.exe`), email printed in the backend console; a services check.
  - Check: the services check shows every service healthy.
  - 2026-11-06: the company PC may not download programs, so Step 4 runs first with built-in stand-ins
    (rate limits and codes in memory, search in PostgreSQL, JWT signed with the JDK). At home: install the
    services, fill in `backend/.env`, swap the stand-ins (and optionally the JWT code for a JWT library), add
    Google / Facebook login (P3-04).
- [ ] **Step 4: API for every existing page** (P3-02 – P3-06, P3-09 – P3-13, P3-15, P3-17; P3-05/P3-14 stats only)
  - Header, auth (sign up, code, log in, refresh, log out, forgot, reset, rate limits; Google / Facebook only with
    dev app keys), Home, Rankings, Genres, Search, Series, comic and novel readers, Coins (PayWay sandbox if keys
    exist, otherwise a dev-only payment simulator), Library, Settings, Creator dashboard.
  - Check: every endpoint has tests (success, validation, permission, double submit where relevant).
  - Done in five parts, stopping after each:
    - [x] Part 1, sign-in (P3-02, P3-03 in memory): `/api/v1/auth` csrf, signup, verify, resend-code, login,
      refresh, logout, logout-all, forgot-password, reset-password; `GET /api/v1/me`.
      Done 2026-11-06: 25 sign-in tests (66 backend tests green). Real check through
      `http://localhost:3000/api/v1` on Supabase: wrong password 401, log in, `/me`, refresh, log out with the same
      CSRF token (it stays the same for the browser), then `/me` and refresh 401; 6 wrong passwords for one email
      give 429 with `retryAfterSeconds`. Fixed on the way: the CSRF token used to change after every signed-in
      request, so a page that read it earlier got 403 on log out.
    - [x] Part 2, catalog (P3-06 without Redis and page refresh, P3-15 stand-in): `GET /api/v1/home`, `/rankings`,
      `/genres`, `/genres/{slug}`, `/series` (type, genre, popular / newest, paged), `/series/{slug}`,
      `/series/{slug}/episodes` (oldest / newest, paged), `/search` (PostgreSQL). All public.
      Done 2026-11-06: 18 new tests (84 backend tests green). The catalog test compares every one of the 48 series
      cards, the Glass Compass episode list and the home sections with `demo-data.json` on the demo's today, then
      moves the clock (a Fast Pass episode turns free on its date; UP and NEW badges follow the calendar). Real check
      through `http://localhost:3000/api/v1` on Supabase: home built in 1.2 s (Tokyo), then 10–20 ms from memory;
      series page 0.5 s; lists 0.1–0.2 s. Not done yet: Redis cache and "refresh the website's page on publish"
      (Step 3 and P3-14), Meilisearch (P3-15), the reader's own Continue reading (Part 3).
    - [x] Part 3, reading (P3-09 without signed image URLs, P3-12, P3-13): episode / chapter content
      `GET /api/v1/series/{slug}/episodes/{n}` (402 `episode_locked` with `price` and `freeOn`), progress, episode
      likes and bookmarks; subscribe, follow, the reader's state on a series page (`/series/{slug}/me`), library
      lists `/me/history` (Continue reading), `/me/subscriptions`, `/me/unlocked`, `/me/follows` (recent / title,
      paged), remove with undo; comment threads on series pages and episodes (top / newest, paged), post, delete,
      like, reports for series, episodes and comments.
      Done 2026-11-06: 18 new tests (102 backend tests green). Real check through `http://localhost:3000/api/v1` on
      Supabase as the demo reader: free episode and chapter, 402 on a Fast Pass episode, history with the four demo
      entries, progress, subscribe, like, comment like and follow (each undone afterwards). Not done yet: signed
      image URLs (P3-08), view counters (Redis, Step 3), unlocking with coins (Part 4).
    - [ ] Part 4, coins: balance, unlocks, packs, orders with a dev-only payment simulator, history
    - [ ] Part 5, settings and the creator dashboard
- [ ] **Step 5: Connect the frontend** (P5-01, P5-06, parts of P5-04, P5-05, P5-07; `/reset` from P4-09)
  - Fetch wrapper (cookies, CSRF, silent refresh, `ApiError`); every `demo-api.ts` call has a real-API path; server
    state for logged-in users; 401 / 402 / 429 handling; payment status polling; `/reset` page.
    `NEXT_PUBLIC_DEMO=1` still runs the old demo.
  - Check: the Playwright key flows pass against the local backend and in demo mode; lint, typecheck and build pass.

Not in Stage 1: deployment (P1-10, Phase 7), CI (P1-09), uploads / R2 / image Worker (P3-07, P3-08), creator
writing pages and admin (P3-14 writes, P3-18, P4-13 – P4-16), sending notifications and real email (P3-16,
Resend), Phase 6 gates.

---

## Phase 1: Project setup (backend parts)

P1-03 (Next.js app) and P1-04 (web libraries + shadcn/ui) are done by T01–T06.

- [ ] **P1-01 Repository and README**
  - Build: `backend/` (Spring Boot, Gradle), `infra/` (Cloudflare Worker, deploy files), `src/lib/api/` for the
    generated client, `docs/`. Root README gains a "Run the backend" section.
  - Depends on: —
  - Done when: clone + README steps start both apps on a new machine in under 15 minutes (without Docker).

- [ ] **P1-02 Local services (no Docker)**
  - Build: the plan's five local services without Docker: Supabase dev project `phumreader-dev` (Singapore,
    Data API off, session pooler), Upstash Redis (Memurai offline), Meilisearch Windows binary, R2 dev bucket
    (MinIO binary offline), Mailpit binary (optional; console mail otherwise). `backend/.env.example` lists every
    setting; a script `scripts/check-services` (or npm `services:check`) pings each one.
  - Depends on: P1-01
  - Done when: the check shows all 5 services healthy.

- [x] **P1-05 Spring Boot app**
  - Build: Spring Boot 4.1.2 / Java 21 (Gradle Kotlin DSL): web, security, validation, data-jpa, Flyway
    (+ `flyway-database-postgresql`), PostgreSQL driver, actuator, springdoc-openapi; later tasks add OAuth2
    client, data-redis, mail, AWS SDK v2 S3 (for R2), Bucket4j and ShedLock when they need them. Test: Zonky
    embedded PostgreSQL, ArchUnit. Spotless. Package `app.phumreader`, profiles `dev` / `test` / `prod`
    (`worker` later). No Dockerfile. `.gitignore` entries for `backend/build`, `backend/.gradle`, `backend/.env`.
  - Depends on: P1-01, P1-02
  - Done when: `/actuator/health` is UP; Flyway runs an empty baseline on the dev database; `./gradlew check`
    passes with a smoke test on embedded PostgreSQL.

- [ ] **P1-06 Folder structure**
  - Build: one package per feature in the API (auth, user, series, episode, library, coin, payment, comment,
    search, notification, media, admin, common, config), each with `web` / `service` / `repository` / `domain`,
    and a README per area. ArchUnit rules: controllers do not use repositories, no entity in a controller
    signature, features do not reach into each other's internals.
  - Depends on: P1-03, P1-05
  - Done when: empty folders + a README per area; import rules enforced by ArchUnit (API) and ESLint (website).

- [x] **P1-07 OpenAPI → TypeScript client** (stale files fail `./gradlew check` and `npm run api:check`; CI in P1-09)
  - Build: springdoc publishes OpenAPI; a Gradle task writes `backend/openapi/openapi.json`; `openapi-typescript`
    generates `src/lib/api/schema.d.ts` (`npm run api:gen`).
  - Depends on: P1-05
  - Done when: changing a Java DTO and running the script changes the TS types; CI fails if they are stale.

- [x] **P1-08 Configuration and secrets**
  - Build: `.env.example` for both apps; typed config (zod in the website, `@ConfigurationProperties` in the API);
    secrets only from the environment. `next.config` rewrites `/api/:path*` to `BACKEND_URL`.
  - Depends on: P1-03, P1-05
  - Done when: each app refuses to start with a missing required setting and names it.

- [ ] **P1-09 CI pipeline**
  - Build: GitHub Actions: website lint, typecheck, build, `npm run api:check`; API `./gradlew check` (includes
    the OpenAPI drift check). No Docker.
  - Depends on: P1-03, P1-05
  - Done when: every pull request shows green checks; `main` is protected.

- [ ] **P1-10 Supabase staging and production**
  - Build: Supabase projects for staging and production (Singapore, Pro plan): Postgres only, Auth and Data API
    off, pooled and direct connection strings stored as secrets.
  - Depends on: —
  - Done when: the API connects to staging through the pooler; Flyway connects through the direct URL (or the
    session pooler if the network has no IPv6).

- [ ] **Milestone M1**: both apps run locally, CI green.

---

## Phase 3: Backend APIs, database and authentication

Spring Boot owns every business rule; the website never talks to the database directly.

- [ ] **P3-01 Database schema V1**
  - Build: Flyway `V1` with the tables in `docs/BACKEND.md` ("Main tables"), foreign keys, unique constraints and
    indexes (episodes by series + number, progress by user, ledger by user + time), row level security with no
    policies. Seed profile loads `backend/seed/demo-data.json` (41 comics, 7 novels, 8 genres, coin packs, the demo
    reader `reader@toonwave.app`); running it twice changes nothing.
  - Depends on: P1-05, P1-10
  - Done when: the migration runs clean on an empty database and on staging; the seed loads the demo series.

- [ ] **P3-02 Sign-in core**
  - Build: Spring Security, Argon2 password hashes, RS256 JWT access token (15 min) and rotating refresh token
    (30 days) in Secure HttpOnly SameSite=Lax cookies, CSRF token for writes. Endpoints: signup, verify email
    (6-digit code, 10 min, 5 tries), login, refresh, logout, logout everywhere, forgot, reset. Password rules as in
    the frontend. Shared error body and request id (`common`).
  - Depends on: P3-01
  - Done when: integration tests cover every endpoint; a reused refresh token logs out that device; tokens never
    appear in JavaScript-readable storage.

- [ ] **P3-03 Rate limits and lockout**
  - Build: Bucket4j + Redis on login, signup, codes, reset, comments and payments.
  - Depends on: P3-02
  - Done when: the 6th wrong password in 10 minutes is slowed; limits return 429 with a retry time.

- [ ] **P3-04 Google and Facebook login**
  - Build: OAuth2 client, accounts linked to an existing account by verified email, `user_identities` rows,
    return to the page the user came from.
  - Depends on: P3-02, A14
  - Done when: new and returning users can sign in with each provider on staging.

- [ ] **P3-05 Roles and ownership**
  - Build: roles READER / CREATOR / ADMIN, `@PreAuthorize` rules, ownership checks on every creator write;
    "become a creator" endpoint (accept the Creator terms, A11).
  - Depends on: P3-02
  - Done when: a creator cannot edit another creator's series (403), proven by tests.

- [ ] **P3-06 Catalog API**
  - Build: home feed (featured, daily by weekday, trending, genres, web novels), series detail, episode list
    (paged, newest / oldest), rankings, genres; Redis cache; tells Next.js which pages to refresh on publish.
    Response shapes follow `src/data/types.ts` so the frontend swaps only its fetch layer.
  - Depends on: P3-01
  - Done when: home feed is under 150 ms p95 from cache; publishing an episode refreshes its series page within
    60 s.

- [ ] **P3-07 Media upload and processing**
  - Build: presigned R2 upload URLs for covers, banners, thumbnails and comic panels; the worker checks type, size
    and 800 px width (A19: JPG or PNG, 20 MB each, 100 images and 200 MB per episode), makes WebP/AVIF and
    thumbnails with libvips. The seed uploads the demo artwork.
  - Depends on: P3-01
  - Done when: a 799 px image is rejected with a clear reason; processed images appear in R2 with variants.

- [ ] **P3-08 Image access Worker**
  - Build: Cloudflare Worker in `infra/image-worker/` that validates a short-lived signed token for paid episode
    images; the token is not part of the cache key.
  - Depends on: P3-07
  - Done when: a paid image URL works for 5 minutes for the buyer, then 403; CDN hit rate stays high.

- [ ] **P3-09 Reading API**
  - Build: episode content returns signed image URLs or chapter text only when free, Fast Pass-free (`free_at`
    passed) or unlocked; saves progress and history.
  - Depends on: P3-06, P3-08
  - Done when: a locked episode returns 402 with price and free date; free episode content loads.

- [ ] **P3-10 Coins and unlocks**
  - Build: balance from the ledger; unlock in one transaction (lock wallet row, write ledger, write unlock, record
    the creator's earning); idempotency key per request.
  - Depends on: P3-01, P3-05
  - Done when: 50 parallel unlock requests with the same key charge once; the balance is never negative.

- [ ] **P3-11 ABA PayWay payments**
  - Build: packs from the database (A2), create order, KHQR / ABA Pay / hosted card page, signed webhook, order
    status endpoint, 10-minute expiry, nightly reconciliation of pending orders. Purchase history.
  - Depends on: P3-10, A4
  - Done when: a sandbox payment credits coins exactly once even if the webhook arrives twice; an expired order
    shows as expired.

- [ ] **P3-12 Library API**
  - Build: subscribe / unsubscribe, subscribed list, recently read, unlocked list, bulk remove with undo.
  - Depends on: P3-09
  - Done when: all three library tabs return paged data with sort options.

- [ ] **P3-13 Comments, likes, reports**
  - Build: comments (post, delete own, creator deletes on own series), likes, reports to the admin queue.
  - Depends on: P3-05
  - Done when: comments respect the episode's comments on/off setting.

- [ ] **P3-14 Creator API and scheduling**
  - Build: series create / edit / draft / publish; episode create with images or chapter text; reorder; Fast Pass
    settings (3–10 coins, free after N days, default 5 coins / 7 days, A3); publish now / schedule (stored UTC,
    shown Asia/Phnom_Penh) / draft; scheduled publish job (ShedLock); stats.
  - Depends on: P3-07, P3-05
  - Done when: a scheduled episode goes live within 1 minute of its time; the episode count updates on My series.

- [ ] **P3-15 Search**
  - Build: outbox events keep Meilisearch in sync; search endpoint with type, genre and status filters, sort and
    suggestions.
  - Depends on: P3-06
  - Done when: a new series is searchable within 30 s; Khmer titles return results.

- [ ] **P3-16 Notifications**
  - Build: web push tokens (Firebase Cloud Messaging) and email (Resend) for new episodes, sent in batches by the
    worker; respects the user's notification settings.
  - Depends on: P3-14
  - Done when: 10,000 subscribers are notified in under 5 minutes without slowing the API.

- [ ] **P3-17 Account settings API**
  - Build: profile and avatar, change email (with code), change password, devices list and sign-out, language,
    notification and content settings, reader settings, delete account (30-day grace, A18).
  - Depends on: P3-02
  - Done when: every Settings section can be saved and reloaded.

- [ ] **P3-18 Admin API and audit log**
  - Build: users (ban), content (hide), reports, orders (refund to the ledger).
  - Depends on: P3-05
  - Done when: every admin action writes an audit row with who, what and when.

- [ ] **Milestone M3**: all endpoints in OpenAPI, integration tests green.

---

## Phase 4: Pages the frontend does not have yet

The other Phase 4 pages (P4-01 to P4-08, P4-10 to P4-12) are built by T20–T45; differences found while
wiring them are fixed in P5-07.

- [ ] **P4-09 Sign-in pages: reset and addressable steps**
  - Build: `/reset` (new password from the emailed link) and addressable `/signup`, `/verify`, `/forgot` (the
    existing views in `/login`); 6-digit code with resend after 30 s; return to the previous page.
  - Depends on: P2-04 (T15)
  - Done when: every error from the API shows next to its field or as an alert; typed input is never lost.

- [ ] **P4-13 Creator › My series** `/creator/series` (A1)
  - Build: list with filter and search, Create series, Add episode per row, success notice with "Add the first
    episode" / "Add another episode".
  - Depends on: P2-04 (T12)
  - Done when: the episode count updates after publishing.

- [ ] **P4-14 Create / edit series** `/creator/series/new`, `/creator/series/[id]/edit` (A1)
  - Build: title, genres, type (comic or novel), language, summary, tags, schedule, rating (A10), cover and banner
    upload, terms, save draft or publish.
  - Depends on: P2-03 (T09–T10)
  - Done when: validation matches the API rules; a draft can be reopened.

- [ ] **P4-15 Upload episode** `/creator/series/[id]/episodes/new` (A1)
  - Build: breadcrumb, auto number, title; comic: drag-and-drop, reorder by drag and up / down, delete, file rules,
    live preview strip; novel: editor with bold, italic, heading, scene break, word count; square thumbnail;
    creator's note; comments on / off; Free or Fast Pass with price and free-after days; publish now / schedule
    (Asia/Phnom_Penh) / draft; preview; validation; success with View episode and Upload another.
  - Depends on: P2-03 (T09–T10)
  - Done when: an upload of 60 panels on a 10 Mbps connection finishes with per-file progress; a failed file can
    be retried alone.

- [ ] **P4-16 Admin** `/admin` (A8, A9)
  - Build: users, content, reports queue, orders and refunds, with existing components.
  - Depends on: P2-04 (T12)
  - Done when: only ADMIN can open it; actions show in the audit log.

- [ ] **P4-17 System and legal pages**
  - Build: offline page for the installable app, Terms, Privacy, Help (placeholder text, A16); 404 and 500 already
    exist (T44).
  - Depends on: P2-04 (T12)
  - Done when: unknown URLs show the 404 page with search and Home links; the new pages are linked from the footer.

- [ ] **Milestone M4**: every artboard's buttons work (creator and admin pages on mock data until Phase 5).

---

## Phase 5: Real data, with loading, empty, error and success states

| State | Pattern |
|---|---|
| Loading | Skeletons shaped like the final layout (`loading.tsx` per route); spinner inside the pressed button; no full-page spinners |
| Empty | EmptyState with a short reason and one next action |
| Error | Field errors under the field; page errors in ErrorState with Retry; offline banner; 402 opens the unlock dialog; 401 goes to Log in; 429 shows when to try again |
| Success | Toast for small actions; a success screen with the next step for big ones |

- [ ] **P5-01 Data layer**
  - Build: one fetch wrapper in `src/lib/api/` (cookies, CSRF header, one silent refresh on 401 then retry,
    typed `ApiError`), TanStack Query keys, server-side fetching with revalidate tags for public pages.
  - Depends on: P1-07, P3-02
  - Done when: an expired access token never shows an error to the reader; public pages are cached and refresh on
    publish.

- [ ] **P5-02 Loading states**
  - Build: skeletons for every route and list; optimistic updates with rollback for subscribe, like, follow and
    library remove.
  - Depends on: P5-01, Phase 4
  - Done when: throttled "Slow 4G" shows skeletons within 100 ms, never a blank page.

- [ ] **P5-03 Empty states**
  - Build: empty states for every list (library tabs, search, comments, history, My series; Continue reading hidden
    when empty).
  - Depends on: P5-01
  - Done when: each empty list shows its message and action; tested with an empty account.

- [ ] **P5-04 Error states**
  - Build: `error.tsx` boundaries per route group, API field errors mapped to form fields, 401 / 402 / 403 / 404 /
    429 / 5xx handling, offline banner, Sentry capture with the request id.
  - Depends on: P5-01
  - Done when: killing the API shows ErrorState with Retry on every page; Sentry receives the error with its
    request id.

- [ ] **P5-05 Success states**
  - Build: one list of toast and success-screen texts in both languages; redirects after login, payment and
    publish.
  - Depends on: P5-01
  - Done when: every success in the six key flows ends on the designed screen or toast.

- [ ] **P5-06 Payment status handling**
  - Build: poll order status every 3 s on the pay step, resume a pending order after reload, stop at expiry; the
    webhook stays the source of truth.
  - Depends on: P3-11, P4-10 (T36–T39)
  - Done when: closing and reopening the tab mid-payment still ends on the right result.

- [ ] **P5-07 Mocks removed, staging seeded**
  - Build: replace mocks page by page (`demo-api.ts`, the local store's simulated server state, simulated
    payments, demo credentials); guests keep only local reader settings; seed staging with realistic Khmer and
    English series, 100+ episodes per long series; delete all prototype placeholders except legal and prices
    (A2, A16).
  - Depends on: P5-01 … P5-06
  - Done when: no mock imports remain (grep check in CI); a staging walkthrough of all pages uses real data.

- [ ] **Milestone M5**: six key flows work on staging with real data.

---

## Phase 6: Functional testing, accessibility and performance

- [ ] **P6-01 Backend tests**
  - Build: unit + integration tests on Zonky embedded PostgreSQL with Redis fakes (the plan's Testcontainers is
    replaced: no Docker), security rules, concurrency tests for unlocks and payment webhooks.
  - Depends on: Phase 3
  - Done when: 80%+ line coverage on auth, coin and payment; all tests green in CI.

- [ ] **P6-02 Frontend tests**
  - Build: Vitest + Testing Library for patterns and forms, MSW for API mocks.
  - Depends on: Phase 4
  - Done when: every form's validation and every dialog's open / close is covered.

- [ ] **P6-03 End-to-end tests**
  - Build: Playwright for the six key flows on desktop Chrome, emulated Android (Pixel 7) and iPhone, against
    staging with the PayWay sandbox (replaces the demo-mode tests from T52).
  - Depends on: Phase 5
  - Done when: all six flows pass 3 runs in a row; they run nightly and before every release.

- [ ] **P6-04 Accessibility (WCAG 2.2 AA)**
  - Build: axe checks on every page in Playwright, keyboard-only pass, VoiceOver (iOS) and TalkBack (Android) on
    the key flows, `lang="km"` on Khmer text.
  - Depends on: Phase 5
  - Done when: no serious or critical axe issues; every action reachable by keyboard with visible focus.

- [ ] **P6-05 Performance budgets**
  - Build: Lighthouse CI (mobile profile).
  - Depends on: Phase 5
  - Done when: Home, Series and readers: LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms, JavaScript ≤ 200 KB gzipped per
    route.

- [ ] **P6-06 Load test**
  - Build: k6: 5,000 readers open the same new episode within 1 minute, plus 200 coin purchases per minute.
  - Depends on: P3-11, staging
  - Done when: 95% of API responses are under 300 ms; zero errors; zero double charges.

- [ ] **P6-07 Security checks**
  - Build: OWASP ZAP baseline scan, dependency scanning, security headers (CSP, HSTS), secret scanning, webhook
    signature tests; `/security-review`; `docs/SECURITY.md`.
  - Depends on: Phase 5
  - Done when: no high findings are open; CSP blocks inline scripts except Next.js nonces.

- [ ] **Milestone M6**: all gates green.

---

## Phase 7: Deployment, configuration and final verification

Cannot finish until every "Blocks launch" assumption is settled.

- [ ] **P7-01 Environments**
  - Build: staging and production for the website (Vercel), API and worker (Spring Boot jar on a Singapore host,
    no Docker),
    Supabase, Redis, Meilisearch, R2 buckets; Cloudflare DNS, CDN rules and firewall; `/api` routing decision
    (rewrite or `api.<domain>`); secrets in each platform's secret store.
  - Depends on: P1-08, P1-10
  - Done when: staging and production run the same images with only settings different; no secret is in the
    repository.

- [ ] **P7-02 Release pipeline and rollback**
  - Build: `main` → staging automatically; tagged release → production after manual approval; Flyway migrates
    before the new API version rolls out; documented rollback.
  - Depends on: P1-09, P7-01
  - Done when: a test release and a rollback on staging each take under 15 minutes with no downtime.

- [ ] **P7-03 Monitoring, analytics, backups**
  - Build: Sentry for web and API, PostHog with the starter events (A22), uptime checks, alerts on error rate,
    payment failures and job queue backlog; database backups with point-in-time recovery and one restore drill.
  - Depends on: P7-01
  - Done when: an injected error and a failed sandbox payment each raise an alert within 5 minutes; the restore
    drill succeeds.

- [ ] **P7-04 Launch configuration ("Blocks launch" items closed)**
  - Build: real coin prices (A2), PayWay production keys (A4), production Google and Facebook apps (A14), email
    domain with SPF / DKIM (A13), Khmer translations (A12), legal pages (A16), launch series loaded.
  - Depends on: all "Blocks launch" rows
  - Done when: every "Blocks launch" assumption is closed with a named owner and date.

- [ ] **P7-05 Final verification and go-live**
  - Build: run the Phase 6 suites on production, make one real small KHQR purchase and refund it, walk every page
    on a phone and a laptop in both languages, design and product sign-off, then 48 hours of close monitoring.
  - Depends on: P7-01 … P7-04
  - Done when: every task's acceptance criteria are re-checked and ticked; no open critical bugs; sign-off is
    recorded.

- [ ] **Milestone M7**: live, signed off, 48 hours stable.

---

## Plan coverage

All 74 plan tasks, and where each one lives.

| Plan tasks | Where |
|---|---|
| P1-01, P1-02, P1-05 – P1-10 | This list, Phase 1 |
| P1-03, P1-04 | Done: T01–T06 |
| P2-01 – P2-10 (shared UI) | Done: T04–T15, T49–T50. P2-08's R2/CDN image loader is added in P5-07 |
| P3-01 – P3-18 | This list, Phase 3 |
| P4-01 – P4-08, P4-10 – P4-12 | Done: T20–T45; gaps fixed in P5-07 |
| P4-09, P4-13 – P4-17 | This list, Phase 4 |
| P5-01 – P5-07 | This list, Phase 5 |
| P6-01 – P6-07 | This list, Phase 6 |
| P7-01 – P7-05 | This list, Phase 7 |

## Plan assumptions (A1–A22)

| ID | Missing requirement | Assumption we build to | When needed |
|---|---|---|---|
| A1 | 8 screens have no V2 design: Rankings, Genres, Search, My library, Settings, Creator › My series, Create series, Upload episode | Rebuild from V1 layouts with V2 tokens and components; review each screen before merge | Phase 4 |
| A2 | Coin pack prices (USD and KHR) are placeholders | Prices in a database table that changes without a deploy; packs 10 / 30 / 60 / 120 / 300 with the designed bonuses | Blocks launch |
| A3 | Fast Pass rules | Creator sets price (3–10 coins) and "free after N days" per episode; default 5 coins, 7 days | Phase 3 |
| A4 | ABA PayWay merchant account, keys and sandbox | Build against the PayWay sandbox; production keys come with merchant onboarding | Blocks launch |
| A5 | Card payments | PayWay's hosted card page; PhumReader never sees card numbers | Phase 3 |
| A6 | Reader subscription plan (monthly) | Out of scope for v1: coins only | Product decision |
| A7 | Creator earnings and payouts | Earnings per unlock in a ledger; payouts and revenue share out of scope for v1 | Product decision |
| A8 | Admin tools (hide content, ban users, refunds) | A small admin area behind the ADMIN role: users, series, episodes, comments, orders | Phase 4 |
| A9 | Reports and moderation | "Report" on series, episodes and comments; reports go to the admin queue; creators can delete comments on their own series | Phase 4 |
| A10 | Age ratings and mature content | A rating per series (All, Teen, Mature); shown, no age gate in v1 | Product decision |
| A11 | Becoming a creator | Any logged-in reader becomes a creator by accepting the Creator terms (no review) | Phase 3 |
| A12 | Khmer translation of all UI text | English is the source; a translator supplies Khmer before launch; missing keys fall back to English | Blocks launch |
| A13 | Email sending (codes, resets, receipts) | Resend; sender `no-reply@` the final domain | Phase 3 |
| A14 | Google and Facebook login apps | Register both OAuth apps for staging and production domains | Phase 3 |
| A15 | Domain and brand | Brand is PhumReader (CLAUDE.md); staging and production domains to be chosen | Blocks launch |
| A16 | Terms, Privacy, refund policy, receipts and tax (VAT) | Pages exist with placeholder text; legal and finance supply content | Blocks launch |
| A17 | Notifications | Web push + email for new episodes of subscribed series; no in-app notification list in v1 | Phase 3 |
| A18 | Account deletion | 30-day grace period, then personal data is erased; purchases stay as anonymised records | Phase 3 |
| A19 | Comic upload rules | Panels exactly 800 px wide, JPG or PNG, 20 MB each, 100 images and 200 MB per episode | Phase 3 |
| A20 | Launch scale | About 10,000 daily readers at launch, built to grow to 100,000 without code changes | Phase 6 |
| A21 | Browser support | Last 2 versions of Chrome, Safari, Firefox, Edge and Samsung Internet; Android phones with 3 GB RAM | Phase 6 |
| A22 | Analytics events | A starter event list (sign-up, read, unlock, purchase, upload, publish) defined in Phase 6 | Phase 6 |

## Assumptions made while working

1. **Dev database region.** `phumreader-dev` was created in Tokyo (`ap-northeast-1`); fine for development.
   Staging and production go to Singapore (P1-10).
2. **Flyway's history table has no row level security.** Altering it inside a migration waits forever on
   Flyway's own lock, so V1 skips it. It only lists migrations, and the Data API is off.
3. **Seed dates.** Seeded timestamps use the demo's pinned "today" (2026-11-05, midnight Asia/Phnom_Penh), so
   episode and Fast Pass dates match the demo. The API itself uses the real clock, so Fast Pass episodes turn
   free on their real dates (the first on 2026-11-12).
4. **Demo purchase history is not seeded.** Its two rows (a paid 33-coin order, a failed order) have no
   matching ledger entries, and the demo account must keep 3 coins and its first-purchase bonus (e2e flow 3).
5. **A login for the stand-in creator.** `creator@toonwave.app` / the demo password is Chan Sreyleak, whose
   series the creator dashboard shows. The other 11 demo creators and the 5 commenters cannot log in
   (`*.phumreader.invalid` addresses, no password).
6. **Badges.** "NEW" comes from `series.launched_at`: series the demo marks as new are seeded as launched 14 days
   before the demo's today. "UP" is computed from the schedule and release dates (assumption 15), so it does not
   match the demo's hand-set flags exactly.
7. **Subscriber counts** are seeded as 4.68% of likes, the website's own rule (frontend Assumption 5).
8. **Access tokens without a JWT library (for now).** RS256 tokens are signed and checked with the JDK's own
   crypto (`auth/service/JwtService`): only RS256, our issuer and unexpired tokens pass. Dev and tests use a
   throw-away key; production needs `PHUMREADER_JWT_PRIVATE_KEY` (PKCS#8 PEM).
9. **Two tabs refreshing at once.** A rotated refresh token still works for 20 seconds
   (`refresh-reuse-grace`); used later, it signs that device out. Tests use 0 seconds.
10. **Dev email code is always 123456** (as in the demo), so the Playwright flows can sign up against the real
    API. Production refuses to start when `phumreader.auth.fixed-verification-code` is set. Codes and reset
    links are printed in the backend console in dev; there is no email sender for production yet (A13).
11. **Signing up again with an unconfirmed email** replaces the name and password and sends a new code; a
    confirmed email gets 409 `email_taken`. Logging in before confirming answers 403 `email_not_verified` and
    sends a new code. A reset link also confirms the email (it proves the mailbox).
12. **Rate limits (in memory until Step 3):** 5 wrong passwords per email per 10 minutes, 30 logins per client
    address per 10 minutes, 10 sign-ups and 10 forgot-password requests per client address per hour (at most
    3 reset emails per email address per hour), one code per 30 seconds per email, 10 password resets per
    client address per 10 minutes. 429 answers carry
    `Retry-After` and `retryAfterSeconds`.
13. **"Remember me" off** gives browser-session cookies (no Max-Age); the choice is kept on the refresh token
    (V2 migration), so refreshes keep it.
14. **Catalog answers carry raw values.** Field names follow `src/data/types.ts`, but `views` / `likes` are numbers,
    episode `date` is an ISO day in Asia/Phnom_Penh, ranking movement is `previousRank` (null = NEW) and there is
    no `schedule` text (`updateDay` instead). Step 5's fetch layer turns them into the website's strings ("1.6M",
    "Nov 5, 2026", "▲ 2", "Every Sun") with its own formatters, which also cover Khmer. Formatting on the server
    would be English only.
15. **UP and NEW badges use the real clock in Asia/Phnom_Penh.** A series is UP when it is ongoing, updates today
    and released an episode (or a Fast Pass episode turned free) in the last 7 days; with the seed that is the
    day's 6–7 scheduled series through 2026-12-02 (the last demo episode turns free on 2026-11-26),
    then none. An episode is UP when it is the newest free one and
    turned free in the last 7 days (the spec's "latest free episode has UP"). NEW lasts 30 days after launch, so
    the 16 demo "new" series lose it on 2026-11-21.
16. **Home feed choices the demo hard-coded:** daily lists, genre rows and web novels are the most viewed (ties by
    id); a genre row shows up to 12 series; the "become a creator" card shows the 3 most viewed comics (the demo
    picked three titles). The home feed has no Continue reading: that is the reader's own data (Part 3).
17. **Home feed cache in memory** for 60 s (`phumreader.catalog.home-cache-ttl`, 0 in tests), rebuilt at
    midnight in Phnom Penh. Redis replaces it in Step 3; nothing changes the catalog yet (publishing is P3-14).
18. **Search stand-in.** `GET /api/v1/search` finds published series whose title, creator or genre contains the
    text (any case, Khmer works), titles starting with it first, at most 20; an empty query gives the 6 most
    viewed ("Popular now"). P3-15 moves it to Meilisearch behind the same address.
19. **Who may read a Fast Pass episode before its free date:** readers who unlocked it, the series' creator and
    admins. Everyone else gets 402 `episode_locked` with `price` and `freeOn`. Saving progress, liking,
    bookmarking and commenting on an episode need the same access. Comic panels are returned as their stored
    public paths until signed image URLs (P3-08). Opening an episode does not count a view yet (view counters
    come with Redis).
20. **Reading progress:** `PUT /series/{slug}/progress` stores the episode opened last and how far into it;
    `lastRead` (the highest episode opened, for the "✓ Read" marks) only goes up. "Continue reading" on Home and
    "Recently read" in the library are both `GET /me/history` (most recent first).
21. **Comments:** at most 500 characters (the website's counter); "Top" is the thread's most liked comment with at
    least 10 likes; there are no threaded replies (the website's Reply puts the name in the box); deleting hides
    the comment (status DELETED); 10 comments per reader per 10 minutes. Liking an episode also adds to its
    series' like count.
22. **Reports:** a reader's second report on the same series, episode or comment is ignored while the first is
    still open; 20 reports per reader per hour.
23. **Remove with undo** has no server-side trash: `/me/subscriptions/remove` and `/me/history/remove` return the
    removed entries, and sending them to `.../restore` puts them back with their original dates. Unlocked
    episodes cannot be removed (they were paid for).
