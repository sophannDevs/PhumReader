# PhumReader backend design (Spring Boot)

Status: revised B01 decision. The backend is a **separate Spring Boot service**, not part of the Next.js app.
Checklist: `docs/BACKEND_CHECKLIST.md`. The frontend checklist (`docs/CHECKLIST.md`, T01–T53) is finished.

## Decisions

| Topic | Decision |
|---|---|
| Architecture | Two services: the Next.js frontend (repo root, port 3000) and a Spring Boot API (`backend/`, port 8080). One git repository (monorepo) for now. |
| Language / runtime | Java 21 LTS (records, virtual threads). Kotlin is not used. |
| Framework | Spring Boot, latest stable release (exact version pinned in B02): Spring Web MVC, Spring Security, Spring Validation, Spring Data JPA (Hibernate), Spring Session Data Redis, Spring Mail, Spring Boot Actuator |
| Build | Gradle (Kotlin DSL) with the wrapper, `backend/gradlew`. The frontend keeps npm. |
| Database | PostgreSQL 16, Flyway migrations (`backend/src/main/resources/db/migration`), `ddl-auto=validate` |
| Cache / sessions | Redis 7: server-side sessions (Spring Session), rate limits (Bucket4j), view counters |
| Storage | Cloudflare R2 (S3 API) through AWS SDK v2, behind an `ImageStorage` interface; local disk in development |
| Jobs | Spring `@Scheduled` with ShedLock (PostgreSQL lock table) so only one instance runs a job. Heavy work later via a queue if needed. |
| Auth | Own email + password (Argon2id via Spring Security), httpOnly cookie session, Google and Facebook OAuth (Spring Security OAuth2 Client) |
| API contract | REST + JSON under `/api/v1`. springdoc-openapi generates `backend/openapi/openapi.json` (committed). The frontend generates TypeScript types from it with `openapi-typescript`. |
| Payments | KHQR (Bakong) and ABA PayWay (card through the PayWay hosted page). No Stripe. No card fields in this app. |
| Launch scope | Readers only. Creator features (Part 6, B36–B40) are postponed. |
| Email | `MailSender` interface: console log in development, SMTP/provider in production (choose in B09) |
| Tests | JUnit 5, Spring Boot Test, MockMvc, Testcontainers (PostgreSQL and Redis), ArchUnit for layering; Playwright end-to-end from the frontend |
| Code style | Spotless (google-java-format AOSP style) and `./gradlew check` in CI |
| Hosting / region | Open. Decide in B50 (Singapore region preferred for Cambodia). Backend ships as a Docker image. |

## Repository layout

```
/                          Next.js frontend (unchanged location)
  src/ e2e/ design/ docs/
  src/lib/api/             generated schema.d.ts + typed fetch client (B07)
backend/
  build.gradle.kts  settings.gradle.kts  gradlew
  Dockerfile
  openapi/openapi.json     committed API contract
  seed/demo-data.json      copy of src/data/demo-data.json used by the seed runner
  src/main/java/app/phumreader/
    PhumReaderApplication.java
    common/                errors, ApiError, pagination, request id, config, idempotency
    auth/                  signup, verify, login, reset, oauth, sessions
    user/                  profile, settings, roles
    catalog/               series, episodes, chapters, genres, search, rankings
    reader/                reader content, progress
    library/               subscriptions, bookmarks, likes
    comment/
    wallet/                coin wallet, ledger, unlock
    payment/               packs, orders, KHQR, PayWay, webhooks, history, Fast Pass
    notification/          email templates, preferences
    storage/               ImageStorage (R2 / local)
    admin/                 moderation, refunds
  src/main/resources/      application.yml, application-dev.yml, application-prod.yml, db/migration
  src/test/java/…          unit, web and integration tests (Testcontainers)
docker-compose.yml         Postgres + Redis (+ Mailpit for dev email)
```

Package-by-feature. Inside a feature: `web` (controllers + request/response records) → `service` → `repository` / `domain`. Controllers hold no business logic, services never use `HttpServletRequest`, and only the `storage`, `payment` and `notification` adapters talk to outside services. ArchUnit tests enforce this.

## How the two services talk

- **Same origin in every environment.** The browser only calls `/api/v1/...` on the frontend domain.
  - Development: `next.config` rewrites `/api/:path*` to `BACKEND_URL` (default `http://localhost:8080`).
  - Production: the reverse proxy (or the same rewrite) routes `/api` to the backend.
  - Result: the session cookie is first-party, no CORS in the browser, simple CSRF.
- **Session**: `PHUMREADER_SESSION` httpOnly, Secure, SameSite=Lax cookie, session data in Redis.
- **CSRF**: cookie-to-header token (`XSRF-TOKEN` cookie, `X-XSRF-TOKEN` header) on all non-GET calls. The generated client adds it.
- **Contract**: backend is the source of truth. `npm run api:gen` regenerates `src/lib/api/schema.d.ts` from `backend/openapi/openapi.json`; CI fails if the committed file is out of date.
- **Local server-side fetches** from Next.js (server components, `generateMetadata`) call `BACKEND_URL` directly.

## API conventions

- Base path `/api/v1`. JSON only. Dates are ISO 8601 UTC. Ids are UUIDs (series keep their public `slug`).
- Errors always `{ "error": { "code": "snake_case", "message": "…" } }` with the right status (400 validation, 401, 403, 404, 409, 429). Implemented once in a `@RestControllerAdvice`.
- Lists use cursor pagination: `?cursor=&limit=` returning `{ items, nextCursor }`.
- Mutations that move money or grant access (unlock, checkout, webhooks) require an `Idempotency-Key` header and are safe to retry.
- Response shapes follow `src/data/types.ts` and `src/lib/demo-api.ts` so the frontend swaps only its fetch layer.
- Every response carries `X-Request-Id`; it is also in the logs (MDC).
- Validation uses Jakarta Validation on request records; entities are never returned from controllers.

## Demo mode and real mode

- `NEXT_PUBLIC_DEMO=1`: the frontend uses `src/lib/demo-api.ts` and the persisted zustand store, exactly as in Phase 1. It stays the default until B25 makes the switch; B52 removes it from production builds.
- Without the flag: the frontend calls `/api/v1`. Guests keep local state; logged-in users use server state.
- The `?demo=empty|error|slow` flags keep working in development.

## Money rules

- Coin balances change only through `coin_ledger` entries (append-only), in one `@Transactional` unit, with a pessimistic lock on the wallet row. Never update a balance directly.
- Orders: `PENDING → PAID | FAILED | CANCELLED | EXPIRED`. Coins are credited once, on the first transition to PAID.
- Provider webhooks are signature-verified, idempotent and replay-safe.
- Packs, prices and bonuses come from the database (B28), not from the UI.

## Security basics (detail in B45)

Argon2id passwords; server-side sessions; CSRF protection; rate limits on auth, comments and payments; secrets only in environment variables (`.env.example` and `application-dev.yml` hold no real secrets); uploads validated by type and size; method security (`@PreAuthorize`) for roles.

## Commands

```
npm run dev                         frontend, http://localhost:3000
docker compose up -d                Postgres, Redis, Mailpit
cd backend && ./gradlew bootRun     API, http://localhost:8080 (profile dev)
cd backend && ./gradlew check       tests + Spotless + ArchUnit
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,seed'   load demo data
npm run api:gen                     regenerate TypeScript types from the OpenAPI file
```

## What changed from the earlier Next.js-backend plan

| Before | Now |
|---|---|
| `src/app/api/v1` route handlers, `src/server/` | Separate Spring Boot project in `backend/` |
| zod request validation | Jakarta Validation on Java records, plus generated OpenAPI |
| Drizzle ORM + SQL migrations | JPA/Hibernate + Flyway |
| BullMQ worker | `@Scheduled` + ShedLock |
| Vitest API tests | JUnit 5 + Testcontainers |
| Shared zod schemas | OpenAPI → generated TypeScript types |
| 50 tasks | 52 tasks (new: scaffold B02, OpenAPI client B07; Part 1 now has 8 tasks) |

Unchanged: PostgreSQL, Redis, R2, KHQR + PayWay, readers only, the money rules, demo mode, and the frontend.

## Open items

- Email provider (B09), OAuth app credentials (B12), KHQR/PayWay merchant accounts and sandboxes (B29–B30), hosting (B50).
