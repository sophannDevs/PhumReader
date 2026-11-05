"use client"

import { ArrowRightIcon, BellIcon, CheckIcon, HeartIcon, ListIcon, Share2Icon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CommentsSection } from "@/components/pr/comments-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { episodeCommentCount, type Episode, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { formatCount, parseCount } from "@/lib/format"
import { readerHref, seriesHref } from "@/lib/routes"
import { likeKey, useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const card = "rounded-card border border-surface-border bg-surface-panel p-5"
const pill =
  "border-surface-border-strong bg-transparent text-surface-foreground hover:bg-surface-border hover:text-surface-foreground focus-visible:ring-offset-surface-panel"

/** Below the strip: end card (Like / Subscribe / Share), next episode, comments, all episodes. */
export function ComicEndSection({
  series,
  episode,
  next,
  nextLocked,
  onUnlockNext,
}: {
  series: Series
  episode: Episode
  /** The following episode, or undefined on the last one. */
  next?: Episode
  nextLocked: boolean
  onUnlockNext: () => void
}) {
  const t = useTranslations("reader")
  const tt = useTranslations("toasts")
  const key = likeKey.episode(series.id, episode.n)
  const liked = useAppStore((s) => !!s.likes[key])
  const subscribed = useAppStore((s) => s.subscriptions.includes(series.id))
  const likeCount = parseCount(episode.likes) + (liked ? 1 : 0)

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(tt("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-3 px-4 py-6">
      <section className={cn(card, "flex flex-col items-center gap-3 text-center")}>
        <p className="type-eyebrow text-surface-quiet">{t("endOf", { n: episode.n })}</p>
        <h2 className="type-h3">{episode.title}</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={liked}
            aria-label={t("likeLabel", { count: likeCount.toLocaleString("en-US") })}
            className={cn(pill, "tabular-nums")}
            onClick={() => useAppStore.getState().toggleLike(key)}
          >
            <HeartIcon className={cn(liked && "fill-destructive text-destructive")} />
            {formatCount(likeCount)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={subscribed}
            className={pill}
            onClick={() => {
              useAppStore.getState().toggleSubscription(series.id)
              toast.success(subscribed ? tt("unsubscribed") : tt("subscribed", { title: series.title }))
            }}
          >
            {subscribed ? <CheckIcon /> : <BellIcon />}
            {subscribed ? t("subscribed") : t("subscribe")}
          </Button>
          <Button variant="outline" size="sm" className={pill} onClick={share}>
            <Share2Icon />
            {t("share")}
          </Button>
        </div>
      </section>

      {next ? (
        <section className={cn(card, "flex items-center gap-4")}>
          <div className="relative size-12 shrink-0 overflow-hidden rounded-control bg-surface">
            <Image src={next.thumb} alt="" width={96} height={96} className="size-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <p className="type-caption text-surface-quiet">{t("nextEpisode_card")}</p>
            <h3 className="type-h4 truncate">{next.title}</h3>
            {nextLocked ? (
              <Badge variant="warn">
                <ZapIcon /> Fast Pass
              </Badge>
            ) : null}
          </div>
          {nextLocked ? (
            <Button variant="brand" size="sm" onClick={onUnlockNext}>
              {t("unlock")}
            </Button>
          ) : (
            <Button asChild variant="brand" size="sm">
              <Link href={readerHref(series, next.n)}>
                {t("readNext")}
                <ArrowRightIcon />
              </Link>
            </Button>
          )}
        </section>
      ) : (
        <section className={cn(card, "flex flex-col items-center gap-1 text-center")}>
          <h3 className="type-h4">{t("caughtUp")}</h3>
          <p className="type-small font-normal text-surface-quiet">{t("caughtUpDesc")}</p>
        </section>
      )}

      <CommentsSection kind="episode" slug={`${series.slug}:${episode.n}`} variant="reader" count={episodeCommentCount(episode)} />

      <div className="flex justify-center pt-2">
        <Button asChild variant="outline" size="sm" className={pill}>
          <Link href={seriesHref(series)}>
            <ListIcon />
            {t("allEpisodes", { title: series.title })}
          </Link>
        </Button>
      </div>
    </div>
  )
}
