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

Progress: 3 / 51 tasks (P1-05, P1-07, P1-08) · Stage 1: step 5 of 5 done (all 5 parts) · milestones M1, M3, M4, M5, M6, M7

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
- [ ] **Step 3: Other local services** (P1-02 rest) — services part 1 done 2026-11-06 (see below); stand-in swaps remain
  - Upstash Redis, Meilisearch (`meilisearch.exe`), email printed in the backend console; a services check.
  - Check: the services check shows every service healthy.
  - Done 2026-11-06 (part 1, on a Mac with Homebrew, no Docker): Redis, Meilisearch, MinIO (R2 stand-in) and Mailpit
    installed with `brew install` and run by `npm run services:start` / `services:stop` (`scripts/services.sh`; data
    in git-ignored `.local/`). `npm run services:check` (`scripts/check-services.mjs`) shows all 5 healthy (the 5th is
    the database through the API). `backend/.env.example` lists the new settings. Not done yet: Upstash and a real
    R2 bucket (accounts), the MinIO bucket `phumreader-dev` (created by P3-07), and part 2: swap the in-memory
    stand-ins for Redis (rate limits, codes, view counters), Meilisearch (search + outbox sync) and Mailpit (SMTP),
    then Google / Facebook login (P3-04).
  - Done 2026-11-06 (part 2a, Redis): `RedisRateLimiter` and `RedisShortLivedStore` (`common/ratelimit`, `common/store`)
    replace the in-memory ones when `REDIS_URL` is set (`phumreader.redis.url`); without it the in-memory versions stay
    (tests, no-Redis machines). Limiter: one Lua script (INCR + PEXPIRE) per key, fails open with a warning if Redis is
    down; store: SET with TTL, errors are not hidden. New `RedisStandInsTest` (3 tests, runs against a real Redis,
    skipped when none is on 6379), `./gradlew check` green. Real check on Supabase + local Redis: 5 wrong passwords
    then 429 and the keys `phumreader:rl:*` with TTL ~600 s; sign-up put `phumreader:kv:verify:<email>` (TTL 600 s) and
    verifying removed it. Not done yet: view counters and the job queue (Redis, with P3-14).
  - Done 2026-11-06 (part 2b, email): `SmtpEmailSender` (`notification/service`) sends plain-text mail over SMTP when
    `MAIL_HOST` is set (`phumreader.mail.host`; `MAIL_FROM`, `MAIL_PORT`; prod also `MAIL_USERNAME` / `MAIL_PASSWORD` for
    the provider, A13); without it the console sender stays in dev. `SmtpEmailSenderTest`, `./gradlew check` green.
    Real check: sign-up on Supabase put "Your PhumReader code: 123456" in Mailpit (http://127.0.0.1:8025), nothing in
    the console. Plain text only; HTML templates come with P3-16.
  - Done 2026-11-06 (part 2c, search, P3-15 first half): `search/service` has `SearchIndex`, `MeilisearchIndex`
    (plain HTTP, waits for each Meilisearch task; searches title, creator, genre with typos and prefixes, ties ranked by
    views), `SearchSyncService` (full sync at startup in the background, then `outbox_events` topic SEARCH every 5 s with
    `for update skip locked`, 5 attempts then left alone) and `OutboxEvents` (`add(type, seriesId)` for the writers).
    On when `MEILI_URL` is set; `CatalogService.search` uses it and falls back to PostgreSQL (with a warning) if the
    index is down or unset. Empty query still returns Popular now from PostgreSQL. Tests: `SearchSyncTest` (3, fake
    index on embedded PostgreSQL), `MeilisearchIndexTest` (3, real Meilisearch, skipped when none), check green. Real
    check on Supabase + local Meilisearch: 48 series indexed at startup; "glass", "compas" (typo), creator and genre
    searches answer from Meilisearch. Not done yet: nothing writes SEARCH events until the creator pages exist
    (P3-14: call `OutboxEvents.add` in the same transaction as a publish / unpublish / edit); the ranking uses the views
    from the last sync (refreshed with view counters); suggestions and filters beyond `type`.
  - Done 2026-11-06 (part 2d, view counters): `common/views` (`ViewCounter`: `RedisViewCounter` with Lua scripts, or
    `InMemoryViewCounter` without Redis; `ViewRecorder`; `common/web/Viewer`). Opening a series page counts one view for
    the series; opening an episode or chapter counts one view for that episode (not the series). One viewer (user id, or
    client address when signed out) counts once per page per 30 minutes (`phumreader.views.dedupe-window`). A counter
    error is only logged. `ViewFlushService` (every 60 s, `phumreader.views.flush-interval`) adds the counts to
    `series.view_count` and `episodes.view_count`, puts them back if the write fails, and queues a `VIEWS_CHANGED` search
    event per series (only when Meilisearch is on) so search ranking follows. Off in tests (`phumreader.views.enabled`),
    on in dev and prod. Tests: `ViewCountingTest` (3), `ViewFlushDatabaseTest` (1), `RedisViewCounterTest` (1, real
    Redis, skipped when none); check green. Real check on Supabase + Redis: 5 requests from one client gave 1 series and
    1 episode view in Redis; after the flush Glass Compass went from 1,600,000 to 1,600,001 views. Known gap: the page
    shows the stored total, up to one flush interval behind; the first views after a restart of a no-Redis API are lost
    if it stops before a flush.
  - 2026-11-06: the company PC may not download programs, so Step 4 runs first with built-in stand-ins
    (rate limits and codes in memory, search in PostgreSQL, JWT signed with the JDK). At home: install the
    services, fill in `backend/.env`, swap the stand-ins (and optionally the JWT code for a JWT library), add
    Google / Facebook login (P3-04).
- [x] **Step 4: API for every existing page** (P3-02 – P3-06, P3-09 – P3-13, P3-15, P3-17; P3-05/P3-14 stats only)
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
    - [x] Part 4, coins (P3-10, P3-11 with the dev simulator instead of PayWay): `GET /api/v1/me/coins`,
      `POST /series/{slug}/episodes/{n}/unlock` (Idempotency-Key), `/me/coins/ledger`, `GET /coins/packs`,
      `POST /coins/orders` (Idempotency-Key), order status, cancel, `POST /coins/orders/{number}/simulate`
      (dev only), `/me/coins/orders` (purchase history). Flyway V3: `payment_orders.first_bonus_coins`.
      Done 2026-11-06: 13 new tests (115 backend tests green), among them 50 parallel unlocks with one key
      (charged once), 50 parallel unlocks with too few coins for all (balance never below 0) and a payment
      confirmed 50 times at once (credited once). Real check on Supabase (V3 applied): the demo reader keeps 3
      coins and the first-purchase offer (unlock answers 402 `not_enough_coins`); a new test account bought the
      10 pack (+10 first bonus), paying twice credited once, then unlocked Glass Compass 66 for 5 coins.
      Not done yet: ABA PayWay (KHQR, ABA Pay, hosted card page, signed webhook, nightly reconciliation; A4).
    - [x] Part 5, settings and the creator dashboard (P3-17; P3-14 stats only): `GET` / `PATCH /api/v1/me/settings`
      (language, appearance, novel reader defaults, notifications; only the fields sent change), `PATCH
      /me/profile` (display name); under `/api/v1/auth` (where the refresh cookie is sent): `change-password`
      (signs out the other devices), `change-email` + `change-email/confirm` (6-digit code to the new address),
      `devices` (list, `DELETE devices/{id}`), `delete-account` (30-day grace, A18); `GET /api/v1/creator/dashboard`
      (the creator's series with views, likes, subscribers, comments, unlocks and earned coins, plus totals).
      Done 2026-11-06: 21 new tests (136 backend tests green). Real check through `http://localhost:3000/api/v1` on
      Supabase: the demo reader's settings saved, reloaded and put back (size 15 refused); Chan Sreyleak's
      dashboard shows her 4 series (76.5M views, 14.4M likes); a new test account renamed itself, changed language,
      password (the other device signed out) and email (dev code), signed out its phone, then deleted itself
      (`/me` 401; logging in kept it; deleted again and left pending). Not done yet: avatar upload (needs P3-07),
      "become a creator" (A11) and the creator writing pages (P3-14), the job that erases accounts after 30 days
      (worker), content settings (no column or page control yet).
- [x] **Step 5: Connect the frontend** (P5-01, P5-06, parts of P5-04, P5-05, P5-07; `/reset` from P4-09)
  - Fetch wrapper (cookies, CSRF, silent refresh, `ApiError`); every `demo-api.ts` call has a real-API path; server
    state for logged-in users; 401 / 402 / 429 handling; payment status polling; `/reset` page.
    `NEXT_PUBLIC_DEMO=1` still runs the old demo.
  - Check: the Playwright key flows pass against the local backend and in demo mode; lint, typecheck and build pass.
  - Done in five parts, stopping after each. Pages not yet connected keep using the demo data in both modes until
    their part:
    - [x] Part 1, data layer and sign-in: `src/lib/api/` fetch wrapper, the demo / real switch, the session from
      `GET /me` on start (header), log in (unconfirmed email goes to the code step, 429 shows the wait), sign up,
      code and resend, forgot password, log out, the new `/reset` page.
      Done 2026-11-06: `src/lib/api/client.ts` (cookies, CSRF header with one retry on `invalid_csrf_token`, one
      shared silent refresh on 401, `ApiError`, `idempotencyKey()`), `src/lib/api/config.ts` (`DEMO_MODE`),
      `src/lib/session.ts` (sign-in for both modes), `src/lib/session-sync.tsx`, `/reset`. Real check in Chromium
      on a real-API production build against the local API on Supabase: wrong password, log in, reload, a deleted
      access cookie refreshed silently, log out (`/me` 401), sign up with code 123456, taken email, forgot
      password, reset link (weak password refused, new one saved, log in with it, the link fails the second time),
      unconfirmed log in to the code step, 6 wrong passwords ("Try again in 10 minutes."), Khmer `/km/reset`,
      Google "coming soon". Demo mode (`NEXT_PUBLIC_DEMO=1` build): the Playwright suite passes (24 tests; the
      desktop "404 page" test failed once on a cold server and passed 8 times after, see assumption 44).
    - [x] Part 2, catalog: Home, Rankings, Genres, Search, Series page, episode lists, comic and novel readers
      (402 opens the unlock dialog); raw API values formatted for English and Khmer.
      Done 2026-11-06: `src/lib/api/catalog.ts` turns the API's raw values into the pages' shapes (counts "1.6M",
      dates "Nov 5, 2026", "Every Sun", ranking movement "▲ 2" / "NEW"); `src/lib/queries.ts` picks the demo or the
      real API; a reader that gets 402 `episode_locked` goes back to the series page with the unlock dialog
      (`src/lib/use-locked-redirect.ts`). Real check in Chromium on a real-API build against the local API on
      Supabase: Home (one `/home` call), the daily grid with the demo's counts, rankings (Paper Tigers first with
      "▲ 2" as in the demo, all 41 comics, the novels tab), genres and Sci-fi's series, search, the Glass Compass
      page ("68 episodes · new every Sun", About, related), comic episode 1 (9 pages) and Next, episode 66 opened
      by URL back to the series page with the dialog, novel chapter 1 and Next, the Khmer series page (Khmer digits
      and schedule), unknown series and episode (the 404 page), an API 500 (ErrorState, Retry recovers). Demo build
      (`NEXT_PUBLIC_DEMO=1`): the Playwright suite passes except the desktop "404 page" test on a cold server
      (assumption 44).
    - [x] Part 3, the reader's own data: progress and Continue reading, read marks, subscribe, follow, likes,
      bookmarks, library tabs with remove and undo, comments (post, like, delete, report).
      Done 2026-11-06: `src/lib/api/me.ts` (the calls) and `src/lib/me.ts` / `src/lib/comments.ts` (hooks that read
      the store in demo mode and the API otherwise, so the components share one code path). Subscriptions are one
      list query (`/me/subscriptions`) used by every Subscribe button and the Subscribed tab; follow, read marks and
      unlocked numbers come from `GET /series/{slug}/me`; like and bookmark come with the episode (`viewer`) and
      update its cache; opening an episode saves progress 0 and reaching its end section saves 1; Home and the
      Library's Continue reading come from `/me/history`. Optimistic updates roll back on failure. Real check in
      Chromium on a real-API build against the local API: logged-out Subscribe asks to log in; subscribe and follow
      persist after a reload; episode like persists; read mark and "Continue episode 2"; Library remove and Undo
      on Continue reading and Subscribed; Home Continue reading; comment post, like (kept after reload), delete,
      report; novel chapter bookmark; exactly one progress call per opening. Demo build: the Playwright suite passes
      (24 tests; the "404 page" test failed once on a cold server, assumption 44, and passed on the rerun).
      Assumption 103 in docs/CHECKLIST.md.
    - [x] Part 4, coins: balance in the header, unlock with an Idempotency-Key, packs, orders paid with the dev
      simulator, status polling every 3 s and resuming after a reload (P5-06), purchase history.
      Done 2026-11-06: `src/lib/api/coins.ts` (wallet, packs, orders, unlock), `src/lib/wallet.ts` (balance mirrored into
      the store, `applyBalance`), the real branch of `useCheckout` (create order with an Idempotency-Key, poll every
      3 s, resume from `phumreader.pendingOrder`, cancel, simulate), unlock with one Idempotency-Key per episode.
      Real check in Chromium on a real-API build against the local API: header balance equals `/me/coins`; packs
      and methods from the API; continue to pay, reload resumes the pay step; "I've paid" (balance 3 to 263 with the
      first-purchase bonus, header updated); cancel; simulated failure; history rows Paid / Cancelled / Failed after
      a reload; an order paid from outside the page is noticed by the poll (1.8 s, pending key cleared); unlocking
      Glass Compass episode 68 charged exactly 5 (263 to 258), opened the reader and listed it in `/series/{slug}/me`
      and the Library's Unlocked tab. Demo build: the Playwright suite passes (23 of 24; the "404 page" test failed on
      a cold server, assumption 44). Assumption 104 in docs/CHECKLIST.md. The test left the demo account with 258 coins.
    - [x] Part 5, settings and creator dashboard; Playwright key flows against the local backend and in demo mode.
      Done 2026-11-06: `src/lib/api/account.ts`, `src/lib/settings-sync.tsx` (load and save appearance, reading
      defaults, notifications), `src/components/pr/account-security.tsx` (rename, change password and email, devices,
      delete account), the creator dashboard on `/creator/dashboard`. New `e2e/real.spec.ts` with
      `playwright.real.config.ts` and `npm run test:e2e:real`: 8 flows on a brand-new account against the local API
      (sign up with the code; subscribe, follow, like, Library remove and Undo; comment post, like, delete; buy the 10
      pack with the simulator, reload resumes the order, unlock episode 66; name, dark theme and text size saved and
      seen from a second browser; wrong then right current password, new password logs in, device list; creator
      dashboard empty, then with a fixture answer because no creator account can log in; delete account) all pass in
      50 s. Demo suite (`npm run test:e2e`, real spec excluded): 23 of 24, the "404 page" cold-server test failed
      once (assumption 44). Each real run leaves one account waiting for deletion. Assumption 105 in docs/CHECKLIST.md.


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

- [x] **P3-05 Roles and ownership**
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

- [x] **P3-07 Media upload and processing**
  - Build: presigned R2 upload URLs for covers, banners, thumbnails and comic panels; the worker checks type, size
    and 800 px width (A19: JPG or PNG, 20 MB each, 100 images and 200 MB per episode), makes WebP/AVIF and
    thumbnails with libvips. The seed uploads the demo artwork.
  - Depends on: P3-01
  - Done when: a 799 px image is rejected with a clear reason; processed images appear in R2 with variants.
  - Done (2026-11-06): `POST /api/v1/creator/uploads` (kind COVER / BANNER / THUMBNAIL / PANEL, type, size) returns a
    presigned PUT URL (size and type are part of the signature); `POST …/{id}/complete` checks the file's own bytes
    and makes WebP variants (320, 800, 1200 px, never wider than the original); `GET …/{id}` shows the state.
    Rejections answer 422 with a code (`image_too_small`, `not_square`, `unsupported_type`, `corrupt_image`,
    `file_too_large`, `too_many_pixels`). Tests: `MediaApiTest` (10, in-memory store), `S3ObjectStoreTest` (real MinIO,
    skipped when none runs), Playwright real-mode test 8 (upload to MinIO, WebP read back, 799 px refused).
  - Decisions: (1) **No libvips and no AVIF.** libvips is not installed here and CLAUDE.md allows no extra system
    installs, so the JVM does the work: ImageIO checks, scrimage-webp (bundled encoder) makes WebP. AVIF can be added
    with a Worker/libvips later. (2) Minimum widths: panel 800, banner 800 (A19), cover 600, thumbnail 300 and square
    (my choice, the plan gives only 800). (3) Processing runs inside the `complete` request, not in a background
    worker; a 20 MB image takes a second or two. (4) Not yet: the per-episode limits (100 images, 200 MB), cleaning up
    uploads that never complete, and uploading the demo artwork in the seed (the demo covers are SVG, which the
    JPG/PNG pipeline refuses; the seed keeps its current `/covers/…` paths). Per-episode limits belong to P3-14.
    (5) Browser PUTs to MinIO work (MinIO allows any origin); R2 needs a CORS rule on the bucket (Phase 7).

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

- [x] **P3-12 Library API**
  - Build: subscribe / unsubscribe, subscribed list, recently read, unlocked list, bulk remove with undo.
  - Depends on: P3-09
  - Done when: all three library tabs return paged data with sort options.

- [x] **P3-13 Comments, likes, reports**
  - Build: comments (post, delete own, creator deletes on own series), likes, reports to the admin queue.
  - Depends on: P3-05
  - Done when: comments respect the episode's comments on/off setting.

- [x] **P3-14 Creator API and scheduling**
  - Build: series create / edit / draft / publish; episode create with images or chapter text; reorder; Fast Pass
    settings (3–10 coins, free after N days, default 5 coins / 7 days, A3); publish now / schedule (stored UTC,
    shown Asia/Phnom_Penh) / draft; scheduled publish job (ShedLock); stats.
  - Depends on: P3-07, P3-05
  - Done when: a scheduled episode goes live within 1 minute of its time; the episode count updates on My series.
  - Done (2026-11-06), all under `/api/v1/creator/series` (CREATOR only, own series only: 403 otherwise):
    `GET` (list, `q` and `visibility` filters), `POST` (draft), `PUT /{id}`, `POST /{id}/publish` and `/unpublish`;
    `GET|POST /{id}/episodes`, `GET|PUT|DELETE /{id}/episodes/{n}`. Covers, banners, thumbnails and panels come from
    finished uploads (P3-07) by id. Episodes: `publish.mode` draft / now / scheduled (+ `at`), Fast Pass 3–10 coins
    and free after 1–90 days (defaults 5 and 7, A3), comments on / off, creator's note; comics send panel upload ids in
    reading order (max 100, 200 MB), novels send text blocks. A scheduled episode goes live by a job every 30 s
    (`CreatorContentService.publishDueEpisodes`, one instance at a time through the `shedlock` table). Publishing
    clears the home cache and queues a search update. Migration V5 (`fast_pass_days`, `episode_images.upload_id`).
    Tests: `CreatorContentApiTest` (10), Playwright real-mode test 9 (the scheduled episode went live by itself).
  - Decisions: (1) JSON values follow the existing API: lowercase enums (`comic`, `draft`, `published`), weekdays
    `Mon`…`Sun`, so `publish.mode` is `draft` / `now` / `scheduled` (the upload API from P3-07 still uses uppercase
    kinds and statuses). (2) The ShedLock library is not used (it has to follow Spring's releases): `JobLock` writes
    the same `shedlock` table. (3) A series needs a summary and a cover to be published; a published episode cannot go
    back to a draft or be deleted. (4) A panel's `storage_key` holds the full public URL of its largest WebP.
    (5) Not yet: deleting a series, reordering several episodes, the per-day publish limits, and refreshing the
    Next.js pages on publish (the API clears its own home cache; the pages revalidate on their own timer).

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

- [x] **P3-18 Admin API and audit log**
  - Build: users (ban), content (hide), reports, orders (refund to the ledger).
  - Depends on: P3-05
  - Done when: every admin action writes an audit row with who, what and when.
  - Done (2026-11-06): `/api/v1/admin/**`, ADMIN role only (`SecurityConfig`; 401 for guests, 403 for everyone
    else, same JSON error body). Endpoints: `GET overview`; `GET users`, `POST users/{id}/ban|unban`;
    `GET content?type=series|episode|comment`, `POST content/{type}/{id}/hide|restore`; `GET reports`,
    `POST reports/{id}/settle` (`dismiss | resolve | hide`); `GET orders`, `POST orders/{id}/refund`; `GET audit`.
    Lists page with a cursor and filter by `q` and `status`. Migration V6: episode status `HIDDEN`, order status
    `REFUNDED` (+ `refunded_at`), `reports.resolution_note`, one REFUND ledger row per order, and `audit_log`
    is append-only (a trigger rejects update, delete and truncate, like the coin ledger).
    Every action writes its `audit_log` row (actor, action, target, details with the admin's reason, request id)
    in the same transaction as the change: `user.ban`, `user.unban`, `content.hide`, `content.restore`,
    `report.resolve`, `report.dismiss`, `order.refund`. `AdminApiTest` (15 tests) covers access, each action,
    paging and the audit rows.
  - Decisions: **Ban** sets the account to BANNED and revokes every refresh token (no more sign-in or refresh);
    an access token already issued works until it expires (15 minutes). Admin accounts cannot be banned here.
    **Hide** moves live content to HIDDEN (series PUBLISHED, episode PUBLISHED, comment VISIBLE) and restore moves
    it back; only live content can be hidden. The public pages already show only published/visible content, so
    hidden content disappears at once; the creator cannot edit, delete or re-publish it (series: 403
    `hidden_by_admin`, episode: 409 `episode_hidden`). Hiding also resolves the open reports on that target, the
    search index and the home feed are told. **Reports**: "hide" through one report settles every open report on
    the same target; "dismiss" and "resolve" settle only that one. **Refund** takes back every coin the order
    credited (pack + bonus + first-purchase bonus) with one REFUND ledger row; it is refused when the reader
    already spent some (409 `coins_spent`) or the order is not PAID (409 `order_not_refundable`). A refunded order
    still counts as the reader's first purchase (no second first-purchase bonus). Returning the money to the
    payer is done in the payment provider's dashboard (P3-11/P3-12 has no provider refund call yet).
    Not done: there is no API to grant the ADMIN role (set it in the database for now); the admin cannot edit a
    series or episode, only hide it; no notification is sent to the user whose account or content was actioned.

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

- [x] **P4-13 Creator › My series** `/creator/series` (A1)
  - Build: list with filter and search, Create series, Add episode per row, success notice with "Add the first
    episode" / "Add another episode".
  - Depends on: P2-04 (T12)
  - Done when: the episode count updates after publishing.
  - Done (2026-11-06): `/creator/series` (`src/components/pr/creator-series-page.tsx`): search (250 ms after typing),
    All / Published / Draft filter, one row per series (cover, type, episodes, readers, subscribers, status badge,
    Add episode, Edit), "Create series", the success notice (`?notice=series-created|episode-added&series=<id>`
    with "Add the first episode" / "Add another episode"), loading, empty, no-match, error and logged-out states,
    English and Khmer. A reader sees "Become a creator" with a dialog (pen name + terms, react-hook-form + zod) that
    calls `POST /creator` and then refreshes the session so creator-only calls work at once; `/creator` uses the
    same dialog for "Start publishing" and links to My series. Demo mode shows the stand-in creator's series read-only.
    Tests: real-mode Playwright test 8 (dialog, list, filter, search, notices), demo `e2e/creator-series.spec.ts`
    (desktop and phone, no sideways scroll, Khmer).
  - Notes: "Create series", "Edit" and "Add episode" link to `/creator/series/new`, `/creator/series/[id]/edit` and
    `/creator/series/[id]/episodes/new`, which P4-14 and P4-15 build (until then they show the 404 page).
    Also fixed in this task: a comment you post in a thread of more than 50 comments could vanish from the list
    (the API sends the top 50 by likes, and the list was loaded again after the post); `src/lib/comments.ts` now
    keeps the reader's own comments. The "404 page" demo test (`/series/nope` answers 200 in dev) already fails on a
    clean checkout; not caused by this task.

- [x] **P4-14 Create / edit series** `/creator/series/new`, `/creator/series/[id]/edit` (A1)
  - Build: title, genres, type (comic or novel), language, summary, tags, schedule, rating (A10), cover and banner
    upload, terms, save draft or publish.
  - Depends on: P2-03 (T09–T10)
  - Done when: validation matches the API rules; a draft can be reopened.
  - Done (2026-11-06): `src/components/pr/series-form.tsx` with the two pages (`series-form-pages.tsx`), the shared
    `CreatorGate` (login / become a creator) and `ImageUploadField` (type, size and width checked in the browser, real
    upload progress, cancel, the API's reasons). Fields: type, title, genre, language, summary, tags, schedule, age
    rating (A10), cover, banner, terms, and for editing the story status. Save draft / Publish (summary, cover and terms
    needed) / Save changes / Unpublish; the API's field errors show next to their fields; a draft reopens with its
    values and cover; another creator's series says so (403), an unknown id says not found; English and Khmer.
    Tests: real-mode Playwright test 9 (validation, 599 / 700 px images refused in the browser, real uploads to MinIO,
    draft, edit, publish, edit while live, unpublish, public API checks, no sideways scroll at 320 / 390 / 768 / 1440 px),
    demo spec for the demo notice. Assumptions 106 and 107 in docs/CHECKLIST.md.
  - Notes: the browser PUTs to MinIO directly (works: MinIO allows any origin); Cloudflare R2 needs a CORS rule on the
    bucket for the site's origin (Phase 7). The pen name from "Become a creator" is not editable yet.

- [x] **P4-15 Upload episode** `/creator/series/[id]/episodes/new` (A1)
  - Build: breadcrumb, auto number, title; comic: drag-and-drop, reorder by drag and up / down, delete, file rules,
    live preview strip; novel: editor with bold, italic, heading, scene break, word count; square thumbnail;
    creator's note; comments on / off; Free or Fast Pass with price and free-after days; publish now / schedule
    (Asia/Phnom_Penh) / draft; preview; validation; success with View episode and Upload another.
  - Depends on: P2-03 (T09–T10)
  - Done when: an upload of 60 panels on a 10 Mbps connection finishes with per-file progress; a failed file can
    be retried alone.
  - Done (2026-11-06): `/creator/series/[id]/episodes/new` and `/creator/series/[id]/episodes/[n]/edit`
    (`episode-form.tsx`, `panel-uploader.tsx`, `chapter-editor.tsx`, `use-panel-uploads.ts`). Comics: drop or choose
    files, three uploads at a time each with its own progress, reorder by dragging or with Up / Down, remove, Retry on
    a failed file only (a wrong file, such as 799 px, can only be removed), 100 images / 200 MB, a preview strip and a
    Preview dialog. Novels: block editor (paragraph, heading, quote, scene break, bold and italic with buttons or
    Ctrl+B / Ctrl+I, reorder, live word count). Both: auto number, title, square thumbnail, creator's note, comments
    on / off, Free or Fast Pass (3–10 coins, free after 1–90 days), publish now / schedule in Phnom Penh time / save
    draft, validation next to the fields, a success screen (View episode, Upload another, Back to My series), and
    editing drafts, scheduled and live episodes. English and Khmer.
    Tests: real-mode Playwright test 11 (60 panels with the network limited to 10 Mbps: all uploaded in about 20 s with
    per-file progress; one file cut off and retried alone; reorder by button and drag; Fast Pass rules; preview;
    publish; schedule with the Phnom Penh time checked on the API; draft; edit of a live episode; no sideways scroll at
    320 / 390 / 768 / 1440 px), test 12 (the chapter editor, and the reader shows heading and bold / italic).
    Assumptions 108 to 110 in docs/CHECKLIST.md.
  - Changed on the way: (1) chapter text gets a `heading` block and `**bold**` / `*italic*` marks (backend accepts
    and returns them; the novel reader and the preview render them without HTML). (2) Editing an episode without a new
    thumbnail keeps the saved one. (3) Saving an episode with many panels was slow (one database call per panel);
    panels are now looked up and written in two statements. (4) The public series and reader pages no longer
    404 on the server for slugs missing from the demo data when the real API is on, so a creator's own series and
    episodes can be opened (View episode works).

- [x] **P4-16 Admin** `/admin` (A8, A9)
  - Build: users, content, reports queue, orders and refunds, with existing components.
  - Depends on: P2-04 (T12)
  - Done when: only ADMIN can open it; actions show in the audit log.
  - Done (2026-11-06): `/admin` (`admin-page.tsx`, `admin-lists.tsx`, `admin-dialogs.tsx`, `src/lib/admin.ts`,
    `src/lib/api/admin.ts`), English and Khmer. Tabs: Overview (counts that link to the lists), Reports (open by
    default; dismiss, resolve, hide content), Users (search, suspend with a reason, restore), Content (series,
    episodes, comments; hide and restore), Orders (search, status filter, refund with a reason) and Audit log
    (filter by area). Lists load 20 at a time with "Load more". Hide, suspend and refund ask for a reason in a dialog;
    the API's refusals (coins already spent, already suspended, …) show as a readable message inside the dialog.
    Access: the page asks the API (`GET /admin/overview`); a 403 shows "You do not have access", a guest is asked to
    log in, the demo explains that the admin area needs the real API. The account menu shows "Admin" for accounts
    whose `/me` roles include ADMIN (`StoredUser.roles`). Tests: real test 14 (non-admin refused; hide through a
    report, readers no longer see it, restore; suspend needs a reason; refund refused after coins were spent; audit
    rows with the admin's name) and `e2e/admin.spec.ts` (demo). `npm run test:e2e:real`: 15/15.
  - Notes: a role granted in the database reaches the access token only after the next sign-in or refresh. The
    future account purge must keep `audit_log` rows (the table is append-only and `actor_id` references `users`).
    Layout at 390 px was not checked in a browser: rows wrap and the tab bar scrolls inside its own box.

- [x] **P4-17 System and legal pages**
  - Build: offline page for the installable app, Terms, Privacy, Help (placeholder text, A16); 404 and 500 already
    exist (T44).
  - Depends on: P2-04 (T12)
  - Done when: unknown URLs show the 404 page with search and Home links; the new pages are linked from the footer.
  - Done (2026-11-06): `/terms`, `/privacy` (`legal-page.tsx`: numbered sections with a table of contents), `/help`
    (`help-page.tsx`: six questions in an accordion, contact section at `/help#contact`) and `/offline`
    (`offline-view.tsx`), all in English and Khmer under the `legal` messages, with placeholder text and
    `[PLACEHOLDERS]` for company, dates, prices and the support email (A16). The footer's Help center, Terms,
    Privacy and Contact links now open them (they went to "coming soon" before). The 404 page has a search box
    (opens `/search?q=…`), "Back to Home" and "Browse genres". Installable app: `public/sw.js`, registered in
    production only (`service-worker.tsx`), keeps `/offline` and `/km/offline` (with their style sheets) and shows
    them when a page cannot be loaded; it never touches API calls or other files. Tests: `e2e/system-pages.spec.ts`
    (footer links, table of contents, Khmer, 404 with search and Home, offline page, and the network turned off
    after the first visit shows the offline page); no sideways scroll at 390 and 1440 px.
  - Notes: `/series/nope` and other unknown dynamic URLs show the 404 page but answer HTTP 200 (the same known
    failure of the demo test "404 page" in `e2e/states.spec.ts`); fully unknown paths such as `/no/such/page` answer 404.
    The service worker only works on the production build (`next start`), not in `npm run dev`.

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
24. **Idempotency-Key is required** on unlocks and new orders (8–100 characters, kept 24 hours). A retry with the
    same key gets the first answer back; the same key on a different request is refused with 409
    `idempotency_key_reused`. The reader's wallet row is locked first, so two requests with one key never both run.
25. **Unlocks:** 402 `not_enough_coins` (with `price` and `freeOn`) when the balance is too low; 409
    `episode_not_locked` when the episode is free to read already (also for its creator and admins). Unlocking an
    episode again charges nothing. The creator's earning is the full price (A7: revenue share comes later).
26. **First-purchase bonus** = the pack's own coins (double coins), once per account: on the first order that is
    *paid*. An open order shows the bonus it expects (`first_bonus_coins`, Flyway V3); if another order is paid
    first, this one gets none. The ledger has one PURCHASE row and BONUS rows ("Pack bonus", "First purchase
    bonus") per paid order.
27. **Orders until PayWay (A4):** dev and tests pay with `POST /coins/orders/{number}/simulate`
    (`phumreader.payments.simulator`; production refuses to start with it on, and without PayWay answers 503
    `payments_unavailable`). An unpaid order is `expired` once its 10 minutes are over (stored as EXPIRED when it
    is next changed) and can no longer be paid, like an expired KHQR code. Cancelling twice is fine; 20 new orders
    per reader per hour. The webhook and nightly reconciliation come with PayWay.
28. **Purchase history** is `GET /me/coins/orders` with every status (pending and expired too); the website shows
    the Paid, Failed and Cancelled rows. `GET /me/coins/ledger` lists every coin change.
29. **Test account on Supabase dev:** the real check of part 4 created `part4-check-20261106142851@phumreader.test`
    (demo password) with one paid 10-coin order, one cancelled order, an unlock of Glass Compass 66 and 15 coins.
    Ledger rows are permanent, so it stays; it does not touch the demo reader.
30. **Settings use the website's names and values:** `language` (`en` / `km`), `theme` (`system` / `light` / `dark`,
    as next-themes), `reader` = the store's `novelSettings` (`size` one of 14–24 in steps of 2, `theme`
    `light` / `sepia` / `dark`, `font` `sans` / `serif`, `wide`), `notifications` (`episodes`, `fastPass`).
    `PATCH` changes only the fields sent. Accounts without a settings row read the defaults. Sending notifications
    is P3-16. The display name follows the sign-up rule (2–60 characters after trimming). There is no avatar
    until uploads exist (P3-07): the website keeps showing initials.
31. **Account actions ask for the current password** (change password, change email, delete account); 5 wrong
    ones per account in 10 minutes pause all three with 429. Accounts that only use Google or Facebook (P3-04) have
    no password and set one with "Forgot password" first.
32. **Changing the password** keeps the device that asked signed in and signs out every other device; an email
    tells the account. **Changing the email** sends a 6-digit code (10 minutes, 5 tries, one per 30 seconds; dev
    code 123456) to the new address; the change happens when the code is entered, and the old address is told.
    Pending changes are kept in memory until Step 3 (Redis).
33. **Devices** are sign-ins (refresh-token families) that are neither signed out nor expired, with browser and
    system read from the User-Agent (`null` when unknown; the website names them). These endpoints live under
    `/api/v1/auth` because the refresh cookie is only sent there, which is how the API knows the current device. A
    signed-out device's access token still works for up to 15 minutes.
34. **Deleting the account (A18)** signs out every device and marks it DELETION_PENDING; logging in before
    `deleteAfter` (30 days) keeps it, with an email. Erasing the personal data after 30 days is a worker job that
    is not built yet; the account keeps its email address until then. Creators may delete their account; what
    happens to their series is decided with P3-14 and P3-18.
35. **Creator dashboard:** `creator` comes from `creator_profiles` (not the token's roles), so readers who are not
    creators get `creator: false` with no series, which is the page's empty state. "Readers" is total views;
    earnings are coins from Fast Pass unlocks (payouts are not in v1, A7). Drafts and hidden series are included
    with their `visibility` (the seed has only published ones). "Become a creator" (A11) waits for the Creator
    terms and the writing pages (P3-14).
36. **Test account on Supabase dev:** the real check of part 5 created
    `part5-check-20261106150150@phumreader.test`, now `part5-check-20261106150150-moved@phumreader.test`
    (password `Phumreader2?`), and left it waiting for deletion. The demo reader's settings were put back.
37. **The real API is the default.** `NEXT_PUBLIC_DEMO=1` builds the Phase 1 demo; the setting is read at build
    time, so one build serves one mode. Pages not connected yet keep using the demo data in both modes until their
    part of Step 5.
38. **The session in the website:** the header's name and email stay in localStorage only as a hint (no flash on
    load); on every full page load `GET /me` confirms it, refreshing once if the access token has expired. A
    signed-in call that still gets 401 after the refresh logs the header out. The refresh cookie is HttpOnly, so
    the website cannot tell a guest in advance: a guest's page load costs `GET /me` and a refresh (both 401, shown
    in the browser console). Pages keep fetching in the browser; server-side fetching with revalidate tags (P5-01)
    is not part of Stage 1.
39. **Google and Facebook buttons** say "coming soon" with the real API (P3-04 needs keys, at home).
40. **Unconfirmed accounts:** logging in opens the code step (the API has sent a new code). "Resend code" follows
    the API's 30-second wait.
41. **`/reset?token=`** asks for a new password with the sign-up rules. Success signs this device out locally and
    offers Log in; a used or expired link offers a new one (`/login?mode=forgot`). The page is not indexed. P4-09's
    separate `/signup`, `/verify` and `/forgot` addresses are not built: those views stay in `/login?mode=`.
42. **Demo hints stay** on the sign-in pages (demo account, code 123456): they are true for the dev API as well.
    P5-07 removes them.
43. **New Khmer strings** (sign-in errors, the reset page) need a native speaker's review.
44. **404 status on a cold server:** with Cache Components, the first request for an unknown series or episode
    streams the page's static shell (status 200) and then the not-found content inside it; from the second
    request on the answer is the cached 404. Only the HTTP status of that first request is off; the 404 page
    shows both times. Not caused by Step 5 (the server-side check still reads the demo data, assumption 48);
    the desktop "404 page" Playwright test fails on a freshly started production server and passes after. A fix
    (checking the slug before the Suspense boundary) is left for P5-04.
45. **Test accounts on Supabase dev (Step 5 part 1):** `step5-check-20261106082102@phumreader.test` (password
    `Phumreader2?`) and `step5-unconfirmed-20261106082102@phumreader.test` (demo password).
46. **Catalog values are formatted in the website** (`src/lib/api/catalog.ts`): the API's numbers become "1.6M",
    ISO days "Nov 5, 2026", `updateDay` "Every Sun", `previousRank` "▲ 2" / "▼ 1" / "—" / "NEW"; `useLocalize`
    turns those into Khmer as it did for the demo. A status of `hiatus` shows as ongoing (the pages know ongoing
    and completed); a series without a schedule shows no schedule line and "N episodes"; a missing cover shows
    `public/covers/placeholder.svg`; an age rating other than "all" is shown as the API sends it (teen, mature).
47. **Whole lists are fetched page by page:** the episode list, the rankings and a genre's series are read at the
    API's largest page (100) until `nextCursor` is empty, because the pages show the whole list (the episodes
    tab keeps its own "12 at a time"). Proper paged lists come with P5-02.
48. **Server-side checks still read the demo data:** `generateStaticParams`, `generateMetadata` and the
    server-side 404 for unknown slugs and episode numbers use `src/data` (the seed is the same 48 series). A
    series that exists only in the API would 404 until P5-07 moves these to `BACKEND_URL`. The API's own 404
    answers are handled in the browser (`notFound()`); `?demo=` flags do nothing with the real API.
49. **Locked episodes with the real API:** the reader asks the API; 402 `episode_locked` sends it to the series
    page with the unlock dialog. Until Step 5 part 4 the unlock itself is still the demo (the local store), so
    with the real API a Fast Pass episode stays locked after the demo "unlock" and the reader comes back to the
    dialog; lock icons in the lists also still follow the local store.
50. **Continue reading on Home** is empty with the real API until Step 5 part 3 (`/me/history`).
