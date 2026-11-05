"use client"

import { ThumbsUpIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Comment } from "@/data/types"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

/** A comment plus the state the page owns (stable id, whether this reader liked it). */
export type CommentView = Comment & { id: string; liked?: boolean }

/** Comments with avatar, name · time, "Top" badge, like toggle (count ± 1) and Reply. */
export function CommentList({
  comments,
  onToggleLike,
  onReply,
  className,
}: {
  comments: CommentView[]
  onToggleLike: (id: string) => void
  /** Receives the author's name; the page prefills the composer with "@Name ". */
  onReply: (name: string) => void
  className?: string
}) {
  const t = useTranslations("comments")

  return (
    <ul className={cn("flex flex-col gap-6", className)}>
      {comments.map((c) => {
        const count = c.likes + (c.liked ? 1 : 0)
        return (
          <li key={c.id} className="flex gap-3">
            <Avatar>
              <AvatarFallback>{initials(c.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground">· {c.when}</span>
                {c.top ? <Badge variant="brand">{t("top")}</Badge> : null}
              </div>
              <p className="text-sm break-words">{c.text}</p>
              <div className="-ml-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={!!c.liked}
                  aria-label={t("likeCount", { count })}
                  className={cn("gap-1.5 px-2 tabular-nums", c.liked && "text-brand-ink")}
                  onClick={() => onToggleLike(c.id)}
                >
                  <ThumbsUpIcon className={cn(c.liked && "fill-primary")} />
                  {count}
                </Button>
                <Button variant="ghost" size="sm" className="px-2" onClick={() => onReply(c.name)}>
                  {t("reply")}
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
