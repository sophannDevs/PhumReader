"use client"

import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  demoData,
  purchaseHistory,
  type Genre,
  type MyWork,
  type NotificationKind,
  type PaymentMethodId,
  type Purchase,
  type ReportTarget,
} from "@/data"
import type { Locale } from "@/i18n/routing"
import { DEMO_MODE } from "@/lib/api/config"
import { STORAGE_PREFIX } from "@/lib/storage-migration"

/**
 * Simulated app state, persisted in localStorage under one key (design/spec.md §0 "Simulated state").
 * The spec's key names map to these fields: subs → `subscriptions`, read → `lastRead`, novel → `novelSettings`;
 * `receipt` and `legalDoc` are URL params in this app (`/coins/orders/[id]`, `/legal/[doc]`).
 * Per device, not per account (V1 Assumption 14).
 */
export const STORE_KEY = `${STORAGE_PREFIX}app`
/** v1 → v2: V2.1 keys. v2 → v3: with the real API the balance and purchases come from the server, not the device. */
const STORE_VERSION = 3

export type StoredUser = {
  name: string
  email: string
  /** READER, CREATOR, ADMIN (real API; the demo accounts get the same from their role). */
  roles?: string[]
  /** From the real API: the profile picture, or null for initials. */
  avatarUrl?: string | null
}
export type StoredAccount = StoredUser & { password: string }
export type StoredPurchase = Purchase & {
  orderId?: string
  /** Epoch ms of the order (receipts show date and time in ICT). */
  at?: number
  base?: number
  bonus?: number
  first?: number
}
export type NovelSettings = { size: number; theme: "light" | "sepia" | "dark"; font: "sans" | "serif"; wide: boolean }

/** Settings and reader preferences (spec §0 `settings`). */
export type AppSettings = {
  mode: "scroll" | "page"
  quality: "auto" | "high" | "saver"
  theme: "system" | "light" | "dark"
  /** Novel text size preset used for the first visit of the novel reader (Settings: A− A A+ A++) */
  size: "s" | "m" | "l" | "xl"
  autoNext: boolean
  saveData: boolean
  region: string
  /** Story languages (at least one) */
  langs: Locale[]
  publicLib: boolean
  mature: boolean
  google: boolean
  facebook: boolean
}

/** [push, email] per alert type, quiet hours (ICT, 0-23) and the daily digest (spec §13). */
export type NotifPrefs = {
  update: [boolean, boolean]
  comment: [boolean, boolean]
  coins: [boolean, boolean]
  fastpass: [boolean, boolean]
  news: [boolean, boolean]
  quiet: boolean
  from: number
  to: number
  digest: boolean
}

export type ReportStatus = "In review" | "Removed" | "No violation found"
export type StoredReport = {
  /** Case number R-xxxxx */
  id: string
  kind: ReportTarget
  /** "comment by Vibol K.", "Glass Compass · Episode 12", … */
  target: string
  /** The reported person, when there is one */
  who: string
  reason: string
  details: string
  at: number
  status: ReportStatus
}

/**
 * Demo "Request changes": the reasons as keys (`REVIEW_ITEMS`: "contact", "cover", …; Manage series translates them;
 * saves from before V21-01 hold the admin's label instead, shown as it is) and the admin's note.
 */
export type ReviewNote = { items: string[]; note: string }
export type HelpPrefill = { topic: string; order: string; msg: string }
/** `handle`: the profile it belongs to (/creators/[handle]); older saves without one belong to the signed-in creator. */
export type CreatorProfile = { name: string; location: string; bio: string; handle?: string }
export type AdminDecision = { id: string; queue: "series" | "reports" | "payments"; label: string; action: string; at: number }

export type AppState = {
  user: StoredUser | null
  coins: number
  /** Series ids (spec `subs`) */
  subscriptions: string[]
  /** Creator names */
  follows: string[]
  unlocked: Record<string, number[]>
  /** Highest episode / chapter number opened, per series id (spec `read`) */
  lastRead: Record<string, number>
  /** Reader scroll position 0..1 per series id and episode (spec `pos`) */
  pos: Record<string, Record<number, number>>
  purchases: StoredPurchase[]
  returnTo: string | null
  /**
   * Coins opened from a locked episode: where to go back. `price` is that episode's Fast Pass price and `novel` says
   * "chapter"; both are optional (older stored values have neither: the demo's price, and the demo series' type).
   */
  shopReturn: { page: string; episode: number; title: string; price?: number; novel?: boolean } | null
  /** `direct`: set by a reader redirect (locked episode opened by URL): reopen even when logged out. */
  pendingUnlock: { seriesId: string; episode: number; direct?: boolean; bundle?: boolean } | null
  /** Spec `novel` */
  novelSettings: NovelSettings
  /** The novel reader's own settings were chosen (its Aa popover); until then its size and theme follow Settings. */
  novelCustom: boolean
  settings: AppSettings
  readerBg: "dark" | "light"
  readerWidth: "fit" | "narrow"
  lang: Locale
  accounts: StoredAccount[]
  /** Toggles keyed by `likeKey.*` (episode likes, comment likes, bookmarks) */
  likes: Record<string, boolean>
  checkoutDraft: { pack: number; method: PaymentMethodId }
  /** V1 Settings > Notifications: the push switches of New episodes and Fast Pass (`notifPrefs` has them too) */
  notifications: { episodes: boolean; fastPass: boolean }
  /** Home genre picks; null = never chosen (spec `prefs`) */
  prefs: Genre[] | null
  /** Demo inbox: read and removed item ids (real mode: the API keeps them, V21-03) */
  notifRead: string[]
  notifGone: string[]
  /** Alert settings; real mode: the account's, loaded by SettingsSync and saved by `saveAlertPrefs` */
  notifPrefs: NotifPrefs
  /** Blocked display names */
  blocked: string[]
  /** Real mode: the blocked accounts' ids by display name (Unblock calls the API with them) */
  blockedIds: Record<string, string>
  reports: StoredReport[]
  myWorks: MyWork[]
  reviewNotes: Record<string, ReviewNote>
  /** Where /welcome returns to after first-time setup */
  welcomeNext: string | null
  /** First-time setup finished or skipped */
  welcomed: boolean
  helpPrefill: HelpPrefill | null
  recentSearches: string[]
  /** Creator profile edits (owner view) */
  profile: CreatorProfile | null
  payoutSet: boolean
  /** Create series draft (autosaved) */
  draftSeries: Record<string, unknown> | null
  /** Admin decisions (newest first), with ids of handled queue items */
  adminLog: AdminDecision[]
  /** Library > Recently read: series ids removed from the history (demo; prototype `v2histHidden`) */
  historyHidden: string[]
}

type AppActions = {
  login: (user: StoredUser) => void
  logout: () => void
  addCoins: (amount: number) => void
  spendCoins: (amount: number) => void
  toggleSubscription: (seriesId: string) => void
  setSubscriptions: (ids: string[]) => void
  toggleFollow: (creator: string) => void
  unlockEpisode: (seriesId: string, episode: number) => void
  markRead: (seriesId: string, episode: number) => void
  setPos: (seriesId: string, episode: number, value: number) => void
  addPurchase: (purchase: StoredPurchase) => void
  setReturnTo: (path: string) => void
  clearReturnTo: () => void
  setShopReturn: (value: NonNullable<AppState["shopReturn"]>) => void
  clearShopReturn: () => void
  setPendingUnlock: (value: NonNullable<AppState["pendingUnlock"]>) => void
  clearPendingUnlock: () => void
  setNovelSettings: (patch: Partial<NovelSettings>) => void
  /** The novel reader's Aa popover: saves all its settings and marks them as chosen (`novelCustom`). */
  chooseNovelSettings: (value: NovelSettings) => void
  setSettings: (patch: Partial<AppSettings>) => void
  setReaderBg: (value: AppState["readerBg"]) => void
  setReaderWidth: (value: AppState["readerWidth"]) => void
  setLang: (lang: Locale) => void
  addAccount: (account: StoredAccount) => void
  toggleLike: (key: string) => void
  setCheckoutDraft: (patch: Partial<AppState["checkoutDraft"]>) => void
  setNotification: (key: keyof AppState["notifications"], value: boolean) => void
  setPrefs: (genres: Genre[] | null) => void
  setNotifRead: (id: string, read: boolean) => void
  markAllNotifRead: (ids: string[]) => void
  removeNotif: (id: string) => void
  restoreNotif: (id: string) => void
  setNotifPrefs: (patch: Partial<NotifPrefs>) => void
  /** `userId`: real mode, the account (kept for Unblock) */
  block: (name: string, userId?: string) => void
  unblock: (name: string) => void
  /** Saves a report and returns its case number (`caseId`: the API's R-xxxxx) */
  addReport: (report: Omit<StoredReport, "id" | "at" | "status">, caseId?: string) => string
  setReportStatus: (id: string, status: ReportStatus) => void
  upsertWork: (work: MyWork) => void
  setWorkStatus: (id: string, status: MyWork["status"]) => void
  setReviewNote: (id: string, note: ReviewNote | null) => void
  setWelcomeNext: (path: string | null) => void
  setWelcomed: (value: boolean) => void
  setHelpPrefill: (value: HelpPrefill | null) => void
  addRecentSearch: (q: string) => void
  removeRecentSearch: (q: string) => void
  clearRecentSearches: () => void
  setProfile: (profile: CreatorProfile | null) => void
  setPayoutSet: (value: boolean) => void
  setDraftSeries: (draft: Record<string, unknown> | null) => void
  logAdmin: (decision: AdminDecision) => void
  undoAdmin: (id: string) => void
  setHistoryHidden: (ids: string[]) => void
  /** Settings > Reset demo data: back to 3 coins, logged out, the 2 demo purchases, default reader settings. */
  resetDemo: () => void
}

export const likeKey = {
  episode: (seriesId: string, n: number) => `episode:${seriesId}:${n}`,
  comment: (scope: string, id: string) => `comment:${scope}:${id}`,
  bookmark: (seriesId: string, n: number) => `bookmark:${seriesId}:${n}`,
}

/** Demo order numbers for the two purchase-history rows (Receipt screens, Help "TW-12345678" format). */
export const DEMO_ORDER_IDS = ["TW-48213377", "TW-48190012"] as const

/** ICT is UTC+7: the demo rows' times as shown on the Receipt screens. */
const demoOrderTimes = [Date.UTC(2026, 9, 28, 7, 5), Date.UTC(2026, 9, 12, 2, 40)]

const demoPurchases = (): StoredPurchase[] =>
  purchaseHistory().map((p, i) => ({ ...p, orderId: DEMO_ORDER_IDS[i], at: demoOrderTimes[i] }))

/** The regions Settings offers (and the account accepts, V21-08); `settings.region` holds one of them. */
export const REGIONS = ["KH", "TH", "VN", "OTHER"] as const
export type Region = (typeof REGIONS)[number]

export const defaultSettings: AppSettings = {
  mode: "scroll",
  quality: "auto",
  theme: "system",
  size: "m",
  autoNext: true,
  saveData: false,
  region: "KH",
  langs: ["en", "km"],
  publicLib: false,
  mature: false,
  google: true,
  facebook: false,
}

export const defaultNotifPrefs: NotifPrefs = {
  update: [true, false],
  comment: [true, false],
  coins: [true, true],
  fastpass: [true, false],
  news: [false, false],
  quiet: true,
  from: 22,
  to: 7,
  digest: false,
}

/** The demo "Removed" report shown in Settings > Your reports (prototype default). */
const demoReports = (): StoredReport[] => [
  {
    id: "R-20477",
    kind: "comment",
    target: "comment by spam_bot_88",
    who: "spam_bot_88",
    reason: "spam",
    details: "",
    at: Date.UTC(2026, 9, 30),
    status: "Removed",
  },
]

const defaultPack = demoData.coinPacks.find((p) => p.tag === "Popular")?.coins ?? demoData.coinPacks[0].coins

const initialState = (): AppState => ({
  user: null,
  coins: DEMO_MODE ? 3 : 0,
  subscriptions: [],
  follows: [],
  unlocked: {},
  lastRead: {},
  pos: {},
  purchases: DEMO_MODE ? demoPurchases() : [],
  returnTo: null,
  shopReturn: null,
  pendingUnlock: null,
  novelSettings: { size: 18, theme: "light", font: "sans", wide: true },
  novelCustom: false,
  settings: { ...defaultSettings, langs: [...defaultSettings.langs] },
  readerBg: "dark",
  readerWidth: "fit",
  lang: "en",
  accounts: [],
  likes: {},
  checkoutDraft: { pack: defaultPack, method: "khqr" },
  notifications: { episodes: true, fastPass: false },
  prefs: null,
  notifRead: [...demoData.notificationsReadByDefault],
  notifGone: [],
  notifPrefs: { ...defaultNotifPrefs },
  blocked: [],
  blockedIds: {},
  reports: demoReports(),
  myWorks: demoData.myWorks.map((w) => ({ ...w })),
  reviewNotes: {},
  welcomeNext: null,
  welcomed: false,
  helpPrefill: null,
  recentSearches: ["letters to tuesday", "Mina Sok", "romance", "dragon"],
  profile: null,
  payoutSet: false,
  draftSeries: null,
  adminLog: [],
  historyHidden: [],
})

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState(),

      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      addCoins: (amount) => set((s) => ({ coins: s.coins + amount })),
      spendCoins: (amount) => set((s) => ({ coins: Math.max(0, s.coins - amount) })),
      toggleSubscription: (seriesId) => set((s) => ({ subscriptions: toggleIn(s.subscriptions, seriesId) })),
      setSubscriptions: (ids) => set({ subscriptions: [...new Set(ids)] }),
      toggleFollow: (creator) => set((s) => ({ follows: toggleIn(s.follows, creator) })),
      unlockEpisode: (seriesId, episode) =>
        set((s) => {
          const list = s.unlocked[seriesId] ?? []
          return list.includes(episode) ? s : { unlocked: { ...s.unlocked, [seriesId]: [...list, episode].sort((a, b) => a - b) } }
        }),
      markRead: (seriesId, episode) =>
        set((s) => ((s.lastRead[seriesId] ?? 0) >= episode ? s : { lastRead: { ...s.lastRead, [seriesId]: episode } })),
      setPos: (seriesId, episode, value) =>
        set((s) => ({ pos: { ...s.pos, [seriesId]: { ...(s.pos[seriesId] ?? {}), [episode]: Math.min(1, Math.max(0, value)) } } })),
      addPurchase: (purchase) => set((s) => ({ purchases: [{ at: Date.now(), ...purchase }, ...s.purchases].slice(0, 30) })),
      setReturnTo: (path) => set({ returnTo: path }),
      clearReturnTo: () => set({ returnTo: null }),
      setShopReturn: (value) => set({ shopReturn: value }),
      clearShopReturn: () => set({ shopReturn: null }),
      setPendingUnlock: (value) => set({ pendingUnlock: value }),
      clearPendingUnlock: () => set({ pendingUnlock: null }),
      setNovelSettings: (patch) => set((s) => ({ novelSettings: { ...s.novelSettings, ...patch } })),
      chooseNovelSettings: (value) => set({ novelSettings: { ...value }, novelCustom: true }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setReaderBg: (value) => set({ readerBg: value }),
      setReaderWidth: (value) => set({ readerWidth: value }),
      setLang: (lang) => set({ lang }),
      addAccount: (account) => set((s) => ({ accounts: [...s.accounts.filter((a) => a.email !== account.email), account] })),
      toggleLike: (key) => set((s) => ({ likes: { ...s.likes, [key]: !s.likes[key] } })),
      setCheckoutDraft: (patch) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, ...patch } })),
      setNotification: (key, value) => set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      setPrefs: (genres) => set({ prefs: genres }),
      setNotifRead: (id, read) =>
        set((s) => ({ notifRead: read ? [...new Set([...s.notifRead, id])] : s.notifRead.filter((x) => x !== id) })),
      markAllNotifRead: (ids) => set((s) => ({ notifRead: [...new Set([...s.notifRead, ...ids])] })),
      removeNotif: (id) => set((s) => ({ notifGone: [...new Set([...s.notifGone, id])] })),
      restoreNotif: (id) => set((s) => ({ notifGone: s.notifGone.filter((x) => x !== id) })),
      setNotifPrefs: (patch) => set((s) => ({ notifPrefs: { ...s.notifPrefs, ...patch } })),
      block: (name, userId) =>
        set((s) => ({
          blocked: s.blocked.includes(name) ? s.blocked : [...s.blocked, name],
          blockedIds: userId ? { ...s.blockedIds, [name]: userId } : s.blockedIds,
        })),
      unblock: (name) =>
        set((s) => ({
          blocked: s.blocked.filter((x) => x !== name),
          blockedIds: Object.fromEntries(Object.entries(s.blockedIds).filter(([n]) => n !== name)),
        })),
      addReport: (report, caseId) => {
        const id = caseId ?? `R-${20480 + get().reports.length + 1}`
        set((s) => ({ reports: [{ ...report, id, at: Date.now(), status: "In review" as const }, ...s.reports].slice(0, 20) }))
        return id
      },
      setReportStatus: (id, status) => set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) })),
      upsertWork: (work) =>
        set((s) => ({
          myWorks: s.myWorks.some((w) => w.id === work.id) ? s.myWorks.map((w) => (w.id === work.id ? work : w)) : [...s.myWorks, work],
        })),
      setWorkStatus: (id, status) => set((s) => ({ myWorks: s.myWorks.map((w) => (w.id === id ? { ...w, status } : w)) })),
      setReviewNote: (id, note) =>
        set((s) => {
          const next = { ...s.reviewNotes }
          if (note) next[id] = note
          else delete next[id]
          return { reviewNotes: next }
        }),
      setWelcomeNext: (path) => set({ welcomeNext: path }),
      setWelcomed: (value) => set({ welcomed: value }),
      setHelpPrefill: (value) => set({ helpPrefill: value }),
      addRecentSearch: (q) =>
        set((s) => {
          const t = q.trim()
          if (!t) return s
          return { recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) }
        }),
      removeRecentSearch: (q) => set((s) => ({ recentSearches: s.recentSearches.filter((x) => x !== q) })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      setProfile: (profile) => set({ profile }),
      setPayoutSet: (value) => set({ payoutSet: value }),
      setDraftSeries: (draft) => set({ draftSeries: draft }),
      logAdmin: (decision) => set((s) => ({ adminLog: [decision, ...s.adminLog.filter((d) => d.id !== decision.id)].slice(0, 50) })),
      undoAdmin: (id) => set((s) => ({ adminLog: s.adminLog.filter((d) => d.id !== id) })),
      setHistoryHidden: (ids) => set({ historyHidden: [...new Set(ids)] }),
      // The language is a preference tied to the URL locale, so a reset keeps it.
      resetDemo: () => set((s) => ({ ...initialState(), lang: s.lang })),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated once on mount (StoreHydrator) so server and first client render match.
      skipHydration: true,
      // v1 (V1 frontend) → v2 (V2.1): new keys take their defaults (shallow merge); the two demo purchase rows
      // get their TW- order numbers so the Receipt page can open them.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState>
        if (version < 2 && Array.isArray(state.purchases)) {
          const demo = demoPurchases()
          state.purchases = state.purchases.map((p) => {
            if (p.orderId) return p
            const match = demo.find((d) => d.date === p.date && d.pack === p.pack && d.status === p.status)
            return match ? { ...p, orderId: match.orderId, at: match.at } : p
          })
        }
        if (version < 3 && !DEMO_MODE) {
          state.coins = 0
          state.purchases = []
        }
        return state as AppState & AppActions
      },
    }
  )
)

/** true once the persisted state has been loaded from localStorage (client only). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false
  )
}

// ---- selectors
export const useUser = () => useAppStore((s) => s.user)
export const useCoins = () => useAppStore((s) => s.coins)
export const useIsUnlocked = (seriesId: string, n: number) =>
  useAppStore((s) => s.unlocked[seriesId]?.includes(n) ?? false)
export const useIsRead = (seriesId: string, n: number) => useAppStore((s) => n <= (s.lastRead[seriesId] ?? 0))
export const useIsBlocked = (name: string) => useAppStore((s) => s.blocked.includes(name))
export const isCreator = (user: StoredUser | null) => !!user?.roles?.some((r) => r === "CREATOR" || r === "ADMIN")
export const isAdmin = (user: StoredUser | null) => !!user?.roles?.includes("ADMIN")

/** Demo inbox items still shown (not removed), with their read state. */
export function visibleNotifications(state: Pick<AppState, "notifGone" | "notifRead">) {
  return demoData.notifications
    .filter((n) => !state.notifGone.includes(n.id))
    .map((n) => ({ ...n, read: state.notifRead.includes(n.id) }))
}
/** The demo's unread items (the bell in demo mode; real mode asks the API: `useUnreadCount` in src/lib/notifications.ts). */
export const useDemoUnreadCount = () =>
  useAppStore((s) => demoData.notifications.filter((n) => !s.notifGone.includes(n.id) && !s.notifRead.includes(n.id)).length)

export type { NotificationKind }

/** The two demo history rows are display-only: they don't end the first-purchase offer (V1 Assumption 9). */
export const isDemoOrder = (orderId: string) => (DEMO_ORDER_IDS as readonly string[]).includes(orderId)
