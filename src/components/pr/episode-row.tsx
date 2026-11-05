import { CheckIcon, ChevronRightIcon, LockIcon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { Episode, Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { readerHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"

export type EpisodeState = "free" | "read" | "locked" | "unlocked"

/** The list wrapper: one bordered card with dividers between rows. */
export function EpisodeList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("divide-y overflow-hidden rounded-card border bg-card shadow-xs", className)}
      {...props}
    />
  )
}

const rowClass =
  "group flex w-full items-center gap-3 px-3.5 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"

/**
 * One episode (or novel chapter). 64 px thumb, title, date and likes, and a
 * state on the right. Free / read / unlocked rows open the reader; locked rows
 * call `onLockedClick` (the UnlockDialog opens there).
 */
export function EpisodeRow({
  series,
  episode,
  state,
  price = 5,
  onLockedClick,
}: {
  series: Pick<Series, "slug" | "type">
  episode: Episode
  state: EpisodeState
  /** Fast Pass price in coins */
  price?: number
  onLockedClick?: (episode: Episode) => void
}) {
  const t = useTranslations("episodes")
  const loc = useLocalize()
  const tc = useTranslations("coins")
  const tcards = useTranslations("cards")
  const locked = state === "locked"

  const body = (
    <>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-control bg-muted">
        <Image
          src={episode.thumb}
          alt=""
          width={128}
          height={128}
          sizes="64px"
          className={cn("size-full object-cover", locked && "opacity-50 saturate-50")}
        />
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center text-surface-foreground">
            <LockIcon className="size-5 drop-shadow" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={cn(
              "type-h4 truncate",
              state === "read" && "font-medium text-muted-foreground"
            )}
          >
            {loc.title(episode.title)}
          </p>
          {state === "free" && episode.isUp ? <Badge variant="up">{tcards("up")}</Badge> : null}
        </div>
        <p className="type-small flex items-center gap-3 font-normal text-muted-foreground tabular-nums">
          <span>{loc.date(episode.date)}</span>
          <span aria-label={t("likes", { count: episode.likes })}>♡ {episode.likes}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {state === "locked" ? (
          <Badge variant="warn" className="tabular-nums">
            <ZapIcon /> {tc("balanceLabel", { count: price })}
          </Badge>
        ) : null}
        {state === "unlocked" ? <Badge variant="brand">{t("unlocked")}</Badge> : null}
        {state === "read" ? (
          <Badge variant="outline" className="font-medium text-muted-foreground">
            <CheckIcon /> {t("read")}
          </Badge>
        ) : null}
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </div>
    </>
  )

  return (
    <li>
      {locked ? (
        <button
          type="button"
          className={rowClass}
          onClick={() => onLockedClick?.(episode)}
        >
          {body}
          <span className="sr-only">{t("locked", { count: price })}</span>
        </button>
      ) : (
        <Link href={readerHref(series, episode.n)} className={rowClass}>
          {body}
        </Link>
      )}
    </li>
  )
}
