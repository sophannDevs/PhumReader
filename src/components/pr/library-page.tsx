"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LibraryIcon } from "@/components/animate-ui/icons/library"
import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { SparklesIcon } from "@/components/animate-ui/icons/sparkles"
import { XIcon } from "@/components/animate-ui/icons/x"
import { ZapIcon } from "@/components/animate-ui/icons/zap"
import Image from "next/image"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { UndoBar, useUndo } from "@/components/pr/patterns"
import { NativeSelect } from "@/components/pr/settings-ui"
import { StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { episodesFor, fastPassPrice, type ContinueView, type Series } from "@/data"
import { Link, usePathname } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { SUN_FIRST_WEEKDAYS, addDays, daysFromToday, formatShortDate, ictDate, today, weekdayOf } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { meKeys, useAccountEmail, useFailed, useSubscriptions } from "@/lib/me"
import { useDemoFlag, useLibrary } from "@/lib/queries"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * My library (spec §8, prototype Library/): tabs Subscribed / Recently read / Unlocked, the "New episodes" filter,
 * sort, edit mode (select all, remove) with a 6 s Undo bar, a guest banner and empty states.
 * Demo mode reads the store (subscriptions, lastRead + the demo history, unlocked); the real API mode reads
 * /me/subscriptions, /me/history and /me/unlocked and removes / restores through the API.
 */

type Tab = "subs" | "recent" | "unl"
type SubSort = "updated" | "added" | "az"
type RecentSort = "recent" | "progress" | "az"

type HistoryItem = { series: Series; episode: number; progress: number; when: string }
/** `coins`: what the reader paid for them (real API); the demo counts the demo price per episode. */
type UnlockedItem = { series: Series; numbers: number[]; coins?: number }

const NONE_LIST: string[] = []
const NONE_MAP: Record<string, number[]> = {}
const NONE_READ: Record<string, number> = {}
/** Days ago of the demo history rows, in order (prototype: Today, Today, Yesterday, 2 days ago, …). */
const DEMO_DAYS_AGO = [0, 0, 1, 2, 3, 7]

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** New episodes waiting in a subscribed series (prototype: UP series have 1–3). */
function newCount(s: Series): number {
  if (!s.badges.up) return 0
  const m = /^S(\d+)$/.exec(s.id)
  return m ? (Number(m[1]) % 3) + 1 : 1
}

/** Days since the series' latest update day (0 = today), for "Recently updated". */
function daysSinceUpdate(s: Series): number {
  if (!s.updateDays.length) return 7
  return Math.min(...s.updateDays.map((d) => (SUN_FIRST_WEEKDAYS.indexOf(weekdayOf(today)) - SUN_FIRST_WEEKDAYS.indexOf(d) + 7) % 7))
}

/** "Nov 26, 2026" (episode display date) → "2026-11-26", or undefined. */
function displayToIso(display: string): string | undefined {
  const ms = Date.parse(`${display} UTC`)
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().slice(0, 10)
}

/** ISO date (YYYY-MM-DD) → days between it and `now`'s date (both in ICT). */
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

function SelectBox({ on, size = "md" }: { on: boolean; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center border",
        size === "lg" ? "size-[22px] rounded-md border-transparent shadow-md" : "size-5 rounded-[5px]",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : size === "lg"
            ? "bg-white/95 text-transparent"
            : "border-border-strong bg-background text-transparent"
      )}
    >
      <CheckIcon className="size-3" strokeWidth={3} />
    </span>
  )
}

function Thumb({ series }: { series: Series }) {
  return (
    <Link
      href={seriesHref(series)}
      tabIndex={-1}
      aria-hidden
      className="h-[74px] w-14 shrink-0 overflow-hidden rounded-lg bg-muted max-md:h-16 max-md:w-12"
    >
      <Image src={series.cover} alt="" width={112} height={148} className="size-full object-cover" />
    </Link>
  )
}

function TitleLink({ series }: { series: Series }) {
  return (
    <Link
      href={seriesHref(series)}
      className={cn("type-h4 truncate rounded-sm underline-offset-3 hover:underline", focusRing)}
    >
      {series.title}
    </Link>
  )
}

export function LibraryPage() {
  const t = useTranslations("library")
  const locale = useLocale()
  const loc = useLocalize()
  const user = useUser()
  const hydrated = useHydrated()
  const pathname = usePathname()
  const email = useAccountEmail()
  const qc = useQueryClient()
  const failed = useFailed()
  const undoBar = useUndo()
  const [now] = useState(() => Date.now())

  const [tab, setTab] = useState<Tab>("subs")
  const [subSort, setSubSort] = useState<SubSort>("updated")
  const [recentSort, setRecentSort] = useState<RecentSort>("recent")
  const [newOnly, setNewOnly] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<string[]>([])

  // ---- data: the demo's query + store, or the three lists of the real API
  const demoQuery = useLibrary()
  const enabled = !DEMO_MODE && !!email
  const history = useQuery({ queryKey: meKeys.history(email ?? ""), queryFn: real.fetchHistory, enabled })
  const subs = useSubscriptions()
  const unlockedQuery = useQuery({ queryKey: meKeys.unlocked(email ?? ""), queryFn: real.fetchUnlocked, enabled })
  const parts = DEMO_MODE ? [demoQuery] : enabled ? [history, subs, unlockedQuery] : []
  const isPending = !hydrated || parts.some((q) => q.isPending)
  const isError = !isPending && parts.some((q) => q.isError)
  const refetch = () => void Promise.all(parts.map((q) => q.refetch()))

  // ?demo=empty shows the empty tabs even when this device has reading history.
  const forcedEmpty = useDemoFlag() === "empty"
  const storeSubs = useAppStore((s) => (forcedEmpty ? NONE_LIST : s.subscriptions))
  const storeUnlocked = useAppStore((s) => (forcedEmpty ? NONE_MAP : s.unlocked))
  const lastRead = useAppStore((s) => (forcedEmpty ? NONE_READ : s.lastRead))
  const hidden = useAppStore((s) => s.historyHidden)

  const demo = demoQuery.data
  const byId = new Map((demo?.series ?? []).map((s) => [s.id, s]))

  // Subscribed: store order is oldest first; the API's is newest first. Keep "newest first" for "Recently added".
  const subscribed: Series[] = DEMO_MODE
    ? [...storeSubs].reverse().flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
    : (subs.data ?? [])

  // Recently read
  const whenLabel = (days: number, iso?: string) =>
    days <= 0
      ? t("whenToday")
      : days === 1
        ? t("whenYesterday")
        : days < 7
          ? t("whenDaysAgo", { count: days })
          : days < 14 || !iso
            ? t("whenLastWeek")
            : formatShortDate(iso, locale)
  const historyItems: HistoryItem[] = []
  if (DEMO_MODE && demo && !forcedEmpty) {
    const seen = new Set<string>()
    const base: HistoryItem[] = demo.continueReading.map((c: ContinueView, i) => {
      seen.add(c.seriesData.id)
      const days = DEMO_DAYS_AGO[i] ?? 7
      return {
        series: c.seriesData,
        episode: Math.max(c.episode, lastRead[c.seriesData.id] ?? 0),
        progress: c.progress,
        when: whenLabel(days, addDays(today, -days)),
      }
    })
    // Series opened on this device that the demo history doesn't have come first.
    for (const [id, n] of Object.entries(lastRead)) {
      const s = byId.get(id)
      if (s && n > 0 && !seen.has(id)) historyItems.push({ series: s, episode: n, progress: 0.5, when: t("whenRecently") })
    }
    historyItems.push(...base)
  } else if (!DEMO_MODE) {
    const nowIso = ictDate(now)
    for (const h of history.data ?? []) {
      const iso = h.readAt ? ictDate(Date.parse(h.readAt)) : undefined
      historyItems.push({
        series: h.seriesData,
        episode: h.episode,
        progress: h.progress,
        when: iso ? whenLabel(daysBetween(iso, nowIso), iso) : t("whenRecently"),
      })
    }
  }
  const recent = DEMO_MODE ? historyItems.filter((h) => !hidden.includes(h.series.id)) : historyItems

  // Unlocked
  const unlockedItems: UnlockedItem[] = DEMO_MODE
    ? Object.entries(storeUnlocked).flatMap(([id, nums]) =>
        byId.get(id) && nums.length ? [{ series: byId.get(id)!, numbers: [...nums].sort((a, b) => a - b) }] : []
      )
    : (unlockedQuery.data ?? [])

  // Reading position per series (Subscribed cards): this device's reads, else the history.
  const lastOf = (s: Series) => Math.max(lastRead[s.id] ?? 0, recent.find((h) => h.series.id === s.id)?.episode ?? 0)

  // ---- views
  const withNew = subscribed.filter((s) => newCount(s) > 0)
  const subView = [...(newOnly ? withNew : subscribed)]
  if (subSort === "az") subView.sort((a, b) => a.title.localeCompare(b.title))
  if (subSort === "updated")
    subView.sort((a, b) => Number(newCount(b) > 0) - Number(newCount(a) > 0) || daysSinceUpdate(a) - daysSinceUpdate(b))
  const recentView = [...recent]
  if (recentSort === "az") recentView.sort((a, b) => a.series.title.localeCompare(b.series.title))
  if (recentSort === "progress") recentView.sort((a, b) => a.progress - b.progress)

  const ready = !isPending && !isError
  const tabItems = tab === "subs" ? subView : tab === "recent" ? recentView : unlockedItems
  const emptyFilter = tab === "subs" && newOnly && subscribed.length > 0 && withNew.length === 0
  const canEdit = ready && tab !== "unl" && tabItems.length > 0
  const showToolbar = ready && tab !== "unl" && (tabItems.length > 0 || emptyFilter)
  const selectableIds = tab === "subs" ? subView.map((s) => s.id) : recentView.map((h) => h.series.id)
  const allOn = selectableIds.length > 0 && selectableIds.every((id) => sel.includes(id))
  const countsKnown = DEMO_MODE ? hydrated && !!demo : ready

  function pickTab(next: string) {
    setTab(next as Tab)
    setEditing(false)
    setSel([])
  }
  const toggleSel = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))

  /** Real API: removes the ids from the cached list now, then from the account; Undo restores them. */
  async function removeReal(list: "history" | "subscriptions", ids: string[], text: string) {
    if (!email) return
    const key = list === "history" ? meKeys.history(email) : meKeys.subscriptions(email)
    await qc.cancelQueries({ queryKey: key })
    const before = qc.getQueryData<(Series | ContinueView)[]>(key)
    qc.setQueryData(
      key,
      before?.filter((x) => !ids.includes("seriesData" in x ? x.seriesData.id : x.id))
    )
    try {
      if (list === "history") {
        const removed = (await Promise.all(ids.map((id) => real.removeFromHistory(id)))).flat()
        undoBar.show(text, () => void real.restoreHistory(removed).catch(failed).finally(() => void qc.invalidateQueries({ queryKey: key })))
      } else {
        const removed = (await Promise.all(ids.map((id) => real.removeSubscription(id)))).flat()
        undoBar.show(text, () => void real.restoreSubscriptions(removed).catch(failed).finally(() => void qc.invalidateQueries({ queryKey: key })))
      }
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    }
  }

  function removeSelected() {
    const ids = sel.filter((id) => selectableIds.includes(id))
    if (ids.length === 0) return
    setEditing(false)
    setSel([])
    const store = useAppStore.getState()
    if (tab === "subs") {
      const text = t("undoUnsubscribed", { count: ids.length })
      if (!DEMO_MODE) return void removeReal("subscriptions", ids, text)
      const before = store.subscriptions
      store.setSubscriptions(before.filter((id) => !ids.includes(id)))
      undoBar.show(text, () => useAppStore.getState().setSubscriptions(before))
    } else {
      const text = t("undoRemoved", { count: ids.length })
      if (!DEMO_MODE) return void removeReal("history", ids, text)
      const before = store.historyHidden
      store.setHistoryHidden([...before, ...ids])
      undoBar.show(text, () => useAppStore.getState().setHistoryHidden(before))
    }
  }

  const toAuth = () => useAppStore.getState().setReturnTo(pathname)
  const unitShort = (s: Series) => (s.type === "novel" ? "ch" : "ep")

  const empties = {
    subs: [t("emptySubsTitle"), t("emptySubsText")],
    recent: [t("emptyRecentTitle"), t("emptyRecentText")],
    unl: [t("emptyUnlTitle"), t("emptyUnlText")],
  } as const

  const tabs = [
    { value: "subs", label: t("tabSubscribed"), count: subscribed.length },
    { value: "recent", label: t("tabRecent"), count: recent.length },
    { value: "unl", label: t("tabUnlocked"), count: unlockedItems.length },
  ] as const

  return (
    <div className="container flex flex-col gap-5 pt-7 pb-[72px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-h1">{t("title")}</h1>
          {countsKnown ? (
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {t("headLine", { subs: subscribed.length, withNew: withNew.length, unlocked: unlockedItems.length })}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant={editing ? "brand" : "outline"}
            className="mt-1 shrink-0"
            aria-pressed={editing}
            onClick={() => {
              setEditing(!editing)
              setSel([])
            }}
          >
            {editing ? t("done") : t("edit")}
          </Button>
        ) : null}
      </div>

      {hydrated && !user ? (
        <div className="flex items-center gap-4 rounded-card border bg-[linear-gradient(120deg,#f0fdf5_0%,#ffffff_70%)] dark:bg-[image:linear-gradient(120deg,var(--brand-wash-from)_0%,var(--brand-wash-to)_70%)] p-5 shadow-xs max-md:flex-col max-md:items-start max-md:p-4">
          <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LibraryIcon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="type-h3">{t("guestTitle")}</h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("guestText")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <Link href="/login" onClick={toAuth}>
                {t("login")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?mode=signup" onClick={toAuth}>
                {t("createAccount")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={pickTab} className="gap-5">
        <TabsList variant="line" aria-label={t("tabs")} className="gap-1">
          {tabs.map((x) => (
            <TabsTrigger key={x.value} value={x.value} className="h-11 px-3 pt-0 pb-0">
              {x.label}
              {countsKnown ? <TabsCount className="rounded-badge px-2 py-0.5 text-xs font-semibold text-secondary-foreground"><Num>{x.count}</Num></TabsCount> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {showToolbar ? (
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            {editing ? (
              <>
                <div className="flex items-center gap-2.5">
                  <AnimateIcon asChild animateOnHover><label className="flex cursor-pointer items-center gap-2 text-[13px] leading-[18px]">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={allOn}
                      onChange={() => setSel(allOn ? [] : selectableIds)}
                    />
                    <span className="inline-flex rounded-[4px] peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex size-4 items-center justify-center rounded-[4px] border",
                          allOn ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-background text-transparent"
                        )}
                      >
                        <CheckIcon className="size-3" strokeWidth={3} />
                      </span>
                    </span>
                    {t("selectAll")}
                  </label></AnimateIcon>
                  <span className="text-[13px] leading-[18px] text-muted-foreground" aria-live="polite">
                    {sel.length ? t("selected", { count: sel.length }) : t("selectHint")}
                  </span>
                </div>
                <Button animateIcon variant="destructive" size="sm" disabled={sel.length === 0} onClick={removeSelected}>
                  <XIcon className="size-3.5" />
                  {tab === "subs"
                    ? sel.length
                      ? t("unsubscribeN", { count: sel.length })
                      : t("unsubscribe")
                    : sel.length
                      ? t("removeHistoryN", { count: sel.length })
                      : t("removeHistory")}
                </Button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {tab === "subs" ? (
                    <AnimateIcon asChild animateOnHover><button
                      type="button"
                      aria-pressed={newOnly}
                      onClick={() => setNewOnly(!newOnly)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                        focusRing,
                        newOnly ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-accent"
                      )}
                    >
                      <SparklesIcon className="size-3" aria-hidden />
                      {t("newFilter", { count: withNew.length })}
                    </button></AnimateIcon>
                  ) : null}
                  <span className="text-[13px] leading-[18px] text-muted-foreground">
                    {t("seriesCount", { count: tab === "subs" ? subView.length : recent.length })}
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-[13px] leading-[18px] text-muted-foreground max-md:sr-only">{t("sortBy")}</span>
                  <NativeSelect
                    value={tab === "subs" ? subSort : recentSort}
                    onChange={(e) =>
                      tab === "subs" ? setSubSort(e.target.value as SubSort) : setRecentSort(e.target.value as RecentSort)
                    }
                    wrapperClassName="w-auto"
                    className="min-w-[170px] max-md:min-w-0"
                  >
                    {tab === "subs" ? (
                      <>
                        <option value="updated">{t("sortUpdated")}</option>
                        <option value="added">{t("sortAdded")}</option>
                        <option value="az">{t("sortAz")}</option>
                      </>
                    ) : (
                      <>
                        <option value="recent">{t("sortRecent")}</option>
                        <option value="progress">{t("sortProgress")}</option>
                        <option value="az">{t("sortAz")}</option>
                      </>
                    )}
                  </NativeSelect>
                </label>
              </>
            )}
          </div>
        ) : null}

        {undoBar.current ? <UndoBar text={undoBar.current.text} onUndo={undoBar.undo} /> : null}

        {/* Loading, error and empty sit in the current tab's panel too, so the tab's aria-controls always points at one. */}
        {isPending ? (
          <TabsContent value={tab} className="mt-0">
            <div
              className="grid grid-cols-3 gap-x-3 gap-y-4 md:grid-cols-4 md:gap-x-5 md:gap-y-6 lg:grid-cols-6"
              aria-busy="true"
              aria-label={t("loading")}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="aspect-[3/4] rounded-[10px]" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          </TabsContent>
        ) : isError ? (
          <TabsContent value={tab} className="mt-0">
            <StateBox
              icon={AlertCircleIcon}
              tone="bad"
              title={t("errorTitle")}
              text={t("errorText")}
              action={
                <Button animateIcon variant="outline" size="sm" onClick={refetch}>
                  <RefreshCwIcon className="size-3.5" />
                  {t("tryAgain")}
                </Button>
              }
            />
          </TabsContent>
        ) : tabItems.length === 0 ? (
          <TabsContent value={tab} className="mt-0">
            <StateBox
              icon={LibraryIcon}
              title={emptyFilter ? t("emptyNewTitle") : empties[tab][0]}
              text={emptyFilter ? t("emptyNewText") : empties[tab][1]}
              className="[&>p:nth-of-type(2)]:max-w-[46ch]"
              action={
                emptyFilter ? (
                  <Button variant="outline" size="sm" onClick={() => setNewOnly(false)}>
                    {t("showAllSubs")}
                  </Button>
                ) : (
                  <Button asChild variant="brand" size="sm">
                    <Link href="/">{t("browse")}</Link>
                  </Button>
                )
              }
            />
          </TabsContent>
        ) : (
          <>
            <TabsContent value="subs" className="mt-0">
              <ul
                aria-label={t("subsLabel")}
                className="m-0 grid list-none grid-cols-3 gap-x-3 gap-y-4 p-0 md:grid-cols-4 md:gap-x-5 md:gap-y-6 lg:grid-cols-6"
              >
                {subView.map((s, si) => {
                  const n = newCount(s)
                  const last = lastOf(s)
                  const next = last > 0 ? Math.min(last + 1, s.freeEpisodes) : 1
                  const on = sel.includes(s.id)
                  const unit = unitShort(s)
                  return (
                    <Effect key={s.id} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(si, 10) * 40} inView>
                    <li className="relative flex min-w-0 flex-col gap-2.5 rounded-card">
                      {editing ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={on ? t("deselect", { title: s.title }) : t("select", { title: s.title })}
                          onClick={() => toggleSel(s.id)}
                          className={cn("absolute inset-0 z-[2] flex w-full items-start justify-end rounded-card p-2", focusRing)}
                        >
                          <SelectBox on={on} size="lg" />
                        </button>
                      ) : null}
                      <Link
                        href={seriesHref(s)}
                        tabIndex={editing ? -1 : undefined}
                        className={cn("group flex min-w-0 flex-col gap-2.5 rounded-[10px]", focusRing)}
                      >
                        <div
                          className={cn(
                            "relative aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-muted",
                            on && "shadow-[0_0_0_3px_var(--primary)]"
                          )}
                        >
                          <Image
                            src={s.cover}
                            alt=""
                            width={360}
                            height={480}
                            sizes="(min-width: 1280px) 190px, (min-width: 768px) 25vw, 33vw"
                            className={cn("cover-zoom size-full object-cover", on && "opacity-80")}
                          />
                          {!editing && (n > 0 || s.type === "novel") ? (
                            <div className="absolute top-2 right-2 left-2 flex flex-wrap gap-1">
                              {n > 0 ? <Badge variant="up">{t("newBadge", { count: n })}</Badge> : null}
                              {s.type === "novel" ? <Badge variant="dark">{t("novel")}</Badge> : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <h3 className="truncate text-sm leading-5 font-semibold max-md:text-[13px] max-md:leading-[18px]">{s.title}</h3>
                          <p className="truncate text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">
                            {last > 0
                              ? t(`readOf.${unit}`, { n: last, total: s.freeEpisodes })
                              : t("notStarted", { total: s.freeEpisodes })}
                          </p>
                          <p className="truncate text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">{loc.schedule(s)}</p>
                        </div>
                      </Link>
                      {!editing ? (
                        <Button asChild variant="secondary" size="sm" className="w-full max-md:h-[30px] max-md:px-1.5 max-md:text-xs">
                          <Link href={readerHref(s, next)}>
                            <span className="truncate">{last > 0 ? t(`continueAt.${unit}`, { n: next }) : t(`startAt.${unit}`)}</span>
                          </Link>
                        </Button>
                      ) : null}
                    </li>
                    </Effect>
                  )
                })}
              </ul>
            </TabsContent>

            <TabsContent value="recent" className="mt-0">
              <ul aria-label={t("tabRecent")} className="m-0 flex list-none flex-col divide-y overflow-hidden rounded-card border p-0">
                {recentView.map((h, hi) => {
                  const s = h.series
                  const on = sel.includes(s.id)
                  const pct = Math.round(h.progress * 100)
                  const done = pct >= 100
                  const unit = s.type === "novel" ? "chapter" : "episode"
                  const nextEp = done ? Math.min(h.episode + 1, s.freeEpisodes) : h.episode
                  return (
                    <Effect key={s.id} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(hi, 10) * 40} inView>
                    <li
                      className={cn(
                        "flex items-center gap-3.5 bg-background px-4 py-3 max-md:gap-3 max-md:px-3 max-md:py-2.5",
                        on && "bg-brand-soft"
                      )}
                    >
                      {editing ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={on ? t("deselect", { title: s.title }) : t("select", { title: s.title })}
                          onClick={() => toggleSel(s.id)}
                          className={cn("inline-flex rounded-md p-1.5", focusRing)}
                        >
                          <SelectBox on={on} />
                        </button>
                      ) : null}
                      <Thumb series={s} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <TitleLink series={s} />
                        <span className="text-xs leading-4 text-muted-foreground">
                          {done ? t(`finished.${unit}`, { n: h.episode }) : t(`readPct.${unit}`, { n: h.episode, pct })} · {h.when}
                        </span>
                        <Progress value={pct} aria-label={t("progressOf", { title: s.title })} className="max-w-80" />
                      </div>
                      {!editing ? (
                        <Button asChild variant="brand" size="sm" className="shrink-0">
                          <Link href={readerHref(s, nextEp)}>{done ? t(`next.${unit}`) : t("continue")}</Link>
                        </Button>
                      ) : null}
                    </li>
                    </Effect>
                  )
                })}
              </ul>
            </TabsContent>

            <TabsContent value="unl" className="mt-0 flex flex-col gap-5">
              <div className="flex items-start gap-3 rounded-[10px] border border-brand-soft-border bg-brand-soft px-4 py-3.5">
                <ZapIcon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
                <div className="flex min-w-0 flex-col">
                  <p className="text-sm leading-5 font-semibold">{t("unlockedNoteTitle")}</p>
                  <p className="text-[13px] leading-[19px]">{t("unlockedNoteText")}</p>
                </div>
              </div>
              <ul aria-label={t("unlockedLabel")} className="m-0 flex list-none flex-col divide-y overflow-hidden rounded-card border p-0">
                {unlockedItems.map((u, ui) => {
                  const s = u.series
                  const e = u.numbers
                  const unit = s.type === "novel" ? "chapter" : "episode"
                  const lastN = e[e.length - 1]
                  const fp = episodesFor(s.slug).find((x) => x.n === lastN && x.access === "fastpass")
                  const freeIso = (fp && displayToIso(fp.date)) || addDays(today, (lastN - s.freeEpisodes) * 7)
                  // Real API: the coins actually charged; demo: the demo price per episode.
                  const spent = u.coins ?? e.length * fastPassPrice()
                  return (
                    <Effect key={s.id} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(ui, 10) * 40} inView>
                    <li className="flex items-center gap-3.5 bg-background px-4 py-3 max-md:gap-3 max-md:px-3 max-md:py-2.5">
                      <Thumb series={s} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <TitleLink series={s} />
                        <span className="text-xs leading-4 text-muted-foreground">
                          {t(`unlockedEps.${unit}`, { count: e.length, list: e.join(", ") })}
                        </span>
                        <span className="text-xs leading-4 text-muted-foreground">
                          {daysFromToday(freeIso) > 0
                            ? t("spentFree", { coins: spent, date: formatShortDate(freeIso, locale) })
                            : t("spentFreeNow", { coins: spent })}
                        </span>
                      </div>
                      <Button asChild variant="brand" size="sm" className="shrink-0">
                        <Link href={readerHref(s, e[0])}>{t(`readAt.${unitShort(s)}`, { n: e[0] })}</Link>
                      </Button>
                    </li>
                    </Effect>
                  )
                })}
              </ul>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
