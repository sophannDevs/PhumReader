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
T32 → T33 → T34 → F24–F27 → T39–T42 (all done 2026-11-11) → T43 → T44 → T45. A V2.1 task marked "→ Fnn" is ticked
when that Fix task is done.

## Fix: finished V1 work that differs from V2.1

- [x] F01 Store and demo accounts: every key in Spec §0 "Simulated state" (`subs`, `read`, `pos`, `settings`,
  `readerBg`/`readerWidth`, `novel`, `prefs`, `notifRead`/`notifGone`/`notifPrefs`, `blocked`, `reports`, `myWorks`,
  `reviewNotes`, `welcomeNext`, `helpPrefill`, `receipt`, `legalDoc`) with a persist migration from the V1 keys;
  the three demo accounts with roles; demo orders TW-48213377 (paid) and TW-48190012 (failed). → T03
- [x] F02 Foundations: `/dev/foundations` page matching screen 00; shadcn components from foundations.md §4 that are
  missing (hand-written on `radix-ui`, no downloads); status badge variants (§8); Khmer dates and times in ICT with
  Khmer month names. → T02, T04
- [x] F03 Site chrome: logo (done in the upgrade), language pill (shows the other language), coin chip, bell with the
  red unread count, avatar menu (My library, Notifications, Get coins, Creator dashboard, Settings, Log out); header
  nav Home / Rankings / Genres / Web novels (Genres with format=novel); footer columns Read / Create / Help and the
  language switch; tab bar Home / Search / Library / Coins / Me; ≤420 px gaps. Screens 01-home-*. → T05
- [x] F04 Shared patterns: restyle SeriesCard, ContinueCard, RankRow, EpisodeRow, EmptyState, ErrorState to V2.1; add
  OptionCard, StepsBar, StatCard, Timeline, UndoBar, SaveBar, ListRowActions, ResumeChip, FastPassLockCard. → T06
- [x] F05 Home: spotlight (main hero + "Featured this week", no autoplay), genre picker → "Recommended for you",
  Daily updates (day tabs with counts, type filter, "New today", 6 cards + "Show all N"), Trending (top 3 larger),
  Browse by genre with counts + "Surprise me", Web novels, creator CTA; states. Spec §1 · Screens 01. → T07
- [x] F06 Series page: hero with progress line, Episodes tab (Fast Pass card with countdown, toolbar with Go to #,
  grouped list, "Free Nov 26 · in 21 days", badges, "Show 12 more"), About with Report, comments preview → Comments
  page, phone sticky bar, unavailable series state. Spec §2 · Screens 02. → T08
- [x] F07 Unlock dialog: single (5) or all Fast Pass episodes (15), balance and "after unlocking", log-in hand-off,
  "You need N more coins" → Coins (`shopReturn`, `pendingUnlock`) → reopen. Spec §2, §6. → T09
- [x] F08 Comic reader: bars with progress, episode list, settings panel (scroll/page, dark/light, full/narrow,
  auto-next, data saver → `settings`), page-by-page taps and ← →, resume chip from `pos`, end of episode (like,
  subscribe, share, report, 5 s auto-next, next card, top comments), Fast Pass lock screen. Spec §3 · Screens 03. → T10, T11
- [x] F09 Novel reader: settings popover (size, theme, font, spacing; first visit from Settings), progress, resume
  chip, locked chapter teaser + unlock card, chapter end with creator's note and Report. Spec §4 · Screens 04. → T11, T12
- [x] F10 Log in / Sign up / Forgot on `/login` (`?mode=signup`, `?mode=forgot`; the V1 routes redirect): context
  line, language toggle, Caps Lock warning, Remember me, Google / Facebook / Apple, sign-up name / email (taken
  check) / strength meter / confirm / app language / birth year (under 13 blocked, 13–17 note) / terms, code with
  resend after 30 s, forgot → code → new password; new accounts → `/welcome`. Spec §5 · Screens 05. → T15
- [x] F11 Coins: steps bar, balance "≈ N Fast Pass episodes", "Almost there" + "Covers it", packs with bonus % and
  "You get N", methods, pay (10-minute countdown, placeholders), processing, success with 5 s auto-return and "Stay
  here", failed / expired, trust notes, history rows → Receipt, FAQ. Spec §6 · Screens 06. → T17
- [x] F12 My library: tabs Subscribed / Recently read / Unlocked, "New episodes" filter, sort, edit mode with select
  all + remove + 6 s Undo, guest banner, empty states. Spec §8 · Screens 08. → T19
- [x] F13 Settings: side menu and section cards (Account, Reading, Language and region, Notifications, Privacy and
  safety, Coins and payments, Account actions), inline password change, story languages, blocked accounts, your
  reports, DELETE dialog, save bar. Spec §12 · Screens 12. → T20
- [x] F14 Search page: landing (recent + trending), tabs with counts, filters (genre, day, sort), highlight, Subscribe
  / Follow, "Did you mean", show more (6), states. Spec §7 · Screens 07. → T22
- [x] F15 Rankings: lists Trending / Popular / New / Rising, filters (format, genre, period), top 3 cards, movement,
  "How rankings work", show more, empty. Spec §10 · Screens 10. → T23
- [x] F16 Genres / Web novels on `/genres?g=&format=` (the V1 `/genres/[genre]` redirects): chips with counts, coloured
  banner, filters (format, status, day, sort), "Clear filters (N)", 6/4/3 grid, show more, empty. Spec §11 · Screens 11. → T24
- [x] F17 Help center: search + popular searches, 6 topic cards, 17 articles with links and "Was this helpful?",
  contact form (topic, email, order number for payments, message 20+, screenshot, ticket T-xxxxx), pre-fill from a
  receipt. Spec §19 · Screens 19. → T25
- [x] F18 Policies on `/legal/[doc]` (terms, privacy, refund, community, creator; `/terms` and `/privacy` redirect): side
  menu, short version, on this page, numbered sections, template warning, Khmer "coming before launch". Spec §20 · Screens 20. → T26
- [x] F19 Error pages: 404 (address, did you mean, search, popular), 500 (retry fails once, reference with copy),
  offline (tips, auto return), `/maintenance`, series unavailable; illustration, code badge, en/km toggle. Spec §9 · Screens 09. → T27
- [x] F20 Creator layout (CreatorNav) + dashboard: stat cards, 14-day chart, My series filters with status-based
  actions, to-do, new comments with reply and like, new-creator 3-step guide. Spec §14 · Screens 14. → T28
- [x] F21 Create series on `/creator/new`: 4 steps, error summary, autosave draft, tags, cover checklist, publishing,
  submit → in review (`myWorks`, admin queue). Spec §15 · Screens 15. → T29
- [x] F22 Upload episode on `/creator/upload?series=`: image list (progress, reorder, remove, size errors), novel text
  with word count, release now / scheduled (ICT), Fast Pass, comments, creator's note, checklist, phone preview,
  sticky bar, success. Spec §16 · Screens 16. → T30
- [x] F23 Manage series `/creator/series/[id]` with tabs (episodes, details, fast-pass, settings), edit / hide /
  delete, changes requested list + resubmit. Spec §21 · Screens 21. → T31
- [x] F24 AdminShell (dark top bar, side menu with counts) + overview; admin demo login only. Spec §22 · Screens 22-admin-overview. → T35
- [x] F25 Admin series review (queue, flags, checklist, approve / request changes / reject, `reviewNotes`, undo). Screens 22-admin-series-review. → T36
- [x] F26 Admin reports (priority, detail, actions, reporter status, undo). Screens 22-admin-reports. → T37
- [x] F27 Admin payments (refunds with eligibility, paid but no coins → Add coins). Screens 22-admin-payments. → T38

## Phase A – Foundations
- [x] T01 Project setup: Next.js app (npm), Tailwind, shadcn/ui init, lucide, next-intl (en, km), fonts (Inter, Kantumruy Pro, Noto Serif), scripts (typecheck, test:e2e). Copy design/assets → public, demo-data → src/data. Spec §0 (V1 T01–T03; V2.1 data copied in the upgrade)
- [x] T02 Design tokens + shadcn theme in globals.css; Khmer type rules; add the shadcn components listed in foundations.md §4. Build a `/dev/foundations` page that matches screen 00. Screens 00 → F02
- [x] T03 Data layer: typed demo-data helpers, `demo-api.ts` (delay + ?demo flags), zustand store with every key in Spec §0 "Simulated state" (prefix `phumireader.`) → F01
- [x] T04 i18n: generate messages/km.json from design/i18n/km-dictionary.json (`npm run i18n:km`, done in the upgrade), plus a language switch that saves to the store; Khmer date and time formatters (ICT) → F02
- [x] T05 Layout: SiteHeader (search trigger, language button, coin chip, bell, avatar menu, logo), SiteFooter, MobileTabBar, ⌘K search dialog, toasts. Check the header at 390 px logged in. Screens 01-home-search-open, 01-home-account-menu → F03
- [x] T06 Shared patterns: SeriesCard, ContinueCard, RankRow, EpisodeRow, OptionCard, StepsBar, StatCard, Timeline, EmptyState, ErrorState, UndoBar, SaveBar → F04

## Phase B – Reading
- [x] T07 Home (all rows, genre picker, daily updates, states). Spec §1 · Screens 01 → F05
- [x] T08 Series page: hero, progress, episodes tab (Fast Pass card, toolbar, grouped list), About, comments preview, phone sticky bar. Spec §2 · Screens 02 → F06
- [x] T09 Unlock flow: single or bundle dialog, log in hand-off, short of coins → Coins → return and reopen (`shopReturn`, `pendingUnlock`). Spec §2, §6 → F07
- [x] T10 Comic reader: bars, episode list, settings panel, scroll and page modes, resume chip, auto-next, end-of-episode, arrow keys. Spec §3 · Screens 03 → F08
- [x] T11 Fast Pass lock screen in the comic and novel readers. Screens 03-viewer-locked, 04-novel-locked → F08, F09
- [x] T12 Novel reader: settings (size, theme, font, spacing; defaults from Settings), resume, chapter end. Spec §4 · Screens 04 → F09
- [x] T13 Comments page + CommentThread (pinned, spoilers, replies, edit/delete, sort, creator filter). Spec §23 · Screens 23
- [x] T14 Report and Block dialogs (global), hiding blocked comments. Spec §0 · Screens 02-series-report-comment, 17-creator-profile-report-sent

## Phase C – Account and money
- [x] T15 Log in / Sign up / code / Forgot / New password (zod rules, demo accounts, returnTo). Spec §5 · Screens 05 → F10
- [x] T16 First-time setup /welcome (3 steps, real notification permission request, picks). Spec §24 · Screens 24
- [x] T17 Coins: steps, packs, "Covers it" pre-select, methods, pay (countdown, placeholders), processing, success with auto-return, failed/expired, history, FAQ. Spec §6 · Screens 06 → F11
- [x] T18 Receipt page (paid / failed / refunded) and Help pre-fill. Spec §25 · Screens 25
- [x] T19 My library (tabs, filter, sort, edit mode, undo, guest banner). Spec §8 · Screens 08 → F12
- [x] T20 Settings (all sections, password rules, save bar, delete dialog, blocked accounts, your reports). Spec §12 · Screens 12 → F13
- [x] T21 Notifications (inbox, groups, read/unread, remove + undo, alert settings) and the header bell count. Spec §13 · Screens 13

## Phase D – Discovery and help
- [x] T22 Search page (landing, tabs, filters, highlight, did-you-mean, show more). Spec §7 · Screens 07 → F14
- [x] T23 Rankings. Spec §10 · Screens 10 → F15
- [x] T24 Genres / Web novels. Spec §11 · Screens 11 → F16
- [x] T25 Help center (search, topics, articles, feedback, contact form with validation and pre-fill). Spec §19 · Screens 19 → F17
- [x] T26 Policies /legal/[doc] (5 documents from demo-data `policies`, template warning). Spec §20 · Screens 20 → F18
- [x] T27 Error pages: not-found, error boundary (retry), offline (online event), maintenance, series unavailable; en/km. Spec §9 · Screens 09 → F19

## Phase E – Creators
- [x] T28 Creator layout (CreatorNav) + dashboard (stats, chart, My series with status-based actions, to-do, comments, new-creator state). Spec §14 · Screens 14 → F20
- [x] T29 Create series wizard (4 steps, validation, tags, cover, autosave draft, submit → review). Spec §15 · Screens 15 → F21
- [x] T30 Upload episode (image list with progress, reorder, size errors; novel text; schedule; Fast Pass; checklist; preview). Spec §16 · Screens 16 → F22
- [x] T31 Manage series (episodes, details, Fast Pass, settings, changes requested + resubmit). Spec §21 · Screens 21 → F23
- [x] T32 Creator public profile (reader and owner views, edit, follow, report/block). Spec §17 · Screens 17
- [x] T33 Earnings (period, stats, chart/table, by series, payouts, add method dialog). Spec §18 · Screens 18
- [x] T34 Become a creator landing + calculator. Spec §26 · Screens 26

## Phase F – Admin
- [x] T35 AdminShell + overview (counts, waiting longest, recent decisions); admin demo login only. Spec §22 · Screens 22-admin-overview → F24
- [x] T36 Admin series review (queue, auto-check flags, checklist, approve / request changes / reject, `reviewNotes`, undo). Screens 22-admin-series-review → F25
- [x] T37 Admin reports (priority order, detail, actions, reporter status update, undo). Screens 22-admin-reports → F26
- [x] T38 Admin payments (refunds, paid-but-no-coins). Screens 22-admin-payments → F27

## Phase G – Quality
- [x] T39 Khmer pass: every page in km at 390/768/1440; no clipped text; `lang="km"`; fix long strings
- [x] T40 Accessibility pass (keyboard, focus, dialogs, labels, contrast) and reduced motion
- [x] T41 Playwright e2e for the 6 key flows in Spec "Key flows to test end to end" (and update the V1 tests for the new routes)
- [x] T42 Final review: no "Toonwave"/"PhumReader" left in the UI, placeholders visible, all ?demo states work, README for running the demo

## After V2.1 (added 2026-11-11)
Follow-ups found after T42. The API work for V2.1 features that only save on the device is in
docs/BACKEND_CHECKLIST.md, "V2.1 API additions" (V21-01 … V21-07).
- [x] T43 Badges 22 px tall with 8 px side padding, like the prototype's `.badge` (ours: 20 px, 6 px). Check the rows
  and cards that line badges up with text at 390 and 1440 px.
- [ ] T44 Khmer: native review of every `km` string (launch blocker A12), and decide the digits: numbers filled into
  messages print Latin digits, while the dictionary's fixed strings use Khmer digits (V2-61). Apply the decision
  everywhere (one formatter, not per page).
- [ ] T45 Real-API e2e for the V2.1 screens: `e2e/real.spec.ts` still describes V1 (V2-63). Work started on branch
  `p1-01-readme-and-startup-check` ("Port the real-API tests to the redesigned components"). Needs the backend
  running (home PC). Key flows 3 and 4 also need V21-04 and V21-01. → P6-03

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
- V2-5 (upgrade) **Storage**: old `phumreader.*` and `toonwave.*` keys are copied to `phumireader.*` once
  (`src/lib/storage-migration.ts`, run by StoreHydrator before the store loads), then removed. `phumreader.` wins
  over `toonwave.`. There is no first-paint script any more (the site is light only), which also ends React's
  "script tag" console error on client navigations.
- V2-6 (upgrade) **Khmer strings**: `npm run i18n:km` copies the dictionary's Khmer for every English string that is a
  dictionary entry (109 strings changed); everything else keeps the V1 Khmer.
- V2-7 (upgrade) **No downloads**: missing shadcn components are written by hand on the installed `radix-ui` package
  instead of `npx shadcn add`; charts are plain SVG/CSS (no chart library).
- V2-8 (upgrade) **Real mode**: V2.1 features the API does not have yet (notifications, reports and blocking,
  welcome picks, receipts, earnings, creator profile, admin payments) run on the local store in real mode too.
- V2-9 (F01) **Store field names**: one persisted object (`phumireader.app`, version 2). The spec's keys map to
  `subs` → `subscriptions`, `read` → `lastRead`, `novel` → `novelSettings`; `receipt` and `legalDoc` are URL
  params (`/coins/orders/[id]`, `/legal/[doc]`). Extra keys for prototype state: `welcomed`, `recentSearches`,
  `profile`, `payoutSet`, `draftSeries`, `adminLog`. Version 1 data migrates (new keys get defaults; the demo
  purchase rows get TW-48213377 / TW-48190012).
- V2-10 (F01) **Demo roles**: reader → READER; creator → READER + CREATOR; admin (moderator) → READER + CREATOR +
  ADMIN, so the moderator can also open creator pages. Accounts made by sign up are readers.
- V2-11 (F01) **Order numbers** are `TW-` + 8 digits (V1 Assumption 10 used `PR-`). The two demo rows stay
  display-only and don't end the first-purchase offer.
- V2-12 (F03) **Light only**: the site no longer follows the OS dark mode (foundations.md "Light theme only"). The
  stored theme (light / dark / system, synced with the API) is the *reader* theme from Settings > Reading.
- V2-13 (F03) **Header**: an "Admin" item is added to the avatar menu for admin accounts (not in the design, which
  only shows the reader menu). The phone Search tab opens the Search page (V1 opened the ⌘K palette).
- V2-14 (F03) **Footer social buttons** (Facebook, Telegram, YouTube) go to `/coming-soon?topic=…` until the real
  pages exist.
- V2-15 (F05) **Series hooks**: the one-line hooks under titles ("Recommended for you", Web novels) are not in
  demo-data.json; `src/data/hooks.ts` holds the prototype's 26 hooks, other series use "An ongoing {genre} story, new
  every {day}." (demo content, English in both languages).
- V2-16 (F05) **Spotlight tags** come from `homeHero` in the demo data ("Season 2", "New episode", "Web novel"), not
  the prototype's longer wording ("Season 2 is here", …). The spotlight is hidden while the feed fails or is empty.
- V2-17 (F05) **Daily updates** now get every series per weekday from the feed (V1 filled short days with UP series,
  Assumption 59). In real mode the counts are whatever the API's home feed returns per day.
- V2-18 (F04/F05) **Shared V2.1 primitives** live in `src/components/pr/v2-primitives.tsx` (StateBox, Chip,
  Segmented, Eyebrow, SectionHead, `phoneSwipeRow`). SeriesCard, ContinueCard and RankRow follow the V2.1 classes;
  OptionCard, StepsBar, StatCard, Timeline, UndoBar, SaveBar, ListRowActions, ResumeChip and FastPassLockCard are
  built with the first page that uses them. Buttons: `lg` is 44 px / 22 px padding / 15 px text / 10 px radius.
- V2-19 (F02) **/dev/foundations** is a developer reference (screen 00) built from the real components. It renders only
  in development builds (404 in production) and is English only, like V1's `/dev/kit`.
- V2-20 (i18n) **Messages per namespace**: `src/messages/<locale>/<namespace>.json`, merged by the generated
  `src/messages/<locale>/index.ts` (`npm run i18n:index`); `npm run i18n:km [-- <namespace>…]` works per namespace.
- V2-21 (T14) **Report and Block** is one app-wide dialog (`ReportProvider` in `src/lib/query.tsx`, `useReport()`).
  Reports are stored locally (`reports`, case numbers R-20481 up) in both modes; callers can also send them to the
  API (`onSend`, used for comments in real mode). Blocking is local (`blocked`); the API has no block list yet.
- V2-22 (F06) **Series details come from the data**: Glass Compass shows "Completed" (its `status`; the prototype hard-codes
  "Ongoing"); tags are built from the data (#genre, #format, #language); the sidebar moves under the tabs below 1024 px.
- V2-23 (F06) **Unavailable series**: `?demo=unavailable` on any series page in the demo; in real mode a 404 for a series
  that is still in the reader's subscriptions. Similar series: same genre first, then trending comics.
- V2-24 (F06) **Fast Pass countdown and Up next**: a Fast Pass episode's `date` is its free date, counted from the pinned
  demo today (real mode: today in ICT). "Up next" is the episode after the last one read; the phone sticky bar shows once
  the whole hero is out of view.
- V2-25 (F07) **Bundle unlock**: one demo call plus store updates; the real API unlocks each episode in turn (episodes
  already unlocked stay unlocked if one fails), then the reader opens the first one. Coins needed = one episode's price.
- V2-26 (T13) **Comments page data**: demo `commentThreads`, shared by every series and episode; creator comments take the
  series' creator name. Posted comments, replies, edits and deletes last for the visit (prototype); likes persist. Real
  mode: the API's latest 50 comments (post, like, delete, report); replies, edits, spoilers and pins are visit-only.
- V2-27 (F11) **Coins**: pack and method cards stay RadioGroup cards (arrow keys); history shows the 6 newest orders; an
  expired demo KHQR code adds a Failed row; a demo order's time is the pinned date plus the real ICT time of day.
  Placeholders stay English on Khmer pages.
- V2-28 (T18) **Receipt**: spending takes the oldest coins first (TW-48213377: 15 spent / 18 unused, as in the
  prototype). States: paid, failed, refunded (demo: `?status=refunded`), cancelled, pending (real mode), not found.
  "Download receipt" is a placeholder toast. Real mode reads `GET /coins/orders/{number}`.
- V2-29 (F12) **Library**: a new demo login starts with no subscriptions or unlocks (the prototype shows 10 demo
  subscriptions). Recently read = the demo continue-reading entries plus series opened on this device; removing hides
  them (`historyHidden`). New-episode counts per series follow the prototype (UP series: id % 3 + 1).
- V2-30 (T21) **Notifications** run on the store in both modes; notification text is English demo content in Khmer too;
  quiet hours default to 10:00 PM – 7:00 AM (the design screen shows 12:00 AM twice, a prototype select bug).
- V2-31 (F13) **Settings save**: account, reading, region, story languages and privacy switches go through the save bar;
  language, blocking, password, photo, download and account actions apply at once. Text size presets A− A A+ A++ =
  16/18/20/22 px in the novel reader. Real mode: name, photo, password, email, devices, log out everywhere and delete use
  the API (delete also asks for the password); reader theme, text size and two push switches sync to /me/settings; the
  rest stays on the device. V1 "Reset demo data" is gone (not in V2.1); demo "Delete account" clears this device's data.
- V2-32 (F10) **Auth chrome**: /login and /reset show the site header and footer but no phone tab bar (screens 05-*).
  /signup, /forgot and /verify redirect to /login?mode=… (query kept); the step lives in `?mode=`.
- V2-33 (F10) **Forgot password**: the demo resets with a 6-digit code on /login (V2.1 design); the real API emails a
  link, so real mode shows "Check your inbox" and /reset?token= opens the new-password step. A demo reset saves the new
  password as an account on this device (the demo accounts' own passwords keep working).
- V2-34 (F10) **Sign-up checks**: all 4 password rules; birth year is checked in the form only (the API has no field);
  the three demo emails and accounts made on this device count as taken. Apple sign-in is simulated in the demo and
  "coming soon" in real mode. The 3-try lock is demo only (the API answers 429 after 5 tries).
- V2-35 (F10) **Who gets /welcome**: new sign-ups (also an unconfirmed real-mode login confirmed with the code); social
  logins count as existing accounts.
- V2-36 (T16) **/welcome** has its own top bar (no site header, footer or tab bar), is not gated, and uses the screens'
  3-segment bar with "Step N of 3". Picks come from the demo catalogue in both modes; in real mode "+ Add" subscribes
  through the API. A granted notification permission also turns on push for new episodes.
- V2-37 (F08) **Reader unlocks**: the lock screen's "Unlock for 5 coins" / "Unlock all N" open the shared unlock
  dialog to confirm (the prototype spends at once); "Get coins" and "Log in" go straight to Coins / Log in and the dialog
  reopens on return. Buying coins from a reader returns to that reader page. A locked episode opened by URL shows the lock
  screen (V1 redirected); in real mode a 402 has no panels, so the blurred art is the episode thumbnail.
- V2-38 (F08) **Reader details**: auto-next starts once per episode at 97 % (or the last page) and never opens a locked
  episode; data saver asks for half-width images; top comments are the reader's own new comments then the 3 most liked;
  the episode list and settings popovers stay dark on the light background.
- V2-39 (F09) **Novel reader**: until its Aa popover is used (`novelCustom`), size and theme follow Settings; the lock
  card also offers "Unlock all" when 2 or more chapters are locked; there is no comments block (spec §4 and the
  prototype end a chapter without it). Reading time comes from the text.
- V2-40 (F14) **Search**: the demo searches the whole catalogue; the real API returns at most 20 results, which the page
  tabs, filters and sorts. Creators come from the results; Follow uses the store's `follows` in both modes. Only Enter,
  a recent / trending / genre click or arriving with `?q=` saves a recent search. "Did you mean" = closest title by edit
  distance. Subscribe asks logged-out readers to log in.
- V2-41 (F15) **Rankings**: series come from the rankings query; all four lists are ordered on the page with the
  prototype's fixed demo numbers (reads per period, views, growth %, movement) until the API supports lists, periods and
  genres. "Last update 9:00 AM" is static.
- V2-42 (F16) **Genres**: `/genres?g=<Genre>&format=comic|novel` (`g` also accepts a slug); status, day and sort are page
  state; `/genres` opens on All genres. The banner count ignores filters (prototype). Series pages link genres here.
- V2-43 (F17) **Help**: articles are translated in the `help` namespace (topics and links from demo data); the contact
  form is simulated in both modes (no support API), ticket T-xxxxx is random, screenshots stay in the browser, "Was this
  helpful?" votes are not saved. Prototype page names map to routes (Shop → /coins, Settings → /settings#…, …).
- V2-44 (F18) **Policies**: policy text stays English (`lang="en"`) on Khmer pages; the ខ្មែរ chip says the Khmer version
  comes before launch. Unknown documents show the 404 (HTTP 200 when streamed, as for series).
- V2-45 (F19) **Error pages**: the language toggle switches the site language on the same address; "Did you mean" is
  the closest series to the address; 500 retry re-renders (demo: the first retry fails, the second works); the reference
  is TW-500-<digest>; `/demo/crash` (demo only) shows the 500 page. /offline now uses the site layout with a small inline
  script for when the service worker serves it without JS. /maintenance is a normal page (nothing switches the site into
  maintenance); "Notify me" is local.
- V2-46 (F20) **Creator studio**: CreatorNav (`src/components/layout/creator-nav.tsx`) picks the tab from the address
  (Manage counts as Dashboard). Demo readers see "Become a creator"; accepting adds the CREATOR role on this device. Real
  mode is unchanged (POST /creator). /creator/series redirects to /creator and keeps `?notice=`.
- V2-47 (F20) **Dashboard data**: demo rows are store `myWorks`; stats, the 14-day chart and comments use the
  prototype's values. Real mode: rows from /creator/series and totals from /creator/dashboard ("All time", no change
  %); chart and comments stay demo data. Draft rows list what the work is actually missing; the greeting follows the ICT
  time of day.
- V2-48 (T32) **Creator profiles**: every creator name in the demo series has `/creators/<slug>`; unknown handles are a
  404 (except the signed-in creator's own `?view=owner`). Followers = the series' subscribers summed; Follow uses store
  `follows`; owner edits are saved with the handle. Profiles run on demo data in both modes.
- V2-49 (T33) **Earnings**: demo numbers in both modes (default period 6 months); published works share 94 % of coins;
  `payoutSet` starts false (warning + "On hold"); the chosen payout method is not stored.
- V2-50 (T34) **Become a creator**: logged out, "Sign up and start creating" goes to sign up with returnTo /creator/new;
  the calculator uses range inputs (readers 10–2000, episodes 1–12) × the Fast Pass price.
- V2-51 (F24) **Admin area**: a `(admin)` route group with AdminShell (no site chrome). Demo checks `isAdmin(user)`;
  real mode asks GET /admin/overview (403 for non-admins). Demo shows "Tuesday, Nov 10" (the queues' waiting times
  are relative to it); the rest of the app stays pinned to Nov 5. The "Prototype data" badge reads "Demo data".
- V2-52 (F24) **Admin decisions**: every decision goes into store `adminLog` with a 6 s Undo bar and a toast; real-mode
  API calls are sent when the Undo window closes (closing the tab within 6 s loses the decision). V1 Users, Content,
  All orders and Audit log stay as extra real-mode menu items (no Undo); demo hides them.
- V2-53 (F25) **Series review**: queue = `adminSeriesQueue` + `myWorks` with status "review" (demo data and store in both
  modes). Series submitted on this device are auto-checked for contact details and similar titles (not watermarks).
  Approve → "published" (clears notes); Request changes → "changes" + `reviewNotes[id]` (items as text in the admin's
  language); Reject → "draft" (prototype).
- V2-54 (F26) **Reports**: demo queue = `adminReportQueue` + the reader's own "In review" reports (their content isn't
  stored, so it shows "(Content as reported)"). Real mode maps remove / warn / suspend to the API's settle "hide" (or
  "resolve") with the action as the note, and No violation to "dismiss"; the API has no timed suspension.
- V2-55 (F27) **Payments**: demo rows come from the prototype (`src/lib/admin.ts`); Add coins adds to this device's wallet
  (one device plays reader and admin). Real mode lists paid orders with eligibility and refunds after a reason;
  "Paid but no coins" is hidden (no such API list).
- V2-56 (F21) **Create series** on `/creator/new` (V1 `/creator/series/new` redirects, keeping the query): the draft
  autosaves to store `draftSeries` ("new" or the work id; `?draft=C3` continues the dashboard draft). Demo: the cover
  is a sample cover from the catalogue ("Demo: a sample cover was added"); Submit adds the work to `myWorks` with status
  "review". Real mode: Save draft creates/updates the series as a draft, Submit publishes it (the API has no review
  step) and the cover is a real upload; the second genre, 16+ vs 18+, "Both" languages, more than one update day, the
  release time and Fast Pass stay in the local draft (no API fields).
- V2-57 (F22) **Upload episode** on `/creator/upload?series=<id>` (`&ep=<n>` edits; V1 episode routes redirect). Demo: the
  series list is `myWorks` minus drafts; images are the creator's own files with a simulated upload (the real width is
  checked: 690–1600 px); publishing adds one to the work's episode count; Save draft only marks it saved. Real mode
  sends the panels, or the novel text as blocks (blank line = paragraph, "# " heading, "> " quote, "* * *" scene
  break). Fast Pass is 5 coins and free for everyone 7 days after release (prototype Manage > Fast Pass).
- V2-58 (F23) **Manage series** `/creator/series/[id]` with `?tab=episodes|details|fast-pass|settings` (V1 `…/edit` redirects
  to the details tab). Demo: the episode list is generated from the work (`demoEpisodes`); the changes come from
  `reviewNotes[id]` (each with "Mark fixed"), else the two automatic-check items; Resubmit sets the status back to
  "review". Episode edits, story status, break message, extra update days, Fast Pass, comments and hiding the series
  last for the visit. Real mode: GET/PUT the series and episodes, DELETE drafts, hiding the series unpublishes it; the
  API can't hide one episode or delete a series (not shown) and doesn't store the series-wide Fast Pass or comments.
- V2-59 (F23) On phones the prototype's flex-wrap pushes the cover above long Fast Pass rows; we keep the cover beside
  the title on every row (same content, steadier layout).
- V2-60 (F04) **ListRowActions** is built into each list's rows (admin queue, upload image list, Manage episodes, Library
  edit mode) with the shared tokens, rather than as one component; every other pattern in F04 is a shared component.
- V2-61 (T39) **Khmer pass**: every page in km at 390 / 768 / 1440 checked by script for sideways scroll, clipped text and
  `lang="km"` (also Khmer text inside English pages): no problems. The only boxes that overflow are decorative (series
  header backdrop, Home spotlight cover, the cover fan on Log in at 768 px). Numbers filled into messages print in Latin
  digits in Khmer (the CLDR default for km), while the dictionary's fixed strings use Khmer digits ("៣០ ថ្ងៃ"): left for
  the native review to decide.
- V2-62 (T40) **Accessibility pass**: axe-core (WCAG 2.0/2.1 A + AA) on every page at 1440 and 390 px (en) and 1440 px
  (km), plus a keyboard check of the dialogs (focus moves in, Tab stays inside, Escape returns focus). Fixed: the
  accessible name now contains the visible text on Search, both language switches (which also had the wrong `lang`),
  comment likes, Subscribe/Add and Fast Pass episode rows; Library tabs always have a panel; warning text is #92400e
  (prototype `.alert.warn`, was 80 % and 4.4:1). Left as is: axe's experimental label-in-name rule still flags the
  avatar initials and the ⌘K hint (both aria-hidden) and Khmer labels (it matches whole words; Khmer has no spaces).
- V2-63 (T41) **e2e**: the 6 key flows are in e2e/flows.spec.ts (1, 2, 5, 6) and e2e/admin-flows.spec.ts (3, 4); the V1
  demo tests are rewritten for the V2.1 routes. e2e/real.spec.ts (real API, not run in CI) still describes V1 screens;
  updating it needs the backend running, which this office PC can't do.
- V2-64 (T42) **Final review**: no "Toonwave"/"PhumReader" in the UI (the generated API types quote backend setting
  names, which keep the old spelling); the service worker cache is now `phumireader-offline-v2`, so returning visitors
  get the V2.1 offline page. Every placeholder in foundations §8 is on screen. `?demo=empty|error|slow` checked on every
  data page. Settings and Help read only local data in the demo, so the flags change their writes: Save changes and
  the password change now go through the fake API (delay, `?demo=error` fails them). Unused V1 leftovers removed
  (password-rules, image-upload-field, empty message namespaces); unused shadcn/ui primitives stay as the kit. README
  has a "Try the demo" section.
- V2-65 (T43) **Badges** follow the prototype's `.badge` exactly: 22 px tall, 8 px side padding (was 20 px / 6 px), and
  the Fast Pass (`warn`) and `brand` badges have no border, like `.badge-warn` / `.badge-brand`; `warn` text is
  `--warning` #B45309 (4.8:1 on #FFFBEB) instead of #92400E. `danger` (failed payments, not in the prototype) lost its
  border too. The six per-page "h-[22px] px-2" overrides are gone.
