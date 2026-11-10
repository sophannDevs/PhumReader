"use client"

import { useId, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CommentAvatar } from "@/components/pr/comment-thread"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Link, usePathname } from "@/i18n/navigation"
import { useAppStore, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

/** "Add a comment" card (series Comments tab): textarea, "0/500 · Be kind…" and a dark Post button. */
export function CommentComposer({
  value,
  onChange,
  onSubmit,
  max = 500,
  textareaRef,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  max?: number
  textareaRef?: React.Ref<HTMLTextAreaElement>
  className?: string
}) {
  const t = useTranslations("comments")
  const user = useUser()
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <form
      className={cn("flex flex-col gap-2.5 rounded-card border bg-card p-5 shadow-xs max-md:p-4", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (!user) toast.message(t("loginToComment"))
        else if (!value.trim()) toast.message(t("writeFirst"))
        else onSubmit()
      }}
    >
      <Label htmlFor={id} className="text-sm font-medium">
        {t("add")}
      </Label>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        maxLength={max}
        placeholder={user ? t("placeholder") : t("placeholderLoggedOut")}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
      />
      <div className="flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs leading-4 text-muted-foreground">
          <span className="tabular-nums">
            {value.length}/{max}
          </span>{" "}
          · {t("hint")}
        </p>
        <Button type="submit" size="sm">
          {t("post")}
        </Button>
      </div>
    </form>
  )
}

/**
 * Comments page composer (prototype `.cm-compose`): the reader's avatar, a 500-character textarea, "Contains
 * spoilers", the counter and Post, and the community guidelines line. Logged out: "Log in to join" + Log in.
 */
export function ThreadComposer({
  onPost,
  className,
}: {
  /** Resolves true when the comment was posted (the composer clears). */
  onPost: (text: string, spoiler: boolean) => Promise<boolean> | boolean
  className?: string
}) {
  const t = useTranslations("comments")
  const user = useUser()
  const pathname = usePathname()
  const id = useId()
  const [draft, setDraft] = useState("")
  const [spoiler, setSpoiler] = useState(false)
  const [busy, setBusy] = useState(false)
  const max = 500

  if (!user) {
    return (
      <section
        aria-label={t("writeLabel")}
        className={cn("flex flex-wrap items-center justify-between gap-3 rounded-card border bg-card p-4 shadow-xs", className)}
      >
        <span className="text-[13px] leading-[18px]">{t("loginToJoin")}</span>
        <Button asChild variant="brand" size="sm">
          <Link
            href="/login"
            onClick={() => useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)}
          >
            {t("login")}
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <section aria-label={t("writeLabel")} className={cn("rounded-card border bg-card p-4 shadow-xs", className)}>
      <form
        className="flex items-start gap-2.5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!draft.trim() || busy) return
          setBusy(true)
          const ok = await onPost(draft, spoiler)
          setBusy(false)
          if (ok) {
            setDraft("")
            setSpoiler(false)
          }
        }}
      >
        <CommentAvatar name={user.name} mine />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="sr-only" htmlFor={`${id}-text`}>
            {t("yourComment")}
          </label>
          <Textarea
            id={`${id}-text`}
            rows={3}
            maxLength={max}
            value={draft}
            placeholder={t("placeholderKind")}
            onChange={(e) => setDraft(e.target.value.slice(0, max))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={`${id}-spoiler`} className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
              <Checkbox id={`${id}-spoiler`} checked={spoiler} onCheckedChange={(v) => setSpoiler(v === true)} />
              {t("containsSpoilers")}
            </label>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {draft.length}/{max}
            </span>
            <Button type="submit" variant="brand" size="sm" loading={busy} disabled={!draft.trim()}>
              {t("post")}
            </Button>
          </div>
          <p className="text-xs leading-4 text-muted-foreground">
            {t.rich("guidelinesLine", {
              link: (chunks) => (
                <Link href="/legal/community" className="rounded-sm text-brand-ink underline outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </form>
    </section>
  )
}
