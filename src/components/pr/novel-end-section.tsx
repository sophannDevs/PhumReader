"use client"

import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, HeartIcon, ListIcon, MessageSquareIcon, Share2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CommentsSection } from "@/components/pr/comments-section"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { chapterCommentCount, fastPassPrice, type Series } from "@/data"
import type { NovelChapter } from "@/data"
import { Link } from "@/i18n/navigation"
import { formatCount, initials, parseCount } from "@/lib/format"
import { seriesHref } from "@/lib/routes"
import { likeKey, useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const card = "rounded-card border border-reader-border"
const pill =
  "border-reader-border bg-transparent text-reader-text hover:bg-reader-border/60 hover:text-reader-text focus-visible:ring-offset-reader-page"

/** End of a chapter: Like / Bookmark / Share, creator's note, Previous / Next and "All chapters". */
export function NovelEndSection({
  series,
  chapter,
  total,
  nextLocked,
  onPrev,
  onNext,
}: {
  series: Series
  chapter: NovelChapter
  total: number
  nextLocked: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const t = useTranslations("reader")
  const tt = useTranslations("toasts")
  const n = chapter.n
  const likedKey = likeKey.episode(series.id, n)
  const markKey = likeKey.bookmark(series.id, n)
  const liked = useAppStore((s) => !!s.likes[likedKey])
  const bookmarked = useAppStore((s) => !!s.likes[markKey])
  const likeCount = parseCount(chapter.likes) + (liked ? 1 : 0)
  const commentCount = chapterCommentCount(chapter)

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(tt("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }

  return (
    <div className="mt-12 flex flex-col gap-3">
      <section className={cn(card, "flex flex-col items-center gap-3 px-5 py-5 text-center")}>
        <p className="type-caption tracking-wider text-reader-quiet uppercase">{t("endOfChapter", { n })}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={pill}
            aria-pressed={liked}
            aria-label={`${formatCount(likeCount)} · ${t("likeLabel", { count: likeCount.toLocaleString("en-US") })}`}
            onClick={() => useAppStore.getState().toggleLike(likedKey)}
          >
            <HeartIcon className={cn(liked && "fill-destructive text-destructive")} />
            <span className="tabular-nums">{formatCount(likeCount)}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={pill}
            onClick={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <MessageSquareIcon />
            <span className="tabular-nums">{commentCount}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={pill}
            aria-pressed={bookmarked}
            onClick={() => {
              useAppStore.getState().toggleLike(markKey)
              toast.success(tt(bookmarked ? "bookmarkRemoved" : "bookmarked"))
            }}
          >
            <BookmarkIcon className={cn(bookmarked && "fill-current")} />
            {t("bookmark")}
          </Button>
          <Button variant="outline" size="sm" className={pill} onClick={share}>
            <Share2Icon />
            {t("share")}
          </Button>
        </div>
      </section>

      <section className={cn(card, "flex items-start gap-3 p-4")}>
        <Avatar variant="brand" size="lg">
          <AvatarFallback>{initials(series.creator)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="type-caption text-reader-quiet">{t("creatorNote")}</h2>
          <p className="type-small font-normal">{chapter.creatorNote}</p>
        </div>
      </section>

      <CommentsSection kind="episode" slug={`${series.slug}:${n}`} variant="novel" count={commentCount} />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" className={cn(pill, "text-reader-quiet")} disabled={n <= 1} onClick={onPrev}>
          <ChevronLeftIcon />
          {t("previous")}
        </Button>
        <Button variant="brand" size="lg" disabled={n >= total} onClick={onNext}>
          {nextLocked ? t("nextCoins", { price: fastPassPrice() }) : t("nextChapterBtn")}
          <ChevronRightIcon />
        </Button>
      </div>

      <Link
        href={seriesHref(series)}
        className="mx-auto inline-flex items-center gap-2 rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ListIcon className="size-4" aria-hidden />
        {t("allChapters", { title: series.title })}
      </Link>
    </div>
  )
}
