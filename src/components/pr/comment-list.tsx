"use client"

import { ThumbsUpIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { CommentAvatar } from "@/components/pr/comment-thread"
import { useReport } from "@/components/pr/report-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Comment } from "@/data/types"
import { formatCount, initials } from "@/lib/format"
import { useAskToLogin } from "@/lib/me"
import { useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/** A comment plus the state the page owns (stable id, whether this reader liked it). */
export type CommentView = Comment & { id: string; liked?: boolean; canDelete?: boolean; mine?: boolean }

/**
 * Flat comments (series Comments tab preview, the readers' end cards): avatar, name · time, "Top" badge, then
 * Like (count ± 1), Reply, and Report / Block on other people's comments (app-wide dialogs, log in first).
 * Delete shows on the reader's own comments when `onDelete` is given (real API).
 */
export function CommentList({
  comments,
  onToggleLike,
  onReply,
  onDelete,
  onReportSend,
  tone = "light",
  className,
}: {
  comments: CommentView[]
  onToggleLike: (id: string) => void
  /** Receives the author's name; the page prefills the composer with "@Name ". */
  onReply: (name: string) => void
  /** Offered on comments the reader may delete (their own). Real API only. */
  onDelete?: (id: string) => void
  /** Real API: the Report dialog also sends the report there. */
  onReportSend?: (id: string, reason: string, details: string) => Promise<void>
  /** "dark" for the comic reader (surface colours), "themed" for the novel reader (reader theme colours). */
  tone?: "light" | "dark" | "themed"
  className?: string
}) {
  const t = useTranslations("comments")
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport, openBlock } = useReport()
  const dark = tone === "dark"
  const themed = tone === "themed"
  const ghost = cn(
    dark && "text-surface-quiet hover:bg-surface-border hover:text-surface-foreground focus-visible:ring-offset-surface",
    themed && "text-reader-quiet hover:bg-reader-border hover:text-reader-text focus-visible:ring-offset-reader-page"
  )
  const quiet = cn(ghost, !dark && !themed && "text-muted-foreground")
  const gate = (fn: () => void) => () => (user ? fn() : askToLogin())

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {comments.map((c) => {
        const count = c.likes + (c.liked ? 1 : 0)
        return (
          <li key={c.id} className="flex items-start gap-3">
            {dark || themed ? (
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  dark ? "bg-surface-border text-surface-foreground" : "bg-reader-border text-reader-text"
                )}
              >
                {initials(c.name)}
              </span>
            ) : (
              <CommentAvatar name={c.name} mine={c.mine} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-1 text-[13px] leading-[18px]">
                <strong className="font-semibold">{c.name}</strong>
                <span className={dark ? "text-surface-quiet" : themed ? "text-reader-quiet" : "text-muted-foreground"}>· {c.when}</span>
                {c.top ? (
                  <Badge variant="brand" className="ml-1">
                    {t("top")}
                  </Badge>
                ) : null}
              </p>
              <p className="text-sm leading-[21px] [overflow-wrap:anywhere]">{c.text}</p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={!!c.liked}
                  className={cn("tabular-nums", ghost, c.liked && (dark ? "text-primary" : "text-brand-ink"))}
                  onClick={() => onToggleLike(c.id)}
                >
                  <ThumbsUpIcon className={cn("size-3.5", c.liked && "fill-primary")} aria-hidden />
                  <span className="sr-only">{t("likeSr", { name: c.name })} </span>
                  <Num>{formatCount(count)}</Num>
                </Button>
                <Button variant="ghost" size="sm" className={ghost} onClick={() => onReply(c.name)}>
                  {t("reply")}
                </Button>
                {!c.mine ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={quiet}
                      aria-label={t("reportBy", { name: c.name })}
                      onClick={gate(() =>
                        openReport({
                          kind: "comment",
                          target: t("commentBy", { name: c.name }),
                          who: c.name,
                          onSend: onReportSend ? (reason, details) => onReportSend(c.id, reason, details) : undefined,
                        })
                      )}
                    >
                      {t("report")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={quiet}
                      aria-label={t("blockName", { name: c.name })}
                      onClick={gate(() => openBlock(c.name))}
                    >
                      {t("block")}
                    </Button>
                  </>
                ) : null}
                {c.canDelete && onDelete ? (
                  <Button variant="ghost" size="sm" className={quiet} onClick={() => onDelete(c.id)}>
                    {t("delete")}
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
