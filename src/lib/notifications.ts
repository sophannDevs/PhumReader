"use client"

import {
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useMemo, useRef } from "react"
import { notificationKindOfApi, type NotificationGroup, type NotificationKind } from "@/data"
import * as account from "@/lib/api/account"
import type { Schemas } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import { meKeys, notificationKeys } from "@/lib/api/keys"
import * as api from "@/lib/api/notifications"
import { ictDate } from "@/lib/format"
import { useAccountEmail } from "@/lib/me"
import { readerHref, seriesHref } from "@/lib/routes"
import { type NotifPrefs, useAppStore, useDemoUnreadCount } from "@/lib/store"

/**
 * The in-app inbox (V21-03) and the alert settings, for the Notifications page, the header bell and Settings.
 * Demo mode (`NEXT_PUBLIC_DEMO=1`) keeps the demo items and the store (`notifRead`, `notifGone`, `notifPrefs`);
 * real mode uses `GET /me/notifications`, the unread count, the read / remove / restore calls and the account's
 * `notifications` settings. The bell and the page share one cache (`notificationKeys`), so every change on the page
 * updates the bell at once, and both ask the API again on window focus and every 60 s (a second browser catches up).
 */

export type { InboxTab, NotificationItem } from "@/lib/api/notifications"

/** How often the bell and the open page ask the API again (also on window focus). */
export const INBOX_REFRESH_MS = 60_000

// ---------------------------------------------------------------- the bell

/** GET /me/notifications/unread-count for the signed-in account (real mode). */
export function useUnreadCountQuery() {
  const email = useAccountEmail()
  return useQuery({
    queryKey: notificationKeys.unread(email ?? ""),
    queryFn: api.fetchUnreadCount,
    enabled: !DEMO_MODE && !!email,
    refetchOnWindowFocus: "always",
    refetchInterval: INBOX_REFRESH_MS,
  })
}

/** The bell's number: the demo's unread items, or the API's unread count (0 while it loads or when logged out). */
export function useUnreadCount(): number {
  const demo = useDemoUnreadCount()
  const real = useUnreadCountQuery()
  const email = useAccountEmail()
  if (DEMO_MODE) return demo
  return email ? (real.data ?? 0) : 0
}

// ---------------------------------------------------------------- the inbox

/** The page's tabs → the API's (`updates` = New episodes = `episodes`). */
export const API_TAB = {
  all: "all",
  unread: "unread",
  updates: "episodes",
  comments: "comments",
  coins: "coins",
} as const satisfies Record<string, api.InboxTab>

/** The kind a tab lists (all and unread list every kind). */
const KIND_OF_TAB: Partial<Record<api.InboxTab, api.NotificationItem["kind"]>> = {
  episodes: "episode",
  comments: "comment",
  coins: "coins",
}

/** Whether `item` belongs in the list of `tab` (what the API would answer). */
export const inTab = (tab: api.InboxTab, item: api.NotificationItem) =>
  tab === "all" ? true : tab === "unread" ? !item.read : KIND_OF_TAB[tab] === item.kind

type Pages = InfiniteData<api.NotificationPage, string | undefined>

/** One tab of the inbox, newest first, a page at a time ("Load more"). */
export function useInbox(tab: api.InboxTab) {
  const email = useAccountEmail()
  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(email ?? "", tab),
    queryFn: ({ pageParam }) => api.fetchNotifications(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !DEMO_MODE && !!email,
    refetchOnWindowFocus: "always",
    refetchInterval: INBOX_REFRESH_MS,
  })
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data])
  return { query, items }
}

/** The tab of a list key (`notificationKeys.list`). */
const tabOfKey = (key: QueryKey) => key[3] as api.InboxTab

const listsOf = (email: string) => [...notificationKeys.all(email), "list"]

/** Changes the items of every loaded tab of the account. */
function editLists(qc: QueryClient, email: string, edit: (items: api.NotificationItem[]) => api.NotificationItem[]) {
  for (const [key, data] of qc.getQueriesData<Pages>({ queryKey: listsOf(email) })) {
    if (data) qc.setQueryData<Pages>(key, { ...data, pages: data.pages.map((p) => ({ ...p, items: edit(p.items) })) })
  }
}

/** Puts `item` back where it belongs (newest first) in every loaded tab it is part of; not past the loaded pages. */
function insertInLists(qc: QueryClient, email: string, item: api.NotificationItem) {
  const at = Date.parse(item.createdAt)
  for (const [key, data] of qc.getQueriesData<Pages>({ queryKey: listsOf(email) })) {
    const tab = tabOfKey(key)
    if (!data || !inTab(tab, item) || data.pages.some((p) => p.items.some((x) => x.id === item.id))) continue
    const pages = data.pages.map((p) => ({ ...p, items: [...p.items] }))
    for (let i = 0; i < pages.length; i++) {
      const items = pages[i].items
      const index = items.findIndex((x) => Date.parse(x.createdAt) < at)
      const last = i === pages.length - 1
      if (index >= 0 || (last && !pages[i].nextCursor)) {
        items.splice(index >= 0 ? index : items.length, 0, item)
        break
      }
    }
    qc.setQueryData<Pages>(key, { ...data, pages })
  }
}

/** Moves the bell's number by `delta` (never below 0) until the API's own count comes back. */
function bumpCount(qc: QueryClient, email: string, delta: number) {
  qc.setQueryData<number>(notificationKeys.unread(email), (n) => (n === undefined ? n : Math.max(0, n + delta)))
}

/**
 * What the page does with items (real mode). Each change shows at once in every tab and on the bell, then the API is
 * called and the inbox and count are read again, so they end up as the API has them (a failure undoes the change).
 * The promises reject when the call fails, for the page's error message.
 */
export function useInboxActions() {
  const qc = useQueryClient()
  const email = useAccountEmail() ?? ""

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: notificationKeys.all(email) }), [qc, email])
  /** Stops reads of the inbox and count on their way, so they can't undo the change about to be shown. */
  const hold = useCallback(() => qc.cancelQueries({ queryKey: notificationKeys.all(email) }), [qc, email])

  const setRead = useCallback(
    async (item: api.NotificationItem, read: boolean) => {
      await hold()
      editLists(qc, email, (items) => items.map((x) => (x.id === item.id ? { ...x, read } : x)))
      if (item.read !== read) bumpCount(qc, email, read ? -1 : 1)
      try {
        await api.setNotificationRead(item.id, read)
      } finally {
        void refresh()
      }
    },
    [qc, email, refresh, hold]
  )

  /**
   * The API calls of each item, chained in the order the reader made them: remove, Undo, remove again reach the
   * API in that order, however long each call takes (otherwise a late restore could bring back an item removed
   * after it).
   */
  const queue = useRef(new Map<string, Promise<void>>())
  /** The number of the latest action on each item: only that one puts the screen back when its call fails. */
  const latest = useRef(new Map<string, number>())

  /** Queues `call` after the item's earlier calls; registered at once, before any await, to keep the order. */
  const inOrder = useCallback((id: string, call: () => Promise<void>) => {
    const turn = (latest.current.get(id) ?? 0) + 1
    latest.current.set(id, turn)
    const done = (queue.current.get(id) ?? Promise.resolve()).catch(() => undefined).then(call)
    queue.current.set(id, done)
    void done
      .catch(() => undefined)
      .finally(() => {
        if (queue.current.get(id) === done) queue.current.delete(id)
      })
    return { done, isLatest: () => latest.current.get(id) === turn }
  }, [])

  const remove = useCallback(
    async (item: api.NotificationItem): Promise<void> => {
      const { done, isLatest } = inOrder(item.id, () => api.removeNotification(item.id))
      await hold()
      editLists(qc, email, (items) => items.filter((x) => x.id !== item.id))
      if (!item.read) bumpCount(qc, email, -1)
      try {
        await done
      } catch (error) {
        if (isLatest()) {
          insertInLists(qc, email, item)
          if (!item.read) bumpCount(qc, email, 1)
        }
        throw error
      } finally {
        if (isLatest()) void refresh()
      }
    },
    [qc, email, refresh, hold, inOrder]
  )

  /** The Undo after `remove`: the item is back at once; the API is asked after the removal's call. */
  const restore = useCallback(
    async (item: api.NotificationItem) => {
      const { done, isLatest } = inOrder(item.id, () => api.restoreNotification(item.id))
      await hold()
      insertInLists(qc, email, item)
      if (!item.read) bumpCount(qc, email, 1)
      try {
        await done
      } finally {
        if (isLatest()) void refresh()
      }
    },
    [qc, email, refresh, hold, inOrder]
  )

  const readAll = useCallback(async () => {
    await hold()
    editLists(qc, email, (items) => items.map((x) => (x.read ? x : { ...x, read: true })))
    qc.setQueryData<number>(notificationKeys.unread(email), 0)
    try {
      await api.markAllNotificationsRead()
    } finally {
      void refresh()
    }
  }, [qc, email, refresh, hold])

  return { setRead, remove, restore, readAll, refresh }
}

// ---------------------------------------------------------------- one item

/** The inbox kind of an API item (icon and tab), see `notificationKindOfApi`. */
export const kindOf = (item: api.NotificationItem): NotificationKind => notificationKindOfApi[item.kind] ?? "system"

const DAY_MS = 86_400_000

/** Today, This week (the 6 days before) or Earlier, by the dates in Cambodia time (ICT). */
export function inboxGroup(at: number, now: number): NotificationGroup {
  const days = Math.round((Date.parse(ictDate(now)) - Date.parse(ictDate(at))) / DAY_MS)
  return days <= 0 ? "Today" : days < 7 ? "This week" : "Earlier"
}

const text = (value: unknown) => (typeof value === "string" && value ? value : undefined)

/**
 * Where an item leads: the episode (or chapter), the comments of the series or episode, the order's receipt (Coins),
 * the reported series, Manage series for the creator's own series, Home for the welcome.
 */
export function notificationHref(item: api.NotificationItem): string {
  const series = item.series ?? undefined
  switch (item.type) {
    case "episode_published":
      return series ? (item.episode ? readerHref(series, item.episode) : seriesHref(series)) : "/"
    case "comment_liked":
      return series ? `${seriesHref(series)}/comments${item.episode ? `?ep=${item.episode}` : ""}` : "/"
    case "order_paid":
    case "order_refunded": {
      const order = text(item.data.orderNumber)
      return order ? `/coins/orders/${encodeURIComponent(order)}` : "/coins"
    }
    case "report_resolved":
    case "report_dismissed":
      return series ? seriesHref(series) : "/"
    case "series_approved":
    case "series_changes":
    case "series_rejected":
      return series ? `/creator/series/${series.id}` : "/creator"
    default:
      return "/"
  }
}

// ---------------------------------------------------------------- alert settings

export const ALERT_TYPES = ["update", "fastpass", "comment", "coins", "news"] as const
export type AlertType = (typeof ALERT_TYPES)[number]

type ApiNotifications = Schemas["NotificationSettings"]
type NotificationsChange = Schemas["NotificationsChange"]

/** The account's alert settings as the page's `[push, email]` pairs, quiet hours and digest (keys as in the store). */
export function prefsFromApi(n: ApiNotifications): NotifPrefs {
  const pair = (type: AlertType): [boolean, boolean] => [n.types[type].push, n.types[type].email]
  return {
    update: pair("update"),
    comment: pair("comment"),
    coins: pair("coins"),
    fastpass: pair("fastpass"),
    news: pair("news"),
    quiet: n.quiet.on,
    from: n.quiet.from,
    to: n.quiet.to,
    digest: n.digest,
  }
}

/** The same alert settings (whatever the key order). */
export const samePrefs = (a: NotifPrefs, b: NotifPrefs) =>
  (Object.keys(b) as (keyof NotifPrefs)[]).every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]))

/** The other way round (the cached account settings follow every change at once). */
export function prefsToApi(p: NotifPrefs): ApiNotifications {
  const types = Object.fromEntries(ALERT_TYPES.map((type) => [type, { push: p[type][0], email: p[type][1] }])) as ApiNotifications["types"]
  return { types, quiet: { on: p.quiet, from: p.from, to: p.to }, digest: p.digest, episodes: p.update[0], fastPass: p.fastpass[0] }
}

/** The PATCH for a change: only the switches that differ from `before` (the API merges what is sent). */
export function prefsChange(before: NotifPrefs, patch: Partial<NotifPrefs>): NotificationsChange {
  const change: NotificationsChange = {}
  for (const type of ALERT_TYPES) {
    const next = patch[type]
    if (!next) continue
    const one: Schemas["AlertSwitchChange"] = {}
    if (next[0] !== before[type][0]) one.push = next[0]
    if (next[1] !== before[type][1]) one.email = next[1]
    if (Object.keys(one).length) change.types = { ...change.types, [type]: one }
  }
  const quiet: Schemas["QuietHoursChange"] = {}
  if (patch.quiet !== undefined && patch.quiet !== before.quiet) quiet.on = patch.quiet
  if (patch.from !== undefined && patch.from !== before.from) quiet.from = patch.from
  if (patch.to !== undefined && patch.to !== before.to) quiet.to = patch.to
  if (Object.keys(quiet).length) change.quiet = quiet
  if (patch.digest !== undefined && patch.digest !== before.digest) change.digest = patch.digest
  return change
}

const pick = (prefs: NotifPrefs, keys: (keyof NotifPrefs)[]): Partial<NotifPrefs> =>
  Object.fromEntries(keys.map((k) => [k, prefs[k]])) as Partial<NotifPrefs>

/**
 * GET /me/settings for the signed-in account (real mode), shared by SettingsSync (which loads it and applies it to
 * this browser once per account), the alert settings and the Settings page. `load: false` only reads what is
 * already loaded (no request of its own).
 */
export function useAccountSettings(load = true) {
  const email = useAccountEmail()
  return useQuery({
    queryKey: meKeys.settings(email ?? ""),
    queryFn: account.fetchSettings,
    enabled: load && !DEMO_MODE && !!email,
    staleTime: Infinity,
  })
}

/**
 * Changes alert settings at once (the store and, in real mode, the cached account settings) and saves them: demo to
 * the store only; real mode PATCHes `/me/settings` with only what changed and keeps the account's answer. When the
 * save fails, the changed settings go back to what they were and the promise rejects.
 */
export async function saveAlertPrefs(qc: QueryClient, email: string | undefined, patch: Partial<NotifPrefs>): Promise<void> {
  if (DEMO_MODE || !email) {
    useAppStore.getState().setNotifPrefs(patch)
    return
  }
  const key = meKeys.settings(email)
  const current = () => {
    const cached = qc.getQueryData<account.Settings>(key)
    return cached ? prefsFromApi(cached.notifications) : useAppStore.getState().notifPrefs
  }
  const apply = (prefs: NotifPrefs) => {
    useAppStore.setState({ notifPrefs: prefs, notifications: { episodes: prefs.update[0], fastPass: prefs.fastpass[0] } })
    qc.setQueryData<account.Settings>(key, (s) => (s ? { ...s, notifications: prefsToApi(prefs) } : s))
  }
  const keys = Object.keys(patch) as (keyof NotifPrefs)[]
  const before = current()
  const change = prefsChange(before, patch)
  apply({ ...before, ...patch })
  if (Object.keys(change).length === 0) return
  try {
    const saved = await account.patchSettings({ notifications: change })
    // Only what was sent: another switch may have changed since (its own save keeps its answer).
    apply({ ...current(), ...pick(prefsFromApi(saved.notifications), keys) })
  } catch (error) {
    apply({ ...current(), ...pick(before, keys) })
    throw error
  }
}

/** `saveAlertPrefs` for the signed-in account. */
export function useSaveAlertPrefs() {
  const qc = useQueryClient()
  const email = useAccountEmail()
  return useCallback((patch: Partial<NotifPrefs>) => saveAlertPrefs(qc, email, patch), [qc, email])
}
