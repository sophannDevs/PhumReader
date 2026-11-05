# PhumReader backend design

Status: approved decisions for Phase 2 (task B01). Checklist: `docs/BACKEND_CHECKLIST.md`.

## Decisions

| Topic | Decision |
|---|---|
| Architecture | Inside this Next.js app. Route handlers in `src/app/api/v1/`, server code in `src/server/`. A separate worker process (`src/server/worker.ts`) for jobs. |
| Language / runtime | TypeScript (strict), Node 22 LTS or newer, npm |
| Database | PostgreSQL 16, Drizzle ORM, SQL migrations in `drizzle/` |
| Cache / sessions | Redis 7 (sessions, rate limits, view counters) |
| Storage | Cloudflare R2 (S3 API) behind an `images` adapter; local disk in development |
| Jobs | BullMQ on Redis |
| Validation | zod for every request and response; schemas shared with the frontend in `src/server/schemas/` |
| Auth | Own email + password (argon2), httpOnly secure cookie sessions, Google and Facebook OAuth (B10) |
| Payments | KHQR (Bakong) and ABA PayWay (card through the PayWay hosted page). Stripe is not used. No card fields in this app. |
| Launch scope | Readers only. Creator features (Part 6, B34–B38) are postponed. |
| Email | Adapter: console in development, a transactional provider in production (choose in B07) |
| Tests | Vitest (unit + API against a test database), Playwright (end-to-end) |
| Hosting / region | Open. Decide in B48 (Singapore region preferred for Cambodia). |

## Folder layout

```
src/app/api/v1/          route handlers (thin: parse, call a service, respond)
src/server/
  env.ts                 zod-validated environment
  db/                    drizzle client, schema/, queries
  services/              business logic (auth, wallet, unlock, payments …)
  adapters/              email, images, payment providers, oauth (swappable, fakeable in tests)
  schemas/               zod request/response schemas
  lib/                   errors, logging, rate limit, idempotency
  worker.ts              BullMQ worker entry
drizzle/                 generated SQL migrations
scripts/                 seed.ts and other one-off scripts
```

Rules: route handlers contain no business logic; services never import from `next/*`; adapters are the only code that talks to outside services.

## API conventions

- Base path `/api/v1`. JSON only. Dates are ISO 8601 UTC.
- Errors always `{ "error": { "code": "snake_case", "message": "…" } }` with the right status (400 validation, 401, 403, 404, 409, 429).
- Lists use cursor pagination: `?cursor=&limit=` returning `{ items, nextCursor }`.
- Mutations that move money or grant access (unlock, checkout, webhooks) require an `Idempotency-Key` and are safe to retry.
- Response shapes match `src/data/types.ts` and `src/lib/demo-api.ts`, so the frontend only swaps its fetch layer.
- Every response carries `x-request-id`; it is also in the logs.

## Demo mode and real mode

- `NEXT_PUBLIC_DEMO=1`: the app uses `src/lib/demo-api.ts` and the persisted zustand store, exactly as in Phase 1. This stays the default until B23 makes the switch possible and B50 removes it from production.
- Without the flag: the frontend calls `/api/v1`. Guests keep local state; logged-in users use server state.
- The `?demo=empty|error|slow` flags keep working in development.

## Money rules

- Coin balances change only through `coin_ledger` entries (append-only), in a transaction, under a row lock. Never update a balance directly.
- Orders: `Pending → Paid | Failed | Cancelled | Expired`. Coins are credited once, on the first transition to Paid.
- Provider webhooks are verified, idempotent and replay-safe.
- No prices are hard-coded in the UI: packs and bonuses come from the database (B26).

## Security basics (detail in B43)

Passwords hashed with argon2id; sessions server side; CSRF protection on cookie-authenticated mutations; rate limits on auth, comments and payments; secrets only in environment variables (`.env.example` is the only committed env file); uploads validated by type and size.

## Open items

- Email provider (B07), OAuth app credentials (B10), KHQR/PayWay merchant accounts and sandboxes (B27–B28), hosting (B48).
