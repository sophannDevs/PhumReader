# PhumReader

PhumReader (ភូមិ "village" + Reader) is a webtoon-style site for comics and web novels for readers in
Cambodia, in English and Khmer. The website (Next.js) is in the repo root; the Spring Boot API lives in
[`backend/`](backend/README.md) (plan: [docs/BACKEND.md](docs/BACKEND.md), progress:
[docs/BACKEND_CHECKLIST.md](docs/BACKEND_CHECKLIST.md)). The website can run on its own in **demo mode**
(`NEXT_PUBLIC_DEMO=1`: fake data kept in your browser, no backend needed) or against the API.

## Run it

Requires Node 22 or newer and npm. Nothing else is needed for the quickest start, demo mode (about 2 minutes):

```bash
git clone https://github.com/sophannDevs/PhumReader.git && cd PhumReader
npm install
echo "NEXT_PUBLIC_DEMO=1" > .env.local     # works in macOS, Linux, Git Bash and Windows Command Prompt
npm run dev                                # http://localhost:3000  (Khmer: http://localhost:3000/km)
```

Without `NEXT_PUBLIC_DEMO=1` the website talks to the API, so start the API first (next section); with no API
running, the pages show their error state. `.env.example` lists every setting; restart `npm run dev` after changing `.env.local`.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run build` | production build |
| `npm test` | Vitest + Testing Library + MSW: unit and component tests in `src/**/*.test.ts(x)` (forms, dialogs, readers; the API is mocked, no backend needed). `npm run test:watch` re-runs on save |
| `npm run test:e2e` | Playwright tests in demo mode (run `npx playwright install chromium` once; it starts `npm run dev` with `NEXT_PUBLIC_DEMO=1` itself, or reuses a dev server already on port 3000, so stop your own dev server first or it will test that one instead; with `CI=true` it builds and tests the production site, as GitHub does) |
| `npm run api:gen` | TypeScript types `src/lib/api/schema.d.ts` from `backend/openapi/openapi.json` |
| `npm run api:check` | fails when `src/lib/api/schema.d.ts` is out of date |

## Run the backend

Requires Java 21 (for example Temurin 21). Docker is optional: it only runs the local helper services (Redis,
Meilisearch, S3 storage, Mailpit); the API and its tests do not need it.

1. `cp backend/.env.example backend/.env` (Windows Command Prompt: `copy backend\.env.example backend\.env`) and fill
   in `DB_URL`, `DB_USER` and `DB_PASSWORD` from your Supabase project's session pooler (see the comments in the
   file). `backend/.env` is git-ignored. If they are missing the API stops at start-up and names them.
2. `cd backend` then `./gradlew bootRun` (Windows Command Prompt: `gradlew.bat bootRun`): the API starts on
   http://localhost:8080.
3. In another terminal, `npm run dev` in the repo root with `NEXT_PUBLIC_DEMO` unset or `0` in `.env.local`: the website
   forwards `/api/...` to the API (`BACKEND_URL` in `.env.local`, default `http://localhost:8080`). Check:
   http://localhost:3000/api/v1/health shows `{"status":"UP","database":"UP"}`.

To run the API's tests and style checks: `cd backend && ./gradlew check` (no database, no network, no Docker).

Local services (optional, for Redis, search, file storage and email; the API falls back to built-in stand-ins
without them). Pick one way; both use the same ports:

- Docker: `npm run services:docker:up` (stop with `npm run services:docker:down`), see `docker-compose.yml`.
- Homebrew on macOS: `npm run services:start` / `npm run services:stop`.

`npm run services:check` shows whether each service is healthy.

Details and commands: [backend/README.md](backend/README.md). To let other people try the site for $0 (Vercel + a
free Supabase database + the API on your computer behind a tunnel): [docs/STAGING.md](docs/STAGING.md).

## Demo account

- Log in with **reader@toonwave.app** / **Toonwave1!** (the address keeps the project's old working name). The
  seeded API database has the same account.
- Sign up works with any new email; the email code is **123456** (in demo mode and with the dev API, which prints
  emails, such as reset links, in its console).
- "Continue with Google / Facebook": in demo mode it does no OAuth and logs in as Sokha Chan; with the API it says
  "coming soon".
- Coins, unlocks, subscriptions, reading history, purchases and reader settings are kept per browser in
  `localStorage` under `phumreader.app`. Reset everything in **Settings > Reset demo data**, or clear that key.
- Payments are placeholders only (`[PAYMENT PROVIDER FORM]`, `[KHQR PLACEHOLDER]`): use "I've paid (simulate)"
  or "Simulate failed payment" on the payment step. There are no real card fields and prices stay `[PRICE USD]` / `[PRICE KHR]`.

## Demo flags

Add a flag to any page URL to see a state of the fake API (`src/lib/demo-api.ts`, 0.3-0.8 s delay on every call):

- `?demo=empty`: empty lists and contents
- `?demo=error`: every call fails (use Retry; remove the flag first)
- `?demo=slow`: adds 3 s so the skeletons stay visible
- development only: `/coins?expiry=10` shortens the KHQR countdown to 10 seconds

The demo "today" is fixed to 2026-11-05 so schedules and dates are stable.

## Stack

Next.js (App Router, Cache Components) + TypeScript strict, Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react,
next-intl (`en`, `km`; English has no URL prefix, Khmer lives under `/km`), TanStack Query, react-hook-form + zod,
zustand (persisted), sonner, Embla carousel. Fonts through `next/font`: Inter, Kantumruy Pro, Noto Serif.

## Folder structure

```
src/app/[locale]/(site)/     home, series/[slug], coins, library, settings, creator, rankings, genres, search, ...
src/app/[locale]/(reader)/   read/[slug]/[episode], novel/[slug]/[chapter]
src/app/[locale]/(auth)/     login
src/components/ui/           shadcn/ui components
src/components/pr/           PhumReader patterns (SeriesCard, EpisodeRow, UnlockDialog, ...) and page bodies
src/components/layout/       header, footer, tab bar, reader bars, auth layout, search palette
src/components/auth/         login / sign up / verify / forgot views
src/data/                    demo-data.json (the only content source) and typed selectors
src/lib/                     demo-api.ts, store.ts, queries.ts, format.ts, localize.ts, routes.ts
src/lib/api/                 schema.d.ts generated from the backend's OpenAPI file (npm run api:gen)
backend/                     Spring Boot API (Java 21, Gradle), see backend/README.md
src/messages/                en.json, km.json
e2e/                         Playwright tests (spec flows 1-6, demo flags, 404)
design/                      design source of truth (screens, foundations, spec): do not edit
docs/CHECKLIST.md            task checklist, progress and numbered assumptions
```

Demo content (titles, synopses, comments, chapter text) is English in both languages; the interface text is
translated. The Khmer UI strings were written for this demo and have not been reviewed by a native speaker.
