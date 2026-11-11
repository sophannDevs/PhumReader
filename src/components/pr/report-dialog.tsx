"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { toast } from "sonner"
import { OptionCard } from "@/components/pr/patterns"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { demoData, type ReportTarget } from "@/data"
import { Link } from "@/i18n/navigation"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Report and Block (spec §0 "Report and block", prototype layers.html `rp-dlg`). One dialog for the whole app:
 * `useReport().openReport({ kind, target, who })` from comments, profiles, the series About tab and episode or
 * chapter ends; `useReport().openBlock(name)` for Block. Reasons depend on what is reported (demo-data
 * `reportReasons`; episodes use the series list). Reports go to the store (`reports`, status "In review"); blocking
 * adds the name to `blocked`. `onSend` lets a caller also send the report to the real API.
 */

export type ReportKind = ReportTarget | "episode"
export type ReportRequest = {
  kind: ReportKind
  /** What is reported, shown in Settings > Your reports: "comment by Vibol K.", "Glass Compass · Episode 12" */
  target: string
  /** The person behind it (offers "Also block"); empty for series and episodes */
  who?: string
  onSend?: (reason: string, details: string) => Promise<void> | void
}

type Open = { step: "reason"; req: ReportRequest } | { step: "sent"; req: ReportRequest; caseId: string } | { step: "block"; who: string }

const ReportContext = createContext<{ openReport: (r: ReportRequest) => void; openBlock: (who: string) => void }>({
  openReport: () => {},
  openBlock: () => {},
})

export const useReport = () => useContext(ReportContext)

const NEEDS_DETAILS = ["other", "copyright", "impersonate"]

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const openReport = useCallback((req: ReportRequest) => setOpen({ step: "reason", req }), [])
  const openBlock = useCallback((who: string) => setOpen({ step: "block", who }), [])
  const value = useMemo(() => ({ openReport, openBlock }), [openReport, openBlock])

  return (
    <ReportContext.Provider value={value}>
      {children}
      <Dialog open={open !== null} onOpenChange={(o) => (o ? null : setOpen(null))}>
        <DialogContent className="max-h-[calc(100dvh-40px)] overflow-y-auto sm:max-w-[440px]">
          {open?.step === "reason" ? (
            <ReasonStep key={open.req.target} req={open.req} onSent={(caseId) => setOpen({ step: "sent", req: open.req, caseId })} onCancel={() => setOpen(null)} />
          ) : open?.step === "sent" ? (
            <SentStep req={open.req} caseId={open.caseId} onDone={() => setOpen(null)} />
          ) : open?.step === "block" ? (
            <BlockStep who={open.who} onDone={() => setOpen(null)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </ReportContext.Provider>
  )
}

function ReasonStep({ req, onSent, onCancel }: { req: ReportRequest; onSent: (caseId: string) => void; onCancel: () => void }) {
  const t = useTranslations("report")
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const list = demoData.reportReasons[req.kind === "episode" ? "series" : req.kind]
  const needs = NEEDS_DETAILS.includes(reason)
  const detailsBad = needs && details.trim().length < 10
  const label = (kind: string, id: string, fallback: string, part: "label" | "desc") =>
    t.has(`reasons.${kind}.${id}.${part}` as never) ? t(`reasons.${kind}.${id}.${part}` as never) : fallback
  const listKind = req.kind === "episode" ? "series" : req.kind

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || detailsBad) {
      setTried(true)
      return
    }
    setSending(true)
    try {
      await req.onSend?.(reason, details.trim())
    } catch {
      // The local report still counts; the API copy is best effort.
    }
    const caseId = useAppStore.getState().addReport({ kind: listKind, target: req.target, who: req.who ?? "", reason, details: details.trim() })
    setSending(false)
    onSent(caseId)
  }

  return (
    <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1 pr-6">
        <DialogTitle className="type-h3">{t(`title.${req.kind}`)}</DialogTitle>
        <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">{t(`why.${req.kind}`)}</DialogDescription>
      </div>
      <div role="radiogroup" aria-label={t("reason")} className="flex flex-col gap-1.5">
        {list.map(([id, l, d]) => (
          <OptionCard
            key={id}
            selected={reason === id}
            onSelect={() => setReason(id)}
            className="px-3 py-2.5"
            title={<span className="text-[13px] font-semibold">{label(listKind, id, l, "label")}</span>}
            description={label(listKind, id, d, "desc")}
          />
        ))}
      </div>
      {needs ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="rp-d">{t(reason === "copyright" ? "detailsCopyright" : reason === "impersonate" ? "detailsImpersonate" : "detailsOther")}</Label>
          <Textarea
            id="rp-d"
            rows={3}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder={t(reason === "copyright" ? "detailsCopyrightPh" : "detailsPh")}
            aria-invalid={tried && detailsBad ? true : undefined}
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">{details.length}/500</span>
        </div>
      ) : null}
      {tried && (!reason || detailsBad) ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {!reason ? t("chooseReason") : t("moreDetails")}
        </p>
      ) : null}
      <p className="m-0 rounded-control bg-muted px-2.5 py-2 text-xs text-muted-foreground">{t("urgent")}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="brand" loading={sending}>
          {t("send")}
        </Button>
      </div>
    </form>
  )
}

function SentStep({ req, caseId, onDone }: { req: ReportRequest; caseId: string; onDone: () => void }) {
  const t = useTranslations("report")
  const blocked = useAppStore((s) => (req.who ? s.blocked.includes(req.who) : true))
  const [alsoBlock, setAlsoBlock] = useState(false)

  return (
    <div role="status" className="flex flex-col gap-3.5">
      <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <DialogTitle className="type-h3">{t("sentTitle")}</DialogTitle>
        <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">
          {t.rich("sentText", {
            link: (chunks) => (
              <Link href="/legal/community" className="text-brand-ink underline" onClick={onDone}>
                {chunks}
              </Link>
            ),
          })}
        </DialogDescription>
        <span className="text-xs text-muted-foreground">{t("case", { id: caseId })}</span>
      </div>
      {req.who && !blocked ? (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3">
          <Checkbox checked={alsoBlock} onCheckedChange={(v) => setAlsoBlock(v === true)} className="mt-0.5" />
          <span className="flex flex-col gap-px">
            <span className="text-[13px] font-semibold">{t("alsoBlock", { name: req.who })}</span>
            <span className="text-xs text-muted-foreground">{t("alsoBlockText")}</span>
          </span>
        </label>
      ) : null}
      <Button
        variant="brand"
        onClick={() => {
          if (alsoBlock && req.who) {
            useAppStore.getState().block(req.who)
            toast.success(t("blocked", { name: req.who }))
          }
          onDone()
        }}
      >
        {t("done")}
      </Button>
    </div>
  )
}

function BlockStep({ who, onDone }: { who: string; onDone: () => void }) {
  const t = useTranslations("report")
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5 pr-6">
        <DialogTitle className="type-h3">{t("blockTitle", { name: who })}</DialogTitle>
        <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">{t("blockText")}</DialogDescription>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            useAppStore.getState().block(who)
            onDone()
            toast.success(t("blocked", { name: who }))
          }}
        >
          {t("block")}
        </Button>
      </div>
    </div>
  )
}

/**
 * Hides comments from blocked people (spec §0): returns the visible list and, when some are hidden, a line
 * "1 comment from people you blocked hidden · Show" that reveals them for this view.
 */
export function useBlockedFilter<T>(items: T[], nameOf: (item: T) => string) {
  const blocked = useAppStore((s) => s.blocked)
  const [reveal, setReveal] = useState(false)
  const hidden = items.filter((i) => blocked.includes(nameOf(i))).length
  const visible = reveal ? items : items.filter((i) => !blocked.includes(nameOf(i)))
  return { visible, hidden: reveal ? 0 : hidden, reveal: () => setReveal(true) }
}

export function BlockedHiddenLine({ count, onShow, className }: { count: number; onShow: () => void; className?: string }) {
  const t = useTranslations("report")
  if (count === 0) return null
  return (
    <p className={cn("text-[13px] text-muted-foreground", className)}>
      {t("hiddenLine", { count })} ·{" "}
      <button
        type="button"
        onClick={onShow}
        className="rounded-sm font-medium text-brand-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("show")}
      </button>
    </p>
  )
}
