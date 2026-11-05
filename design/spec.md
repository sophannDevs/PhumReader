# Toonwave V2 – Page and behaviour spec (frontend, demo data)

What every page shows and what every control does. Screens are in `screens/`, tokens in `foundations.md`, data in `demo-data.json`.
Scope: frontend only. Anything a server would do is simulated with demo data, a fake API with delay, and browser state.

## 0. Global rules

### Routes
| Page | Route | Screens |
|---|---|---|
| Home | `/` | 01-home-* |
| Series | `/series/[slug]` | 02-series-* |
| Comic reader | `/read/[slug]/[episode]` | 03-episode-viewer-* |
| Novel reader | `/novel/[slug]/[chapter]` | 04-novel-reader-* |
| Log in / Sign up | `/login` (`?mode=signup`) | 05-* |
| Coins | `/coins` | 06-* |
| Not designed in V2 yet (link targets) | `/library`, `/settings`, `/creator`, `/rankings`, `/genres/[genre]`, `/search` | Build as simple pages in V2 style, or "Coming soon" |

Home nav items: Home → `/`, Rankings → `/#rank`, Genres → `/#genres`, Web novels → `/#novels` (until those pages exist).
Comics open in the comic reader; series whose `type` is `novel` open in the novel reader.

### Simulated state (zustand + localStorage)
| State | Default | Changed by |
|---|---|---|
| `user` (name) or null | null (logged out) | Log in, sign up, social buttons, Log out |
| `coins` | 3 | Unlock (−5), purchase (+pack total) |
| `subscriptions` (series ids) | [] | Subscribe buttons |
| `unlocked[seriesId]` (episode numbers) | [] | Unlock dialog |
| `lastRead[seriesId]` | 0 | Opening an episode/chapter |
| `purchases` | 2 rows from demo data | Checkout (Paid / Failed / Cancelled) |
| `returnTo` | — | Set before going to Log in |
| `shopReturn` {page, episode, title} | — | Set before going to Coins from a locked episode |
| `pendingUnlock` {seriesId, episode} | — | Reopens the unlock dialog after log in / coins |
| `novelSettings` {size 18, theme light, font sans, wide true} | — | Novel reader settings |
| `lang` en / km | en | Language switch |
| `accounts` (signed-up users) | — | Sign up |

### Fake API (`lib/demo-api.ts`)
Every read/write goes through it: 300–800 ms delay. URL flags for reviewing states: `?demo=empty` returns empty lists, `?demo=error` throws, `?demo=slow` adds 3 s.

### Header (all site pages; not on readers or Log in)
Logo → Home · nav links (current one bold) · search trigger "Search series, creators…" with ⌘K hint (icon button on phone) · coin chip "C 3" → Coins · logged out: "Log in" (ghost) + "Sign up" (brand); phone shows only "Log in" · logged in: avatar with initials → menu: name + coins, My library, Get coins, Creator dashboard, Settings, Log out (toast "You’re logged out").
Log in / Sign up links first save `returnTo` = current page.

### Search (⌘K / Ctrl+K / search icon)
Command dialog near the top. Empty query: "Popular now" (first 6 series). Typing filters by title, creator or genre (max 8). Each result: 28×36 cover, title, "creator · genre", "Novel" badge. Click → series page. No results: "No results. Try a title, creator or genre." Esc / click outside closes.

### Footer
Brand + one-line description + 3 social buttons · columns Read / Create / Help · bottom line "© 2026 Toonwave · [YOUR COMPANY NAME]…" + language note.

### Phone tab bar (< 768 px)
Home, Search (opens command search), Library, Coins, Me (logged in → Settings) / Log in. Current tab dark, others muted.

### Toasts
White card with green check dot, auto-hide after 2.6 s.

## 1. Home `/`

1. **Hero carousel** (dark banner, 20 px radius): 3 slides from `homeHero`. Blurred cover background, badges (tag in green, genre, "Web novel" for novels), title, blurb, creator · likes · schedule, buttons: "Read episode 1"/"Read chapter 1" (brand, lg) → reader at 1 · "+ Subscribe"/"✓ Subscribed" toggle (toast) · "Series details →" link. Cover art on the right (desktop, tilted 2°). Dots + prev/next buttons. Autoplay every 7 s; any manual control stops autoplay. Phone: cover on top, text below.
2. **Continue reading**: 4 ContinueCards (from `continueReading`) → reader at that episode. Subtitle: logged in "Pick up where you left off." / logged out "Your reading history on this device." "My library ›" link. Hidden when empty.
3. **Daily updates**: pill tabs Mon–Sun with Thursday labelled "Today" (selected by default). Grid of 6 SeriesCards for that day (fill with UP series if fewer than 6).
4. **Trending now** card (left): tabs Comics / Web novels; ranked list of 8 with movement.
5. **Browse by genre** (right): 8 chips (Fantasy selected); "N series in <genre>"; 3×2 grid of that genre.
6. **Web novels**: 6 NovelCards (84 px cover, genre badge, title, "creator · N chapters"), 3 columns desktop, 1 on phone.
7. **Creator call-to-action** card (green-to-white gradient): eyebrow "For creators", "Publish your own series", "Start publishing" (brand) + "Creator guidelines" (outline) → `/creator`; 3 fanned covers on desktop.

States: loading skeletons for hero, cards and lists; `?demo=empty` → sections show EmptyState; `?demo=error` → ErrorState with Retry.

## 2. Series `/series/[slug]`

**Hero** (dark, blurred cover behind): breadcrumb Home › Genre › Title · 240 px cover (132 px on phone) · badges genre, Comic/Web novel, schedule, "Ongoing" · title · creator avatar + name · synopsis (`synopsisByGenre`) · stats Views, Likes, Subscribers, Episodes (total incl. Fast Pass) · buttons: "Read episode 1" or "Continue episode N" (brand lg) · Subscribe toggle · Share icon (toast "Link copied").

**Tabs** (underline style): Episodes [count] · About · Comments [2.4K].
- Episodes: brand Alert "Fast Pass: read 3 episodes early — Unlock for 5 coins each, or wait — one becomes free every week. You have N coins." + "Get coins". Row "68 episodes · new every Sun" + sort button (Newest first ⇄ Oldest first). List of EpisodeRows, 12 at a time, "Show 12 more". Locked rows: dimmed thumb with lock, warn badge "⚡ 5 coins". Unlocked Fast Pass: "Unlocked" badge. Read free episodes: grey title + "✓ Read". The latest free episode has "UP".
- About: synopsis + "New episodes every …" · details list (Genre, Format, Schedule, Status, Language, Age rating) · tags.
- Comments: composer card (500 chars, counter, "Post"; logged out → toast "Log in to comment") · comments with avatar, name · time, "Top" badge, text, like toggle (count +1), Reply.

**Sidebar** (below content on phone): About the creator (avatar, "3 series on Toonwave", Follow/Following toggle + toast) · You may also like (4 same-genre series).

**Unlock dialog** (click a locked row): thumb, "⚡ Fast Pass", "Unlock Episode N", "Free for everyone on <date>", Price / Your balance box, then one of:
- Logged out: info alert + "Log in to unlock" → Log in (saves `returnTo` + `pendingUnlock`).
- Enough coins: "Unlock for 5 coins" → spinner 0.7 s → coins −5, episode added to unlocked, toast "Episode N unlocked", opens the reader.
- Not enough: warning "You need N more coins." + "Get coins" → Coins (saves `shopReturn` + `pendingUnlock`).
- Always: "Wait for the free release" (closes).
Returning after log in / purchase with enough coins reopens the dialog automatically.

## 3. Comic reader `/read/[slug]/[n]`

Dark page. Sticky bar: back arrow → series · series title (small) + episode title · "Episodes" popover (9 nearby episodes, newest first; current marked "Now"; locked show a lock; header "N episodes · N coins") · previous / next buttons (disabled at ends) · 2 px green progress line (episode n / total).
Image strip: `comicPanels`, 800 px max, white background, lazy loaded.
End section: card "END OF EPISODE N" + title + pills Like (count, heart fills red) · Subscribe (bell) · Share · Next-episode card (thumb, title, Fast Pass badge if locked, "Read next →" or "Unlock") · "You’re all caught up" when last · Comments card (input + Post, 3 comments) · "All episodes of <series>".
Going to a locked episode (next, list, keyboard → ) opens the same unlock dialog (light). Opening an episode records `lastRead`.
Keyboard: ← / → previous / next.

## 4. Novel reader `/novel/[slug]/[n]`

Same structure as the comic reader but light by default. Bar: back · titles · "Chapters" popover · "Aa" settings popover:
- Text size − / + (14, 16, 18, 20, 22, 24 px) with a progress bar showing the level.
- Theme: Light / Sepia / Dark.
- Font: Sans / Serif.
- Wide line spacing switch.
Settings apply instantly and persist.
Article (720 px column): eyebrow "CHAPTER N", chapter name, "creator · date · 6 min read", body from `novelChapterText` (paragraphs, quotes with green left border, centred "* * *" scene breaks).
End: "END OF CHAPTER N" card with Like · Bookmark (toast) · Share · Creator’s note card · Previous / Next chapter buttons (Next shows "Next · 5 coins" when locked) · "All chapters of …". Locked chapters use the unlock dialog.

## 5. Log in / Sign up `/login`

Desktop: left 46% dark panel (rotated collage of covers, logo, creator quote) · right: "← Back to Toonwave" + EN / ខ្មែរ switch, centred 380 px form. Phone: logo + language switch, form only.
- **Log in**: title "Welcome back", tabs Log in / Sign up, Google + Facebook buttons (spinner 1 s → logged in as Sokha Chan), "OR WITH EMAIL", Email, Password (show/hide eye), "Forgot password?" link, "Keep me logged in" checkbox (on), "Log in" (brand lg, spinner 0.9 s), demo hint line. Errors: empty/invalid email, empty password, wrong credentials → red alert "Email or password is incorrect". Demo: reader@toonwave.app / Toonwave1! or any account created by sign up.
- **Sign up**: Display name (2+ chars), Email, Password with 4-segment strength bar (amber under 3 rules, green at 3+) and live rule list (8+ characters, Upper and lower case, A number, A symbol), Terms checkbox (required), "Create account" → Verify.
- **Verify**: mail icon, "Check your email", "We sent a 6-digit code to <email>", 6 OTP slots, "Verify email", "Didn’t get it? Resend in 30s" countdown → "Resend code" (toast), demo code 123456, wrong code → red slots + "That code isn’t right…", "Use a different email".
- **Forgot**: email → "Send reset link" → "Check your inbox… It expires in 30 minutes." → "Back to log in".
- **Done**: green check, "Welcome, <first name>", "Taking you back…", then go to `returnTo` (default Home) after 1.2 s.
- Language switch translates all page text (English/Khmer strings in the V2 design file).

## 6. Coins `/coins`

Header row: "Coins" + "Unlock Fast Pass episodes and chapters before they’re free." + balance card (coin icon, "N coins").
Alerts: "Get coins for episode N of <title>" + "Go back" (when `shopReturn` set) · "First purchase: double coins" (until a Paid purchase exists).
**1. Choose a pack**: 5 radio cards (coins, bonus line incl. "+N first" during first-purchase offer, Popular (green) / Best value (dark) badges, [PRICE USD] / [PRICE KHR]); 120 selected by default; 2 columns on phone.
**2. Pay with**: KHQR (Recommended), ABA Pay, Credit or debit card.
**Checkout card** (right column; below on phone) steps:
1. Review: pack, pack bonus, first-purchase bonus, You get, Total placeholders, Paying with, "Continue to payment", "Balance after: N coins · Coins don’t expire". Logged out → go to Log in (returns here).
2. Pay: title by method ("Scan to pay" / "Confirm in ABA Mobile" / "Card details"), 10:00 countdown badge. KHQR: red "KHQR" header, QR placeholder, "[KHQR PLACEHOLDER] · Toonwave", [PRICE KHR], 3 steps. ABA: "[ABA PAY HANDOFF PLACEHOLDER]". Card: "[PAYMENT PROVIDER FORM]" placeholder — never real card fields. Buttons: "I’ve paid (simulate)" / "Pay now", "Cancel" (toast "Payment cancelled", back to review, recorded Cancelled), "Simulate failed payment".
3. Confirming: spinner 1.5 s.
4. Success: green check, "+N coins", new balance, order id + method, "Back to <episode>" (when returning) + "Buy more coins"; toast "+N coins added".
5. Failed: red X; "Payment didn’t go through" (declined) or "The code expired" (countdown hit 0); "Try again" / "Choose another method".
Pack and method cards are disabled during Pay/Confirming.
**Purchase history** table (Date, Item, Method [hidden on phone], Coins, Status badge Paid/Failed/Cancelled) · **Questions** accordion (first open) · prototype note line.

## 7. Key flows to test

1. Home → series card → Series → Read episode 1 → Next.
2. Locked episode (logged out) → Log in → back to Series, dialog reopens → Unlock → reader.
3. Locked episode with 3 coins → Get coins → buy 120 pack with KHQR (simulate) → Back to episode → Unlock.
4. Sign up → code 123456 → returns to the page you came from, logged in.
5. Novel: change size / Sepia / Serif → reload → settings kept.
6. ⌘K → type "gl" → Glass Compass → Series.
