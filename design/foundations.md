# PhumiReader V2 – Foundations

Source of truth for colors, type, spacing and components. Matches `screens/00-foundations-desktop.png`.
Built for Next.js + Tailwind CSS + shadcn/ui (Radix) + lucide-react icons. Light theme only (the comic reader is always dark; the novel reader has its own themes).

## 1. Color tokens (put in `app/globals.css` as shadcn CSS variables)

| Token | Value | Use |
|---|---|---|
| `--background` | `#FFFFFF` | Page, cards, popovers |
| `--foreground` | `#09090B` | Main text, default (dark) button |
| `--card` / `--popover` | `#FFFFFF` | Card and menu surfaces |
| `--muted` | `#F4F4F5` | Tabs track, skeletons, icon tiles |
| `--muted-foreground` | `#71717A` | Secondary text, captions |
| `--secondary` | `#F4F4F5` (text `#18181B`) | Secondary buttons, neutral badges |
| `--accent` | `#F4F4F5` | Hover background for ghost buttons, menu items, rows |
| `--border` / `--input` | `#E4E4E7` | Borders, separators, inputs |
| `--ring` | `#00A650` | Focus ring (2 px gap in background color + 2 px ring) |
| `--primary` | `#00DC64` | Primary actions, progress bars, selected states |
| `--primary-hover` | `#00C85A` | Primary hover |
| `--primary-foreground` | `#04210F` | Text and icons on green (never white on green) |
| `--brand-ink` | `#047A3A` | Green text and links on white |
| `--brand-soft` | `#E8FBF0` (border `#BBF0D0`) | Brand alert, "Unlocked", "Recommended" badges |
| `--destructive` | `#DC2626` (soft `#FEF2F2`, border `#FECACA`, text `#991B1B`) | Errors, delete |
| `--warning` | `#B45309` (soft `#FFFBEB`, border `#FDE68A`, text `#92400E`) | Fast Pass badges, warnings |
| Coin | `#FBBF24` circle, letter "C" in `#78350F` | Coin icon everywhere coins appear |
| UP badge | bg `#FEE2E2`, text `#B91C1C` | New-episode "UP" badge |
| Selected card bg | `#F6FEF9` + 1 px `--primary` ring | Selected pack / payment method |

Dark surfaces (comic reader, heroes): background `#09090B`, panels `#18181B`, borders `#27272A`/`#3F3F46`, text `#FAFAFA`, quiet text `#A1A1AA`.

Novel reader themes (scoped to the reader only):

| Theme | Page | Text | Quiet text | Border |
|---|---|---|---|---|
| Light | `#FFFFFF` | `#18181B` | `#71717A` | `#E4E4E7` |
| Sepia | `#F6EFE2` | `#3B2F22` | `#8A7660` | `#E3D6BF` |
| Dark | `#111113` | `#E4E4E7` | `#A1A1AA` | `#27272A` |

## 2. Typography

Fonts: **Inter** (400/500/600/700) for Latin, **Kantumruy Pro** for Khmer (in the same font stack, so it falls back automatically), **Noto Serif** as the optional serif in the novel reader. Self-host with `next/font`.

| Style | Size / line height | Weight | Letter spacing |
|---|---|---|---|
| Hero title (desktop) | 48 / 52 | 700 | -0.03em |
| H1 | 36 / 42 (phone 26 / 32) | 700 | -0.025em |
| Series title | 40 / 46 (phone 26 / 30) | 700 | -0.03em |
| H2 | 24 / 30 (phone 20 / 26) | 600 | -0.02em |
| H3 | 18 / 26 | 600 | -0.01em |
| H4 / card title | 15 / 22 (cards 14 / 20) | 600 | — |
| Lead | 16 / 26, muted | 400 | — |
| Body | 14 / 20 | 400 | — |
| Small | 13 / 18 | 400–500 | — |
| Caption | 12 / 16 | 500 | — |
| Eyebrow | 12 / 16 uppercase, brand-ink | 600 | 0.06em |
| Novel text | 18 px default (14–24), line height 1.85 (1.6 when "wide spacing" is off) | 400 | — |

Numbers that change (coins, counts, timers) use `tabular-nums`.

## 3. Spacing, radius, shadows, layout

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 56. Sections on Home are 56 px apart.
- `--radius: 10px`. Buttons and inputs 8 px; cards 12 px; dialogs 14 px; hero banners 20 px (16 px on phone); badges 6 px; chips, avatars, switches fully round.
- Shadows: xs `0 1px 2px rgba(9,9,11,.05)` (cards, inputs, outline buttons); md `0 4px 12px rgba(9,9,11,.08)` (menus, toasts); lg `0 16px 48px rgba(9,9,11,.16)` (dialogs, command search).
- Container: max 1280 px, 32 px side padding; 16 px on phones.
- Breakpoint for the phone layout: 760 px (use Tailwind `md` = 768 px). Tablet (768–1023) uses the desktop layout with fewer columns.
- Card grids: 6 columns desktop, 4 tablet, 3 phone; gap 20 / 16 / 12 px.
- Header 64 px (phone 56 px), sticky, white at 92% with blur, bottom border.
- Phone bottom tab bar: Home, Search, Library, Coins, Me/Log in; sticky at the bottom; 11 px labels, 20 px icons.
- Minimum tap size: 36 px desktop controls, 44 px for primary actions (`lg` buttons).
- Readers: comic image strip max 800 px wide; novel text column max 720 px.

## 4. Components (shadcn/ui) and how V2 uses them

| shadcn component | PhumiReader use | Notes |
|---|---|---|
| Button | All actions | Variants: `default` (dark), `brand` (green, 600 weight), `secondary`, `outline`, `ghost`, `link` (brand-ink, underline), `destructive`. Sizes: `sm` 32, default 36, `lg` 44, `icon` 36/32 |
| Badge | UP, NEW, Fast Pass, Unlocked, Read, genre, Novel, Popular, Best value | Variants: default, secondary, outline, brand, up, new, warn, dark (`rgba(9,9,11,.72)` on covers) |
| Card | Continue cards, novel cards, sidebar boxes, order summary | 1 px border + xs shadow |
| Tabs | Day tabs, rankings, Log in / Sign up, reader settings | Pill style (muted track, white active). Series page uses an underline variant |
| Toggle / Badge | Genre chips | Round chips; selected = dark fill |
| Dialog | Unlock dialog | 440 px wide, 24 px padding |
| DropdownMenu | Avatar menu | Label with name + coins, items with icons, Log out |
| Command | ⌘K search | 560 px, input + "Popular now"/"Series" group, cover thumbnails |
| Popover | Episode list (comic reader), chapters list + reading settings (novel reader) | |
| Input, Textarea, Label, Form | All forms | Errors in red under the field, `aria-invalid` |
| Checkbox, Switch | Keep me logged in, terms, wide spacing | |
| RadioGroup (as cards) | Coin packs, payment methods | Selected = green border + ring + `#F6FEF9` |
| InputOTP | 6-digit email code | 48×56 slots (44×52 phone) |
| Progress | Reading progress, continue reading, text size | Green fill, 6 px |
| Accordion | Coins FAQ | |
| Table | Purchase history | |
| Alert | Fast Pass notice, first purchase, errors, warnings | Variants: default, brand, destructive, warning |
| Sonner (toast) | Subscribed, Unlocked, Link copied, Payment cancelled… | White card with green check dot |
| Skeleton | Loading states | |
| Avatar | Header, comments, creator | Brand avatar = green with dark initials |
| Separator, Breadcrumb, Carousel, Tooltip, ScrollArea | As needed | |

## 5. PhumiReader patterns (build once in `components/pr/`)

SeriesCard (3:4 cover, top-left badges, title, "creator · genre", likes) · ContinueCard (48×64 cover, title, "Episode N · 62%", progress) · RankRow (rank number green for top 3, 40×52 cover, title, meta, movement ▲/▼/NEW/—) · HeroCarousel · NovelCard · EpisodeRow (64 px thumb, title, UP badge, date, likes, right badge: Fast Pass price / Unlocked / Read) · UnlockDialog (three states: log in, enough coins, not enough coins) · CoinChip · PackCard · PaymentMethodCard · CommentList + Composer · EmptyState · ErrorState · CreatorCTA · SiteHeader · SiteFooter · MobileTabBar · ComicReaderBar · NovelReaderBar · AuthSplitLayout.

## 6. Icons

lucide-react, 16 px default (14 in badges, 18–20 in bars), stroke 2: search, menu, x, chevron-left/right/down, arrow-left/right, heart, eye, bell, check, lock, zap (Fast Pass), share, home, book-open (library), user, coins, trending-up, list, sliders (settings), type (Aa), message-square, clock, calendar, plus, minus, sparkles, log-out, globe, mail, alert-circle, info, qr-code, credit-card, smartphone, gift, shield, pen, arrow-up-down (sort), bookmark, moon, sun, thumbs-up.

## 7. Motion and accessibility

- Transitions 150 ms for color/background; 200 ms for switches; cover hover zoom 1.04 over 300 ms; respect `prefers-reduced-motion`.
- Visible focus ring on every interactive element; dialogs trap focus; toasts announced politely.
- Khmer text gets `lang="km"`. Contrast ≥ 4.5:1 for text (green text uses `--brand-ink`).

## 8. Brand, language and patterns added in V2.1

See `screens/00-foundations-desktop.png` (bottom sections).

### Brand
- Name: **PhumiReader** in English, **ភូមិReader** in Khmer. Wordmark: "Phumi" (or "ភូមិ") in `--foreground` + "Reader" in `--brand-ink`, beside the green mark. On dark bars "Reader" uses `--primary`.
- Domain in examples: phumireader.app.

### Khmer typography
- Font: Kantumruy Pro for all Khmer UI (and for the novel reader when the story is Khmer).
- Line height 1.45 for headings and 1.6 for body; no negative letter-spacing; eyebrows are not uppercase.
- Put `lang="km"` on Khmer text. Khmer strings are longer: allow wrapping, never fixed widths on buttons.

### Header actions (right side, in order)
Search · language button (pill, 32 px, shows the *other* language: "ខ្មែរ" or "EN") · coin chip · bell (ghost icon button, red count badge `#EF4444`, 16 px, white 2 px ring) · avatar menu.
At ≤420 px: 4 px gaps, language button padding 0 8 px.

### Status badges (one meaning per colour)
| Badge | Variant |
|---|---|
| Published, Paid, Creator, Unlocked | brand (green tint) |
| Fast Pass, In review, Covers it | warn (amber) |
| Scheduled | default (dark) |
| Draft, Read | secondary (grey) |
| Hidden | outline |
| Changes requested, Failed, UP | up (red tint) |
| New, Up next, Popular | new (solid green) |

### Patterns added (build in `components/pr/`)
| Pattern | Where | Notes |
|---|---|---|
| StepsBar | Coins, Create series, Welcome | Numbered circles; current = dark fill, done = green with ✓ |
| OptionCard (radio as card) | Unlock choice, report reasons, payout method, reading mode | Selected = green border + 1 px ring + `#F6FEF9` |
| ReportDialog / BlockDialog | Global | Reasons per content type; case number; "Also block" |
| CommentThread | Series, Viewer, Comments | Pinned creator comment, spoiler blur button, replies indented 44 px with a 2 px left line |
| ListRowActions | Upload images, Manage episodes, Admin queue | 48 px thumb, title + meta, actions on the right; error rows `#FEF2F2`; selected queue row = brand tint + 3 px left bar |
| Timeline | Receipt | 12 px dots: green done, red failed, grey waiting |
| FastPassLockCard | Comic and novel readers | Dark card over a blurred first panel, or a fading text teaser |
| ResumeChip | Readers | Sticky pill under the bar: "You stopped at 40% · Continue / Start over" |
| SaveBar | Settings | Dark sticky bar: "You have unsaved changes · Discard / Save changes" |
| UndoBar | Library, Notifications, Admin | Dark toast with Undo, 6 s |
| CreatorNav | Creator pages | Grey band under the header with underline tabs |
| AdminShell | Admin | Dark top bar, 240 px white side menu with counts |
| StatCard | Dashboard, Earnings, Admin | Label, 26 px number, coloured change line |

### Placeholders that must stay visible until real values exist
[PRICE USD], [PRICE KHR], [PAYMENT PROVIDER FORM], [KHQR PLACEHOLDER], [USD AMOUNT], [REVENUE SHARE], [PAYOUT ACCOUNT], [PAYOUT DATE], [MIN PAYOUT], [PAYOUT PROVIDER FORM], [REFUND WINDOW], [SUPPORT EMAIL], [SUPPORT TELEGRAM], [SUPPORT HOURS], [SUPPORT RESPONSE TIME], [PROVIDER TRANSACTION ID], [MAINTENANCE START], [MAINTENANCE END], [EFFECTIVE DATE], [COMPANY NAME] and the other legal placeholders.
