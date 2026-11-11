"use client";

import { ArrowRightIcon, BellIcon, HeartIcon, ListIcon, MessageSquareIcon, Share2Icon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CommentThread } from "@/components/pr/comment-thread"
import { BlockedHiddenLine, useBlockedFilter, useReport } from "@/components/pr/report-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { episodeCommentCount, type Episode, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { useCommentThreads } from "@/lib/comments"
import { formatCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useAskToLogin, useEpisodeReactions, useSubscribe } from "@/lib/me"
import { seriesHref } from "@/lib/routes"
import { useAppStore, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/** `.vw-card`: the reader's card colours (set on the reader root), 14 px radius. */
const card = "rounded-[14px] border bg-card p-6 text-card-foreground max-md:p-[18px]"
/** `.vw-pill`: round grey button. */
export const pill = "rounded-full border-input bg-secondary text-foreground shadow-none hover:bg-input hover:text-foreground"
const TOP = 3
const MAX = 300

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
  dark,
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
  /** Dark reading background (comment text colour) */
  dark: boolean
  /** Marks the episode finished once the end card scrolls into view. */
  finishRef?: (el: HTMLElement | null) => void
  /** Real API (V21-02): false when the creator turned comments off (no comment box) */
  commentsEnabled?: boolean
}) {
  const t = useTranslations("reader")
  const tt = useTranslations("toasts")
  const loc = useLocalize()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport } = useReport()
  const { liked, likeCount, toggleLike } = useEpisodeReactions({ series, n: episode.n, kind: "comic", likes: episode.likes })
  const { subscribed, toggle: toggleSubscribe } = useSubscribe(series)

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(tt("linkCopied"));
    } catch {
      toast.error(tt("copyFailed"));
    }
  }

  function like() {
    const liking = !liked
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
            <HeartIcon className={cn(liked && "fill-destructive text-destructive")} aria-hidden />
            <Num>{formatCount(likeCount)}</Num>
          </Button>
          <Button variant="outline" aria-pressed={subscribed} className={pill} onClick={() => void toggleSubscribe()}>
            <BellIcon aria-hidden />
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
          <button
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
          </button>
        </>
      ) : (
        <div className={cn(card, "text-center text-[13px] leading-[18px] text-foreground/80")}>{caughtUp}</div>
      )}

      <TopComments series={series} episode={episode} dark={dark} closed={!commentsEnabled} />

      <Button asChild variant="outline" className={cn(pill, "self-center")}>
        <Link href={seriesHref(series)}>
          <ListIcon className="size-3.5" aria-hidden />
          {t("allEpisodes", { title: series.title })}
        </Link>
      </Button>
    </section>
  )
}

/** "Comments 1.2K · See all", a one-line composer and the top 3 threads (the reader's own new ones first). */
function TopComments({ series, episode, dark, closed }: { series: Series; episode: Episode; dark: boolean; closed: boolean }) {
  const t = useTranslations("reader")
  const tc = useTranslations("comments")
  const user = useUser()
  const data = useCommentThreads(series, `${series.slug}:${episode.n}`)
  const blocked = useAppStore((s) => s.blocked)
  const { visible, hidden, reveal } = useBlockedFilter(data.threads, (c) => c.name)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)

  const top = useMemo(() => {
    const mine = visible.filter((c) => c.mine)
    const others = visible.filter((c) => !c.mine && !c.pinned).sort((a, b) => b.likes - a.likes)
    return [...mine, ...others.slice(0, TOP)]
  }, [visible])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || posting) return
    setPosting(true)
    const ok = await data.post(draft, false)
    setPosting(false)
    if (ok) setDraft("")
  }

  return (
    <div className={cn(card, "flex flex-col gap-3.5")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h4">
          {t("commentsTitle")} <span className="font-medium text-muted-foreground tabular-nums"><Num>{episodeCommentCount(episode)}</Num></span>
        </h2>
        <Link
          href={`/series/${series.slug}/comments?ep=${episode.n}`}
          className="rounded-sm text-xs leading-4 font-semibold underline underline-offset-[3px] outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("seeAll")}
        </Link>
      </div>
      {closed ? (
        <p className="text-[13px] leading-[18px] text-muted-foreground">{tc("closed")}</p>
      ) : (
        <form className="flex gap-2" onSubmit={post}>
          <Input
            value={draft}
            maxLength={MAX}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            placeholder={user ? t("addCommentPh") : t("loginToComment")}
            aria-label={t("addComment")}
            className="shadow-none"
          />
          <Button type="submit" variant="brand" loading={posting}>
            {t("post")}
          </Button>
        </form>
      )}
      {data.query.isPending ? (
        <div className="flex flex-col gap-4" aria-hidden>
          {Array.from({ length: TOP }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-32 bg-muted" />
                <Skeleton className="h-3 w-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : data.query.isError ? (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground" role="alert">
          {t("commentsError")}
          <Button variant="ghost" size="sm" onClick={() => void data.query.refetch()}>
            {t("tryAgain")}
          </Button>
        </p>
      ) : top.length === 0 ? (
        // Comments turned off and none written: the note above says it all ("No comments yet. Be the first." would not fit).
        closed && data.threads.length === 0 ? null : (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MessageSquareIcon className="size-4" aria-hidden />
            {data.threads.length === 0 ? t("noComments") : t("noVisibleComments")}
          </p>
        )
      ) : (
        <ul aria-label={t("commentsTitle")} className={cn("flex flex-col [&>li:last-child]:border-b-0 [&>li:last-child]:pb-0", dark && "[&_p]:text-[#e4e4e7]")}>
          {top.map((c) => (
            <CommentThread
              key={c.id}
              thread={c}
              hideReplyFrom={blocked}
              onLike={(id) => void data.like(id)}
              onReply={data.reply}
              onEdit={data.edit}
              onDelete={(id) => void data.remove(id)}
              onReportSend={data.reportSend}
              className="py-3"
            />
          ))}
        </ul>
      )}
      <BlockedHiddenLine count={hidden} onShow={reveal} className="text-xs" />
    </div>
  );
}
