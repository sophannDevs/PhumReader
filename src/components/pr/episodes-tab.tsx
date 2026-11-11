"use client"

import { ArrowUpDownIcon, BookOpenIcon, RotateCcwIcon, ZapIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useMemo, useState } from "react"
import { CoinIcon } from "@/components/pr/coin-icon"
import { daysUntilFree, EpisodeGroupHead, EpisodeList, EpisodeRow, episodeIso, type EpisodeState } from "@/components/pr/episode-row"
import { SkeletonRow } from "@/components/pr/skeletons"
import type { UnlockMode } from "@/components/pr/unlock-dialog"
import { StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fastPassPrice, type Episode, type Series } from "@/data"
import { Link, useRouter } from "@/i18n/navigation"
import { formatShortDate } from "@/lib/format"
import { useEpisodes } from "@/lib/queries"
import { useSeriesViewer } from "@/lib/me"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore, useCoins, useUser } from "@/lib/store"

const PAGE = 12

/**
 * Episodes tab (spec §2, prototype Series `.fp-card` / `.ep-tools` / `.ep-list`): the Fast Pass card (next free date
 * with a countdown, "Unlock all N", "N coins · Get more"), the toolbar (Episode 1, Latest free, Go to #, Newest /
 * Oldest), the list grouped into "Fast Pass · read before everyone" and "Free to read", and "Show 12 more".
 * Locked rows and the bundle call `onUnlock` (the UnlockDialog of the page).
 */
export function EpisodesTab({
  series,
  onUnlock,
}: {
  series: Series
  onUnlock: (episode: Episode, mode?: UnlockMode) => void
}) {
  const t = useTranslations("series")
  const th = useTranslations("home")
  const locale = useLocale()
  const router = useRouter()
  const coins = useCoins()
  const user = useUser()
  const { lastRead, unlocked } = useSeriesViewer(series)
  const query = useEpisodes(series.slug)
  const [newestFirst, setNewestFirst] = useState(true)
  const [visible, setVisible] = useState(PAGE)
  const [jump, setJump] = useState("")
  const [jumpErr, setJumpErr] = useState("")
  const jumpId = useId()
  const novel = series.type === "novel"
  const price = fastPassPrice()

  const all = useMemo(() => query.data ?? [], [query.data])
  const sorted = useMemo(() => (newestFirst ? [...all].reverse() : all), [all, newestFirst])
  const fastAll = all.filter((e) => e.access === "fastpass")
  const lockedFast = fastAll.filter((e) => !unlocked?.includes(e.n))
  const freeList = all.filter((e) => e.access === "free")
  const upNext = lastRead > 0 ? Math.min(lastRead + 1, freeList.length) : 0
  const isLocked = (e: Episode) => e.access === "fastpass" && !unlocked?.includes(e.n)

  function stateOf(e: Episode): EpisodeState {
    if (e.access === "fastpass") return unlocked?.includes(e.n) ? "unlocked" : "locked"
    return e.n <= lastRead ? "read" : "free"
  }

  function go(e: Episode) {
    if (isLocked(e)) onUnlock(e)
    else router.push(readerHref(series, e.n))
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="h-[74px] animate-pulse rounded-card bg-muted" />
        <div className="h-8 w-full animate-pulse rounded-control bg-muted" />
        <div className="flex flex-col gap-4 rounded-card border p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }
  if (query.isError) {
    return (
      <StateBox
        icon={RotateCcwIcon}
        tone="bad"
        title={t("episodesErrorTitle")}
        text={t("episodesErrorText")}
        action={
          <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
            {t("tryAgain")}
          </Button>
        }
      />
    )
  }
  if (all.length === 0) {
    return <StateBox icon={BookOpenIcon} title={t(novel ? "noChapters" : "noEpisodes")} text={t("noEpisodesDesc")} />
  }

  const firstFast = fastAll[0]
  const firstFastIso = firstFast ? episodeIso(firstFast.date) : null
  const unit = (key: string) => (novel ? `${key}Chapter` : key)

  // Rows with a group head ("Fast Pass" / "Free to read") whenever the group changes.
  const rows: React.ReactNode[] = []
  let group: "fp" | "free" | null = null
  for (const e of sorted.slice(0, visible)) {
    const g = e.access === "fastpass" ? "fp" : "free"
    if (g !== group) {
      group = g
      rows.push(
        g === "fp" ? (
          <EpisodeGroupHead
            key="head-fp"
            fastPass
            title={t("groupFastPass")}
            note={t(unit("groupFastPassNote"), { count: fastAll.length, price })}
          />
        ) : (
          <EpisodeGroupHead key="head-free" title={t("groupFree")} note={t(unit("groupFreeNote"), { count: freeList.length })} />
        )
      )
    }
    rows.push(
      <EpisodeRow
        key={e.n}
        series={series}
        episode={e}
        state={stateOf(e)}
        price={price}
        upNext={e.access === "free" && e.n === upNext && e.n > lastRead}
        onLockedClick={(ep) => onUnlock(ep)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {fastAll.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-card border border-[#c9f1da] bg-[linear-gradient(135deg,#effcf4,#e3f9ec)] px-4 py-3.5 max-md:p-3">
          <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <ZapIcon className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <h2 className="type-h4">{t(unit("fpTitle"), { count: lockedFast.length || fastAll.length })}</h2>
              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {t("fpBody", { price })}
                {firstFast && firstFastIso
                  ? ` ${t(unit("fpNextFree"), {
                      n: firstFast.n,
                      date: formatShortDate(firstFastIso, locale),
                      in: t("inDays", { days: daysUntilFree(firstFast) }),
                    })}`
                  : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {lockedFast.length > 1 ? (
              <Button variant="brand" size="sm" onClick={() => onUnlock(lockedFast[0], "all")}>
                <ZapIcon className="size-3.5" />
                {t("unlockAll", { count: lockedFast.length, cost: lockedFast.length * price })}
              </Button>
            ) : null}
            {/* The balance is for logged-in readers only (assumption V2-66). */}
            {user ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href="/coins"
                  onClick={() => useAppStore.getState().setShopReturn({ page: seriesHref(series), episode: 0, title: series.title })}
                >
                  <CoinIcon size={16} />
                  {t("coinsGetMore", { count: coins })}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-[13px] leading-[18px] text-muted-foreground tabular-nums max-md:w-full">
            {series.updateDay
              ? t(novel ? "chaptersLine" : "episodesLine", {
                  count: all.length,
                  // "new every Sun"; Khmer uses the full day name ("ថ្ងៃអាទិត្យ").
                  day: th(locale === "km" ? `dayFull.${series.updateDay}` : `days.${series.updateDay}`),
                })
              : t(novel ? "chaptersCount" : "episodesCount", { count: all.length })}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link href={readerHref(series, all[0].n)}>{t(novel ? "firstChapter" : "firstEpisode")}</Link>
            </Button>
            {freeList.length > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={readerHref(series, freeList[freeList.length - 1].n)}>{t("latestFree")}</Link>
              </Button>
            ) : null}
            <form
              className="flex items-center gap-1"
              onSubmit={(ev) => {
                ev.preventDefault()
                const n = Number.parseInt(jump, 10)
                const e = all.find((x) => x.n === n)
                if (!e) {
                  setJumpErr(t("jumpError", { max: all.length }))
                  return
                }
                setJump("")
                go(e)
              }}
            >
              <label className="sr-only" htmlFor={jumpId}>
                {t(novel ? "jumpLabelChapter" : "jumpLabel")}
              </label>
              <Input
                id={jumpId}
                inputMode="numeric"
                autoComplete="off"
                value={jump}
                placeholder={t(novel ? "jumpPhChapter" : "jumpPh")}
                aria-invalid={jumpErr ? true : undefined}
                aria-describedby={jumpErr ? `${jumpId}-err` : undefined}
                onChange={(ev) => {
                  setJump(ev.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                  setJumpErr("")
                }}
                className="h-8 w-[76px] px-2 text-[13px]"
              />
              <Button type="submit" variant="outline" size="sm">
                {t("go")}
              </Button>
            </form>
            <Button variant="ghost" size="sm" onClick={() => setNewestFirst((v) => !v)}>
              <ArrowUpDownIcon className="size-3.5" />
              {t(newestFirst ? "sortNewest" : "sortOldest")}
            </Button>
          </div>
        </div>
        {jumpErr ? (
          <p id={`${jumpId}-err`} role="alert" className="text-[13px] leading-[18px] font-medium text-destructive">
            {jumpErr}
          </p>
        ) : null}
      </div>

      <EpisodeList aria-label={t(novel ? "chapters" : "episodes")}>
        {rows}
      </EpisodeList>

      {visible < sorted.length ? (
        <Button variant="outline" className="w-full" onClick={() => setVisible((v) => v + PAGE)}>
          {t("showMore", { count: Math.min(PAGE, sorted.length - visible) })}
        </Button>
      ) : null}
    </div>
  )
}
