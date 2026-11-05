# PhumReader web – frontend only, demo data

PhumReader (ភូមិ "village" + Reader) is a webtoon-style site for comics and web novels,
for readers in Cambodia (English + Khmer). This phase builds the complete FRONTEND only. There is no backend.

## Brand name
- The site name is **PhumReader**. The design files still say "Toonwave" (old working name):
  replace it with "PhumReader" everywhere in the UI, metadata, copy and code names.
- Logo: green mark (same as the design) + wordmark "Phum" in --brand-ink/green and "Reader" in --foreground;
  Khmer ភូមិ may appear small under it. Short name for the app icon: "Phum".
- Tagline: "Read and share stories in Khmer and English."
- localStorage keys use the prefix "phumreader." (not "toonwave.").

## Stack
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui (Radix) + lucide-react icons
- next-intl (locales: en, km)
- react-hook-form + zod for forms
- TanStack Query for data loading (against the fake API)
- zustand (+ persist to localStorage) for simulated app state
- sonner for toasts
- Fonts via next/font: Inter, Kantumruy Pro (Khmer), Noto Serif (novel reader option)
- Package manager: npm (do NOT use pnpm or yarn). Node 22 LTS or newer (dev machine: Node 24, Windows).
- Create the app with: npx create-next-app@latest . (TypeScript, ESLint, Tailwind, App Router, src/ dir)
  If it refuses because the folder is not empty, create it in a temporary sibling folder and move
  the generated files in. Never delete or overwrite CLAUDE.md, .claude/ or design/.
- Add a "typecheck": "tsc --noEmit" script to package.json.

## Design source of truth (read before every UI task)
- design/screens/*.png — V2 screens, desktop (1440 px) and phone (390 px), plus key states
- design/foundations.md — colors, fonts, spacing, radius, shadows, component mapping, icons
- design/spec.md — every page, every button, every state, routes, key flows
- design/demo-data.json — the ONLY source of demo content
- design/assets/ — cover and panel artwork (copy to public/covers and public/panels)

Match layout, colors, typography, spacing and components exactly. Do not invent new colors,
sizes or components. If something is missing from the design, use the closest existing
pattern and list it under "Assumptions" in docs/CHECKLIST.md.

Key tokens: --primary #00DC64, --primary-foreground #04210F (never white text on green),
--brand-ink #047A3A, zinc neutrals, --radius 10px, Inter + Kantumruy Pro.

## Scope rules
- Phase 1 (frontend, docs/CHECKLIST.md, finished): NO database, backend, real API, real payments, real auth or deployment.
- Phase 2 (backend, docs/BACKEND_CHECKLIST.md, design in docs/BACKEND.md): a real backend is allowed only as
  described there, one Bxx task at a time. Demo mode (`NEXT_PUBLIC_DEMO=1`, demo-api.ts, local store) must keep working until B50.
  The rules below that say "demo" describe Phase 1 and demo mode.
- All content comes from design/demo-data.json (copied to src/data/). Keep it consistent everywhere.
- Every "server" call goes through src/lib/demo-api.ts:
  - adds a 300–800 ms delay
  - supports URL flags ?demo=empty, ?demo=error, ?demo=slow so every state can be seen
- Login, coins, subscriptions, unlocks, reading progress, purchases and reader settings live in a
  zustand store persisted to localStorage (see "Simulated state" in design/spec.md).
- Payments: simulate KHQR / ABA Pay / card. Show [PAYMENT PROVIDER FORM] and [KHQR PLACEHOLDER]
  placeholders only. Never build real card number fields. Prices stay [PRICE USD] / [PRICE KHR].
- Demo login: reader@toonwave.app / Toonwave1! — email code 123456.

## Folder structure
src/app/[locale]/(site)/        home, series/[slug], coins, library, settings, creator, …
src/app/[locale]/(reader)/      read/[slug]/[episode], novel/[slug]/[chapter]
src/app/[locale]/(auth)/        login
src/components/ui/              shadcn components (generated)
src/components/pr/              PhumReader patterns: SeriesCard, EpisodeRow, UnlockDialog, CoinChip …
src/components/layout/          SiteHeader, SiteFooter, MobileTabBar, reader bars, AuthSplitLayout
src/data/                       demo-data.json + typed helpers
src/lib/                        demo-api.ts, store.ts, utils, formatters
src/messages/                   en.json, km.json
docs/CHECKLIST.md               implementation checklist (source of progress)

## Working rules
- Work on ONE task from docs/CHECKLIST.md at a time, then stop and summarise.
- Every page needs loading, empty, error and success states where relevant (design/spec.md).
- Responsive: check every page at 390 px (phone), 768 px (tablet) and 1440 px (desktop).
  No horizontal scrolling from 320 px to 1920 px.
- Accessibility: visible focus ring, keyboard works for every control, dialogs trap focus,
  images have alt text, Khmer text has lang="km".
- After each task, all of these must pass:
  npm run lint && npm run typecheck && npm run build
- Then tick the task in docs/CHECKLIST.md and commit: "T05: <short description>".
- Never delete or rewrite design/ files.

## Commands
npm install          install dependencies
npm run dev          start the dev server (http://localhost:3000)
npm run lint         ESLint
npm run typecheck    tsc --noEmit
npm run build        production build
npm run test:e2e     Playwright tests for the key flows (added later in the checklist)
npx shadcn@latest add <component>   add a shadcn/ui component
