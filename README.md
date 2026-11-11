# PhumiReader

PhumiReader (ភូមិReader; ភូមិ means "village") is a webtoon-style site for comics and web novels for readers in
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

- Log in with **reader@phumireader.app** / **PhumiReader1!**. The seeded API database has the same account. In demo
  mode there are also **creator@phumireader.app** / **Creator1!** and **admin@phumireader.app** / **Admin1!** (opens
  `/admin`); the API's seeded creator is `creator@toonwave.app` / `PhumiReader1!` (backend/README.md).
- Sign up works with any new email; the email code is **123456** (in demo mode and with the dev API, which prints
  emails, such as reset links, in its console).
- "Continue with Google / Facebook / Apple": in demo mode it does no OAuth and logs in as Sokha Chan; with the API it
  says "coming soon".
- Coins, unlocks, subscriptions, reading history, purchases, settings, reports, your series and admin decisions are
  kept per browser in `localStorage` under `phumireader.app` (old `phumreader.*` / `toonwave.*` keys are moved there
  once). To start over, delete that key (or the site data) in the browser's developer tools.
- Payments are placeholders only (`[PAYMENT PROVIDER FORM]`, `[KHQR PLACEHOLDER]`): use "I've paid (simulate)"
  or "Simulate failed payment" on the payment step. There are no real card fields and prices stay `[PRICE USD]` / `[PRICE KHR]`.

## Demo flags

Add a flag to any page URL to see a state of the fake API (`src/lib/demo-api.ts`, 0.3-0.8 s delay on every call):

- `?demo=empty`: empty lists and contents
- `?demo=error`: every call fails (use Retry; remove the flag first)
- `?demo=slow`: adds 3 s so the skeletons stay visible
- development only: `/coins?expiry=10` shortens the KHQR countdown to 10 seconds

The demo "today" is fixed to 2026-11-05 so schedules and dates are stable (the admin area shows Tuesday, Nov 10, so
its waiting times read naturally).

## Try the demo

With `NEXT_PUBLIC_DEMO=1`, one browser can play every part:

- **Reader** (reader@phumireader.app): Home → a series → a locked Fast Pass episode → Coins (simulated payment) →
  back to the unlocked episode; Library, Notifications, Settings, Help; report a comment.
- **Creator** (creator@phumireader.app): `/creator` → New series (4 steps, "in review") → Manage series → Upload
  episode; Earnings and the public profile.
- **Admin** (admin@phumireader.app): `/admin` → Series review (approve / request changes), Reports, Payments. Every
  decision has a 6-second Undo. Log out and back in as the creator or reader to see the result.
- **Khmer:** the language button in the header (or `/km/...`). **States:** add `?demo=empty`, `?demo=error` or
  `?demo=slow` to any page. **Design reference:** `/dev/foundations` (development only).

## Stack

Next.js (App Router, Cache Components) + TypeScript strict, Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react,
next-intl (`en`, `km`; English has no URL prefix, Khmer lives under `/km`), TanStack Query, react-hook-form + zod,
zustand (persisted), sonner. Fonts through `next/font`: Inter, Kantumruy Pro, Noto Serif.

## Folder structure

```
src/app/[locale]/(site)/     home, series/[slug], search, rankings, genres, coins, library, notifications, settings,
                             help, legal/[doc], creators/[handle], creators/join, creator (studio), welcome, ...
src/app/[locale]/(reader)/   read/[slug]/[episode], novel/[slug]/[chapter]
src/app/[locale]/(auth)/     login (?mode=signup), verify, reset
src/app/[locale]/(admin)/    admin, admin/series, admin/reports, admin/payments
src/components/ui/           shadcn/ui components
src/components/pr/           PhumiReader patterns (SeriesCard, EpisodeRow, UnlockDialog, ...) and page bodies
src/components/layout/       header, footer, tab bar, reader bars, auth layout, search palette
src/components/auth/         login / sign up / verify / forgot views
src/data/                    demo-data.json (the only content source) and typed selectors
src/lib/                     demo-api.ts, store.ts, queries.ts, format.ts, localize.ts, routes.ts
src/lib/api/                 schema.d.ts generated from the backend's OpenAPI file (npm run api:gen)
backend/                     Spring Boot API (Java 21, Gradle), see backend/README.md
src/messages/                en/<namespace>.json, km/<namespace>.json, merged by the generated index.ts
e2e/                         Playwright tests (the 6 key flows, creator and admin tools, demo flags, 404);
                             real.spec.ts runs against the API (npm run test:e2e:real)
design/                      V2.1 design pack (screens, prototype-src, foundations, spec, i18n): do not edit
docs/CHECKLIST.md            V2.1 task checklist, progress and assumptions (docs/CHECKLIST-v1.md: finished V1 list)
scripts/                     data:sync (design → src/data), i18n:km (Khmer dictionary → km.json), services
```

Demo content (titles, synopses, comments, chapter text) is English in both languages; the interface text is
translated. Khmer UI strings come from `design/i18n/km-dictionary.json` (`npm run i18n:km`) where it has them;
none of it has been reviewed by a native speaker yet.

After changing `design/demo-data.json`, run `npm run data:sync`. After changing `src/messages/en/*.json`, run
`npm run i18n:km` (or `npm run i18n:km -- <namespace>`); after adding or removing a namespace file, `npm run i18n:index`.
