"use client"

import { FlagIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Comment } from "@/data/types"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

/** A comment plus the state the page owns (stable id, whether this reader liked it). */
export type CommentView = Comment & { id: string; liked?: boolean; canDelete?: boolean; mine?: boolean }

/** Comments with avatar, name · time, "Top" badge, like toggle (count ± 1) and Reply. */
export function CommentList({
  comments,
  onToggleLike,
  onReply,
  onDelete,
  onReport,
  tone = "light",
  className,
}: {
  comments: CommentView[]
  onToggleLike: (id: string) => void
  /** Receives the author's name; the page prefills the composer with "@Name ". */
  onReply: (name: string) => void
  /** Offered on comments the reader may delete (their own). Real API only. */
  onDelete?: (id: string) => void
  /** Offered on other people's comments. Real API only. */
  onReport?: (id: string) => void
  /** "dark" for the comic reader (surface colours), "themed" for the novel reader (reader theme colours). */
  tone?: "light" | "dark" | "themed"
  className?: string
}) {
  const t = useTranslations("comments")
  const dark = tone === "dark"
  const themed = tone === "themed"
  const quiet = cn(dark && "text-surface-quiet hover:bg-surface-border hover:text-surface-foreground focus-visible:ring-offset-surface", themed && "text-reader-quiet hover:bg-reader-border hover:text-reader-text focus-visible:ring-offset-reader-page")

  return (
    <ul className={cn("flex flex-col gap-6", className)}>
      {comments.map((c) => {
        const count = c.likes + (c.liked ? 1 : 0)
        return (
          <li key={c.id} className="flex gap-3">
            <Avatar>
              <AvatarFallback className={cn(dark && "bg-surface-border text-surface-foreground", themed && "bg-reader-border text-reader-text")}>{initials(c.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className={dark ? "text-surface-quiet" : themed ? "text-reader-quiet" : "text-muted-foreground"}>· {c.when}</span>
                {c.top ? <Badge variant="brand">{t("top")}</Badge> : null}
              </div>
              <p className="text-sm break-words">{c.text}</p>
              <div className="-ml-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={!!c.liked}
                  aria-label={t("likeCount", { count })}
                  className={cn("gap-1.5 px-2 tabular-nums", dark && "text-surface-quiet hover:bg-surface-border hover:text-surface-foreground focus-visible:ring-offset-surface", themed && "text-reader-quiet hover:bg-reader-border hover:text-reader-text focus-visible:ring-offset-reader-page", c.liked && (dark ? "text-primary" : "text-brand-ink"))}
                  onClick={() => onToggleLike(c.id)}
                >
                  <ThumbsUpIcon className={cn(c.liked && "fill-primary")} />
                  {count}
                </Button>
                <Button variant="ghost" size="sm" className={cn("px-2", dark && "text-surface-quiet hover:bg-surface-border hover:text-surface-foreground focus-visible:ring-offset-surface", themed && "text-reader-quiet hover:bg-reader-border hover:text-reader-text focus-visible:ring-offset-reader-page")} onClick={() => onReply(c.name)}>
                  {t("reply")}
                </Button>
                {c.canDelete && onDelete ? (
                  <Button variant="ghost" size="sm" className={cn("gap-1.5 px-2", quiet)} onClick={() => onDelete(c.id)}>
                    <Trash2Icon />
                    {t("delete")}
                  </Button>
                ) : null}
                {!c.mine && onReport ? (
                  <Button variant="ghost" size="sm" className={cn("gap-1.5 px-2", quiet)} onClick={() => onReport(c.id)}>
                    <FlagIcon />
                    {t("report")}
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
