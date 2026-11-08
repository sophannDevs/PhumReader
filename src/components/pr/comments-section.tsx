"use client"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { CommentComposer } from "@/components/pr/comment-composer"
import { CommentList } from "@/components/pr/comment-list"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useCommentThread } from "@/lib/comments"
import { useUser } from "@/lib/store"
import { MessageSquareIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Composer + comment list for a series (or episode). Likes live in the store (persisted);
 * new comments live in component state (prepended with the reader's initials and "now").
 */
export function CommentsSection({
  kind,
  slug,
  variant = "page",
  count,
}: {
  kind: "series" | "episode"
  slug: string
  /** "reader" = the dark card at the end of a comic episode (one-line composer); "novel" = the same card in the novel reader theme colours. */
  variant?: "page" | "reader" | "novel"
  /** Total shown in the reader card header, e.g. "1.2K". */
  count?: string
}) {
  const t = useTranslations("comments")
  const tr = useTranslations("reader")
  const user = useUser()
  const thread = useCommentThread(kind, slug, t("now"))
  const { comments, query } = thread
  const [draft, setDraft] = useState("")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (await thread.post(draft)) setDraft("")
  }

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
            {tr("commentsTitle")} {count ? <span className={cn("font-normal tabular-nums", themed ? "text-reader-quiet" : "text-surface-quiet")}>{count}</span> : null}
          </h2>
          <span className={cn("type-caption", themed ? "text-reader-quiet" : "text-surface-quiet")}>{tr("topComments")}</span>
        </div>
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
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className={cn("h-10", themed ? "bg-reader-border" : "bg-surface-border")} />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <CommentList
            tone={themed ? "themed" : "dark"}
            className="gap-4"
            comments={comments}
            onToggleLike={(id) => void thread.toggleLike(id)}
            onDelete={thread.remove && ((id) => void thread.remove?.(id))}
            onReport={thread.report && ((id) => void thread.report?.(id))}
            onReply={(name) => {
              setDraft(`@${name} `)
              inputRef.current?.focus()
            }}
          />
        )}
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CommentComposer value={draft} onChange={setDraft} onSubmit={() => void submit()} textareaRef={composerRef} />

      {query.isPending ? (
        <div className="flex flex-col gap-6" aria-hidden>
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
        <ErrorState onRetry={() => void query.refetch()} />
      ) : comments.length === 0 ? (
        <EmptyState icon={MessageSquareIcon} title={t("empty")} description={t("emptyDesc")} />
      ) : (
        <CommentList
          comments={comments}
          onToggleLike={(id) => void thread.toggleLike(id)}
            onDelete={thread.remove && ((id) => void thread.remove?.(id))}
            onReport={thread.report && ((id) => void thread.report?.(id))}
          onReply={(name) => {
            setDraft(`@${name} `)
            composerRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
