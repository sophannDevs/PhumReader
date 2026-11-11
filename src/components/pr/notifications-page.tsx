"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, BellIcon, CheckIcon, PlayIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { UndoBar, useUndo } from "@/components/pr/patterns"
import { NativeSelect, SmallSwitch } from "@/components/pr/settings-ui"
import { StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { demoData, type DemoNotification, type NotificationGroup, type NotificationKind } from "@/data"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { withDemo } from "@/lib/demo-api"
import { formatShortDate, localDigits, today } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { type NotifPrefs, useAppStore, useHydrated, useUser, visibleNotifications } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Notifications (spec §13, prototype Notifications/): the inbox (tabs, Today / This week / Earlier groups, unread dot,
 * open = mark read + go to the series or Coins, mark read / unread, remove with Undo, mark all as read) and the
 * alert settings (push / email per type, quiet hours in ICT, daily digest; saved at once to `notifPrefs`).
 * The API has no notifications yet: both modes run on the store (`notifRead`, `notifGone`, `notifPrefs`).
 */

type Tab = "all" | "unread" | "updates" | "comments" | "coins"
type PrefKey = "update" | "fastpass" | "comment" | "coins" | "news"

const KIND_OF_TAB: Partial<Record<Tab, NotificationKind>> = { updates: "update", comments: "comment", coins: "coins" }
const GROUPS: NotificationGroup[] = ["Today", "This week", "Earlier"]
const GROUP_KEY: Record<NotificationGroup, string> = { Today: "today", "This week": "thisWeek", Earlier: "earlier" }
const PREF_ROWS: PrefKey[] = ["update", "fastpass", "comment", "coins", "news"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const ICON_TILE: Record<NotificationKind, string> = {
  update: "bg-brand-soft text-brand-ink",
  comment: "bg-[#eff6ff] text-[#1d4ed8]",
  coins: "bg-[#fef3c7] text-[#92400e]",
  system: "bg-muted text-[#3f3f46]",
}

function KindIcon({ kind }: { kind: NotificationKind }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[15px] leading-none font-bold max-md:size-8",
        ICON_TILE[kind]
      )}
    >
      {kind === "update" ? <PlayIcon className="size-3.5 fill-current" /> : kind === "comment" ? "“" : kind === "coins" ? "C" : "i"}
    </span>
  )
}

/** Where a notification leads: Coins for payments, the series by title, else Home. */
function hrefOf(n: DemoNotification): string {
  if (n.kind === "coins") return "/coins"
  const s = n.series ? demoData.series.find((x) => x.title === n.series) : undefined
  return s ? seriesHref(s) : "/"
}

export function NotificationsPage() {
  const t = useTranslations("notifications")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const hydrated = useHydrated()
  const flag = useDemoFlag()
  const undoBar = useUndo()
  const [tab, setTab] = useState<Tab>("all")

  const notifRead = useAppStore((s) => s.notifRead)
  const notifGone = useAppStore((s) => s.notifGone)
  // A fake load in demo mode, so ?demo=empty / error / slow show every state.
  const query = useQuery({
    queryKey: ["notifications", flag],
    queryFn: () => withDemo(() => true, { empty: () => false }),
    enabled: DEMO_MODE,
  })
  const loading = !hydrated || (DEMO_MODE && query.isPending)
  const failed = DEMO_MODE && query.isError
  const shown = DEMO_MODE ? query.data === true : true

  const all = shown ? visibleNotifications({ notifRead, notifGone }) : []
  const unread = all.filter((n) => !n.read)
  const list = all.filter((n) =>
    tab === "unread" ? !n.read : KIND_OF_TAB[tab] ? n.kind === KIND_OF_TAB[tab] : true
  )
  const groups = GROUPS.map((g) => ({ g, items: list.filter((n) => n.when === g) })).filter((x) => x.items.length > 0)

  /** "9:12 AM", "Mon", "Oct 28" from the demo data, in the page's language. */
  function timeLabel(time: string): string {
    const clock = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time)
    if (clock) return locale === "km" ? `${localDigits(`${clock[1]}:${clock[2]}`, "km")} ${t(clock[3] === "AM" ? "am" : "pm")}` : time
    if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(time)) return t(`days.${time}`)
    const date = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(time)
    if (date && MONTHS.includes(date[1])) {
      const iso = `${today.slice(0, 4)}-${String(MONTHS.indexOf(date[1]) + 1).padStart(2, "0")}-${date[2].padStart(2, "0")}`
      return formatShortDate(iso, locale)
    }
    return time
  }

  function open(n: (typeof all)[number]) {
    if (!n.read) useAppStore.getState().setNotifRead(n.id, true)
    router.push(hrefOf(n))
  }

  function remove(id: string) {
    useAppStore.getState().removeNotif(id)
    undoBar.show(t("removed"), () => useAppStore.getState().restoreNotif(id))
  }

  function markAll() {
    useAppStore.getState().markAllNotifRead(all.map((n) => n.id))
    toast.success(t("allRead"))
  }

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "all", label: t("tabAll") },
    { value: "unread", label: t("tabUnread"), count: unread.length },
    { value: "updates", label: t("tabUpdates") },
    { value: "comments", label: t("tabComments") },
    { value: "coins", label: t("tabCoins") },
  ]

  const loggedIn = hydrated && !!user

  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-h1">{t("title")}</h1>
          {loggedIn && !loading && !failed ? (
            <p className="text-[15px] leading-[26px] text-muted-foreground">
              {unread.length ? t("unreadCount", { count: unread.length }) : t("caughtUp")}
            </p>
          ) : null}
        </div>
        {loggedIn && !loading && unread.length > 0 ? (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckIcon className="size-3.5" />
            {t("markAll")}
          </Button>
        ) : null}
      </div>

      {hydrated && !user ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card border bg-card px-5 py-12 text-center shadow-xs">
          <BellIcon className="size-7 text-muted-foreground" aria-hidden />
          <h2 className="type-h3">{t("loginTitle")}</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">{t("loginText")}</p>
          <Button asChild variant="brand">
            <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
              {t("login")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-label={t("inbox")} className="flex min-w-0 flex-col gap-3.5">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-3.5">
              <TabsList variant="line" aria-label={t("filter")} className="gap-1">
                {tabs.map((x) => (
                  <TabsTrigger key={x.value} value={x.value} className="h-11 px-3 pt-0 pb-0">
                    {x.label}
                    {x.count ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {x.count}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={tab} className="mt-0 flex flex-col gap-3.5">
                {loading ? (
                  <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("loading")}>
                    <Skeleton className="mt-1.5 h-4 w-16" />
                    <div className="flex flex-col divide-y overflow-hidden rounded-card border">
                      {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                          <Skeleton className="size-9 rounded-[10px]" />
                          <div className="flex flex-1 flex-col gap-2">
                            <Skeleton className="h-3.5 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : failed ? (
                  <StateBox
                    icon={AlertCircleIcon}
                    tone="bad"
                    title={t("errorTitle")}
                    text={t("errorText")}
                    action={
                      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                        <RefreshCwIcon className="size-3.5" />
                        {t("tryAgain")}
                      </Button>
                    }
                  />
                ) : groups.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 rounded-card border bg-card px-5 py-10 text-center shadow-xs">
                    <BellIcon className="size-7 text-muted-foreground" aria-hidden />
                    <h2 className="type-h3">{tab === "unread" ? t("caughtUp") : t("emptyTitle")}</h2>
                    <p className="text-[13px] leading-[18px] text-muted-foreground">
                      {tab === "unread" ? t("emptyUnreadText") : t("emptyText")}
                    </p>
                    {tab !== "unread" ? (
                      <Button asChild variant="outline">
                        <Link href="/rankings">{t("findSeries")}</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  groups.map(({ g, items }) => (
                    <div key={g} className="flex flex-col gap-2">
                      <h2 className="mt-1.5 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        {t(`groups.${GROUP_KEY[g]}`)}
                      </h2>
                      <ul className="m-0 flex list-none flex-col divide-y overflow-hidden rounded-card border p-0">
                        {items.map((n) => (
                          <li
                            key={n.id}
                            className={cn(
                              "group flex items-start gap-3 py-3.5 pr-3 pl-4 max-md:gap-2.5 max-md:py-3 max-md:pr-2 max-md:pl-3",
                              n.read ? "bg-background" : "bg-[#f6fef9]"
                            )}
                          >
                            <KindIcon kind={n.kind} />
                            <button
                              type="button"
                              onClick={() => open(n)}
                              className="group/main flex min-w-0 flex-1 flex-col gap-[3px] rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "truncate text-[13px] leading-[18px] underline-offset-3 group-hover/main:underline",
                                    n.read ? "font-medium" : "font-bold"
                                  )}
                                >
                                  {n.read ? null : <span className="sr-only">{t("unreadSr")} </span>}
                                  {n.title}
                                </span>
                                {n.read ? null : <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
                              </span>
                              <span className="truncate text-xs leading-4 text-muted-foreground max-md:whitespace-normal">{n.body}</span>
                              <span className="text-xs leading-4 text-muted-foreground">{timeLabel(n.time)}</span>
                            </button>
                            <div className="flex shrink-0 gap-0.5 opacity-55 group-hover:opacity-100 focus-within:opacity-100 max-md:flex-col max-md:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={n.read ? t("markUnread") : t("markRead")}
                                title={n.read ? t("markUnread") : t("markRead")}
                                onClick={() => useAppStore.getState().setNotifRead(n.id, !n.read)}
                              >
                                <CheckIcon />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={t("remove")} title={t("removeShort")} onClick={() => remove(n.id)}>
                                <XIcon />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
            {undoBar.current ? (
              <UndoBar
                text={undoBar.current.text}
                onUndo={undoBar.undo}
                className="sticky bottom-4 self-center bg-[#09090b] py-2 pr-2 shadow-md max-md:bottom-[72px]"
              />
            ) : null}
          </section>

          <AlertSettings />
        </div>
      )}
    </div>
  )
}

/** Push / email per alert type, quiet hours and the daily digest; every change is saved at once. */
function AlertSettings() {
  const t = useTranslations("notifications")
  const locale = useLocale()
  const prefs = useAppStore((s) => s.notifPrefs)
  const [saved, setSaved] = useState(false)

  function save(patch: Partial<NotifPrefs>) {
    useAppStore.getState().setNotifPrefs(patch)
    setSaved(true)
  }
  const savePair = (key: PrefKey, pair: [boolean, boolean]) => save({ [key]: pair } as Partial<NotifPrefs>)

  const hourLabel = (h: number) => {
    const h12 = h % 12 || 12
    return locale === "km" ? `${localDigits(h12, "km")}:០០ ${t(h < 12 ? "am" : "pm")}` : `${h12}:00 ${h < 12 ? "AM" : "PM"}`
  }
  const hours = Array.from({ length: 24 }, (_, h) => h)

  return (
    <aside
      id="ns"
      aria-labelledby="ns-h"
      className="flex min-w-0 scroll-mt-20 flex-col rounded-card border bg-card shadow-xs lg:sticky lg:top-20"
    >
      <div className="flex flex-col gap-1 px-5 pt-5 max-md:px-4 max-md:pt-4">
        <h2 id="ns-h" className="type-h3">
          {t("settingsTitle")}
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">{t("settingsText")}</p>
      </div>
      <div className="flex flex-col gap-1 p-5 max-md:p-4">
        <div
          aria-hidden
          className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-2 text-center text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          <span />
          <span>{t("push")}</span>
          <span>{t("email")}</span>
        </div>
        {PREF_ROWS.map((key) => {
          const [push, mail] = prefs[key]
          return (
            <div key={key} className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-2 py-2">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] leading-[18px] font-semibold">{t(`rows.${key}.label`)}</span>
                <span className="text-xs leading-4 text-muted-foreground">{t(`rows.${key}.desc`)}</span>
              </span>
              <SmallSwitch
                className="justify-self-center"
                checked={push}
                aria-label={t("pushAria", { label: t(`rows.${key}.label`) })}
                onCheckedChange={(v) => savePair(key, [v, mail])}
              />
              <SmallSwitch
                className="justify-self-center"
                checked={mail}
                aria-label={t("emailAria", { label: t(`rows.${key}.label`) })}
                onCheckedChange={(v) => savePair(key, [push, v])}
              />
            </div>
          )
        })}
        <div className="my-2.5 h-px bg-border" />
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span id="qh-l" className="text-[13px] leading-[18px] font-semibold">
              {t("quiet")}
            </span>
            <span className="text-xs leading-4 text-muted-foreground">{t("quietText")}</span>
          </span>
          <SmallSwitch checked={prefs.quiet} aria-labelledby="qh-l" onCheckedChange={(v) => save({ quiet: v })} />
        </div>
        {prefs.quiet ? (
          <>
            <div className="flex items-center gap-2 pt-2">
              <label className="sr-only" htmlFor="qh-from">
                {t("from")}
              </label>
              <NativeSelect id="qh-from" value={String(prefs.from)} onChange={(e) => save({ from: Number(e.target.value) })}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </NativeSelect>
              <span className="text-[13px] leading-[18px] text-muted-foreground">{t("to")}</span>
              <label className="sr-only" htmlFor="qh-to">
                {t("toLabel")}
              </label>
              <NativeSelect id="qh-to" value={String(prefs.to)} onChange={(e) => save({ to: Number(e.target.value) })}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <span className="pt-1 text-xs leading-4 text-muted-foreground">{t("ict")}</span>
          </>
        ) : null}
        <div className="my-2.5 h-px bg-border" />
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span id="dg-l" className="text-[13px] leading-[18px] font-semibold">
              {t("digest")}
            </span>
            <span className="text-xs leading-4 text-muted-foreground">{t("digestText")}</span>
          </span>
          <SmallSwitch checked={prefs.digest} aria-labelledby="dg-l" onCheckedChange={(v) => save({ digest: v })} />
        </div>
        <span role="status" aria-live="polite" className="pt-2.5 text-xs leading-4 text-muted-foreground">
          {saved ? t("saved") : t("autoSave")}
        </span>
      </div>
    </aside>
  )
}
