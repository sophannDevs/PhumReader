"use client"

import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { CalendarIcon } from "@/components/animate-ui/icons/calendar"
import { ChevronDownIcon } from "@/components/animate-ui/icons/chevron-down"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { SeriesCard } from "@/components/pr/series-card"
import { phoneSwipeRow, SectionHead, Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Series, Weekday } from "@/data"
import { WEEKDAYS } from "@/data/types"
import { realWeekdayIct } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { SlidingTab, SlidingTabs } from "@/components/ui/sliding-tabs"

type Kind = "all" | "comic" | "novel"

const grid = cn("grid grid-cols-4 gap-5 min-[1100px]:grid-cols-6", phoneSwipeRow, "max-md:auto-cols-[38%]")

const noSubscribe = () => () => {}
/**
 * Today's weekday in ICT, read in the browser only. The page shell is prerendered (cacheComponents), where a clock
 * read is not allowed and would freeze the build day, so the server (and the hydration pass) see null.
 */
const useTodayIct = () => useSyncExternalStore(noSubscribe, () => realWeekdayIct(), () => null)

/**
 * Daily updates (spec §1, prototype Home `#daily`): type filter, day tabs with counts (today outlined in green),
 * at most 6 cards with "Show all N", "New today" on today's UP series. A short skeleton when the day changes.
 * `state` comes from the home query: loading, error (Try again), empty (?demo=empty) or ready.
 */
export function DailyUpdatesSection({
  daily,
  state,
  onRetry,
}: {
  daily: Record<Weekday, Series[]>
  state: "loading" | "error" | "empty" | "ready"
  onRetry: () => void
}) {
  const t = useTranslations("home")
  const todayDay = useTodayIct()
  // The picked tab; until the reader picks one, today's tab (none in the prerendered shell).
  const [picked, setPicked] = useState<Weekday | null>(null)
  const day = picked ?? todayDay
  const [kind, setKind] = useState<Kind>("all")
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const match = (s: Series) => kind === "all" || s.type === kind
  const list = day ? (daily[day] ?? []).filter(match) : []
  const dayName = day ? t(`dayFull.${day}`) : ""
  const isToday = day !== null && day === todayDay

  const pickDay = (d: Weekday) => {
    setPicked(d)
    setShowAll(false)
    setBusy(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBusy(false), 350)
  }

  const loading = state === "loading" || (state !== "error" && busy)
  const empty = !loading && state !== "error" && (state === "empty" || list.length === 0)
  const shown = showAll ? list : list.slice(0, 6)

  return (
    <section id="daily" aria-labelledby="du-h" className="flex scroll-mt-20 flex-col gap-4">
      <SectionHead
        id="du-h"
        size="h2"
        // On phones the type tabs always sit under the title, so a longer day name can't move them.
        className="max-md:flex-col max-md:items-start max-md:gap-3"
        title={t("dailyTitle")}
        subtitle={
          state === "ready" ? t("dayLine", { count: list.length, type: kind, day: dayName, today: isToday ? "yes" : "no" }) : undefined
        }
        action={
          <Segmented
            label={t("typeLabel")}
            value={kind}
            onChange={(k) => {
              setKind(k)
              setShowAll(false)
            }}
            options={[
              { value: "all", label: t("typeAll") },
              { value: "comic", label: t("typeComics") },
              { value: "novel", label: t("typeNovels") },
            ]}
          />
        }
      />

      <div
        role="tablist"
        aria-label={t("dayLabel")}
        className="grid grid-cols-7 gap-1.5 max-md:-mx-4 max-md:flex max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]"
      >
        <SlidingTabs value={day} pill="inset-0 rounded-[10px] bg-foreground">
        {WEEKDAYS.map((d) => {
          const on = d === day
          const n = (daily[d] ?? []).filter(match).length
          return (
            <SlidingTab key={d} value={d} className="flex max-md:w-[52px] max-md:shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pickDay(d)}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-[10px] border px-1 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                on
                  ? "border-foreground text-background"
                  : d === todayDay
                    ? "border-primary bg-background text-brand-ink hover:bg-accent"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-sm font-semibold">{d === todayDay ? t("today") : t(`days.${d}`)}</span>
              <span className="text-[11px] tabular-nums">{state === "ready" ? t("dayCount", { count: n }) : " "}</span>
            </button>
            </SlidingTab>
          )
        })}
        </SlidingTabs>
      </div>

      {state === "error" ? (
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={t("dayErrorTitle")}
          text={t("dayErrorText")}
          action={
            <Button animateIcon variant="outline" size="sm" onClick={onRetry}>
              <RefreshCwIcon className="size-3.5" />
              {t("tryAgain")}
            </Button>
          }
        />
      ) : loading ? (
        <div className={grid} aria-busy="true" aria-label={t("loading")}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-[3/4] rounded-[10px]" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-[55%]" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <StateBox
          icon={CalendarIcon}
          title={state === "empty" ? t("dayEmptyNone") : t("dayEmptyTitle", { type: kind, day: dayName })}
          text={state === "empty" ? t("dayEmptyNoneText") : t("dayEmptyText")}
          action={
            state === "empty" ? undefined : (
              <Button variant="outline" size="sm" onClick={() => setKind("all")}>
                {t("showAllSeries")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className={grid}>
            {shown.map((s) => {
              const fresh = isToday && s.badges.up
              return (
                <SeriesCard
                  key={s.id}
                  series={s}
                  footer={
                    <p className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">
                      <span className={cn(fresh && "font-semibold text-brand-ink")}>
                        {fresh
                          ? t("newToday")
                          : t(s.type === "novel" ? "chShort" : "epShort", { n: s.freeEpisodes })}
                      </span>
                      <span className="inline-flex items-center gap-[3px] tabular-nums">
                        <HeartIcon className="size-3" aria-hidden />
                        <Num>{s.likes}</Num>
                      </span>
                    </p>
                  }
                />
              )
            })}
          </div>
          {!showAll && list.length > 6 ? (
            <Button animateIcon variant="outline" className="w-full max-md:hidden" onClick={() => setShowAll(true)}>
              {t("showAllDay", { count: list.length, type: kind })}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}
