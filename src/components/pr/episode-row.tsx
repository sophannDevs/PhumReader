import { CheckIcon } from "@/components/animate-ui/icons/check"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { LockIcon } from "@/components/animate-ui/icons/lock"
import { ZapIcon } from "@/components/animate-ui/icons/zap"
import Image from "next/image"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { Badge } from "@/components/ui/badge"
import type { Episode, Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { daysFromToday, formatShortDate, ictDate } from "@/lib/format"
import { readerHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

export type EpisodeState = "free" | "read" | "locked" | "unlocked"

/** "Nov 26, 2026" (an episode's display date) -> "2026-11-26", or null. */
export function episodeIso(date: string): string | null {
  const ms = Date.parse(`${date} UTC`)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10)
}

/**
 * Days until a Fast Pass episode is free for everyone (its `date` is the free release date). The demo counts from
 * its pinned "today"; the real API from today's date in ICT.
 */
export function daysUntilFree(e: Pick<Episode, "date">): number {
  const iso = episodeIso(e.date)
  if (!iso) return 0
  const days = DEMO_MODE ? daysFromToday(iso) : Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${ictDate(Date.now())}T00:00:00Z`)) / 86_400_000)
  return Math.max(0, days)
}

/** The list wrapper (prototype `.ep-list`): one bordered box with dividers between rows and group heads. */
export function EpisodeList({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col divide-y overflow-hidden rounded-card border bg-card", className)} {...props} />
}

/** Group head inside an EpisodeList: "⚡ Fast Pass · read before everyone" (amber) or "Free to read". */
export function EpisodeGroupHead({ fastPass, title, note }: { fastPass?: boolean; title: string; note: string }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 px-3.5 py-[9px] text-xs leading-4 font-semibold tracking-[0.02em]",
        fastPass ? "bg-[#fff7e6] text-warning-ink dark:bg-warning-soft" : "bg-muted text-foreground"
      )}
    >
      <span className="flex items-center gap-1.5">{title}</span>
      <span className={cn("font-normal text-muted-foreground tabular-nums", fastPass && "max-md:hidden")}>{note}</span>
    </li>
  )
}

const rowClass =
  "group flex w-full min-w-0 items-center gap-3.5 bg-background px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:gap-3 max-md:px-3"

/**
 * One episode (or novel chapter), prototype `.ep-row`: 64 px thumb (56 on phones), title with UP, date and likes,
 * and the state on the right: Fast Pass price + "Free in 21 days" (locked), Unlocked, ✓ Read or Up next.
 * Free / read / unlocked rows open the reader; locked rows call `onLockedClick` (the UnlockDialog opens there).
 */
export function EpisodeRow({
  series,
  episode,
  state,
  price = 5,
  upNext = false,
  index = 0,
  onLockedClick,
}: {
  series: Pick<Series, "slug" | "type">
  episode: Episode
  state: EpisodeState
  /** Fast Pass price in coins */
  price?: number
  /** "Up next" badge and the green highlight (the next episode to read) */
  upNext?: boolean
  /** Position in the list: staggers the entrance (capped at 10 steps) */
  index?: number
  onLockedClick?: (episode: Episode) => void
}) {
  const t = useTranslations("episodes")
  const tcards = useTranslations("cards")
  const loc = useLocalize()
  const locale = useLocale()
  const locked = state === "locked"
  const iso = locked ? episodeIso(episode.date) : null
  const days = locked ? daysUntilFree(episode) : 0
  const title = loc.title(episode.title)

  const body = (
    <>
      <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted max-md:size-14">
        <Image
          src={episode.thumb}
          alt=""
          width={128}
          height={128}
          sizes="64px"
          className={cn("size-full object-cover", locked && "brightness-75 grayscale-[0.4]")}
        />
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <LockIcon className="size-3.5" aria-hidden />
            <span className="sr-only">{t("fastPass")}</span>
          </span>
        ) : null}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("type-h4 truncate", state === "read" && "font-medium text-muted-foreground")}>{title}</span>
          {episode.isUp ? <Badge variant="up">{tcards("up")}</Badge> : null}
        </span>
        <span className="flex min-w-0 items-center gap-2.5 overflow-hidden text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
          <span className="truncate">{locked && iso ? t("freeOnShort", { date: formatShortDate(iso, locale) }) : loc.date(episode.date)}</span>
          <span className="flex items-center gap-[3px]">
            <HeartIcon className="size-3" aria-hidden />
            <span className="sr-only">{t("likes", { count: episode.likes })}</span>
            <span aria-hidden><Num>{episode.likes}</Num></span>
          </span>
        </span>
      </span>

      {locked ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Badge variant="warn" className="tabular-nums">
            <ZapIcon className="size-3" aria-hidden />
            {t("coins", { count: price })}
          </Badge>
          <span className="text-xs leading-4 text-muted-foreground">{t("freeIn", { days })}</span>
        </span>
      ) : null}
      {state === "unlocked" ? <Badge variant="brand">{t("unlocked")}</Badge> : null}
      {state === "read" ? (
        <Badge variant="secondary">
          <CheckIcon className="size-3" aria-hidden />
          {t("read")}
        </Badge>
      ) : null}
      {upNext ? <Badge variant="new">{t("upNext")}</Badge> : null}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground max-md:hidden" aria-hidden />
    </>
  )

  const cls = cn(rowClass, upNext && "bg-brand-wash-from shadow-[inset_3px_0_0_var(--primary)] hover:bg-brand-wash-from")

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 40} inView>
      <li>
        {locked ? (
          <button
            type="button"
            className={cls}
            onClick={() => onLockedClick?.(episode)}
          >
            {body}
          </button>
        ) : (
          <Link href={readerHref(series, episode.n)} className={cls}>
            {body}
          </Link>
        )}
      </li>
    </Effect>
  )
}
