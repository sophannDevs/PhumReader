"use client"

import { ExternalLinkIcon } from "@/components/animate-ui/icons/external-link"
import { ReceiptTextIcon } from "lucide-react"
import { Undo2Icon } from "@/components/animate-ui/icons/undo-2"
import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { ClockIcon } from "@/components/animate-ui/icons/clock"
import { CopyIcon } from "@/components/animate-ui/icons/copy"
import { LogInIcon } from "@/components/animate-ui/icons/log-in"
import { MessageSquareIcon } from "@/components/animate-ui/icons/message-square"
import { XIcon } from "@/components/animate-ui/icons/x"
import { useQueryClient } from "@tanstack/react-query"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { toast } from "sonner"
import { type Receipt, type ReceiptStatus, useReceipt } from "@/components/pr/receipt-data"
import { Timeline, type TimelineStep } from "@/components/pr/receipt-timeline"
import { StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { paymentMethods } from "@/data"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { requestRefund } from "@/lib/api/coins"
import { useFailed, useAccountEmail } from "@/lib/me"
import { orderKey } from "@/lib/wallet"
import { formatDate, formatShortDate, formatTime, ictDate } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

const statusBadge: Record<ReceiptStatus, "brand" | "up" | "secondary" | "warn"> = {
  Paid: "brand",
  Failed: "up",
  Cancelled: "secondary",
  Refunded: "secondary",
  Pending: "warn",
}

/** Card and column (prototype `.rc-wrap` 640 px, `.rc-card`). */
const wrap = "mx-auto flex w-full max-w-[640px] flex-col gap-[18px] px-8 pt-6 pb-16 max-md:px-4"
const card = "flex flex-col gap-[22px] rounded-card border bg-card p-7 shadow-xs max-md:px-4 max-md:py-5"
/** Phone: every action takes the full width (prototype `.rc-acts .btn{flex:1 1 100%}`). */
const action = "h-auto min-h-9 whitespace-normal py-2 max-md:w-full"

function StatusIcon({ status }: { status: ReceiptStatus }) {
  const Icon = status === "Paid" ? CheckIcon : status === "Refunded" ? Undo2Icon : status === "Pending" ? ClockIcon : XIcon
  return (
    <Effect asChild fade zoom={{ initialScale: 0.5 }} delay={150}>
      <span
        aria-hidden
        className={cn(
          "inline-flex size-14 items-center justify-center rounded-full",
          status === "Paid"
            ? "bg-primary text-primary-foreground"
            : status === "Refunded"
              ? "bg-muted text-secondary-foreground"
              : status === "Pending"
                ? "bg-warning-soft text-warning"
                : "bg-destructive-soft text-destructive"
        )}
      >
        <Icon className="size-6" strokeWidth={3} />
      </span>
    </Effect>
  )
}

function Breadcrumb({ id }: { id: string }) {
  const t = useTranslations("receipt")
  const link = "rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <nav aria-label={t("crumbs")}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-xs leading-4 text-muted-foreground">
        <li>
          <Link href="/coins" className={link}>
            {t("crumbCoins")}
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRightIcon className="size-3" />
        </li>
        <li>
          <Link href="/coins#history" className={link}>
            {t("crumbHistory")}
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRightIcon className="size-3" />
        </li>
        <li aria-current="page" className="text-foreground">
          {id}
        </li>
      </ol>
    </nav>
  )
}

/** Real API (V21-06): the reader says why; an admin reads it in Admin > Payments. */
function RefundDialog({ id, unused, onClose }: { id: string; unused: number; onClose: () => void }) {
  const t = useTranslations("receipt")
  const email = useAccountEmail()
  const qc = useQueryClient()
  const failed = useFailed()
  const [reason, setReason] = useState("")
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const short = reason.trim().length < 10

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (short) {
      setTried(true)
      return
    }
    setSending(true)
    try {
      await requestRefund(id, reason.trim())
      await qc.invalidateQueries({ queryKey: orderKey(email ?? "", id) })
      toast.success(t("refundSent"))
      onClose()
    } catch (error) {
      failed(error)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <form className="flex flex-col gap-3.5" onSubmit={send} noValidate>
          <DialogHeader>
            <DialogTitle className="type-h3">{t("refundDialogTitle", { id })}</DialogTitle>
            <DialogDescription>{t("refundDialogDesc", { count: unused })}</DialogDescription>
          </DialogHeader>
          <label htmlFor="rf-reason" className="text-sm leading-5 font-medium">
            {t("refundReason")}
          </label>
          <Textarea
            id="rf-reason"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={tried && short ? true : undefined}
            aria-describedby={tried && short ? "rf-reason-error" : undefined}
          />
          {tried && short ? (
            <p id="rf-reason-error" role="alert" className="text-[13px] font-medium text-destructive">
              {t("refundReasonShort")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("refundCancel")}
            </Button>
            <Button type="submit" variant="brand" loading={sending}>
              {t("refundSend")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptView({ r }: { r: Receipt }) {
  const t = useTranslations("receipt")
  const locale = useLocale()
  const loc = useLocalize()
  const router = useRouter()
  const methodData = paymentMethods().find((m) => m.id === r.method)
  const method = methodData ? loc.method(r.method, methodData).label : r.method
  const when = `${formatDate(ictDate(r.at), locale)} · ${formatTime(r.at, locale)}`
  const paid = r.status === "Paid"
  const notCharged = r.status === "Failed" || r.status === "Cancelled"
  const unused = Math.max(0, r.total - r.spent)
  const canRefund = paid && unused > 0 && !r.refundRequest
  const [asking, setAsking] = useState(false)

  const rows: { k: string; v: React.ReactNode; copy?: boolean; total?: boolean }[] = [
    { k: t("rowOrder"), v: r.id, copy: true },
    { k: t("rowDate"), v: t("dateValue", { date: formatDate(ictDate(r.at), locale), time: formatTime(r.at, locale) }) },
    { k: t("rowPack"), v: loc.pack(`${r.base} coin pack`) },
    { k: t("rowCoins"), v: t("coinsValue", { count: r.base }) },
    ...(r.bonus > 0 ? [{ k: t("rowPackBonus"), v: t("bonusValue", { count: r.bonus }) }] : []),
    ...(r.first > 0 ? [{ k: t("rowFirstBonus"), v: t("bonusValue", { count: r.first }) }] : []),
    { k: t("rowPaidWith"), v: method },
    { k: t("rowProvider"), v: t("providerPlaceholder") },
    { k: t("rowTotal"), v: notCharged ? t("notCharged") : `${r.priceUSD} · ${r.priceKHR}`, total: true },
  ]

  const shortDate = (ms: number) => formatShortDate(ictDate(ms), locale)
  const steps: TimelineStep[] =
    r.status === "Paid"
      ? [
          { title: t("tlCreated"), detail: when },
          { title: t("tlConfirmed", { method }), detail: t("tlFewSeconds") },
          { title: t("tlAdded", { count: r.total }), detail: t("tlBalance") },
        ]
      : r.status === "Refunded"
        ? [
            { title: t("tlPaid"), detail: when },
            { title: t("tlRefundRequested"), detail: r.refundRequestedAt ? shortDate(r.refundRequestedAt) : undefined },
            {
              title: t("tlRefunded", { method }),
              detail: r.refundedAt ? t("tlRefundedOn", { date: shortDate(r.refundedAt) }) : t("tlCoinsRemoved"),
            },
          ]
        : r.status === "Pending"
          ? [
              { title: t("tlCreated"), detail: when },
              { title: t("tlWaiting"), detail: t("tlWaitingSub"), tone: "waiting" },
              { title: t("tlCoinsLater"), tone: "waiting" },
            ]
          : [
              { title: t("tlCreated"), detail: when },
              {
                title: t(r.status === "Cancelled" ? "tlCancelled" : r.expired ? "tlExpired" : "tlDeclined"),
                detail: t("tlNoMoney"),
                tone: "failed",
              },
              { title: t("tlNoCoins"), tone: "waiting" },
            ]

  const headline =
    r.status === "Paid" ? t("headPaid", { count: r.total }) : t(`head${r.status as Exclude<ReceiptStatus, "Paid">}`)
  const subline =
    r.status === "Paid"
      ? `${t("subPaid")} ${r.spent > 0 ? t("subSpent", { spent: r.spent, unused }) : t("subNoneSpent")}`
      : r.status === "Refunded"
        ? t("subRefunded", { method, count: r.total })
        : t(`sub${r.status}`)

  async function copyId() {
    try {
      await navigator.clipboard.writeText(r.id)
      toast.success(t("copied"))
    } catch {
      toast.error(t("copyFailed", { id: r.id }))
    }
  }

  /** "Get help with this order" / "Ask for a refund": fills in the Help contact form (spec §25, flow 6). */
  const help = (msg: string) => () => useAppStore.getState().setHelpPrefill({ topic: "payment", order: r.id, msg })

  /** Back to Coins with this order's pack and method picked. */
  const retry = () => {
    useAppStore.getState().setCheckoutDraft({ pack: r.base, method: r.method })
    router.push("/coins")
  }

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 12 }}>
      <section aria-labelledby="rc-title" className={card}>
        <div className="flex flex-col items-center gap-3">
          <StatusIcon status={r.status} />
          <div className="flex flex-col items-center gap-1 text-center">
            <Badge variant={statusBadge[r.status]}>{t(`status${r.status}`)}</Badge>
            <h1 id="rc-title" className="type-h2 tabular-nums">
              {headline}
            </h1>
            <p className="m-0 max-w-[46ch] text-[13px] leading-[18px] text-balance text-muted-foreground">{subline}</p>
          </div>
        </div>

        <dl className="m-0 flex flex-col overflow-hidden rounded-card border">
          {rows.map((row) => (
            <div
              key={row.k}
              className={cn(
                "flex items-center justify-between gap-4 border-t px-3.5 py-2.5 text-sm leading-5 first:border-t-0",
                row.total && "bg-subtle font-bold"
              )}
            >
              <dt className={row.total ? "text-foreground" : "text-muted-foreground"}>{row.k}</dt>
              <dd className={cn("m-0 flex min-w-0 items-center gap-1 text-right tabular-nums", row.total ? "font-bold" : "font-medium")}>
                <span className="min-w-0 break-words">{row.v}</span>
                {row.copy ? (
                  <Button variant="ghost" size="icon-sm" onClick={() => void copyId()} aria-label={t("copy")}>
                    <CopyIcon className="size-3.5" />
                  </Button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm leading-5 font-medium">{t("whatHappened")}</h2>
          <Timeline steps={steps} />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {notCharged ? (
            <Button variant="brand" className={action} onClick={retry}>
              {t("tryAgain")}
            </Button>
          ) : null}
          {r.status === "Pending" ? (
            <Button variant="brand" className={action} onClick={retry}>
              {t("continuePay")}
            </Button>
          ) : null}
          {paid ? (
            <Button variant="outline" className={action} onClick={() => toast(t("downloadToast"))}>
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              {t("download")}
            </Button>
          ) : null}
          <Button variant="outline" className={action} asChild>
            <Link href="/help#contact" onClick={help("")}>
              <MessageSquareIcon className="size-3.5" aria-hidden />
              {t("getHelp")}
            </Link>
          </Button>
          {canRefund ? (
            DEMO_MODE ? (
              <Button variant="ghost" className={action} asChild>
                <Link href="/help#contact" onClick={help(t("refundMsg", { count: unused, id: r.id }))}>
                  {t("askRefund")}
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" className={action} onClick={() => setAsking(true)}>
                {t("askRefund")}
              </Button>
            )
          ) : null}
        </div>

        {r.refundRequest && r.status === "Paid" ? (
          <p
            role="status"
            className={cn(
              "m-0 rounded-control px-3 py-2 text-center text-[13px] leading-[18px]",
              r.refundRequest.status === "declined" ? "bg-warning-soft text-warning-ink" : "bg-muted text-muted-foreground"
            )}
          >
            {r.refundRequest.status === "declined"
              ? t("refundDeclined", { note: r.refundRequest.note ?? "" })
              : t("refundOpen", { date: shortDate(r.refundRequest.at) })}
          </p>
        ) : null}
        {asking ? <RefundDialog id={r.id} unused={unused} onClose={() => setAsking(false)} /> : null}

        {paid ? (
          <p className="m-0 text-center text-xs leading-4 text-muted-foreground">
            {canRefund ? t("refundLine", { count: unused }) : t("noRefundLine")}{" "}
            <Link href="/legal/refund" className="rounded-sm text-brand-ink underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t("refundPolicy")}
            </Link>
          </p>
        ) : null}
      </section>
    </Effect>
  )
}

function ReceiptSkeleton() {
  return (
    <div className={card} aria-hidden>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-[30px] w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-[340px] rounded-card" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-56" />
        ))}
      </div>
    </div>
  )
}

/** Receipt `/coins/orders/[id]` (spec §25, prototype Receipt): one order with its status, rows, timeline and actions. */
export function ReceiptPage({ id }: { id: string }) {
  const t = useTranslations("receipt")
  const router = useRouter()
  const pathname = usePathname()
  const data = useReceipt(id)

  return (
    <div className={wrap}>
      <Breadcrumb id={id} />
      {data.state === "loading" ? (
        <ReceiptSkeleton />
      ) : data.state === "ready" ? (
        <ReceiptView r={data.receipt} />
      ) : data.state === "error" ? (
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={t("errorTitle")}
          text={t("errorText")}
          action={
            <Button variant="outline" className="mt-2" onClick={data.retry}>
              {t("tryAgain")}
            </Button>
          }
        />
      ) : data.state === "login" ? (
        <StateBox
          icon={LogInIcon}
          role="status"
          title={t("loginTitle")}
          text={t("loginText")}
          action={
            <Button
              variant="brand"
              className="mt-2"
              onClick={() => {
                useAppStore.getState().setReturnTo(pathname)
                router.push("/login")
              }}
            >
              {t("login")}
            </Button>
          }
        />
      ) : (
        <StateBox
          icon={ReceiptTextIcon}
          role="status"
          title={t("notFoundTitle")}
          text={t("notFoundText")}
          action={
            <Button variant="outline" className="mt-2" asChild>
              <Link href="/coins#history">{t("backToCoins")}</Link>
            </Button>
          }
        />
      )}
      <p className="m-0 text-center text-xs leading-4 text-muted-foreground">{t("prototype")}</p>
    </div>
  )
}
