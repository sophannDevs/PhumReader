"use client"

import { BookmarkIcon, ThumbsUpIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useId, useState } from "react"
import { useReport } from "@/components/pr/report-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCount, initials } from "@/lib/format"
import type { ReportReceipt } from "@/lib/api/me"
import { useAskToLogin } from "@/lib/me"
import { useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * One comment thread (V2.1 Comments page, prototype Comments `.cm-item`): the comment with Creator / You badges,
 * "(edited)", a spoiler cover until tapped, Like / Reply / Report / Block on other people's comments and Edit / Delete
 * on the reader's own, then one level of replies ("View 2 replies · includes the creator") and a reply form.
 * The thread keeps its own UI state (replies open, reply form, editor, spoiler shown); data changes go to the
 * callbacks. Report and Block open the app-wide dialogs. Used by the Comments page and the readers' "Top comments".
 */

export type ReplyView = {
  id: string
  name: string
  when: string
  text: string
  /** Likes without the reader's own (the button adds it) */
  likes: number
  liked: boolean
  creator?: boolean
  mine?: boolean
  /** Real API: the author's account (Block) */
  authorId?: string
}

export type ThreadView = ReplyView & {
  /** Hours ago (sort by Newest) */
  ago: number
  pinned?: boolean
  spoiler?: boolean
  edited?: boolean
  /** The reader may edit / delete it (their own) */
  canEdit?: boolean
  canDelete?: boolean
  replies: ReplyView[]
}

export type ThreadActions = {
  onLike: (id: string) => void
  /** Resolves true when the reply was posted (the form closes). */
  onReply: (threadId: string, text: string) => Promise<boolean> | boolean
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  /** Also send a report to the real API (the local report is always saved). */
  onReportSend?: (id: string, reason: string, details: string) => Promise<ReportReceipt | void>
}

const MAX = 500
const MAX_REPLY = 300

const quiet = "text-muted-foreground"

/** 32 px initials avatar (28 px for replies): green for the creator and the reader, grey for others. */
export function CommentAvatar({ name, creator, mine, small }: { name: string; creator?: boolean; mine?: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "size-7 text-[11px]" : "size-8 text-xs",
        creator || mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}
    >
      {initials(name)}
    </span>
  )
}

function NameLine({ c, edited }: { c: ReplyView; edited?: boolean }) {
  const t = useTranslations("comments")
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px]">
      <strong className="font-semibold">{c.name}</strong>
      {c.creator ? <Badge variant="brand">{t("creator")}</Badge> : null}
      {c.mine ? <Badge variant="secondary">{t("you")}</Badge> : null}
      <span className={quiet}>· {c.when}</span>
      {edited ? <span className={cn("text-xs", quiet)}>{t("edited")}</span> : null}
    </span>
  )
}

function LikeButton({ c, onLike }: { c: ReplyView; onLike: () => void }) {
  const t = useTranslations("comments")
  const count = c.likes + (c.liked ? 1 : 0)
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={c.liked}
      className={cn("tabular-nums", c.liked && "text-brand-ink")}
      onClick={onLike}
    >
      {c.liked ? (
        // The icon pops each time the reader likes (the key restarts it).
        <Effect key="liked" asChild fade={{ initialOpacity: 0.4 }} zoom={{ initialScale: 0.5 }}>
          <ThumbsUpIcon className="size-3.5 fill-primary" aria-hidden />
        </Effect>
      ) : (
        <ThumbsUpIcon className="size-3.5" aria-hidden />
      )}
      <span className="sr-only">{t("likeSr", { name: c.name })} </span>
      <Num>{formatCount(count)}</Num>
    </Button>
  )
}

export function CommentThread({
  thread: c,
  defaultOpen = false,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onReportSend,
  hideReplyFrom,
  className,
}: {
  thread: ThreadView
  /** Replies shown at first */
  defaultOpen?: boolean
  /** Names whose replies are hidden (blocked people) */
  hideReplyFrom?: string[]
  className?: string
} & ThreadActions) {
  const t = useTranslations("comments")
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport, openBlock } = useReport()
  const uid = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [edText, setEdText] = useState("")
  const [replying, setReplying] = useState(false)
  const [rpText, setRpText] = useState("")
  const [sending, setSending] = useState(false)

  const gate = (fn: () => void) => () => (user ? fn() : askToLogin())
  const others = !c.mine && !c.creator
  const replies = hideReplyFrom?.length ? c.replies.filter((r) => !hideReplyFrom.includes(r.name)) : c.replies
  const withCreator = replies.some((r) => r.creator)
  const report = (id: string, name: string, reply: boolean, whoId?: string) =>
    openReport({
      kind: "comment",
      target: t(reply ? "replyBy" : "commentBy", { name }),
      who: name,
      whoId,
      onSend: onReportSend ? (reason, details) => onReportSend(id, reason, details) : undefined,
    })

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!rpText.trim() || sending) return
    setSending(true)
    const ok = await onReply(c.id, rpText.trim())
    setSending(false)
    if (ok) {
      setRpText("")
      setReplying(false)
      setOpen(true)
    }
  }

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} inView>
      <li
        className={cn(
          "flex flex-col gap-2",
          c.pinned ? "mb-2 rounded-xl border border-brand-soft-border bg-selected p-4" : "border-b py-4",
          className
        )}
      >
        {c.pinned ? (
          <span className="inline-flex items-center gap-1.5 text-xs leading-4 font-semibold text-brand-ink">
            <BookmarkIcon className="size-3" aria-hidden />
            {t("pinned")}
          </span>
        ) : null}
        <div className="flex items-start gap-3">
          <CommentAvatar name={c.name} creator={c.creator} mine={c.mine} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <NameLine c={c} edited={c.edited} />
            {editing ? (
              <form
                className="flex flex-col gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!edText.trim()) return
                  onEdit(c.id, edText.trim())
                  setEditing(false)
                }}
              >
                <label className="sr-only" htmlFor={`${uid}-ed`}>
                  {t("editLabel")}
                </label>
                <Textarea
                  id={`${uid}-ed`}
                  rows={2}
                  maxLength={MAX}
                  value={edText}
                  autoFocus
                  onChange={(e) => setEdText(e.target.value.slice(0, MAX))}
                  className="min-h-16"
                />
                <div className="flex gap-1.5">
                  <Button type="submit" variant="brand" size="sm" disabled={!edText.trim()}>
                    {t("save")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            ) : c.spoiler && !revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="self-start rounded-control border border-dashed border-[#a1a1aa] bg-[repeating-linear-gradient(135deg,#f4f4f5_0_8px,#fafafa_8px_16px)] px-3 py-2 text-[13px] font-semibold text-[#3f3f46] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("spoilerHidden")}
              </button>
            ) : (
              <p className="text-sm leading-[21px] [overflow-wrap:anywhere] whitespace-pre-wrap text-[#27272a]">{c.text}</p>
            )}
            <div className="-ml-2 flex flex-wrap gap-0.5">
              <LikeButton c={c} onLike={gate(() => onLike(c.id))} />
              <Button
                variant="ghost"
                size="sm"
                onClick={gate(() => {
                  setReplying(true)
                  setOpen(true)
                })}
              >
                {t("reply")}
              </Button>
              {others ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={quiet}
                    aria-label={t("reportBy", { name: c.name })}
                    onClick={gate(() => report(c.id, c.name, false, c.authorId))}
                  >
                    {t("report")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={quiet}
                    aria-label={t("blockName", { name: c.name })}
                    onClick={gate(() => openBlock(c.name, c.authorId))}
                  >
                    {t("block")}
                  </Button>
                </>
              ) : null}
              {c.canEdit && !editing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={quiet}
                  onClick={() => {
                    setEdText(c.text)
                    setEditing(true)
                  }}
                >
                  {t("edit")}
                </Button>
              ) : null}
              {c.canDelete ? (
                <Button variant="ghost" size="sm" className={quiet} onClick={() => onDelete(c.id)}>
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {replies.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="ml-11 self-start rounded-sm text-[13px] font-semibold text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:ml-0"
          >
            {open ? t("hideReplies") : t(withCreator ? "viewRepliesCreator" : "viewReplies", { count: replies.length })}
          </button>
        ) : null}

        {open && replies.length > 0 ? (
          <ul className="ml-11 flex flex-col gap-3 border-l-2 pl-3.5 max-md:ml-3">
            {replies.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <CommentAvatar name={r.name} creator={r.creator} mine={r.mine} small />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <NameLine c={r} />
                  <p className="text-sm leading-[21px] [overflow-wrap:anywhere] whitespace-pre-wrap text-[#27272a]">{r.text}</p>
                  <div className="-ml-2 flex flex-wrap gap-0.5">
                    <LikeButton c={r} onLike={gate(() => onLike(r.id))} />
                    {!r.mine && !r.creator ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={quiet}
                        aria-label={t("reportReplyBy", { name: r.name })}
                        onClick={gate(() => report(r.id, r.name, true))}
                      >
                        {t("report")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {replying ? (
          <form className="ml-11 flex gap-1.5 max-md:ml-0 max-md:flex-wrap" onSubmit={sendReply}>
            <label className="sr-only" htmlFor={`${uid}-rp`}>
              {t("replyTo", { name: c.name })}
            </label>
            <Input
              id={`${uid}-rp`}
              value={rpText}
              maxLength={MAX_REPLY}
              autoFocus
              placeholder={t("replyToPh", { name: c.name })}
              onChange={(e) => setRpText(e.target.value.slice(0, MAX_REPLY))}
              className="max-md:basis-full"
            />
            <Button type="submit" variant="brand" size="sm" className="h-9" loading={sending} disabled={!rpText.trim()}>
              {t("reply")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setReplying(false)}>
              {t("cancel")}
            </Button>
          </form>
        ) : null}
      </li>
    </Effect>
  )
}
