"use client"

import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { demoData, purchaseHistory, type PaymentMethodId, type Purchase } from "@/data"
import type { Locale } from "@/i18n/routing"

/**
 * Simulated app state (login, coins, subscriptions, unlocks, reading progress,
 * purchases, reader settings), persisted in localStorage under one key.
 * Per design/spec.md "Simulated state". Per device, not per account (Assumption 14).
 */
export const STORE_KEY = "phumreader.app"

export type StoredUser = { name: string; email: string; /** From the real API: READER, CREATOR, ADMIN. */ roles?: string[] }
export type StoredAccount = StoredUser & { password: string }
export type StoredPurchase = Purchase & { orderId?: string }
export type NovelSettings = { size: number; theme: "light" | "sepia" | "dark"; font: "sans" | "serif"; wide: boolean }

type AppState = {
  user: StoredUser | null
  coins: number
  /** Series ids */
  subscriptions: string[]
  /** Creator names */
  follows: string[]
  unlocked: Record<string, number[]>
  /** Highest episode / chapter number opened, per series id */
  lastRead: Record<string, number>
  purchases: StoredPurchase[]
  returnTo: string | null
  shopReturn: { page: string; episode: number; title: string } | null
  /** `direct`: set by a reader redirect (locked episode opened by URL): reopen even when logged out. */
  pendingUnlock: { seriesId: string; episode: number; direct?: boolean } | null
  novelSettings: NovelSettings
  lang: Locale
  accounts: StoredAccount[]
  /** Toggles keyed by `likeKey.*` (episode likes, comment likes, bookmarks) */
  likes: Record<string, boolean>
  checkoutDraft: { pack: number; method: PaymentMethodId }
  /** Settings > Notifications (saved on this device only) */
  notifications: { episodes: boolean; fastPass: boolean }
}

type AppActions = {
  login: (user: StoredUser) => void
  logout: () => void
  addCoins: (amount: number) => void
  spendCoins: (amount: number) => void
  toggleSubscription: (seriesId: string) => void
  toggleFollow: (creator: string) => void
  unlockEpisode: (seriesId: string, episode: number) => void
  markRead: (seriesId: string, episode: number) => void
  addPurchase: (purchase: StoredPurchase) => void
  setReturnTo: (path: string) => void
  clearReturnTo: () => void
  setShopReturn: (value: NonNullable<AppState["shopReturn"]>) => void
  clearShopReturn: () => void
  setPendingUnlock: (value: NonNullable<AppState["pendingUnlock"]>) => void
  clearPendingUnlock: () => void
  setNovelSettings: (patch: Partial<NovelSettings>) => void
  setLang: (lang: Locale) => void
  addAccount: (account: StoredAccount) => void
  toggleLike: (key: string) => void
  setCheckoutDraft: (patch: Partial<AppState["checkoutDraft"]>) => void
  setNotification: (key: keyof AppState["notifications"], value: boolean) => void
  /** Settings > Reset demo data: back to 3 coins, logged out, the 2 demo purchases, default reader settings. */
  resetDemo: () => void
}

export const likeKey = {
  episode: (seriesId: string, n: number) => `episode:${seriesId}:${n}`,
  comment: (scope: string, id: string) => `comment:${scope}:${id}`,
  bookmark: (seriesId: string, n: number) => `bookmark:${seriesId}:${n}`,
}

const defaultPack = demoData.coinPacks.find((p) => p.tag === "Popular")?.coins ?? demoData.coinPacks[0].coins

const initialState = (): AppState => ({
  user: null,
  coins: 3,
  subscriptions: [],
  follows: [],
  unlocked: {},
  lastRead: {},
  purchases: purchaseHistory().map((p) => ({ ...p })),
  returnTo: null,
  shopReturn: null,
  pendingUnlock: null,
  novelSettings: { size: 18, theme: "light", font: "sans", wide: true },
  lang: "en",
  accounts: [],
  likes: {},
  checkoutDraft: { pack: defaultPack, method: "khqr" },
  notifications: { episodes: true, fastPass: false },
})

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      ...initialState(),

      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      addCoins: (amount) => set((s) => ({ coins: s.coins + amount })),
      spendCoins: (amount) => set((s) => ({ coins: Math.max(0, s.coins - amount) })),
      toggleSubscription: (seriesId) => set((s) => ({ subscriptions: toggleIn(s.subscriptions, seriesId) })),
      toggleFollow: (creator) => set((s) => ({ follows: toggleIn(s.follows, creator) })),
      unlockEpisode: (seriesId, episode) =>
        set((s) => {
          const list = s.unlocked[seriesId] ?? []
          return list.includes(episode) ? s : { unlocked: { ...s.unlocked, [seriesId]: [...list, episode].sort((a, b) => a - b) } }
        }),
      markRead: (seriesId, episode) =>
        set((s) => ((s.lastRead[seriesId] ?? 0) >= episode ? s : { lastRead: { ...s.lastRead, [seriesId]: episode } })),
      addPurchase: (purchase) => set((s) => ({ purchases: [purchase, ...s.purchases] })),
      setReturnTo: (path) => set({ returnTo: path }),
      clearReturnTo: () => set({ returnTo: null }),
      setShopReturn: (value) => set({ shopReturn: value }),
      clearShopReturn: () => set({ shopReturn: null }),
      setPendingUnlock: (value) => set({ pendingUnlock: value }),
      clearPendingUnlock: () => set({ pendingUnlock: null }),
      setNovelSettings: (patch) => set((s) => ({ novelSettings: { ...s.novelSettings, ...patch } })),
      setLang: (lang) => set({ lang }),
      addAccount: (account) => set((s) => ({ accounts: [...s.accounts.filter((a) => a.email !== account.email), account] })),
      toggleLike: (key) => set((s) => ({ likes: { ...s.likes, [key]: !s.likes[key] } })),
      setCheckoutDraft: (patch) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, ...patch } })),
      setNotification: (key, value) => set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      // The language is a preference tied to the URL locale, so a reset keeps it.
      resetDemo: () => set((s) => ({ ...initialState(), lang: s.lang })),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated once on mount (StoreHydrator) so server and first client render match.
      skipHydration: true,
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
