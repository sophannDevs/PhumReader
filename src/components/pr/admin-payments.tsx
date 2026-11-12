"use client"

import { CheckIcon } from "@/components/animate-ui/icons/check"
import { SearchIcon } from "@/components/animate-ui/icons/search"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useState } from "react"
import { ReasonDialog, type ReasonAsk } from "@/components/pr/admin-dialogs"
import { AdminCard, AdminError, AdminHead, useDecide } from "@/components/pr/admin-kit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { AdminOrder, AdminRefundRequest, AdminStuckPayment } from "@/lib/api/admin"
import { DEMO_MODE } from "@/lib/api/config"
import {
  actions,
  ADMIN_TODAY,
  decisionKey,
  useAdminQueues,
  useOrders,
  useRefundRequests,
  useStuckPayments,
  type PaymentMethod,
  type RefundRequest,
  type StuckPayment,
} from "@/lib/admin"
import { formatShortDate, formatTime, ictDate } from "@/lib/format"
import { useAppStore } from "@/lib/store"

/** `.ad-rf`: one order row; the actions wrap under it on phones. */
function Row({ children, actions: buttons, fill = false }: { children: React.ReactNode; actions: React.ReactNode; fill?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 md:flex-nowrap [&+li]:border-t">
      <div className="flex min-w-0 grow flex-col gap-[3px]">{children}</div>
      <div className={fill ? "flex w-full gap-1.5 md:w-auto [&>*]:flex-1 md:[&>*]:flex-none" : "flex gap-1.5"}>{buttons}</div>
    </li>
  )
}

function useMethodLabel() {
  const t = useTranslations("admin")
  return (method: string) => {
    const m = method.toLowerCase()
    const id: PaymentMethod | null = m.startsWith("khqr") ? "khqr" : m.startsWith("aba") ? "aba" : m.startsWith("card") ? "card" : null
    return id ? t(`method_${id}`) : method.replace(/_/g, " ")
  }
}

/**
 * /admin/payments (spec §22 Payments, screens 22-admin-payments): refund requests with eligibility (unused, double
 * charge, partly spent) and "Paid but no coins" with Add coins (demo: adds the coins to this device's wallet).
 * Real mode (V21-06): the readers' refund requests (Refund takes back the coins still unused, Decline asks for a reason the
 * reader sees on the receipt), "Paid but no coins" from PayWay reconciliation (Add coins), and below them every paid order
 * with a direct Refund for those whose coins are all unused. Each decision is sent after the Undo window.
 */
export function AdminPayments() {
  const t = useTranslations("admin")
  return (
    <>
      <AdminHead title={t("nav_payments")} line={t("pay_line")} />
      {DEMO_MODE ? (
        <DemoPayments />
      ) : (
        <>
          <RealRequests />
          <RealStuck />
          <RealOrders />
        </>
      )}
    </>
  )
}

function DemoPayments() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const queues = useAdminQueues()
  const decide = useDecide()
  const method = useMethodLabel()

  if (queues.query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
      </div>
    )
  }
  if (queues.query.isError) return <AdminError onRetry={() => void queues.query.refetch()} />

  const pack = (coins: number, bonus: boolean) => t(bonus ? "packBonus" : "pack", { count: coins })
  const when = (at: number) => {
    const day = ictDate(at)
    return day === ADMIN_TODAY ? t("todayAt", { time: formatTime(at, locale) }) : `${formatShortDate(day, locale)}, ${formatTime(at, locale)}`
  }

  const elig = (r: RefundRequest) =>
    r.elig.kind === "unused" ? (
      <Badge variant="brand">{t("elig_unused")}</Badge>
    ) : r.elig.kind === "double" ? (
      <Badge variant="brand">{t("elig_double")}</Badge>
    ) : (
      <Badge variant="warn">{t("elig_partial", { spent: r.elig.spent, unused: r.elig.unused })}</Badge>
    )
  const approveLabel = (r: RefundRequest) =>
    r.elig.kind === "unused" ? t("rf_refund") : r.elig.kind === "double" ? t("rf_refundDuplicate") : t("rf_refundUnused", { count: r.elig.unused })

  const refund = (r: RefundRequest) =>
    decide({
      key: decisionKey("refund", r.id),
      queue: "payments",
      action: "refund",
      label: r.order,
      toast: t("toast_refunded", { method: method(r.method) }),
    })
  const decline = (r: RefundRequest) =>
    decide({ key: decisionKey("refund", r.id), queue: "payments", action: "decline", label: r.order, toast: t("toast_declined") })
  const addCoins = (s: StuckPayment) =>
    decide({
      key: decisionKey("stuck", s.id),
      queue: "payments",
      action: "addCoins",
      label: s.order,
      // One device plays reader and admin in the demo: the coins land in this wallet.
      apply: () => useAppStore.getState().addCoins(s.credit),
      revert: () => useAppStore.getState().spendCoins(s.credit),
      toast: t("toast_coinsAdded"),
    })

  return (
    <>
      <AdminCard title={t("rf_title")} titleId="ad-refunds">
        {queues.refunds.length ? (
          <ul className="m-0 list-none p-0">
            {queues.refunds.map((r) => (
              <Row
                key={r.id}
                fill
                actions={
                  <>
                    <Button variant="brand" size="sm" onClick={() => refund(r)}>
                      {approveLabel(r)}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => decline(r)}>
                      {t("rf_decline")}
                    </Button>
                  </>
                }
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] leading-[18px] font-semibold">{r.order}</span>
                  {elig(r)}
                </span>
                <span className="text-xs leading-4 text-muted-foreground">
                  {r.user} · {pack(r.coins, r.bonus)} · {method(r.method)} · {formatShortDate(r.date, locale)}
                </span>
                <span className="text-xs leading-4">
                  {"quote" in r.reason ? <span lang="en">“{r.reason.quote}”</span> : t("rf_reasonDouble")}
                </span>
              </Row>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-[13px] leading-[18px] text-muted-foreground">{t("rf_empty")}</p>
        )}
      </AdminCard>
      <AdminCard title={t("stuck_title")} titleId="ad-stuck" desc={t("stuck_desc")}>
        {queues.stuck.length ? (
          <ul className="m-0 list-none p-0">
            {queues.stuck.map((s) => (
              <Row
                key={s.id}
                actions={
                  <Button variant={s.done ? "secondary" : "brand"} size="sm" disabled={s.done} onClick={() => addCoins(s)}>
                    {s.done ? (
                      <>
                        <CheckIcon />
                        {t("coinsAdded")}
                      </>
                    ) : (
                      t("addCoins")
                    )}
                  </Button>
                }
              >
                <span className="text-[13px] leading-[18px] font-semibold">{s.order}</span>
                <span className="text-xs leading-4 text-muted-foreground">
                  {s.user} · {pack(s.coins, s.bonus)} · {method(s.method)} · {when(s.at)}
                </span>
              </Row>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-[13px] leading-[18px] text-muted-foreground">{t("stuck_empty")}</p>
        )}
      </AdminCard>
    </>
  )
}

/** Real mode (V21-06): refund requests waiting for an admin. */
function RealRequests() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const decide = useDecide()
  const method = useMethodLabel()
  const list = useRefundRequests("open")
  const log = useAppStore((s) => s.adminLog)
  const [ask, setAsk] = useState<ReasonAsk | null>(null)
  const handled = new Set(log.map((d) => d.id))
  const items = list.items.filter((r) => !handled.has(decisionKey("refund", r.id)))

  const approve = (r: AdminRefundRequest) =>
    decide({
      key: decisionKey("refund", r.id),
      queue: "payments",
      action: "refund",
      label: r.order.orderNumber,
      commit: () => actions.approveRefundRequest(r.id),
      toast: t("toast_refundApproved"),
    })
  const decline = (r: AdminRefundRequest) =>
    setAsk({
      title: t("rf_declineTitle", { number: r.order.orderNumber }),
      description: t("rf_declineDesc"),
      confirm: t("rf_decline"),
      required: true,
      destructive: true,
      run: async (reason) =>
        decide({
          key: decisionKey("refund", r.id),
          queue: "payments",
          action: "decline",
          label: r.order.orderNumber,
          commit: () => actions.declineRefundRequest(r.id, reason),
          toast: t("toast_declined"),
        }),
    })
  const elig = (r: AdminRefundRequest) =>
    r.eligibility.duplicate ? (
      <Badge variant="brand">{t("elig_double")}</Badge>
    ) : r.eligibility.kind === "unused" ? (
      <Badge variant="brand">{t("elig_unused")}</Badge>
    ) : r.eligibility.kind === "partial" ? (
      <Badge variant="warn">{t("elig_partial", { spent: r.eligibility.spent, unused: r.eligibility.unused })}</Badge>
    ) : (
      <Badge variant="warn">{t("elig_spent")}</Badge>
    )
  const approveLabel = (r: AdminRefundRequest) =>
    r.eligibility.kind === "partial" ? t("rf_refundUnused", { count: r.eligibility.unused }) : r.eligibility.duplicate ? t("rf_refundDuplicate") : t("rf_refund")

  return (
    <AdminCard title={t("rf_title")} titleId="ad-refunds">
      {list.isPending ? (
        <div className="flex flex-col gap-3 py-2" aria-hidden>
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-control" />
          ))}
        </div>
      ) : list.isError ? (
        <AdminError onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <p className="py-3 text-[13px] leading-[18px] text-muted-foreground">{t("rf_empty")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((r) => (
            <Row
              key={r.id}
              fill
              actions={
                <>
                  {r.eligibility.kind === "spent" ? null : (
                    <Button variant="brand" size="sm" onClick={() => approve(r)}>
                      {approveLabel(r)}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => decline(r)}>
                    {t("rf_decline")}
                  </Button>
                </>
              }
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] leading-[18px] font-semibold">{r.order.orderNumber}</span>
                {elig(r)}
              </span>
              <span className="text-xs leading-4 break-words text-muted-foreground">
                {r.order.displayName} · {r.order.email} · {t("pack", { count: r.order.coins })} · {method(r.order.method)} ·{" "}
                {t("rf_requested", { date: formatShortDate(ictDate(Date.parse(r.requestedAt)), locale) })}
              </span>
              <span className="text-xs leading-4 break-words" lang="en">
                “{r.reason}”
              </span>
            </Row>
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button variant="outline" className="self-center" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      ) : null}
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </AdminCard>
  )
}

/** Real mode (V21-06): orders PayWay says were paid but reconciliation did not credit. */
function RealStuck() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const decide = useDecide()
  const method = useMethodLabel()
  const list = useStuckPayments("open")
  const log = useAppStore((s) => s.adminLog)
  const handled = new Set(log.map((d) => d.id))
  const items = list.items.filter((s) => !handled.has(decisionKey("stuck", s.id)))

  const addCoins = (s: AdminStuckPayment) =>
    decide({
      key: decisionKey("stuck", s.id),
      queue: "payments",
      action: "addCoins",
      label: s.order.orderNumber,
      commit: () => actions.addStuckCoins(s.id),
      toast: t("toast_coinsAdded"),
    })

  return (
    <AdminCard title={t("stuck_title")} titleId="ad-stuck" desc={t("stuck_desc")}>
      {list.isPending ? (
        <div className="flex flex-col gap-3 py-2" aria-hidden>
          <Skeleton className="h-14 rounded-control" />
        </div>
      ) : list.isError ? (
        <AdminError onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <p className="py-3 text-[13px] leading-[18px] text-muted-foreground">{t("stuck_empty")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((s) => (
            <Row
              key={s.id}
              actions={
                <Button variant="brand" size="sm" onClick={() => addCoins(s)}>
                  {t("addCoins")}
                </Button>
              }
            >
              <span className="text-[13px] leading-[18px] font-semibold">{s.order.orderNumber}</span>
              <span className="text-xs leading-4 break-words text-muted-foreground">
                {s.order.displayName} · {s.order.email} · {t("pack", { count: s.order.coins })} · {method(s.order.method)}
                {s.paidAmount != null ? ` · ${t("stuck_paid", { amount: s.paidAmount.toFixed(2), currency: s.currency ?? "" })}` : ""} ·{" "}
                {t("stuck_found", { date: formatShortDate(ictDate(Date.parse(s.foundAt)), locale) })}
              </span>
            </Row>
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button variant="outline" className="self-center" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      ) : null}
    </AdminCard>
  )
}

/** Real mode: paid orders (search by order, name or email); Refund asks for the reason (audit log) first. */
function RealOrders() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const decide = useDecide()
  const method = useMethodLabel()
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(id)
  }, [text])
  const list = useOrders({ q, status: "paid" })
  const log = useAppStore((s) => s.adminLog)
  const [ask, setAsk] = useState<ReasonAsk | null>(null)
  const handled = new Set(log.map((d) => d.id))
  const items = list.items.filter((o) => !handled.has(decisionKey("refund", o.id)))

  const refund = (o: AdminOrder) =>
    setAsk({
      title: t("refundTitle", { number: o.orderNumber }),
      description: t("refundDesc", { coins: o.coins, name: o.displayName }),
      confirm: t("refund"),
      required: true,
      destructive: true,
      run: async (reason) =>
        decide({
          key: decisionKey("refund", o.id),
          queue: "payments",
          action: "refund",
          label: o.orderNumber,
          commit: () => actions.refundOrder(o.id, reason),
        }),
    })

  return (
    <AdminCard title={t("rf_titleReal")} titleId="ad-orders" desc={t("rf_lineReal")} bodyClassName="flex flex-col gap-2">
      <div className="relative w-full md:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("searchOrders")}
          placeholder={t("searchOrders")}
          className="pl-9"
        />
      </div>
      {list.isPending ? (
        <div className="flex flex-col gap-3 py-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-control" />
          ))}
        </div>
      ) : list.isError ? (
        <AdminError onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <p className="py-3 text-[13px] leading-[18px] text-muted-foreground">{q ? t("noMatchDesc") : t("rf_empty")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.map((o) => (
            <Row
              key={o.id}
              fill
              actions={
                o.refundable ? (
                  <Button variant="brand" size="sm" onClick={() => refund(o)}>
                    {t("rf_refund")}
                  </Button>
                ) : null
              }
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] leading-[18px] font-semibold">{o.orderNumber}</span>
                <Badge variant={o.refundable ? "brand" : "warn"}>{o.refundable ? t("elig_unused") : t("elig_spent")}</Badge>
              </span>
              <span className="text-xs leading-4 break-words text-muted-foreground">
                {o.displayName} · {o.email} · {t("pack", { count: o.coins })} · {method(o.method)} ·{" "}
                {formatShortDate(ictDate(Date.parse(o.paidAt ?? o.createdAt)), locale)}
              </span>
            </Row>
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <Button variant="outline" className="self-center" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      ) : null}
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </AdminCard>
  )
}
