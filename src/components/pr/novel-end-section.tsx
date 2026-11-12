"use client"

import { BookmarkIcon } from "@/components/animate-ui/icons/bookmark"
import { ChevronLeftIcon } from "@/components/animate-ui/icons/chevron-left"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { Share2Icon } from "@/components/animate-ui/icons/share-2"
import { useTranslations } from "@/i18n/translations"
import { toast } from "sonner"
import { useReport } from "@/components/pr/report-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { NovelChapter, Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { initials } from "@/lib/format"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { useAskToLogin, useEpisodeReactions } from "@/lib/me"
import { seriesHref } from "@/lib/routes"
import { useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"
import { ParticleBurst, useBurstOnPress } from "@/components/pr/particle-burst"

/** `.card.nr-card`: card colours of the reader theme (set on the reader root). */
const card = "rounded-card border bg-card text-reader-text"
const outline = "border-border bg-background text-reader-text hover:bg-accent hover:text-reader-text focus-visible:ring-offset-reader-page"

/**
 * End of a chapter (spec §4, prototype Novel end section): Like, Bookmark, Share, the creator's note,
 * Previous / Next (with the price when the next chapter is Fast Pass), all chapters and "Report this chapter".
 */
export function NovelEndSection({
  series,
  chapter,
  total,
  nextLocked,
  price,
  onPrev,
  onNext,
  finishRef,
}: {
  series: Series
  chapter: NovelChapter
  total: number
  nextLocked: boolean
  price: number
  onPrev: () => void
  onNext: () => void
  /** Marks the chapter finished once the end card scrolls into view. */
  finishRef?: (el: HTMLElement | null) => void
}) {
  const t = useTranslations("reader")
  const tt = useTranslations("toasts")
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport } = useReport()
  const n = chapter.n
  const { liked, bookmarked, toggleLike, toggleBookmark } = useEpisodeReactions({ series, n, kind: "novel", likes: chapter.likes })
  const [likeBurst, armLike] = useBurstOnPress(liked)
  const [markBurst, armMark] = useBurstOnPress(bookmarked)

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(tt("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView>
      <section aria-label={t("endOfChapter", { n })} className="flex flex-col gap-3.5 pt-4">
        <div ref={finishRef} className={cn(card, "flex flex-col items-center gap-3.5 p-6 text-center")}>
          <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-reader-quiet uppercase">{t("endOfChapter", { n })}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className={outline}
              aria-pressed={liked}
              onClick={() => {
                armLike()
                void toggleLike()
              }}
            >
              <ParticleBurst burst={likeBurst} tone="destructive">
                <HeartIcon className={cn(liked && "fill-destructive text-destructive")} aria-hidden />
              </ParticleBurst>
              {liked ? t("liked") : t("like")}
            </Button>
            <Button
              variant="outline"
              className={outline}
              aria-pressed={bookmarked}
              onClick={() => {
                armMark()
                void toggleBookmark()
              }}
            >
              <ParticleBurst burst={markBurst}>
                <BookmarkIcon className={cn(bookmarked && "fill-current")} aria-hidden />
              </ParticleBurst>
              {bookmarked ? t("bookmarked") : t("bookmark")}
            </Button>
            <Button variant="outline" className={outline} onClick={share}>
              <Share2Icon aria-hidden />
              {t("share")}
            </Button>
          </div>
        </div>

        {chapter.creatorNote ? (
          <div className={cn(card, "flex items-start gap-3 p-4")}>
            <Avatar variant="brand" className="after:border-transparent">
              <AvatarFallback className="text-xs">{initials(series.creator)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-xs leading-4 font-semibold text-reader-quiet">{t("creatorNote")}</h2>
              <p className="text-[13px] leading-[18px]">{chapter.creatorNote}</p>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" className={cn(outline, "flex-1")} disabled={n <= 1} onClick={onPrev}>
            <ChevronLeftIcon aria-hidden />
            {t("previous")}
          </Button>
          <Button variant="brand" size="lg" className="flex-1" disabled={n >= total} onClick={onNext}>
            {nextLocked ? t("nextCoins", { price }) : t("nextChapterBtn")}
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>

        <Button asChild variant="ghost" className="self-center text-reader-text hover:bg-accent hover:text-reader-text">
          <Link href={seriesHref(series)}>{t("allChapters", { title: series.title })}</Link>
        </Button>
        <button
          type="button"
          onClick={() => (user ? openReport({
                    kind: "episode",
                    target: `${series.title} · ${chapter.title}`,
                    onSend: DEMO_MODE ? undefined : (reason, details) => real.reportEpisode(series.slug, chapter.n, reason, details),
                  }) : askToLogin())}
          className="self-center rounded-sm text-[13px] leading-[18px] text-reader-quiet underline underline-offset-[3px] outline-none hover:text-reader-text focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("reportChapter")}
        </button>
      </section>
    </Effect>
  )
}
