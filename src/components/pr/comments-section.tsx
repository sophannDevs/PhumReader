"use client"

import { useTranslations } from "next-intl"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CommentComposer } from "@/components/pr/comment-composer"
import { CommentList, type CommentView } from "@/components/pr/comment-list"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useComments } from "@/lib/queries"
import { likeKey, useAppStore, useUser } from "@/lib/store"
import { MessageSquareIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  /** "reader" = the dark card at the end of a comic episode (one-line composer). */
  variant?: "page" | "reader"
  /** Total shown in the reader card header, e.g. "1.2K". */
  count?: string
}) {
  const t = useTranslations("comments")
  const tr = useTranslations("reader")
  const tt = useTranslations("toasts")
  const user = useUser()
  const likes = useAppStore((s) => s.likes)
  const query = useComments(kind, slug)
  const [posted, setPosted] = useState<CommentView[]>([])
  const [draft, setDraft] = useState("")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scope = `${kind}:${slug}`

  const comments = useMemo<CommentView[]>(() => {
    const base = (query.data ?? []).map((c, i) => ({ ...c, id: `d${i}` }))
    return [...posted, ...base].map((c) => ({ ...c, liked: !!likes[likeKey.comment(scope, c.id)] }))
  }, [query.data, posted, likes, scope])

  function submit() {
    if (!user) {
      toast(tt("loginToComment"))
      return
    }
    setPosted((p) => [{ id: `p${p.length}`, name: user.name, when: t("now"), text: draft.trim(), likes: 0 }, ...p])
    setDraft("")
  }

  if (variant === "reader") {
    return (
      <section className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface-panel p-5 text-surface-foreground">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {tr("commentsTitle")} {count ? <span className="font-normal text-surface-quiet tabular-nums">{count}</span> : null}
          </h2>
          <span className="type-caption text-surface-quiet">{tr("topComments")}</span>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) submit()
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={user ? tr("addComment") : tr("loginToComment")}
            aria-label={tr("addComment")}
            className="border-surface-border-strong bg-surface text-surface-foreground placeholder:text-surface-quiet focus-visible:ring-offset-surface-panel"
          />
          <Button type="submit" variant="brand" disabled={!draft.trim()}>
            {tr("post")}
          </Button>
        </form>
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 bg-surface-border" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <CommentList
            tone="dark"
            className="gap-4"
            comments={comments}
            onToggleLike={(id) => useAppStore.getState().toggleLike(likeKey.comment(scope, id))}
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
      <CommentComposer value={draft} onChange={setDraft} onSubmit={submit} textareaRef={composerRef} />

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
          onToggleLike={(id) => useAppStore.getState().toggleLike(likeKey.comment(scope, id))}
          onReply={(name) => {
            setDraft(`@${name} `)
            composerRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
