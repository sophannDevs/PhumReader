"use client"

import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { forwardRef } from "react"
import { toast } from "sonner"
import { SmallSwitch } from "@/components/pr/settings-ui"
import { Chip } from "@/components/pr/v2-primitives"
import type { Weekday } from "@/data"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { REVIEW_ITEMS, WEEK, type ReviewItem } from "@/lib/creator-studio"
import { formatShortDate, formatTime, weekdayOf } from "@/lib/format"
import { useWaitText } from "@/lib/use-wait-text"
import { cn } from "@/lib/utils"

/**
 * Building blocks of the creator studio forms (prototype shared.css `.card`, `.field`, `.field-row`, `.cs-req`,
 * `.cs-errs`, `.st-rowc`, `.cs-done`): used by Create series, Upload episode and Manage series.
 */

/** `.field-row`: two equal columns, one on phones. */
export const fieldRow = "grid gap-4 md:grid-cols-2"
/** `.field` */
export const fieldCol = "flex min-w-0 flex-col gap-2"
/** Red border on an invalid native select. */
export const selectInvalid = "aria-invalid:border-destructive"

export function StudioCard({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-card border bg-card text-card-foreground shadow-xs", className)} {...props} />
}

/** `.card-head`: title, a muted line and something on the right. */
export const CardHead = forwardRef<
  HTMLHeadingElement,
  { id?: string; title: React.ReactNode; hint?: React.ReactNode; aside?: React.ReactNode; size?: "h3" | "h4"; className?: string }
>(function CardHead({ id, title, hint, aside, size = "h3", className }, ref) {
  return (
    <div className={cn("flex flex-col gap-1 px-5 pt-5 max-md:px-4 max-md:pt-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 ref={ref} id={id} tabIndex={ref ? -1 : undefined} className={cn(size === "h3" ? "type-h3" : "type-h4", "outline-none")}>
          {title}
        </h2>
        {aside}
      </div>
      {hint ? <p className="text-[13px] leading-[18px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
})

/** `.label` with the red `*` for required fields and "(optional)". */
export function FieldLabel({
  htmlFor,
  id,
  required,
  optional,
  children,
}: {
  htmlFor?: string
  id?: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  const t = useTranslations("seriesForm")
  const body = (
    <>
      {children}
      {required ? (
        <span aria-hidden className="text-destructive">
          {" "}
          *
        </span>
      ) : null}
      {optional ? <span className="text-xs leading-4 font-normal text-muted-foreground"> {t("optional")}</span> : null}
    </>
  )
  const cls = "text-sm leading-5 font-medium text-foreground"
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={cls}>
      {body}
    </label>
  ) : (
    <span id={id} className={cls}>
      {body}
    </span>
  )
}

/** `.hint` / `.err` under a field. */
export function FieldHint({ id, error, className, children }: { id?: string; error?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <p id={id} className={cn("text-[13px] leading-[18px]", error ? "font-medium text-destructive" : "text-muted-foreground", className)}>
      {children}
    </p>
  )
}

/** Red alert "Fix 2 things to continue" with the list (`.alert.bad` + `.cs-errs`). */
export function ErrorSummary({ title, items, className }: { title: string; items: string[]; className?: string }) {
  if (!items.length) return null
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-lg border border-destructive-border bg-destructive-soft px-4 py-3.5 text-destructive-ink", className)}>
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm leading-5 font-semibold">{title}</span>
        <ul className="mt-1 list-disc pl-[18px] text-[13px] leading-[19px]">
          {items.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Round tick: green ✓ when done, grey bullet or "!" when not (`.cs-tick`). */
export function Tick({ ok, mark = "•", className }: { ok: boolean; mark?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        className
      )}
    >
      {ok ? <CheckIcon className="size-3" strokeWidth={3} /> : mark}
    </span>
  )
}

/** Requirement / checklist rows (`.cs-req`). */
export function TickList({ items, mark, className, label }: { items: { ok: boolean; text: string }[]; mark?: string; className?: string; label?: string }) {
  const t = useTranslations("seriesForm")
  return (
    <ul aria-label={label} className={cn("m-0 flex list-none flex-col gap-2 p-0", className)}>
      {items.map((r) => (
        <li key={r.text} className="flex items-center gap-2 text-[13px] leading-[18px] text-[#3f3f46] dark:text-foreground">
          <Tick ok={r.ok} mark={mark} />
          <span>
            {r.text}
            <span className="sr-only"> ({r.ok ? t("tickDone") : t("tickTodo")})</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** `.st-rowc`: label and description on the left, a switch on the right. */
export function SwitchRow({
  id,
  label,
  desc,
  checked,
  onChange,
  strong = false,
}: {
  id: string
  label: React.ReactNode
  desc?: React.ReactNode
  checked: boolean
  onChange: (on: boolean) => void
  /** Card-title size (Manage > Fast Pass) instead of the small label */
  strong?: boolean
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className={strong ? "type-h4" : "text-[13px] leading-[18px] font-semibold"}>
          {label}
        </span>
        {desc ? (
          <span id={`${id}-desc`} className={cn(strong ? "text-[13px] leading-[18px]" : "text-xs leading-4", "text-muted-foreground")}>
            {desc}
          </span>
        ) : null}
      </span>
      <SmallSwitch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={desc ? `${id}-desc` : undefined}
      />
    </div>
  )
}

/** Update-day chips Mon … Sun (toggle buttons). */
export function DayChips({ value, onChange, labelledBy }: { value: Weekday[]; onChange: (days: Weekday[]) => void; labelledBy: string }) {
  const t = useTranslations("seriesForm")
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {WEEK.map((d) => {
        const on = value.includes(d)
        return (
          <Chip key={d} selected={on} onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}>
            {t(`dayChip.${d}`)}
          </Chip>
        )
      })}
    </div>
  )
}

/** "Sat, Nov 7" (en) or "ថ្ងៃសៅរ៍ ៧ វិច្ឆិកា" (km) for an ISO date. */
export function useDayDate() {
  const locale = useLocale()
  const td = useTranslations("data")
  return (iso: string) => (locale === "km" ? `${td(`dayFull.${weekdayOf(iso)}`)} ${formatShortDate(iso, locale)}` : `${weekdayOf(iso)}, ${formatShortDate(iso, "en")}`)
}

/** "6:00 PM" / "៦:០០ ល្ងាច" for an ICT hour. */
export function useHourLabel() {
  const locale = useLocale()
  return (hour: number) => formatTime(Date.UTC(2026, 0, 1, hour - 7), locale)
}

/** `.cs-done`: green check, title, text and actions (series in review, episode scheduled). */
export function DoneCard({ title, body, children }: { title: string; body: React.ReactNode; children: React.ReactNode }) {
  return (
    <section role="status" className="mx-auto mt-6 flex w-full max-w-[680px] flex-col items-center gap-3.5 rounded-card border bg-card px-6 py-14 text-center shadow-xs max-md:px-5 max-md:py-10">
      <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-[26px]" />
      </span>
      <h1 className="type-h2">{title}</h1>
      <p className="max-w-[52ch] text-[13px] leading-[18px] text-muted-foreground">{body}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  )
}

/**
 * API error codes of the series review (V21-01), deleting a series and hiding an episode (V21-02) → their message in
 * the "manage" messages.
 */
const REVIEW_ERRORS = {
  already_in_review: "errorAlreadyInReview",
  already_published: "errorAlreadyPublished",
  changes_not_fixed: "errorChangesNotFixed",
  review_required: "errorReviewRequired",
  changes_requested: "errorChangesRequested",
  no_changes_requested: "errorReviewChanged",
  item_not_requested: "errorReviewChanged",
  has_published_episodes: "errorHasPublished",
  episode_hidden: "errorEpisodeHidden",
  episode_not_published: "errorEpisodeNotPublished",
} as const

/**
 * A failed save as one toast: too many tries (with the wait), PhumiReader hid the series, a series review answer
 * (already in review, changes not fixed, …; a missing summary or cover on submit), a series that can't be deleted, an
 * episode that can't be hidden or shown, or "Something went wrong".
 */
export function useFailToast() {
  const ts = useTranslations("states")
  const tauth = useTranslations("auth")
  const tm = useTranslations("manage")
  const tf = useTranslations("seriesForm")
  const waitText = useWaitText()
  return (error: unknown) => {
    const code = errorCode(error)
    if (code === "hidden_by_admin") return void toast.error(tm("hiddenByAdmin"))
    if (code && Object.hasOwn(REVIEW_ERRORS, code)) return void toast.error(tm(REVIEW_ERRORS[code as keyof typeof REVIEW_ERRORS]))
    // Submit for review needs a summary and a cover (400 required on summary / coverUploadId).
    const fields = fieldErrors(error)
    if (fields.coverUploadId === "required") return void toast.error(tf("errCover"))
    if (fields.summary === "required") return void toast.error(tf("errSummary"))
    const wait = retryAfterSeconds(error)
    if (wait !== undefined) toast.error(tauth("tooManyTitle"), { description: waitText(wait), duration: 5000 })
    else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
  }
}

/**
 * A requested change in the current language: a key ("contact", "cover", …) → the admin page's reason label. Requests
 * saved by an older demo version kept the label itself, which shows as it is.
 */
export function useReviewItemLabel() {
  const t = useTranslations("admin")
  return (item: string) => {
    const i = REVIEW_ITEMS.indexOf(item as ReviewItem)
    return i < 0 ? item : t(`change_${i}` as "change_0")
  }
}

/** Uppercase muted caption over a preview ("Reader preview", "Phone preview"). */
export function PreviewCaption({ children }: { children: React.ReactNode }) {
  return <span className="text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">{children}</span>
}
