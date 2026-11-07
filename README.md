# PhumReader

PhumReader (ភូមិ "village" + Reader) is a webtoon-style site for comics and web novels for readers in
Cambodia, in English and Khmer. The Spring Boot API lives in [`backend/`](backend/README.md)
(plan: [docs/BACKEND.md](docs/BACKEND.md), progress: [docs/BACKEND_CHECKLIST.md](docs/BACKEND_CHECKLIST.md)).
**The website is moving onto it page by page (Stage 1 Step 5)**: sign-in and the catalog (Home, Rankings,
Genres, Search, series pages, both readers) already use the API; the library, coins, comments, settings and
creator pages still use the demo data until their part is done. Set `NEXT_PUBLIC_DEMO=1` in `.env.local` to run the whole
Phase 1 demo without a backend.

## Run it

Requires Node 22 or newer and npm.

```bash
npm install
npm run dev          # http://localhost:3000  (Khmer: http://localhost:3000/km)
```

`npm run dev` talks to the API (start it first, see below). Without a backend, put `NEXT_PUBLIC_DEMO=1` in
`.env.local` (see `.env.example`) and restart `npm run dev`.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run build` | production build |
| `npm run test:e2e` | Playwright tests in demo mode (start with `npx playwright install chromium` once; it starts `npm run dev` with `NEXT_PUBLIC_DEMO=1` itself, or reuses a dev server already on port 3000) |
| `npm run api:gen` | TypeScript types `src/lib/api/schema.d.ts` from `backend/openapi/openapi.json` |
| `npm run api:check` | fails when `src/lib/api/schema.d.ts` is out of date |

## Run the backend

No Docker is needed or used. Requires Java 21 (for example Temurin 21).

1. `copy backend\.env.example backend\.env` and fill in the Supabase session pooler settings (see the comments in
   the file). `backend/.env` is git-ignored.
2. `cd backend` then `gradlew.bat bootRun` (Git Bash: `./gradlew bootRun`): the API starts on http://localhost:8080.
3. `npm run dev` in the repo root: the website forwards `/api/...` to the API (`BACKEND_URL` in `.env.local`,
   default `http://localhost:8080`). Check: http://localhost:3000/api/v1/health shows `{"status":"UP","database":"UP"}`.

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
