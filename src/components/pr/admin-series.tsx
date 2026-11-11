"use client"

import { AlertCircleIcon, CheckIcon } from "lucide-react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { useId, useRef, useState } from "react"
import {
  AdminError,
  AdminHead,
  DetailCard,
  DoneCard,
  FieldLabel,
  QueueList,
  QueueRow,
  Quote,
  SplitSkeleton,
  SplitView,
  useAge,
  useDecide,
  useFlagText,
  useShortDateTime,
} from "@/components/pr/admin-kit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_MODE } from "@/lib/api/config"
import { decisionKey, useAdminQueues, type QueueSeries } from "@/lib/admin"
import { useLocalize } from "@/lib/localize"
import { useAppStore } from "@/lib/store"

const CHECKS = 4
const CHANGES = 5
/** Which "Request changes" reason each automatic check pre-ticks (prototype `askChanges`). */
const PRETICK = { contact: 0, watermark: 1, similar: 2 } as const

/**
 * /admin/series (spec §22 Series review, screens 22-admin-series-review): the queue with waiting time and auto-check
 * flags, and the selected series with a 4-item checklist. Approve stays disabled until every check is ticked;
 * "Request changes" pre-ticks reasons from the flags, adds a note, saves `reviewNotes[id]` and sets the creator's
 * series to "changes" (Manage shows it); Approve publishes it; Reject sends it back to draft. The API has no review
 * queue, so this screen runs on demo data and the store in both modes.
 */
export function AdminSeriesReview() {
  const t = useTranslations("admin")
  const params = useSearchParams()
  const queues = useAdminQueues()
  const age = useAge()
  const [selId, setSelId] = useState<string | null>(() => params.get("id"))
  const [checks, setChecks] = useState<Record<string, boolean[]>>({})
  const detailRef = useRef<HTMLElement>(null)

  const list = queues.series
  const sel = list.find((q) => q.id === selId) ?? list[0]
  const head = (
    <AdminHead
      title={t("nav_series")}
      line={!queues.query.data ? undefined : list.length ? t("sr_line", { count: list.length }) : t("sr_nothing")}
      aside={
        DEMO_MODE ? null : (
          <Badge variant="warn" title={t("sr_realNote")}>
            {t("badgeDemo")}
          </Badge>
        )
      }
    />
  )

  if (queues.query.isPending) return <>{head}<SplitSkeleton /></>
  if (queues.query.isError) return <>{head}<AdminError onRetry={() => void queues.query.refetch()} /></>
  if (!sel) return <>{head}<DoneCard title={t("sr_emptyTitle")} text={t("sr_emptyText")} /></>

  const pick = (id: string) => {
    setSelId(id)
    // One column below 1024 px: bring the detail into view.
    if (window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ block: "start" })
  }

  return (
    <>
      {head}
      {DEMO_MODE ? null : <p className="-mt-3 text-xs leading-4 text-muted-foreground">{t("sr_realNote")}</p>}
      <SplitView>
        <QueueList label={t("sr_queue")}>
          {list.map((q) => (
            <QueueRow key={q.id} selected={q.id === sel.id} onPick={() => pick(q.id)}>
              <Image src={q.cover} alt="" width={72} height={96} className="h-12 w-9 shrink-0 rounded-[6px] object-cover" />
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="truncate text-[13px] leading-[18px] font-semibold">{q.title}</span>
                <span className="truncate text-xs leading-4 text-muted-foreground">
                  {q.creator} · {age(q.hours)}
                </span>
                {q.flags.length ? (
                  <span className="text-xs leading-4 font-semibold text-warning">{t("autoChecks", { count: q.flags.length })}</span>
                ) : null}
              </span>
            </QueueRow>
          ))}
        </QueueList>
        <SeriesDetail
          key={sel.id}
          item={sel}
          checks={checks[sel.id] ?? []}
          onCheck={(i, on) =>
            setChecks((c) => {
              const next = [...(c[sel.id] ?? [])]
              next[i] = on
              return { ...c, [sel.id]: next }
            })
          }
          innerRef={detailRef}
        />
      </SplitView>
    </>
  )
}

function SeriesDetail({
  item,
  checks,
  onCheck,
  innerRef,
}: {
  item: QueueSeries
  checks: boolean[]
  onCheck: (i: number, on: boolean) => void
  innerRef: React.Ref<HTMLElement>
}) {
  const t = useTranslations("admin")
  const localize = useLocalize()
  const flagText = useFlagText()
  const dateTime = useShortDateTime()
  const decide = useDecide()
  const id = useId()
  const [asking, setAsking] = useState(false)
  const [changes, setChanges] = useState<boolean[]>([])
  const [note, setNote] = useState("")
  const [askErr, setAskErr] = useState(false)

  const allChecked = Array.from({ length: CHECKS }, (_, i) => !!checks[i]).every(Boolean)
  const headingId = `${id}-h`

  // Store changes for the creator's own series (Manage reads the status and reviewNotes); demo-only rows just leave
  // the queue through the decision log.
  const store = () => useAppStore.getState()
  const setStatus = (status: "published" | "changes" | "draft" | "review") => {
    if (item.own) store().setWorkStatus(item.id, status)
  }
  const base = { key: decisionKey("series", item.id), queue: "series" as const, label: item.title }

  const approve = () => {
    if (!allChecked) return
    const prevNote = store().reviewNotes[item.id] ?? null
    decide({
      ...base,
      action: "approve",
      apply: () => {
        setStatus("published")
        store().setReviewNote(item.id, null)
      },
      revert: () => {
        setStatus("review")
        store().setReviewNote(item.id, prevNote)
      },
      toast: t("toast_approved"),
    })
  }

  const askChanges = () => {
    const pre: boolean[] = []
    for (const f of item.flags) if (f.kind !== "other") pre[PRETICK[f.kind]] = true
    setChanges(pre)
    setNote("")
    setAskErr(false)
    setAsking(true)
  }

  const sendChanges = () => {
    const items = Array.from({ length: CHANGES }, (_, i) => i)
      .filter((i) => changes[i])
      .map((i) => t(`change_${i}` as "change_0"))
    if (!items.length) {
      setAskErr(true)
      return
    }
    const prevNote = store().reviewNotes[item.id] ?? null
    decide({
      ...base,
      action: "changes",
      apply: () => {
        setStatus("changes")
        store().setReviewNote(item.id, { items, note: note.trim() })
      },
      revert: () => {
        setStatus("review")
        store().setReviewNote(item.id, prevNote)
      },
      toast: t("toast_changes"),
    })
    setAsking(false)
  }

  const reject = () =>
    decide({
      ...base,
      action: "reject",
      apply: () => setStatus("draft"),
      revert: () => setStatus("review"),
      toast: t("toast_rejected"),
    })

  const eps = t(item.format === "novel" ? "eps_novel" : "eps_comic", { count: item.eps })
  const when = item.submittedAt === null ? t("justNow") : dateTime(item.submittedAt)

  return (
    <DetailCard labelledBy={headingId} innerRef={innerRef}>
      <div className="flex items-start gap-3.5">
        <Image
          src={item.cover}
          alt={t("coverAlt", { title: item.title })}
          width={192}
          height={256}
          className="aspect-[3/4] w-24 shrink-0 rounded-[10px] border object-cover"
        />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{t(item.format === "novel" ? "format_novel" : "format_comic")}</Badge>
            <Badge variant="outline">{localize.genre(item.genre)}</Badge>
            <Badge variant="outline">{item.age === "All ages" ? t("age_all") : item.age}</Badge>
            <Badge variant="outline" lang={item.lang}>
              {t(item.lang === "en" ? "lang_en" : "lang_km")}
            </Badge>
          </div>
          <h2 id={headingId} className="type-h3">
            {item.title}
          </h2>
          <p className="text-xs leading-4 text-muted-foreground">{t("sr_meta", { creator: item.creator, eps, when })}</p>
        </div>
      </div>

      {item.flags.length ? (
        <Alert variant="warning" role="note" className="gap-1 px-4 py-3.5">
          <AlertCircleIcon />
          <AlertTitle className="text-sm leading-5">{t("flagsTitle", { count: item.flags.length })}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1 text-[13px] leading-[19px]">
            {item.flags.map((f, i) => (
              <span key={i}>• {flagText(f)}</span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel>{t("summary")}</FieldLabel>
        <Quote>{item.summary || t("noSummary")}</Quote>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm leading-5 font-medium">{t("checklist")}</legend>
        {Array.from({ length: CHECKS }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Checkbox id={`${id}-c${i}`} checked={!!checks[i]} onCheckedChange={(v) => onCheck(i, v === true)} />
            <Label htmlFor={`${id}-c${i}`} className="cursor-pointer text-[13px] leading-[18px] font-normal">
              {t(`check_${i}` as "check_0")}
            </Label>
          </div>
        ))}
      </fieldset>

      {asking ? (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-warning-border bg-warning-soft p-3.5">
          <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2.5 p-0 text-sm leading-5 font-medium">{t("askTitle")}</legend>
            {Array.from({ length: CHANGES }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Checkbox
                  id={`${id}-x${i}`}
                  checked={!!changes[i]}
                  onCheckedChange={(v) => {
                    setChanges((c) => {
                      const next = [...c]
                      next[i] = v === true
                      return next
                    })
                    setAskErr(false)
                  }}
                />
                <Label htmlFor={`${id}-x${i}`} className="cursor-pointer text-[13px] leading-[18px] font-normal">
                  {t(`change_${i}` as "change_0")}
                </Label>
              </div>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-note`} className="gap-1">
              {t("askNote")} <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Textarea
              id={`${id}-note`}
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t("askPlaceholder")}
              className="min-h-16 bg-background"
            />
          </div>
          {askErr ? (
            <p role="alert" className="text-[13px] leading-[18px] text-destructive">
              {t("askError")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={sendChanges}>
              {t("sendToCreator")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" disabled={!allChecked} onClick={approve} aria-describedby={`${id}-hint`}>
              <CheckIcon />
              {t("approve")}
            </Button>
            <Button variant="outline" onClick={askChanges}>
              {t("requestChanges")}
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={reject}>
              {t("reject")}
            </Button>
          </div>
          <p id={`${id}-hint`} className="text-xs leading-4 text-muted-foreground">
            {allChecked ? t("approveHintOn") : t("approveHintOff")}
          </p>
        </div>
      )}
    </DetailCard>
  )
}
