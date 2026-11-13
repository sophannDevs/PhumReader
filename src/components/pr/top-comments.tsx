"use client"

import { MessageSquareIcon } from "@/components/animate-ui/icons/message-square"
import { useTranslations } from "@/i18n/translations"
import { useMemo, useState } from "react"
import { CommentThread } from "@/components/pr/comment-thread"
import { BlockedHiddenLine, useBlockedFilter } from "@/components/pr/report-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { episodeCommentCount, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useCommentThreads } from "@/lib/comments"
import { useAppStore, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

const TOP = 3
const MAX = 300

/**
 * "Comments 1.2K · See all", a one-line composer and the top 3 threads (the reader's own new ones first), under a
 * comic episode (ComicEndSection) or a novel chapter (NovelEndSection). `closed`: comments turned off (no composer).
 */
export function TopComments({
  series,
  episode,
  closed,
  className,
  inputClassName,
}: {
  series: Series
  /** The episode or chapter number and its likes (the comment count is estimated from them). */
  episode: { n: number; likes: string }
  closed: boolean
  /** The card: border, background, text colour and padding of the reader it sits in. */
  className?: string
  /** Extra classes for the comment box (e.g. the reader page's focus ring offset). */
  inputClassName?: string
}) {
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
    <div className={cn("flex flex-col gap-3.5", className)}>
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
            className={cn("shadow-none", inputClassName)}
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
        <ul aria-label={t("commentsTitle")} className="flex flex-col [&>li:last-child]:border-b-0 [&>li:last-child]:pb-0">
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
  )
}
