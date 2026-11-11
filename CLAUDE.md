# PhumiReader web – V2.1 frontend (demo data) + Phase 2 backend

PhumiReader (ភូមិReader: ភូមិ means "village") is a webtoon-style site for comics and web novels, for readers in
Cambodia, in Khmer and English. The frontend follows the **V2.1 design pack** in `design/` (frontend only, demo data).
A separate Spring Boot API lives in `backend/` (Phase 2, see "Scope rules").

## Brand
- English name: **PhumiReader**. Khmer name: **ភូមិReader**. Never use "Toonwave" or "PhumReader" in the UI. Those are
  old names; if you find them in UI code or copy, replace them. (The Java package `app.phumreader`, the backend
  settings `phumreader.*` and the plan doc title keep the old spelling; renaming them is not part of V2.1.)
- Logo: green mark + "Phumi" (foreground) + "Reader" (brand-ink green; `--primary` on dark bars). In Khmer: "ភូមិ" + "Reader".
- Example domain: phumireader.app. localStorage keys use the prefix `phumireader.` (old `phumreader.` / `toonwave.`
  keys are copied over once by `src/lib/storage-migration.ts`).

## Stack
- Next.js (App Router) + TypeScript (strict), Tailwind CSS, shadcn/ui (Radix), lucide-react.
- next-intl with locales `en` and `km`. `src/messages/km.json` is built from `design/i18n/km-dictionary.json`
  (draft; native review needed before launch).
- react-hook-form + zod, TanStack Query (demo API or real API), zustand + persist, sonner.
- Fonts via next/font: Inter, Kantumruy Pro (Khmer), Noto Serif (novel reader option).
- Package manager: **npm** only (no pnpm or yarn). Node 22 LTS or newer. The dev machine runs Windows.
- No new npm or Gradle libraries without asking (office PC: no downloads). shadcn components that are missing are
  written by hand on top of the installed `radix-ui` package instead of `npx shadcn add`.

## Design source of truth (read before every UI task)
- `design/spec.md`: the section for the page you are building (routes, states, flows).
- `design/foundations.md`: tokens, components and patterns, including section 8 (V2.1 additions).
- `design/screens/NN-*-desktop.png` and `-phone.png`: match these at 1440 px and 390 px.
- `design/prototype-src/<Page>/`: exact markup (`body.html`), styles (`page.css`) and behaviour (`page.js`). When the
  spec is unclear, the prototype wins. Rebuild in React; don't paste the prototype code.
- `design/demo-data.json`: the **only** source of demo content. Copied to `src/data/`.
- `design/assets/`: copied to `public/covers` and `public/panels`.

Match layout, colours, type and spacing exactly. Don't invent colours, sizes or components. If something is missing,
use the closest existing pattern and add it under "Assumptions" in docs/CHECKLIST.md.
Key tokens: `--primary #00DC64`, `--primary-foreground #04210F` (never white text on green), `--brand-ink #047A3A`,
zinc neutrals, `--radius 10px`.

## Scope rules
- **Frontend (V2.1, docs/CHECKLIST.md):** demo data, no real payments, no deployment.
  - Every "server" call in demo mode goes through `src/lib/demo-api.ts`: 300–800 ms delay, plus the URL flags
    `?demo=empty`, `?demo=error` and `?demo=slow`.
  - All app state (user, coins, subs, unlocks, reading position, settings, reports, blocked, my works, admin
    decisions…) lives in a zustand store persisted to localStorage. See "Simulated state" in design/spec.md.
  - Payments: simulate KHQR, ABA Pay and card. Show only `[PAYMENT PROVIDER FORM]` and `[KHQR PLACEHOLDER]`. Never
    build real card fields. Keep every placeholder listed in foundations.md §8 visible.
  - Demo logins: reader@phumireader.app / PhumiReader1! · creator@phumireader.app / Creator1! ·
    admin@phumireader.app / Admin1! (opens /admin) · email code 123456.
  - Policy pages are draft templates. Keep the "have a lawyer review" warning.
- **Backend (Phase 2, docs/BACKEND_CHECKLIST.md, design in docs/BACKEND.md):** follows the plan doc "Toonwave V2 –
  Implementation plan" (https://claude.ai/artifact/9bbCmhSxqAbRZeTbjU8QVT; Toonwave = PhumiReader). A separate
  **Spring Boot** API (Java 21, Gradle; Supabase PostgreSQL, Redis, Meilisearch, Cloudflare R2, ABA PayWay) in
  `backend/`, built one plan task (P1-01 … P7-05) at a time, starting with "Stage 1" in the checklist. Docker is
  allowed only for the optional local helper services (`docker-compose.yml`: Redis, Meilisearch, S3 storage (RustFS),
  Mailpit; `npm run services:docker:up`). Still no Dockerfile, no Testcontainers and no Docker in CI: `./gradlew check`
  and the tests need no Docker.
  - The frontend has two modes, chosen at build time: demo (`NEXT_PUBLIC_DEMO=1`: demo-api.ts and the local store)
    and real (the API through `src/lib/api`). Both must keep working. V2.1 features that the API does not have yet
    run on the local store in real mode too; list them under "Assumptions".
  - Backend commands (settings in `backend/.env`, git-ignored): `cd backend && ./gradlew bootRun`,
    `cd backend && ./gradlew check`, `npm run api:gen` (TypeScript types from backend/openapi/openapi.json).
  - A backend task is done when its acceptance criteria pass and `./gradlew check` passes (plus lint/typecheck/build
    if the frontend changed), then commit "<task id>: <short description>", e.g. "P3-02: sign-in core".

## Folder structure
```
src/app/[locale]/(site)/       home, series, search, library, rankings, genres, coins, settings,
                               notifications, help, legal, creators, welcome …
src/app/[locale]/(reader)/     read/[slug]/[episode], novel/[slug]/[chapter]
src/app/[locale]/(auth)/       login
src/app/[locale]/(creator)/    creator, creator/new, creator/upload, creator/series/[id], creator/earnings
src/app/[locale]/(admin)/      admin, admin/series, admin/reports, admin/payments
src/components/ui/             shadcn (generated or hand-written on radix-ui)
src/components/pr/             PhumiReader patterns (SeriesCard, EpisodeRow, UnlockDialog, ReportDialog,
                               CommentThread, StepsBar, OptionCard, Timeline, FastPassLockCard, StatCard …)
src/components/layout/         SiteHeader, SiteFooter, MobileTabBar, ReaderBars, CreatorNav, AdminShell, AuthSplitLayout
src/data/                      demo-data.json + typed helpers
src/lib/                       demo-api.ts, store.ts, utils, formatters (dates in ICT, Khmer month names)
src/lib/api/                   the real API client (the only place that may call fetch)
src/messages/                  en.json, km.json
docs/CHECKLIST.md              the V2.1 task list and progress (docs/CHECKLIST-v1.md: the finished V1 list)
e2e/                           Playwright tests for the key flows in design/spec.md
backend/                       Spring Boot API (Phase 2)
```

## Working rules
- Work on ONE task from docs/CHECKLIST.md at a time, then stop and summarise (unless the user asks for a batch).
- Every data page needs loading, empty, error and success states.
- Responsive at 390, 768 and 1440 px, with no horizontal scrolling from 320 to 1920 px. Check the header at 390 px
  while logged in.
- Accessibility: visible focus, keyboard access for every control, dialogs that trap focus, alt text, `lang="km"` on
  Khmer text, and contrast ≥ 4.5:1.
- Every visible string goes through next-intl (en + km). No hard-coded UI text.
- After each task, all of these must pass: `npm run lint && npm run typecheck && npm test && npm run build`.
- Then tick the task in docs/CHECKLIST.md and commit: `T12: <short description>` (V2.1 task ids; `F01:` for the
  "Fix:" tasks).
- Never delete or rewrite anything in design/.

## Harness Multi-Agent Architecture
This project is configured with the **Harness AI** framework (`revfactory/harness`):
- **Agents** (`.claude/agents/`, `.agents/agents/`):
  - `frontend-developer`: Next.js 16, React 19, Tailwind CSS, Zustand, i18n
  - `backend-developer`: Spring Boot, Java 21, Gradle, Supabase, Redis
  - `qa-verifier`: Playwright E2E testing, API boundary coherence, type & lint verification
- **Skills** (`.claude/skills/`, `.agents/skills/`):
  - `phumreader-orchestrator`: Pipeline & Producer-Reviewer coordinator
  - `playwright-qa`: Targeted & full E2E test executions, trace diagnostics
  - `api-sync`: OpenAPI schema sync and contract enforcement
  - `harness`: Meta-skill for agent team engineering and updates
  - `harness-evolve`: Retrospective feedback and harness improvement
- **Verification Trigger**: After fixing any defect or adding a flow, always execute Playwright tests (`npx playwright test e2e/<file>.spec.ts` or `npm run test:e2e`).

## Commands
```
npm install            install dependencies
npm run dev            dev server (http://localhost:3000)
npm run lint           ESLint
npm run typecheck      tsc --noEmit
npm run build          production build
npm test               Vitest component + unit tests (jsdom, MSW mocks the API)
npm run test:e2e       Playwright key flows in demo mode (dev server, NEXT_PUBLIC_DEMO=1)
npm run test:e2e:real  Playwright key flows against the local backend on :8080 (builds the app in real mode)
npm run api:gen        TypeScript types from backend/openapi/openapi.json
```
