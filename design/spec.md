# PhumiReader (ភូមិReader) V2 – Page and behaviour spec

Frontend only, demo data. Everything a server would do is simulated: demo data, a fake API with a delay, and state saved in the browser.

- Screens: `screens/` (desktop 1440 px and phone 390 px, plus key states).
- Tokens and components: `foundations.md`.
- Data: `demo-data.json`.
- Khmer text: `i18n/km-dictionary.json`.
- Exact behaviour: `prototype-src/<Page>/page.js` (logic), `body.html` (markup) and `page.css` (styles). When this spec and the prototype disagree, the prototype wins. Do not copy its code as-is; rebuild it in React.

## 0. Global

### Brand
- Name: **PhumiReader** in English and **ភូមិReader** in Khmer. Logo = green mark + "Phumi" (foreground) + "Reader" (brand-ink green).
- Domain in examples: phumireader.app. Storage prefix: `phumireader.` (the prototype still uses `toonwave.`; rename it).

### Routes (Next.js App Router, under `/[locale]`)
| Page | Route | Screens |
|---|---|---|
| Home | `/` | 01-* |
| Series | `/series/[slug]` | 02-* |
| Comic reader | `/read/[slug]/[episode]` | 03-* |
| Novel reader | `/novel/[slug]/[chapter]` | 04-* |
| Log in / Sign up / Forgot | `/login` (`?mode=signup`, `?mode=forgot`) | 05-* |
| Coins | `/coins` | 06-* |
| Search | `/search?q=` | 07-* |
| My library | `/library` | 08-* |
| Errors | `not-found.tsx`, `error.tsx`, `/offline`, `/maintenance`, unavailable series inside `/series/[slug]` | 09-* |
| Rankings | `/rankings` | 10-* |
| Genres / Web novels | `/genres?g=&format=` | 11-* |
| Settings | `/settings` | 12-* |
| Notifications | `/notifications` | 13-* |
| Creator dashboard | `/creator` | 14-* |
| Create series | `/creator/new` | 15-* |
| Upload episode | `/creator/upload?series=` | 16-* |
| Creator profile | `/creators/[handle]` (`?view=owner`) | 17-* |
| Earnings | `/creator/earnings` | 18-* |
| Help center | `/help` (`#contact`) | 19-* |
| Policies | `/legal/[doc]` (terms, privacy, refund, community, creator) | 20-* |
| Manage series | `/creator/series/[id]` (tabs: episodes, details, fast-pass, settings) | 21-* |
| Admin | `/admin`, `/admin/series`, `/admin/reports`, `/admin/payments` | 22-* |
| Comments | `/series/[slug]/comments` (`?ep=`) | 23-* |
| First-time setup | `/welcome` | 24-* |
| Receipt | `/coins/orders/[id]` | 25-* |
| Become a creator | `/creators/join` | 26-* |

Locales: `en` (default) and `km`. The Khmer strings are in `i18n/km-dictionary.json`. Build them into `messages/km.json` keyed by message id. Do not translate the page after it renders the way the prototype does.

### Simulated state (zustand + persist, prefix `phumireader.`)
| Key | Default | Changed by |
|---|---|---|
| `user` | null | Log in / sign up / social buttons / log out / delete account |
| `accounts` | demo accounts | Sign up |
| `lang` | `en` | Header language button, Settings, setup, Log in toggle |
| `coins` | 3 | Unlock (−5 each), purchase (+pack total), admin "Add coins" |
| `purchases` | 2 demo rows (TW-48213377 paid, TW-48190012 failed) | Checkout |
| `subs` | demo list | Subscribe buttons, Library edit, setup picks |
| `unlocked[seriesId]` | [] | Unlock (single or bundle) |
| `read[seriesId]` | 0 | Opening an episode |
| `pos[seriesId][ep]` | – | Reader scroll position (0.05–0.95 shows "You stopped at N%") |
| `settings` | `{mode:'scroll', quality:'auto', theme:'system', size:'m', autoNext:true, saveData:false, region:'KH', langs:['en','km'], publicLib:false, mature:false, google:true, facebook:false}` | Settings, reader settings panel |
| `readerBg` / `readerWidth` | dark / fit | Comic reader settings |
| `novel` | `{size:18, theme:'light', font:'sans', wide:true}` | Novel reader settings |
| `prefs` (genres) | null | Home picker, setup |
| `notifRead` / `notifGone` / `notifPrefs` | demo | Notifications page |
| `blocked` (names) | [] | Block |
| `reports` | [] | Report dialog. Status changes when an admin decides. |
| `myWorks` | 3 demo series | Create series, upload, manage, admin decisions |
| `reviewNotes[seriesId]` | – | Admin "Request changes" |
| `returnTo`, `welcomeNext`, `shopReturn`, `pendingUnlock`, `helpPrefill`, `receipt`, `legalDoc` | – | Hand-offs between pages (see flows) |

### Fake API (`lib/demo-api.ts`)
- Every read and write goes through it, with a 300–800 ms delay.
- URL flags: `?demo=empty`, `?demo=error`, `?demo=slow` (adds 3 s).

### Header (site pages)
- **Left:** logo → Home; nav Home / Rankings / Genres / Web novels. Web novels opens Genres with format=novel, and the current item is bold.
- **Right:**
  - Search trigger (⌘K; an icon on phone).
  - Language button: shows "ខ្មែរ" in English and "EN" in Khmer.
  - Coin chip → Coins.
  - Logged out: Log in + Sign up.
  - Logged in: bell with a red unread count → Notifications, and an avatar menu: My library, Notifications, Get coins, Creator dashboard, Settings, Log out.
- **Phone:** the header must fit in 390 px with everything shown. Tighten the gaps at ≤420 px.

### Phone tab bar
Home, Search, Library, Coins, Me (or Log in). Sticky at the bottom.

### Footer
- **Read:** Originals, Rankings, Genres, Web novels.
- **Create:** Become a creator, Creator dashboard, Creator guidelines, Earnings.
- **Help:** Help center, Community guidelines, Terms, Privacy, Coins and refunds, Contact us.
- **Bottom line:** "© 2026 PhumiReader · [YOUR COMPANY NAME]" and a language switch.

### Report and block (shared dialog, any page)
- **Opened from:** Report on comments, profiles, the series About tab, and episode or chapter ends.
- **Reasons depend on what is reported:**
  - Comment: spam, harassment, hate, sexual, violence, spoiler, something else.
  - Series or episode: stolen work first, then the common reasons, plus wrong age rating and something else.
  - Account: spam or fake, pretending to be someone, harassment, something else.
- **Details field:** required (at least 10 characters) for "Something else", "Stolen work" (asks for a link to the original) and "Pretending to be someone".
- **Footer note:** "In Cambodia: police 117, ambulance 119."
- **After sending:** show case number R-xxxxx, say the report is reviewed within 24 h, and offer "Also block [name]".
- **Blocking:** a confirm dialog. Blocked people's comments are hidden, with a "1 comment from people you blocked hidden · Show" line. Settings lists blocked accounts and your reports with their status (In review / Removed / No violation found).

### Every data page
- States: loading skeletons, empty (with a next step), error (with Try again), success.
- No horizontal scrolling at 320–1920 px. Focus rings, keyboard access, dialogs that trap focus, `lang="km"` on Khmer text.

## 1. Home
- Spotlight: a main hero and a "Featured this week" list. No autoplay.
- Rows:
  - Continue reading.
  - "What do you like to read?" genre picker → "Recommended for you", saved to `prefs`.
  - Daily updates: day tabs with counts, a type filter, "New today", and at most 6 cards with "Show all N".
  - Trending, with the top 3 shown larger.
  - Browse by genre with counts and "Surprise me".
  - Web novels.
  - Creator call to action → Become a creator.
- Demo states: live, loading, empty, error.

## 2. Series
- **Hero:**
  - Breadcrumb, cover, badges, creator, synopsis and stats.
  - Read / Continue Ep N, + Subscribe, Share.
  - Progress line: "You've read 20 of 65 free episodes · 31%", or "65 free · 3 Fast Pass".
- **Episodes tab:**
  - Fast Pass card: "read N before everyone", 5 coins each, the next free date with a countdown, "Unlock all N · 15 coins", and "N coins · Get more".
  - Toolbar: Episode 1, Latest free, Go to # (shows an error outside 1–max), and Newest/Oldest.
  - Grouped list: "Fast Pass · read before everyone" and "Free to read".
  - Locked rows show "Free Nov 26 · in 21 days".
  - Badges: UP, Read, Up next, Unlocked.
  - "Show 12 more".
- **Unlock dialog:**
  - Choose single (5) or "All 3 Fast Pass episodes" (15).
  - Shows price, balance and "after unlocking".
  - Not logged in → Log in. Short of coins → "You need N more coins" → Coins, which saves `shopReturn` and `pendingUnlock`. The dialog reopens when they come back.
- **About tab:** details, tags, and "Something wrong with this series? Report it".
- **Comments tab:** a preview, Report / Block on others' comments, and "See all 2.4K comments" → Comments.
- **Phone:** a sticky "Continue Ep. N" bar appears after scrolling past the hero.

## 3. Comic reader
- **Top bar:** back, series and episode title, episode list popover, settings (gear), previous/next. A progress bar shows the position within the episode.
- **Settings panel:**
  - Scroll / Page by page, Dark / Light background, Full / Narrow width.
  - Auto-open next episode and Data saver switches.
  - Everything saves to `settings`.
- **Page by page:** tap the left or right third, or use ← →. The last page leads to the next episode.
- **Resume:** "You stopped at 40% · Continue / Start over".
- **Locked episode:**
  - A blurred first panel with a "Fast Pass" card: free date, unlock for 5, "Get coins · you need N more" (return here after buying), "Unlock all N", and back to the previous episode.
- **End of episode:**
  - Like, Subscribe, Share, Report this episode.
  - Auto-next countdown of 5 s with Cancel.
  - Next episode card (shows the unlock price if it's Fast Pass).
  - Top comments with Report / Block and "See all".
- Arrow keys change episode.

## 4. Novel reader
- **Settings popover:** size, theme (light / sepia / dark), font, line spacing. The first visit takes size and theme from Settings.
- Shows reading progress, a resume chip, and arrow keys change chapter.
- **Locked chapter:** two teaser paragraphs fading out, then the unlock card.
- **End of chapter:** like, bookmark, share, creator's note, previous / next, and "Report this chapter".

## 5. Log in / Sign up
Split layout: a mint panel and a card.
- **Card top:** context line ("Log in to unlock Ep. 66 · Glass Compass") and an English / ខ្មែរ toggle.
- **Log in:**
  - Fields: email and password (with Show and a Caps Lock warning), Remember me, Forgot.
  - Social: Google / Facebook / Apple.
  - Demo account: reader@phumireader.app / PhumiReader1!
- **Sign up:**
  - Fields: name, email (creator@phumireader.app is already taken), password with strength meter and rules, confirm password, app language, birth year (under 13 blocked; 13–17 gets a note), terms.
  - Then a 6-digit code (123456) with resend after 30 s.
- **Forgot:** code → new password → back to log in with a success message.
- **New accounts:** go to `/welcome` and then back to `returnTo`. Existing accounts go straight back to `returnTo`.

## 6. Coins
- **Steps bar:** 1 Choose pack · 2 Pay · 3 Done.
- **Balance:** "≈ N Fast Pass episodes".
- **From a locked episode:** "Almost there · You need N more coins to unlock …". The smallest pack that covers it is pre-selected and marked "Covers it".
- **Packs:** 10/0, 30/+3, 60/+8, 120/+20 (Popular), 300/+60 (Best value). Each shows its bonus % and "You get N · ≈ N episodes". The first purchase doubles the coins.
- **Methods:** KHQR (recommended) / ABA Pay / card.
- **Pay step:**
  - 10-minute countdown and a QR placeholder.
  - [PAYMENT PROVIDER FORM] for cards. Never build real card fields.
  - Prices stay [PRICE USD] / [PRICE KHR].
- **Processing → success:** "+N coins". If they came from an episode, it goes back there automatically after 5 s, with "Stay here".
- **Failed or expired:** Try again / change method.
- **Trust notes:** secure provider, coins never expire, help within a day.
- **History:** each row opens its Receipt. Plus an FAQ.

## 7. Search
- Before typing: recent searches and trending searches.
- Results: tabs All / Comics / Web novels / Creators with counts, and filters for genre, day and sort.
- Matches highlighted; Subscribe on each result; Follow on creators.
- "Show more" (6 at a time), "Did you mean", plus loading, error and no-results states.

## 8. My library
- Tabs: Subscribed / Recently read / Unlocked.
- "New episodes" filter, sort, and edit mode with select all and remove, plus an Undo bar for 6 s.
- Guest banner, empty states.

## 9. Error pages
404, 500, offline, maintenance, series unavailable. Each has its own illustration, a code badge, and an English / ខ្មែរ toggle.
- **404:** shows the address they tried, "Did you mean", search, and popular series.
- **500:** retry (the first retry fails, the second works), reference number with copy.
- **Offline:** tips, retry, and it returns automatically when the connection is back.
- **Maintenance:** [MAINTENANCE START/END], "Notify me".
- **Unavailable:** remove from library, plus similar series.

## 10. Rankings
- Lists: Trending / Popular / New / Rising.
- Filters: format, genre, and period (Today / This week / This month).
- Top 3 as large cards, then rows with movement (▲▼ NEW –), reads for the period (Rising shows +% instead), likes and + Add.
- "How rankings work", "Show more", and an empty state.

## 11. Genres / Web novels
- Genre chips with counts and a coloured banner (description, count, 3 covers).
- Filters: format, status, update day, sort. "Clear filters (N)".
- Grid of 6 / 4 / 3 columns, plus "Show more" and an empty state.

## 12. Settings
- Side menu, with one card per section: Account, Reading, Language and region, Notifications, Privacy and safety, Coins and payments, Account actions.
- **Account:** display name (2–30 characters), change password inline (8+ characters with a letter and a number; must match; must differ from the old one), Google / Facebook connect.
- **Reading:** mode cards, quality, theme, novel text size with a live preview, auto-next, data saver.
- **Language and region:** app language, region, story languages (at least one).
- **Privacy and safety:** public library and mature switches, blocked accounts with Unblock, your reports with status, download your data.
- **Account actions:** log out everywhere; delete account (type DELETE to confirm).
- **Save bar:** "You have unsaved changes · Discard / Save changes".

## 13. Notifications
- **Inbox:**
  - Tabs: All / Unread (N) / New episodes / Comments / Coins.
  - Groups: Today / This week / Earlier, with an unread dot.
  - Click marks it read and opens the series or Coins. Mark read/unread, remove with Undo, mark all as read.
- **Alert settings:** push and email for each type, quiet hours (from / to, ICT), daily digest. Saves automatically.
- The header bell shows the unread count.

## 14. Creator dashboard
- Creator menu: Dashboard, New series, Upload episode, Earnings, Public profile.
- Four stat cards, a 14-day views chart, My series filters.
- Each row has a status badge (Published / In review / Changes requested / Draft) and a main button:
  - Upload episode.
  - "Fix and resubmit" → Manage.
  - "Continue setup" → Create.
  - Plus "Manage" on every row.
- To do list, and new comments with an inline reply and like.
- New-creator state: a 3-step guide.

## 15. Create series
- Four steps (Basics / Story / Cover / Publishing), with an error summary and drafts saved automatically.
- **Basics:**
  - Format cards and title: 2–60 characters, and must not match an existing title.
  - Main and second genre.
  - Age rating with a hint: All / 13+ / 16+ / 18+.
  - Language: ខ្មែរ / English / both.
- **Story:** summary of 50–500 characters, up to 5 tags (Enter or comma adds, Backspace removes), popular tag suggestions.
- **Cover:** pick a cover, a requirements checklist, square thumbnail preview.
- **Publishing:** update days, release time, Fast Pass switch, original-work checkbox.
- Submit → "in review" screen. Status becomes `review`, and the series appears in the admin queue.

## 16. Upload episode
- Choose the series; the episode number fills in automatically.
- Title is required.
- **Comics:** an image list with progress, reorder ↑↓, remove, and a size error ("Too wide: 2400 px. Use 690–1600 px."). Rules: JPG / PNG, 690–1600 px wide, up to 20 MB each, up to 100 images.
- **Novels:** text with a word count; at least 300 words.
- **Release:** now or scheduled (date and time ICT), Fast Pass switch ("free for everyone on …"), comments switch, creator's note (up to 300 characters).
- Checklist and phone preview on the side. Sticky Save draft / Publish bar.
- Success: "Episode N is scheduled".

## 17. Creator profile
- Banner, avatar, verified badge, bio and stats.
- **Reader view:** Follow, Share, Report, Block / Unblock.
- **Owner view:** creator menu, a "This is your public profile" note, Edit profile (name, location, bio up to 200 characters).
- Tabs: Series / Updates / About.

## 18. Earnings
- Period: 30 days / 3 months / 6 months.
- Stat cards; money shows as [USD AMOUNT] at [REVENUE SHARE]%.
- Coins-by-month chart with a "Show as table" switch, plus a by-series breakdown.
- **Payouts:** available amount, ABA [PAYOUT ACCOUNT], next payout [PAYOUT DATE], minimum [MIN PAYOUT].
- **No payout method:** a warning, and history shows "On hold". The add-method dialog shows a [PAYOUT PROVIDER FORM] placeholder.

## 19. Help center
- Search with popular searches, and 6 topic cards that filter.
- 17 articles (in `helpArticles`), each with a link and "Was this helpful?".
- **Contact form:** topic, email, order number (TW-12345678 format, shown only for payments), message (20+ characters), screenshot, ticket number T-xxxxx.
- Opening from a receipt fills in the form. Other contact options are placeholders.

## 20. Policies
- Side menu: Terms, Privacy, Coins and refunds, Community guidelines, Creator guidelines.
- Each has "The short version", "On this page", numbered sections and a contact footer.
- Terms, Privacy and Refunds are **draft templates** with placeholders and a warning to have a lawyer review them.
- The Khmer button shows "coming before launch" until a professional translation exists.

## 21. Manage series
- Header: cover, status, "View as reader", Upload.
- **Episodes:**
  - Filters: All / Published / Scheduled / Drafts and hidden, plus sort and "Show more".
  - Edit dialog: title; scheduled episodes can move their release slot.
  - Hide / Show. Hiding a Fast Pass episode warns that coins aren't refunded automatically.
  - Delete drafts.
- **Series details:** title (changing it triggers a quick review), summary (no contact details), genre, status (Ongoing / On break with a message / Completed), update days, cover.
- **Fast Pass:** on/off, 1–5 episodes ahead, and the current queue.
- **Settings:**
  - Comments on/off.
  - Hide series from readers (type the title to confirm).
  - Delete is blocked while there are published episodes.
- **Changes requested:** a red list of the reviewer's items, each with Fix / Mark fixed. Resubmit unlocks when all are fixed; status goes back to `review` and the series returns to the admin queue.

## 22. Admin (moderators)
Its own dark top bar and a side menu. Every decision has a 6-second Undo.
- **Overview:** four counts that open each queue, "Waiting longest", recent decisions.
- **Series review:**
  - Queue with how long each has waited and automatic-check flags (contact details, watermark, similar title).
  - Detail view with a 4-item checklist; Approve stays disabled until everything is ticked.
  - "Request changes" pre-ticks reasons from the flags and adds a note; saves `reviewNotes`, and the creator sees it in Manage.
  - Reject.
- **Reports:**
  - Urgent (violence, sexual) first, then high, then normal.
  - Detail: content, reporter note, history.
  - Actions: remove / remove and warn / suspend 7 days / no violation.
  - The reporter's status updates in their Settings.
- **Payments:** refund requests with eligibility (unused / double charge / partly spent), and "Paid but no coins" with Add coins.

## 23. Comments
- Breadcrumb, header with count and "Back to episode N".
- **Composer:** 500 characters, "Contains spoilers", guidelines link.
- Sort Top / Newest, "Only threads with a creator reply".
- **Comments:**
  - The creator's pinned comment stays first.
  - Spoilers are hidden until tapped.
  - Replies one level deep ("View N replies · includes the creator").
  - Like, Reply, Report and Block on others' comments; Edit (marked edited) and Delete on your own.
- Blocked people's comments are hidden.

## 24. First-time setup
- Shown once, after sign-up. "Skip for now" at any time.
- **Step 1:** app language (switches the UI immediately) and story languages.
- **Step 2:** genre picture cards (at least 1) and format.
- **Step 3:** alerts → "Turn on alerts" (real browser permission request; if denied, explain) or "Not now".
- **Done:** 4 matching series with + Add, then "Start reading". Saves prefs, subs and settings, then returns to `welcomeNext`.

## 25. Receipt
- Status icon and badge, timeline, and rows: order number (copy), date ICT, pack, bonus lines, method, provider reference placeholder, total.
- **Paid:** shows spent and unused coins, Download receipt (PDF placeholder), "Ask for a refund" when coins are unused.
- **Failed:** "No money was taken" and Try again.
- "Get help with this order" fills in the Help contact form.

## 26. Become a creator
- Hero (Start creating / Creator guidelines), How it works in 4 steps.
- **Earnings calculator:** readers × episodes × 5 coins.
- What you get, Before you start (rules), FAQ, final call to action.
- Logged-out start → sign up with `returnTo` = Create series.

## Key flows to test end to end (Playwright)
1. Sign up → setup → returns to the series → Home shows the chosen genres.
2. Series → locked episode → not enough coins → Coins (pack pre-selected) → pay → back to the episode → the unlock dialog reopens → unlock.
3. Comment → Report → Admin removes it → reporter sees "Removed" in Settings.
4. Create series → Admin requests changes → creator fixes and resubmits → Admin approves → upload episode 1.
5. Switch to Khmer anywhere → every page follows.
6. Receipt → Get help → contact form already filled in.
