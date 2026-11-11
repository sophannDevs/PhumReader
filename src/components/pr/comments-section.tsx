"use client"

import { ChevronRightIcon, MessageSquareIcon, RotateCcwIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useRef, useState } from "react"
import { CommentComposer } from "@/components/pr/comment-composer"
import { CommentList } from "@/components/pr/comment-list"
import { ErrorState } from "@/components/pr/error-state"
import { BlockedHiddenLine, useBlockedFilter } from "@/components/pr/report-dialog"
import { StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "@/i18n/navigation"
import { useCommentThread } from "@/lib/comments"
import { useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/**
 * Composer + comment list for a series (or episode). Likes live in the store (persisted);
 * new comments live in component state (prepended with the reader's name and "now").
 * Other people's comments have Report / Block; blocked people's comments are hidden behind a "Show" line.
 * On the series page the list is a preview with "See all 2.4K comments" → the Comments page (`seeAllHref`).
 * `closed` (real API, V21-02): the creator turned comments off, so there is no comment box, only a note.
 */
export function CommentsSection({
  kind,
  slug,
  variant = "page",
  count,
  seeAllHref,
  closed = false,
}: {
  kind: "series" | "episode"
  slug: string
  /** "reader" = the dark card at the end of a comic episode (one-line composer); "novel" = the same card in the novel reader theme colours. */
  variant?: "page" | "reader" | "novel"
  /** Total shown in the reader card header and the "See all" button, e.g. "1.2K". */
  count?: string
  /** Comments page link ("See all N comments"). */
  seeAllHref?: string
  /** The creator turned comments off (series or episode switch): no composer. */
  closed?: boolean
}) {
  const t = useTranslations("comments")
  const tr = useTranslations("reader")
  const user = useUser()
  const thread = useCommentThread(kind, slug, t("now"))
  const { comments, query } = thread
  const { visible, hidden, reveal } = useBlockedFilter(comments, (c) => c.name)
  const [draft, setDraft] = useState("")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (await thread.post(draft)) setDraft("")
  }

  const list = (tone: "light" | "dark" | "themed", className?: string) => (
    <CommentList
      tone={tone}
      className={className}
      comments={visible}
      onToggleLike={(id) => void thread.toggleLike(id)}
      onDelete={thread.remove && ((id) => void thread.remove?.(id))}
      onReportSend={thread.reportSend}
      onReply={(name) => {
        setDraft(`@${name} `)
        ;(tone === "light" ? composerRef.current : inputRef.current)?.focus()
      }}
    />
  )

  if (variant === "reader" || variant === "novel") {
    const themed = variant === "novel"
    return (
      <section
        id={themed ? "comments" : undefined}
        className={cn(
          "flex scroll-mt-20 flex-col gap-4 rounded-card border p-5",
          themed ? "border-reader-border text-reader-text" : "border-surface-border bg-surface-panel text-surface-foreground",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {tr("commentsTitle")} {count ? <span className={cn("font-normal tabular-nums", themed ? "text-reader-quiet" : "text-surface-quiet")}><Num>{count}</Num></span> : null}
          </h2>
          <span className={cn("type-caption", themed ? "text-reader-quiet" : "text-surface-quiet")}>{tr("topComments")}</span>
        </div>
        {closed ? (
          <p className={cn("text-[13px] leading-[18px]", themed ? "text-reader-quiet" : "text-surface-quiet")}>{t("closed")}</p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim()) void submit()
            }}
          >
            <Input
              ref={inputRef}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={user ? tr("addComment") : tr("loginToComment")}
              aria-label={tr("addComment")}
              className={cn(themed ? "border-reader-border bg-transparent text-reader-text placeholder:text-reader-quiet focus-visible:ring-offset-reader-page" : "border-surface-border-strong bg-surface text-surface-foreground placeholder:text-surface-quiet focus-visible:ring-offset-surface-panel")}
            />
            <Button type="submit" variant="brand" disabled={!draft.trim()}>
              {tr("post")}
            </Button>
          </form>
        )}
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className={cn("h-10", themed ? "bg-reader-border" : "bg-surface-border")} />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : comments.length === 0 ? (
          <p className={cn("py-6 text-center text-sm", themed ? "text-reader-quiet" : "text-surface-quiet")}>
            {t("empty")}
          </p>
        ) : (
          <>
            {list(themed ? "themed" : "dark", "gap-4")}
            <BlockedHiddenLine count={hidden} onShow={reveal} className={themed ? "text-reader-quiet" : "text-surface-quiet"} />
          </>
        )}
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {closed ? (
        <p className="rounded-card border bg-card p-4 text-[13px] leading-[18px] text-muted-foreground shadow-xs">{t("closed")}</p>
      ) : (
        <CommentComposer value={draft} onChange={setDraft} onSubmit={() => void submit()} textareaRef={composerRef} />
      )}

      {query.isPending ? (
        <div className="flex flex-col gap-5" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <StateBox
          icon={RotateCcwIcon}
          tone="bad"
          title={t("errorTitle")}
          text={t("errorText")}
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
              {t("tryAgain")}
            </Button>
          }
        />
      ) : comments.length === 0 ? (
        closed ? null : <StateBox icon={MessageSquareIcon} title={t("empty")} text={t("emptyDesc")} />
      ) : (
        <>
          {list("light")}
          {seeAllHref ? (
            <Button asChild variant="outline" className="self-center">
              <Link href={seeAllHref}>
                {t("seeAll", { count: count ?? "" })}
                <ChevronRightIcon className="size-3.5" />
              </Link>
            </Button>
          ) : null}
          <BlockedHiddenLine count={hidden} onShow={reveal} className="rounded-control bg-muted px-3 py-2.5 text-xs" />
        </>
      )}
    </div>
  )
}
