# PhumiReader V2.1 – implementation checklist

Merged on 2026-11-10 from the V2.1 pack checklist (T01–T42) and the finished V1 list (now `docs/CHECKLIST-v1.md`,
53 / 53 done, with its assumptions 1–110 that still apply unless an assumption below replaces them).

One task at a time, in order. Each task: build → `npm run lint && npm run typecheck && npm run build` → tick → commit
`Fxx: …` or `Txx: …`. "Screens" refers to `design/screens/`; "Spec" refers to the section in `design/spec.md`;
"Prototype" refers to `design/prototype-src/<Page>/`.

- Demo logins: reader@phumireader.app / PhumiReader1! · creator@phumireader.app / Creator1! · admin@phumireader.app /
  Admin1! · email code 123456.
- State flags: add `?demo=empty`, `?demo=error` or `?demo=slow` to any page URL.
- Both frontend modes must keep working: demo (`NEXT_PUBLIC_DEMO=1`) and real (the API in `backend/`).

**Work order:** F01–F04 → T14 → F05–F09 → T13 → F10 → T16 → F11 → T18 → F12 → F13 → T21 → F14–F19 → F20–F23 →
T32 → T33 → T34 → F24–F27 → T39–T42. A V2.1 task marked "→ Fnn" is ticked when that Fix task is done.

## Fix: finished V1 work that differs from V2.1

- [ ] F01 Store and demo accounts: every key in Spec §0 "Simulated state" (`subs`, `read`, `pos`, `settings`,
  `readerBg`/`readerWidth`, `novel`, `prefs`, `notifRead`/`notifGone`/`notifPrefs`, `blocked`, `reports`, `myWorks`,
  `reviewNotes`, `welcomeNext`, `helpPrefill`, `receipt`, `legalDoc`) with a persist migration from the V1 keys;
  the three demo accounts with roles; demo orders TW-48213377 (paid) and TW-48190012 (failed). → T03
- [ ] F02 Foundations: `/dev/foundations` page matching screen 00; shadcn components from foundations.md §4 that are
  missing (hand-written on `radix-ui`, no downloads); status badge variants (§8); Khmer dates and times in ICT with
  Khmer month names. → T02, T04
- [ ] F03 Site chrome: logo (done in the upgrade), language pill (shows the other language), coin chip, bell with the
  red unread count, avatar menu (My library, Notifications, Get coins, Creator dashboard, Settings, Log out); header
  nav Home / Rankings / Genres / Web novels (Genres with format=novel); footer columns Read / Create / Help and the
  language switch; tab bar Home / Search / Library / Coins / Me; ≤420 px gaps. Screens 01-home-*. → T05
- [ ] F04 Shared patterns: restyle SeriesCard, ContinueCard, RankRow, EpisodeRow, EmptyState, ErrorState to V2.1; add
  OptionCard, StepsBar, StatCard, Timeline, UndoBar, SaveBar, ListRowActions, ResumeChip, FastPassLockCard. → T06
- [ ] F05 Home: spotlight (main hero + "Featured this week", no autoplay), genre picker → "Recommended for you",
  Daily updates (day tabs with counts, type filter, "New today", 6 cards + "Show all N"), Trending (top 3 larger),
  Browse by genre with counts + "Surprise me", Web novels, creator CTA; states. Spec §1 · Screens 01. → T07
- [ ] F06 Series page: hero with progress line, Episodes tab (Fast Pass card with countdown, toolbar with Go to #,
  grouped list, "Free Nov 26 · in 21 days", badges, "Show 12 more"), About with Report, comments preview → Comments
  page, phone sticky bar, unavailable series state. Spec §2 · Screens 02. → T08
- [ ] F07 Unlock dialog: single (5) or all Fast Pass episodes (15), balance and "after unlocking", log-in hand-off,
  "You need N more coins" → Coins (`shopReturn`, `pendingUnlock`) → reopen. Spec §2, §6. → T09
- [ ] F08 Comic reader: bars with progress, episode list, settings panel (scroll/page, dark/light, full/narrow,
  auto-next, data saver → `settings`), page-by-page taps and ← →, resume chip from `pos`, end of episode (like,
  subscribe, share, report, 5 s auto-next, next card, top comments), Fast Pass lock screen. Spec §3 · Screens 03. → T10, T11
- [ ] F09 Novel reader: settings popover (size, theme, font, spacing; first visit from Settings), progress, resume
  chip, locked chapter teaser + unlock card, chapter end with creator's note and Report. Spec §4 · Screens 04. → T11, T12
- [ ] F10 Log in / Sign up / Forgot on `/login` (`?mode=signup`, `?mode=forgot`; the V1 routes redirect): context
  line, language toggle, Caps Lock warning, Remember me, Google / Facebook / Apple, sign-up name / email (taken
  check) / strength meter / confirm / app language / birth year (under 13 blocked, 13–17 note) / terms, code with
  resend after 30 s, forgot → code → new password; new accounts → `/welcome`. Spec §5 · Screens 05. → T15
- [ ] F11 Coins: steps bar, balance "≈ N Fast Pass episodes", "Almost there" + "Covers it", packs with bonus % and
  "You get N", methods, pay (10-minute countdown, placeholders), processing, success with 5 s auto-return and "Stay
  here", failed / expired, trust notes, history rows → Receipt, FAQ. Spec §6 · Screens 06. → T17
- [ ] F12 My library: tabs Subscribed / Recently read / Unlocked, "New episodes" filter, sort, edit mode with select
  all + remove + 6 s Undo, guest banner, empty states. Spec §8 · Screens 08. → T19
- [ ] F13 Settings: side menu and section cards (Account, Reading, Language and region, Notifications, Privacy and
  safety, Coins and payments, Account actions), inline password change, story languages, blocked accounts, your
  reports, DELETE dialog, save bar. Spec §12 · Screens 12. → T20
- [ ] F14 Search page: landing (recent + trending), tabs with counts, filters (genre, day, sort), highlight, Subscribe
  / Follow, "Did you mean", show more (6), states. Spec §7 · Screens 07. → T22
- [ ] F15 Rankings: lists Trending / Popular / New / Rising, filters (format, genre, period), top 3 cards, movement,
  "How rankings work", show more, empty. Spec §10 · Screens 10. → T23
- [ ] F16 Genres / Web novels on `/genres?g=&format=` (the V1 `/genres/[genre]` redirects): chips with counts, coloured
  banner, filters (format, status, day, sort), "Clear filters (N)", 6/4/3 grid, show more, empty. Spec §11 · Screens 11. → T24
- [ ] F17 Help center: search + popular searches, 6 topic cards, 17 articles with links and "Was this helpful?",
  contact form (topic, email, order number for payments, message 20+, screenshot, ticket T-xxxxx), pre-fill from a
  receipt. Spec §19 · Screens 19. → T25
- [ ] F18 Policies on `/legal/[doc]` (terms, privacy, refund, community, creator; `/terms` and `/privacy` redirect): side
  menu, short version, on this page, numbered sections, template warning, Khmer "coming before launch". Spec §20 · Screens 20. → T26
- [ ] F19 Error pages: 404 (address, did you mean, search, popular), 500 (retry fails once, reference with copy),
  offline (tips, auto return), `/maintenance`, series unavailable; illustration, code badge, en/km toggle. Spec §9 · Screens 09. → T27
- [ ] F20 Creator layout (CreatorNav) + dashboard: stat cards, 14-day chart, My series filters with status-based
  actions, to-do, new comments with reply and like, new-creator 3-step guide. Spec §14 · Screens 14. → T28
- [ ] F21 Create series on `/creator/new`: 4 steps, error summary, autosave draft, tags, cover checklist, publishing,
  submit → in review (`myWorks`, admin queue). Spec §15 · Screens 15. → T29
- [ ] F22 Upload episode on `/creator/upload?series=`: image list (progress, reorder, remove, size errors), novel text
  with word count, release now / scheduled (ICT), Fast Pass, comments, creator's note, checklist, phone preview,
  sticky bar, success. Spec §16 · Screens 16. → T30
- [ ] F23 Manage series `/creator/series/[id]` with tabs (episodes, details, fast-pass, settings), edit / hide /
  delete, changes requested list + resubmit. Spec §21 · Screens 21. → T31
- [ ] F24 AdminShell (dark top bar, side menu with counts) + overview; admin demo login only. Spec §22 · Screens 22-admin-overview. → T35
- [ ] F25 Admin series review (queue, flags, checklist, approve / request changes / reject, `reviewNotes`, undo). Screens 22-admin-series-review. → T36
- [ ] F26 Admin reports (priority, detail, actions, reporter status, undo). Screens 22-admin-reports. → T37
- [ ] F27 Admin payments (refunds with eligibility, paid but no coins → Add coins). Screens 22-admin-payments. → T38

## Phase A – Foundations
- [x] T01 Project setup: Next.js app (npm), Tailwind, shadcn/ui init, lucide, next-intl (en, km), fonts (Inter, Kantumruy Pro, Noto Serif), scripts (typecheck, test:e2e). Copy design/assets → public, demo-data → src/data. Spec §0 (V1 T01–T03; V2.1 data copied in the upgrade)
- [ ] T02 Design tokens + shadcn theme in globals.css; Khmer type rules; add the shadcn components listed in foundations.md §4. Build a `/dev/foundations` page that matches screen 00. Screens 00 → F02
- [ ] T03 Data layer: typed demo-data helpers, `demo-api.ts` (delay + ?demo flags), zustand store with every key in Spec §0 "Simulated state" (prefix `phumireader.`) → F01
- [ ] T04 i18n: generate messages/km.json from design/i18n/km-dictionary.json (`npm run i18n:km`, done in the upgrade), plus a language switch that saves to the store; Khmer date and time formatters (ICT) → F02
- [ ] T05 Layout: SiteHeader (search trigger, language button, coin chip, bell, avatar menu, logo), SiteFooter, MobileTabBar, ⌘K search dialog, toasts. Check the header at 390 px logged in. Screens 01-home-search-open, 01-home-account-menu → F03
- [ ] T06 Shared patterns: SeriesCard, ContinueCard, RankRow, EpisodeRow, OptionCard, StepsBar, StatCard, Timeline, EmptyState, ErrorState, UndoBar, SaveBar → F04

## Phase B – Reading
- [ ] T07 Home (all rows, genre picker, daily updates, states). Spec §1 · Screens 01 → F05
- [ ] T08 Series page: hero, progress, episodes tab (Fast Pass card, toolbar, grouped list), About, comments preview, phone sticky bar. Spec §2 · Screens 02 → F06
- [ ] T09 Unlock flow: single or bundle dialog, log in hand-off, short of coins → Coins → return and reopen (`shopReturn`, `pendingUnlock`). Spec §2, §6 → F07
- [ ] T10 Comic reader: bars, episode list, settings panel, scroll and page modes, resume chip, auto-next, end-of-episode, arrow keys. Spec §3 · Screens 03 → F08
- [ ] T11 Fast Pass lock screen in the comic and novel readers. Screens 03-viewer-locked, 04-novel-locked → F08, F09
- [ ] T12 Novel reader: settings (size, theme, font, spacing; defaults from Settings), resume, chapter end. Spec §4 · Screens 04 → F09
- [ ] T13 Comments page + CommentThread (pinned, spoilers, replies, edit/delete, sort, creator filter). Spec §23 · Screens 23
- [ ] T14 Report and Block dialogs (global), hiding blocked comments. Spec §0 · Screens 02-series-report-comment, 17-creator-profile-report-sent

## Phase C – Account and money
- [ ] T15 Log in / Sign up / code / Forgot / New password (zod rules, demo accounts, returnTo). Spec §5 · Screens 05 → F10
- [ ] T16 First-time setup /welcome (3 steps, real notification permission request, picks). Spec §24 · Screens 24
- [ ] T17 Coins: steps, packs, "Covers it" pre-select, methods, pay (countdown, placeholders), processing, success with auto-return, failed/expired, history, FAQ. Spec §6 · Screens 06 → F11
- [ ] T18 Receipt page (paid / failed / refunded) and Help pre-fill. Spec §25 · Screens 25
- [ ] T19 My library (tabs, filter, sort, edit mode, undo, guest banner). Spec §8 · Screens 08 → F12
- [ ] T20 Settings (all sections, password rules, save bar, delete dialog, blocked accounts, your reports). Spec §12 · Screens 12 → F13
- [ ] T21 Notifications (inbox, groups, read/unread, remove + undo, alert settings) and the header bell count. Spec §13 · Screens 13

## Phase D – Discovery and help
- [ ] T22 Search page (landing, tabs, filters, highlight, did-you-mean, show more). Spec §7 · Screens 07 → F14
- [ ] T23 Rankings. Spec §10 · Screens 10 → F15
- [ ] T24 Genres / Web novels. Spec §11 · Screens 11 → F16
- [ ] T25 Help center (search, topics, articles, feedback, contact form with validation and pre-fill). Spec §19 · Screens 19 → F17
- [ ] T26 Policies /legal/[doc] (5 documents from demo-data `policies`, template warning). Spec §20 · Screens 20 → F18
- [ ] T27 Error pages: not-found, error boundary (retry), offline (online event), maintenance, series unavailable; en/km. Spec §9 · Screens 09 → F19

## Phase E – Creators
- [ ] T28 Creator layout (CreatorNav) + dashboard (stats, chart, My series with status-based actions, to-do, comments, new-creator state). Spec §14 · Screens 14 → F20
- [ ] T29 Create series wizard (4 steps, validation, tags, cover, autosave draft, submit → review). Spec §15 · Screens 15 → F21
- [ ] T30 Upload episode (image list with progress, reorder, size errors; novel text; schedule; Fast Pass; checklist; preview). Spec §16 · Screens 16 → F22
- [ ] T31 Manage series (episodes, details, Fast Pass, settings, changes requested + resubmit). Spec §21 · Screens 21 → F23
- [ ] T32 Creator public profile (reader and owner views, edit, follow, report/block). Spec §17 · Screens 17
- [ ] T33 Earnings (period, stats, chart/table, by series, payouts, add method dialog). Spec §18 · Screens 18
- [ ] T34 Become a creator landing + calculator. Spec §26 · Screens 26

## Phase F – Admin
- [ ] T35 AdminShell + overview (counts, waiting longest, recent decisions); admin demo login only. Spec §22 · Screens 22-admin-overview → F24
- [ ] T36 Admin series review (queue, auto-check flags, checklist, approve / request changes / reject, `reviewNotes`, undo). Screens 22-admin-series-review → F25
- [ ] T37 Admin reports (priority order, detail, actions, reporter status update, undo). Screens 22-admin-reports → F26
- [ ] T38 Admin payments (refunds, paid-but-no-coins). Screens 22-admin-payments → F27

## Phase G – Quality
- [ ] T39 Khmer pass: every page in km at 390/768/1440; no clipped text; `lang="km"`; fix long strings
- [ ] T40 Accessibility pass (keyboard, focus, dialogs, labels, contrast) and reduced motion
- [ ] T41 Playwright e2e for the 6 key flows in Spec "Key flows to test end to end" (and update the V1 tests for the new routes)
- [ ] T42 Final review: no "Toonwave"/"PhumReader" left in the UI, placeholders visible, all ?demo states work, README for running the demo

## Assumptions (V2.1)
(V1 assumptions 1–110 are in docs/CHECKLIST-v1.md. Anything guessed for V2.1 goes here, with the task ID.)

- V2-1 (upgrade) **Series records**: V2.1 series only keep `episodes` (the free ones). `npm run data:sync` writes
  src/data/demo-data.json from design/demo-data.json in the V1 series shape (which the backend seed also reads):
  every series gets 3 Fast Pass episodes after the free ones (`episodeRule`), also the 9 "completed" ones, as in the
  prototype (Glass Compass is "completed" but has Fast Pass on every screen).
- V2-2 (upgrade) **Slugs**: five V2.1 slugs lost characters when generated (`tiny-dragon-caf`, `ember-co`,
  `salt-thunder`, `silk-steel`, `volt-vale`). `src/data/demo.ts` keeps the V1 slugs (`tiny-dragon-cafe`,
  `ember-and-co`, …) so existing links, e2e tests and the backend seed still match.
- V2-3 (upgrade) **Coin pack prices**: the V2.1 packs have no price fields; the app keeps `[PRICE USD]` / `[PRICE KHR]`.
- V2-4 (upgrade) **Old names that stay**: the Java package `app.phumreader`, the backend settings `phumreader.*`, the
  backend seed account `creator@toonwave.app` and the generated `src/lib/api/schema.d.ts` keep the old spelling
  (backend code, out of V2.1 scope).
- V2-5 (upgrade) **Storage**: old `phumreader.*` and `toonwave.*` keys are copied to `phumireader.*` once, in the
  first-paint script (`src/lib/storage-migration.ts`), then removed. `phumreader.` wins over `toonwave.`.
- V2-6 (upgrade) **Khmer strings**: `npm run i18n:km` copies the dictionary's Khmer for every English string that is a
  dictionary entry (109 strings changed); everything else keeps the V1 Khmer.
- V2-7 (upgrade) **No downloads**: missing shadcn components are written by hand on the installed `radix-ui` package
  instead of `npx shadcn add`; charts are plain SVG/CSS (no chart library).
- V2-8 (upgrade) **Real mode**: V2.1 features the API does not have yet (notifications, reports and blocking,
  welcome picks, receipts, earnings, creator profile, admin payments) run on the local store in real mode too.
