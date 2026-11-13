"use client";

import { AnimateIcon } from "@animate-ui/react/icons"
import { ArrowRightIcon } from "@/components/animate-ui/icons/arrow-right"
import { BellIcon } from "@/components/animate-ui/icons/bell"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { ListIcon } from "@/components/animate-ui/icons/list"
import { Share2Icon } from "@/components/animate-ui/icons/share-2"
import { ZapIcon } from "@/components/animate-ui/icons/zap"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { toast } from "sonner"
import { useReport } from "@/components/pr/report-dialog"
import { TopComments } from "@/components/pr/top-comments"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import type { Episode, Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { formatCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useAskToLogin, useEpisodeReactions, useSubscribe } from "@/lib/me"
import { seriesHref } from "@/lib/routes"
import { useUser } from "@/lib/store"
import { useCopyLink } from "@/lib/use-copy-link"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"
import { ParticleBurst, useBurstOnPress } from "@/components/pr/particle-burst"

/** `.vw-card`: the reader's card colours (set on the reader root), 14 px radius. */
const card = "rounded-[14px] border bg-card p-6 text-card-foreground max-md:p-[18px]"
/** `.vw-pill`: round grey button. */
export const pill = "rounded-full border-input bg-secondary text-foreground shadow-none hover:bg-input hover:text-foreground"

/**
 * Below the strip (spec §3 "End of episode", prototype `.vw-end`): the end card (Like, Subscribe, Share, Report this
 * episode), the auto-next countdown with Cancel, the next episode card (price and free date when it is Fast Pass) or
 * "all caught up", the top comments (CommentThread, Report / Block, "See all") and all episodes.
 */
export function ComicEndSection({
  series,
  episode,
  next,
  nextLocked,
  price,
  onNext,
  countdown,
  onCancelAuto,
  finishRef,
  commentsEnabled = true,
}: {
  series: Series;
  episode: Episode;
  /** The following episode, or undefined on the last one. */
  next?: Episode
  nextLocked: boolean
  price: number
  /** Opens the next episode (or the UnlockDialog when it is locked). */
  onNext: () => void
  /** Seconds left before the next episode opens; null when not counting. */
  countdown: number | null
  onCancelAuto: () => void
  /** Marks the episode finished once the end card scrolls into view. */
  finishRef?: (el: HTMLElement | null) => void
  /** Real API (V21-02): false when the creator turned comments off (no comment box) */
  commentsEnabled?: boolean
}) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport } = useReport()
  const { liked, likeCount, toggleLike } = useEpisodeReactions({ series, n: episode.n, kind: "comic", likes: episode.likes })
  const { subscribed, toggle: toggleSubscribe } = useSubscribe(series)
  const [likeBurst, armLike] = useBurstOnPress(liked)
  const [subBurst, armSub] = useBurstOnPress(subscribed)

  const share = useCopyLink()

  function like() {
    const liking = !liked
    armLike()
    void toggleLike()
    if (liking && (DEMO_MODE || user)) toast.success(t("thanksLike"))
  }

  // "New episodes every Monday and Thursday." (V21-02: every update day); a series on a break says so instead.
  const caughtUp =
    series.status === "hiatus"
      ? t("caughtUpBreak")
      : series.status === "completed" || !series.updateDays.length
        ? t("caughtUpDone")
        : t("caughtUpLine", { day: loc.days(series.updateDays, "full") })

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView>
      <section aria-label={t("endOf", { n: episode.n })} className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 pt-8 pb-[72px]">
        <div ref={finishRef} className={cn(card, "flex flex-col items-center gap-4 text-center")}>
          <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t("endOf", { n: episode.n })}</p>
          <h2 className="type-h3">{loc.title(episode.title)}</h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              aria-pressed={liked}
              aria-label={t("likeLabel", { count: formatCount(likeCount) })}
              className={cn(pill, "tabular-nums", liked && "bg-foreground text-background hover:bg-foreground/90 hover:text-background")}
              onClick={like}
            >
              <ParticleBurst burst={likeBurst} tone="destructive">
                <HeartIcon className={cn(liked && "fill-destructive text-destructive")} aria-hidden />
              </ParticleBurst>
              <Num>{formatCount(likeCount)}</Num>
            </Button>
            <Button
              variant="outline"
              aria-pressed={subscribed}
              className={pill}
              onClick={() => {
                armSub()
                void toggleSubscribe()
              }}
            >
              <ParticleBurst burst={subBurst}>
                <BellIcon aria-hidden />
              </ParticleBurst>
              {subscribed ? t("subscribed") : t("subscribe")}
            </Button>
            <Button variant="outline" className={pill} onClick={share}>
              <Share2Icon aria-hidden />
              {t("share")}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => (user ? openReport({
                    kind: "episode",
                    target: `${series.title} · ${episode.title}`,
                    onSend: DEMO_MODE ? undefined : (reason, details) => real.reportEpisode(series.slug, episode.n, reason, details),
                  }) : askToLogin())}
            className="rounded-sm text-[13px] leading-[18px] text-muted-foreground underline underline-offset-[3px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("reportEpisode")}
          </button>
        </div>

        {next ? (
          <>
            {countdown !== null && !nextLocked ? (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/12 py-2.5 pr-3 pl-4 text-sm tabular-nums"
              >
                {t("nextIn", { count: countdown })}
                <Button variant="ghost" size="sm" onClick={onCancelAuto}>
                  {t("cancel")}
                </Button>
              </div>
            ) : null}
            <AnimateIcon asChild animateOnHover><button
              type="button"
              onClick={onNext}
              className="group flex w-full items-center gap-4 rounded-[14px] border bg-card p-4 text-left text-card-foreground transition-colors outline-none hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-md:flex-wrap"
            >
              <Image src={next.thumb} alt="" width={144} height={144} sizes="72px" className="size-[72px] shrink-0 rounded-[10px] object-cover" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="text-xs leading-4 text-muted-foreground">{t("nextEpisodeCard")}</span>
                <span className="type-h4">{loc.title(next.title)}</span>
                {nextLocked ? (
                  <Badge variant="warn" className="h-auto min-h-[22px] whitespace-normal">
                    <ZapIcon className="size-3" aria-hidden />
                    {t("nextFastPass", { price, date: loc.date(next.date) })}
                  </Badge>
                ) : null}
              </span>
              <span className={cn(buttonVariants({ variant: "brand" }), "max-md:w-full")}>
                {nextLocked ? t("unlock") : t("readNext")}
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </span>
            </button></AnimateIcon>
          </>
        ) : (
          <div className={cn(card, "text-center text-[13px] leading-[18px] text-foreground/80")}>{caughtUp}</div>
        )}

        <TopComments series={series} episode={episode} closed={!commentsEnabled} className={card} />

        <Button asChild variant="outline" className={cn(pill, "self-center")}>
          <Link href={seriesHref(series)}>
            <ListIcon className="size-3.5" aria-hidden />
            {t("allEpisodes", { title: series.title })}
          </Link>
        </Button>
      </section>
    </Effect>
  )
}
