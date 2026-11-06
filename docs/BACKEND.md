# PhumReader backend design (Spring Boot)

Status: adopted on 2026-11-06 from the plan doc **"Toonwave V2 – Implementation plan"**
(https://claude.ai/artifact/9bbCmhSxqAbRZeTbjU8QVT, dated 2026-11-05). The plan is the source of truth for
the backend: its stack, task list (P1–P7), assumptions (A1–A22) and acceptance criteria. "Toonwave" in the plan
means PhumReader here.

Two local rules still apply on top of the plan:

1. **No Docker anywhere in this project**: not on development machines (company policy), not in CI, no
   Dockerfile, no Testcontainers. Every service in the plan runs without Docker (see "Local development
   without Docker").
2. **The repository layout stays as it is.** The frontend stays in the repo root with npm; the API lives in
   `backend/` (the plan's `apps/api`); the plan's `packages/api-client` is `src/lib/api/`; the plan's `infra/`
   holds the Cloudflare Worker and deploy files.

Checklist: `docs/BACKEND_CHECKLIST.md`. The frontend checklist (`docs/CHECKLIST.md`, T01–T53) is finished and
covers the plan's Phase 2 and most of Phase 4.

## Decisions

| Topic | Decision (from the plan, adapted where noted) |
|---|---|
| Architecture | Website (Next.js, repo root) calls the API; the API owns every business rule; the website never talks to the database. A worker (same Spring Boot codebase, `worker` profile) processes images, sends notifications and syncs search. Comic images go from R2 through the CDN straight to the browser. |
| Language / runtime | Java 21 LTS, Spring Boot 4.1.2, Gradle 9.8.2. The plan says Spring Boot 3, but 3.5 left free support in June 2026 (last release 3.5.16), so the user chose 4.x on 2026-11-06. |
| Spring modules | Web MVC, Security (OAuth2 client + resource server), Validation, Data JPA, Flyway, Data Redis, Mail, Actuator, springdoc-openapi 3.x |
| Build | Gradle (Kotlin DSL) with the wrapper, `backend/gradlew`. The frontend keeps npm (never pnpm). |
| Database | Supabase, PostgreSQL 17 only: Auth, Storage and Data API off. Projects: `phumreader-dev` (P1-02; created in Tokyo `ap-northeast-1`, fine for development), staging and production in Singapore `ap-southeast-1` (P1-10). The API connects through the pooler; Flyway connects through the direct URL (session pooler when the network has no IPv6). Flyway migrations in `backend/src/main/resources/db/migration`, `ddl-auto=validate`. |
| Cache and jobs | Redis 7: rate limits (Bucket4j), view counters, job queue (Redis Streams), short-lived codes. Scheduled jobs use `@Scheduled` + ShedLock. |
| Files | Cloudflare R2 + CDN through the S3 API (AWS SDK v2). Presigned uploads. A Cloudflare Worker (`infra/image-worker/`) checks a short-lived signed token for paid images; the token is not part of the cache key. |
| Image processing | Worker checks type, size and 800 px width, makes WebP/AVIF variants and thumbnails with libvips (binding chosen in P3-07). |
| Search | Meilisearch, kept in sync through `outbox_events` |
| Auth | Argon2 password hashes; RS256 JWT access token (15 min) and rotating refresh token (30 days, hashed, one per device) in Secure HttpOnly SameSite=Lax cookies; CSRF token for writes; email verification with a 6-digit code (10 min, 5 tries); Google and Facebook login linked by verified email. Tokens never reach JavaScript-readable storage. |
| Roles | READER, CREATOR, ADMIN. Any logged-in reader becomes a creator by accepting the Creator terms (A11). |
| Payments | ABA PayWay for KHQR, ABA Pay and cards (PayWay hosted card page, A5). PhumReader never sees card numbers. 10-minute order expiry, signed webhook, nightly reconciliation. |
| Fast Pass | Per episode: the creator sets the price (3–10 coins) and "free after N days"; default 5 coins, 7 days (A3). No reader subscription plan in v1 (A6). |
| Email | Resend, sender `no-reply@` the final domain (A13). Development: console log, Mailpit Windows binary optional. |
| Notifications | Web push (Firebase Cloud Messaging) + email for new episodes of subscribed series, sent in batches by the worker (A17) |
| API contract | REST + JSON under `/api/v1`. springdoc publishes OpenAPI to `backend/openapi/openapi.json` (committed); `openapi-typescript` generates `src/lib/api/schema.d.ts` (`npm run api:gen`). CI fails if either is stale. |
| Configuration | `.env.example` for both apps; typed config (zod in the website, `@ConfigurationProperties` in the API); secrets only from the environment. An app refuses to start with a missing required setting and names it. |
| Tests | JUnit 5, Spring Boot Test, MockMvc, ArchUnit. `./gradlew check` needs no Docker and no network: Zonky embedded PostgreSQL (real PostgreSQL binaries started by the tests) plus in-memory fakes for Redis, Meilisearch, R2, PayWay, email and push. Testcontainers is not used. |
| CI | Not in Stage 1. Later: GitHub Actions with lint, typecheck, build and `./gradlew check` (no Docker). `main` is protected. |
| Hosting | Not in Stage 1. Later (P7-01): website on Vercel; API and worker on a Singapore host that runs the Spring Boot jar without Docker; Cloudflare DNS, CDN and firewall |
| Monitoring | Sentry (web and API), PostHog with the starter events (A22), uptime checks, alerts |
| Scope | Readers, creators (series, episodes, Fast Pass, scheduling, stats, earnings ledger) and a small admin area. Creator payouts and revenue share are out of scope for v1 (A7). |

## Repository layout

```
/                              Next.js frontend (unchanged location, npm)
  src/ e2e/ design/ docs/
  src/lib/api/                 generated schema.d.ts + fetch wrapper (P1-07, P5-01)
backend/                       Spring Boot API and worker (the plan's apps/api)
  build.gradle.kts  settings.gradle.kts  gradlew  gradlew.bat
  .env.example                 committed; real values in backend/.env (git-ignored)
  openapi/openapi.json         committed API contract
  seed/demo-data.json          copy of src/data/demo-data.json for the seed
  src/main/java/app/phumreader/
    PhumReaderApplication.java
    auth/  user/  series/  episode/  library/  coin/  payment/  comment/
    search/  notification/  media/  admin/  common/  config/
  src/main/resources/          application.yml, application-{dev,test,prod}.yml, db/migration/
  src/test/java/…              unit, web and database tests (embedded PostgreSQL, fakes)
infra/
  image-worker/                Cloudflare Worker for paid image access (Wrangler, TypeScript)
  deploy/                      deploy files (P7)
```

One package per feature. Inside a feature: `web` (controllers + request/response records) → `service` →
`repository` / `domain`. Controllers hold no business logic; entities are never returned from controllers; only
`media`, `payment`, `notification` and `search` adapters talk to outside services. ArchUnit enforces this.

## Main tables (Flyway, PostgreSQL)

| Area | Tables |
|---|---|
| Accounts | users, user_roles, user_identities (Google, Facebook), refresh_tokens (hashed, one family per device), user_settings, creator_profiles, creator_follows |
| Content | genres, series, series_tags, episodes (number, title, status draft / scheduled / published, published_at, free_at + price for Fast Pass, comments on/off), episode_images (order, width, height, storage key), chapter_texts (blocks as JSON), featured_slides (home hero), rankings |
| Reading | subscriptions, reading_progress (last episode, progress, highest episode opened), episode_likes, episode_bookmarks |
| Money | coin_packs, coin_wallets (the locked row; balance = sum of the ledger), payment_orders, coin_ledger (append-only, one row per top-up, bonus, unlock, refund), unlocks, creator_earnings, idempotency_keys |
| Community | comments, comment_likes, reports |
| Operations | push_tokens, outbox_events (search and notification sync), audit_log, shedlock |

Migration: `backend/src/main/resources/db/migration/V1__init.sql`. Indexes from the plan: episodes by series +
number, progress by user, ledger by user + time. Rules the database enforces: the ledger is append-only
(trigger), an order is credited once and an unlock charged once (partial unique indexes), wallet balances never go
below zero, a Fast Pass episode has both a price (3–10) and a free date. Row level security is enabled on every
table with no policies, so nothing leaks if the Supabase Data API is ever turned on; Flyway's own
`flyway_schema_history` is the exception (it only lists migrations). Additions to the plan's list: user_roles,
creator_follows, genres, featured_slides, rankings, episode_bookmarks, coin_wallets, idempotency_keys, shedlock.

Demo content: `./gradlew bootRun --args='--spring.profiles.active=dev,seed'` loads `src/data/demo-data.json`
(copied onto the classpath at build time) with stable ids, so it can run again safely. Accounts that can log in:
`reader@toonwave.app` (3 coins, Continue reading) and `creator@toonwave.app` (Chan Sreyleak, the demo's stand-in
creator); both use the demo password. The demo's two purchase-history rows are not seeded, because they have no
matching ledger entries.

## How the website and the API talk

- **Same site.** In development `next.config` rewrites `/api/:path*` to `BACKEND_URL` (default
  `http://localhost:8080`), so the browser stays same-origin. In production the API is either behind the same
  rewrite or on `api.<domain>` (same site); decided in P7-01. Cookies stay first-party.
- **Cookies**: access token and refresh token in Secure, HttpOnly, SameSite=Lax cookies; the refresh cookie is
  scoped to the refresh path. A reused refresh token logs out that device.
- **CSRF**: cookie-to-header token (`XSRF-TOKEN` cookie, `X-XSRF-TOKEN` header) on every write.
- **Fetch wrapper** (P5-01): sends cookies and the CSRF header, refreshes once silently on 401 and retries,
  throws a typed `ApiError`.
- **Server-side fetches** from Next.js (server components, `generateMetadata`) call `BACKEND_URL` directly and
  use revalidate tags; publishing tells Next.js which pages to refresh (P3-06).

## API conventions

- Base path `/api/v1`. JSON only. Dates ISO 8601 UTC; schedules are stored in UTC and shown in Asia/Phnom_Penh.
  Ids are UUIDs; series keep their public `slug`.
- Errors: `{ "error": { "code": "snake_case", "message": "…", "fields"?: {…} } }`. Status codes: 400
  validation, 401 not logged in, 402 locked episode (with price and free date), 403 forbidden, 404, 409
  conflict, 429 rate limited (with `Retry-After`). One `@RestControllerAdvice`.
- Lists: cursor pagination `?cursor=&limit=` returning `{ items, nextCursor }`, with sort options.
- Catalog answers keep the website's field names (`src/data/types.ts`) but carry raw values (counts as numbers,
  calendar days as ISO dates in Asia/Phnom_Penh, ranking movement as the previous rank); the website's fetch layer
  formats them with its own `formatCount` / `formatDate` (English and Khmer).
- Money and access mutations (unlock, create order, webhooks) take an `Idempotency-Key` and are safe to retry.
- Every response carries `X-Request-Id`, also in the logs (MDC) and in Sentry.
- Validation uses Jakarta Validation on request records.

## Money rules

- Balances come only from `coin_ledger` (append-only). An unlock is one transaction: lock the wallet row, write
  the ledger, write the unlock. The balance is never negative.
- Orders: `PENDING → PAID | FAILED | CANCELLED | EXPIRED` (10-minute expiry). Coins are credited exactly once, even if the
  webhook arrives twice. The webhook is the source of truth; the website polls order status every 3 s.
- Pack prices (USD and KHR) live in `coin_packs` and change without a deploy (A2): packs 10 / 30 / 60 / 120 / 300
  with the designed bonuses.
- Every unlock records the creator's earning in `creator_earnings`; refunds go back through the ledger.

## Local development without Docker

| Plan service (docker-compose in the plan) | Local replacement |
|---|---|
| PostgreSQL 16 | Supabase dev project `phumreader-dev` (PostgreSQL 17, session pooler); local PostgreSQL 17 Windows install only as an offline fallback (`local` profile) |
| Redis 7 | Upstash Redis free database (Singapore, TLS); Memurai (Windows Redis) as the offline fallback |
| Meilisearch | Meilisearch Windows binary (`meilisearch.exe`, master key in `backend/.env`) |
| MinIO (stands in for R2) | An R2 dev bucket; MinIO Windows binary as the offline fallback |
| Mailpit | Email logged to the console; Mailpit Windows binary optional |
| Cloudflare Worker | `wrangler dev` (Node, no Docker) |
| Testcontainers | Not used: `./gradlew check` uses Zonky embedded PostgreSQL and fakes |
| Docker images | None: no Dockerfile in this project |

Supabase rules:

- The API connects as the table owner. The transaction pooler (port 6543) does not support prepared statements,
  so use the session pooler (IPv4, port 5432, user `postgres.<project-ref>`, SSL). The direct connection is
  IPv6-only unless the IPv4 add-on is bought.
- Free projects pause after a week idle, are capped at 500 MB and have no backups: fine for `phumreader-dev`.
  Staging and production use the Pro plan with point-in-time recovery (P7-03).
- The database password lives only in `backend/.env` (git-ignored) and in each platform's secret store.

## Demo mode

`NEXT_PUBLIC_DEMO=1` keeps the frontend on `src/lib/demo-api.ts` and the persisted zustand store until P5-07.
P5-07 replaces the mocks page by page and removes them (the plan's acceptance: no mock imports remain, grep check
in CI). From then on the states are tested with MSW (P6-02) and the key flows on staging (P6-03).

## Commands

```
npm run dev                          frontend, http://localhost:3000
cd backend && ./gradlew bootRun      API, http://localhost:8080 (profile dev)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,worker'   API + worker
cd backend && ./gradlew check        tests, Spotless, ArchUnit, OpenAPI drift check (no Docker, no network)
cd backend && ./gradlew spotlessApply   format the Java code
cd backend && ./gradlew exportOpenApi   rewrite backend/openapi/openapi.json from the running code
npm run api:gen                      TypeScript types from backend/openapi/openapi.json
npm run api:check                    fail if src/lib/api/schema.d.ts is out of date
```

## History

| Date | Change |
|---|---|
| 2026-11-05 | B01: backend plan in Next.js route handlers, then switched to a separate Spring Boot service (B01–B52) |
| 2026-11-06 | B01 revised: no Docker on dev machines, Supabase PostgreSQL, no Redis |
| 2026-11-06 | Replaced by the plan doc: task ids P1–P7, JWT + refresh cookies instead of server sessions, Redis, Meilisearch, R2 image Worker, ABA PayWay for all payment methods, per-episode Fast Pass, creators and admin in scope. Kept: no Docker on dev machines, Supabase, `backend/` folder, npm. |
| 2026-11-06 | Stage 1 agreed (project setup, database, every existing page on the real API; no deployment). No Docker anywhere in the project, also not in CI. Spring Boot 4.1.2 instead of 3.x. |

## Open items

From the plan's assumptions; "Blocks launch" rows must be closed before Phase 7: coin prices (A2), PayWay
merchant account (A4), Khmer translations (A12), domain (A15), legal and tax (A16). Also needed earlier: Google
and Facebook apps (A14, P3-04), Resend account (A13), Firebase project (P3-16), Upstash and R2 accounts (P1-02).
