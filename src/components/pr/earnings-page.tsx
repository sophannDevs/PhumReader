"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { WalletIcon as CoinsIcon } from "@/components/animate-ui/icons/wallet"
import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { TriangleAlertIcon as AlertTriangleIcon } from "@/components/animate-ui/icons/triangle-alert"
import Image from "next/image"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { toast } from "sonner"
import { CreatorNav } from "@/components/layout/creator-nav"
import { CreatorGate } from "@/components/pr/creator-gate"
import { OptionCard, StatCard } from "@/components/pr/patterns"
import { Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/creators"
import { creatorKeys } from "@/lib/api/keys"
import { withDemo } from "@/lib/demo-api"
import { useAccountEmail, useFailed } from "@/lib/me"
import { formatDate } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Earnings (spec §18, prototype Earnings/): period 30 days / 3 months / 6 months, stat cards (money stays
 * [USD AMOUNT] at [REVENUE SHARE]%), coins by month as a chart or a table, by-series breakdown, payouts and payout
 * history. Without a payout method (store `payoutSet`) a warning shows and history says "On hold"; the dialog shows the
 * [PAYOUT PROVIDER FORM] placeholder. Demo: demo numbers (?demo=empty = no coins). Real API (V21-05): GET /creator/earnings
 * (the last 6 months from the creator's Fast Pass unlocks, by series; readers = people who unlocked that month, added up
 * over the period) and the payout method (aba / bank) saved with the account.
 */

type Period = "30d" | "3m" | "6m"
type EarningsSeries = { id: string; title: string; cover: string | null; live: boolean; coins: number[] }
type EarningsData = {
  /** The last 6 months, oldest first (the last is the current month) */
  months: { year: number; month: number }[]
  /** Coins earned per month */
  coins: number[]
  /** Unlocks and readers per month; null in the demo (worked out from the price) */
  unlocks: number[] | null
  readers: number[] | null
  /** Payouts, newest first: [ISO date, coins] */
  history: [string, number][]
  /** Real API: the series with their coins per month; null in the demo (the store's works share the total) */
  series: EarningsSeries[] | null
  /** Real API: where payouts go; undefined in the demo (store `payoutSet`) */
  method?: real.PayoutMethod | null
}

const DEMO_MONTHS = [6, 7, 8, 9, 10, 11].map((month) => ({ year: 2026, month }))
const DEMO: EarningsData = {
  months: DEMO_MONTHS,
  coins: [1240, 1610, 1980, 2450, 2830, 3420],
  unlocks: null,
  readers: null,
  series: null,
  history: [
    ["2026-11-01", 2830],
    ["2026-10-01", 2450],
    ["2026-09-01", 1980],
  ],
}
const NONE: EarningsData = { ...DEMO, coins: [0, 0, 0, 0, 0, 0], history: [] }

const ymOf = (month: string) => ({ year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) })
/** A finished month is paid on the 1st of the next one. */
const payDay = (month: string) => {
  const { year, month: m } = ymOf(month)
  return m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`
}

function fromApi(e: real.CreatorEarnings): EarningsData {
  return {
    months: e.months.map((m) => ymOf(m.month)),
    coins: e.months.map((m) => m.coins),
    unlocks: e.months.map((m) => m.unlocks),
    readers: e.months.map((m) => m.readers),
    series: e.series.map((s) => ({ id: s.id, title: s.title, cover: s.cover ?? null, live: s.visibility === "published", coins: s.coins })),
    history: e.history.map((h) => [payDay(h.month), h.coins]),
    method: (e.payoutMethod as real.PayoutMethod | null | undefined) ?? null,
  }
}
/** Fast Pass price and the prototype's "≈ 2.6 unlocks each". */
const PRICE = 5
const UNLOCKS_PER_READER = 2.6
/** Share of the coins that come from Fast Pass on the published series (the rest are tips, prototype). */
const FAST_PASS_SHARE = 0.94

const fmt = (n: number) => n.toLocaleString("en-US")

export function EarningsPage() {
  const t = useTranslations("earnings")
  return (
    <CreatorGate title={t("title")}>
      <Earnings />
    </CreatorGate>
  )
}

function Earnings() {
  const t = useTranslations("earnings")
  const ts = useTranslations("states")
  const flag = useDemoFlag()
  const email = useAccountEmail()
  const storePayoutSet = useAppStore((s) => s.payoutSet)
  const [period, setPeriod] = useState<Period>("6m")
  const [asTable, setAsTable] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const query = useQuery({
    queryKey: DEMO_MODE ? ["earnings", flag] : creatorKeys.earnings(email ?? ""),
    queryFn: () => (DEMO_MODE ? withDemo(() => DEMO, { empty: () => NONE }) : real.fetchEarnings().then(fromApi)),
    enabled: DEMO_MODE || !!email,
  })

  const n = period === "30d" ? 1 : period === "3m" ? 3 : 6
  const data = query.data
  const payoutSet = data && data.method !== undefined ? data.method !== null : storePayoutSet
  const coins = data ? data.coins.slice(-n) : []
  const months = data ? data.months.slice(-n) : []
  const total = coins.reduce((a, b) => a + b, 0)
  const unlocks = data?.unlocks ? data.unlocks.slice(-n).reduce((a, b) => a + b, 0) : Math.round(total / PRICE)
  const readers = data?.readers ? data.readers.slice(-n).reduce((a, b) => a + b, 0) : Math.round(total / PRICE / UNLOCKS_PER_READER)
  // Real API: this month against the one before (the demo shows the prototype's 21 %).
  const previous = data && data.series ? (data.coins[data.coins.length - 2] ?? 0) : null
  const pct = previous === null ? 21 : previous > 0 ? Math.round(((coins[coins.length - 1] - previous) / previous) * 100) : null

  return (
    <>
      <CreatorNav active="earnings" />
      <div className="container flex flex-col gap-6 pt-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="type-h2">{t("title")}</h1>
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("sub")}</p>
          </div>
          <Segmented
            label={t("periodLabel")}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "30d", label: t("period30d") },
              { value: "3m", label: t("period3m") },
              { value: "6m", label: t("period6m") },
            ]}
          />
        </div>

        {!payoutSet ? (
          <div role="status" className="flex flex-wrap items-start gap-3 rounded-[10px] border border-warning-border bg-warning-soft px-4 py-3.5 text-warning-ink">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="flex min-w-0 flex-1 basis-60 flex-col">
              <span className="text-sm leading-5 font-semibold">{t("noMethodTitle")}</span>
              <span className="text-[13px] leading-[19px]">{t("noMethodDesc")}</span>
            </div>
            <Button variant="brand" size="sm" className="-my-1 max-md:my-0" onClick={() => setMethodOpen(true)}>
              {t("addMethod")}
            </Button>
          </div>
        ) : null}

        {query.isPending ? (
          <EarningsSkeleton />
        ) : query.isError ? (
          <StateBox
            icon={AlertCircleIcon}
            tone="bad"
            title={ts("errorTitle")}
            text={ts("errorDescription")}
            action={
              <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
                {ts("retry")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
              <StatCard
                label={t("statCoins")}
                value={total} countUp
                change={<span className="font-normal">{total === 0 ? t("noCoinsShort") : n === 1 && pct !== null ? t("vsLastMonth", { pct }) : t("acrossMonths", { count: n })}</span>}
                tone={total > 0 && n === 1 && pct !== null && pct > 0 ? "up" : "muted"}
              />
              <StatCard label={t("statUnlocks")} value={unlocks} countUp change={<span className="font-normal">{t("coinsEach", { count: PRICE })}</span>} />
              <StatCard label={t("statEstimate")} value={<span className="font-bold">[USD AMOUNT]</span>} placeholder change={<span className="font-normal">{t("estimateNote")}</span>} />
              <StatCard label={t("statReaders")} value={readers} countUp change={<span className="font-normal">{data?.readers ? t("readersNote") : t("unlocksEach", { n: UNLOCKS_PER_READER })}</span>} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-w-0 flex-col gap-6">
                <section aria-labelledby="coins-title" className="rounded-card border bg-card shadow-xs">
                  <div className="flex items-center justify-between gap-3 px-5 pt-5 max-md:px-4 max-md:pt-4">
                    <h2 id="coins-title" className="type-h3">
                      {t("chartTitle")}
                    </h2>
                    {total > 0 ? (
                      <Button variant="ghost" size="sm" className="-my-1" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
                        {asTable ? t("showChart") : t("showTable")}
                      </Button>
                    ) : null}
                  </div>
                  <div className="p-5 max-md:p-4">
                    {total === 0 ? (
                      <StateBox icon={CoinsIcon} title={t("noCoinsTitle")} text={t("noCoinsText")} />
                    ) : asTable ? (
                      <CoinsTable months={months} coins={coins} unlocks={data?.unlocks ? data.unlocks.slice(-n) : null} />
                    ) : (
                      <CoinsChart months={months} coins={coins} />
                    )}
                  </div>
                </section>
                <BySeries total={total} data={data!} n={n} />
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                <Payouts data={data!} payoutSet={payoutSet} onMethod={() => setMethodOpen(true)} />
                <History data={data!} payoutSet={payoutSet} />
                <p className="text-xs leading-4 text-muted-foreground">{t("placeholderNote")}</p>
              </div>
            </div>
          </>
        )}
      </div>
      <MethodDialog open={methodOpen} onOpenChange={setMethodOpen} current={data?.method ?? null} />
    </>
  )
}

type Months = { year: number; month: number }[]

function CoinsChart({ months, coins }: { months: Months; coins: number[] }) {
  const t = useTranslations("earnings")
  const max = Math.max(...coins, 1)
  return (
    <div
      role="img"
      aria-label={t("chartAria", { list: months.map((m, i) => `${t(`month.${m.month}`)} ${fmt(coins[i])}`).join(", ") })}
      className="grid h-[200px] items-end gap-3 max-md:h-40 max-md:gap-1"
      style={{ gridTemplateColumns: `repeat(${coins.length}, minmax(0, 1fr))` }}
    >
      {coins.map((v, i) => (
        <Effect key={`${months[i].year}-${months[i].month}`} asChild fade slide={{ direction: "up", offset: 14 }} delay={i * 60} inView>
          <div className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5">
            <strong className="text-xs leading-4 font-bold tabular-nums max-md:text-[9px] max-md:leading-3">{fmt(v)}</strong>
            <span
              className={cn("w-full max-w-11 rounded-t-md rounded-b-[2px]", i === coins.length - 1 ? "bg-primary" : "bg-brand-soft-border")}
              style={{ height: `${Math.round((v / max) * 100 * 0.82)}%` }}
            />
            <span className="text-[11px] leading-[14px] text-muted-foreground">{t(`month.${months[i].month}`)}</span>
          </div>
        </Effect>
      ))}
    </div>
  )
}

function CoinsTable({ months, coins, unlocks }: { months: Months; coins: number[]; unlocks: number[] | null }) {
  const t = useTranslations("earnings")
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{t("tableCaption")}</caption>
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th scope="col" className="px-1 py-2.5 text-left font-semibold">
            {t("colMonth")}
          </th>
          <th scope="col" className="w-[100px] px-1 py-2.5 text-right font-semibold">
            {t("colCoins")}
          </th>
          <th scope="col" className="w-[100px] px-1 py-2.5 text-right font-semibold">
            {t("colUnlocks")}
          </th>
        </tr>
      </thead>
      <tbody>
        {coins.map((v, i) => (
          <tr key={`${months[i].year}-${months[i].month}`} className="not-last:border-b">
            <th scope="row" className="px-1 py-2.5 text-left font-normal">
              {t("monthLong", { month: t(`monthFull.${months[i].month}`), year: months[i].year })}
            </th>
            <td className="px-1 py-2.5 text-right tabular-nums">{fmt(v)}</td>
            <td className="px-1 py-2.5 text-right tabular-nums">{fmt(unlocks ? unlocks[i] : Math.round(v / PRICE))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BySeries({ total, data, n }: { total: number; data: EarningsData; n: number }) {
  const t = useTranslations("earnings")
  const works = useAppStore((s) => s.myWorks).filter((w) => w.status !== "draft")
  const live = works.filter((w) => w.status === "published")
  // Demo: the works in the store share the total. Real API: each series' own coins in the period.
  const rows = data.series
    ? data.series.map((s) => {
        const coins = s.coins.slice(-n).reduce((a, b) => a + b, 0)
        return { w: { id: s.id, title: s.title, cover: s.cover ?? "", status: s.live ? "published" : "review" }, coins, pct: total ? Math.round((coins / total) * 100) : 0 }
      })
    : works.map((w) => {
        const coins = w.status === "published" && live.length ? Math.round((total * FAST_PASS_SHARE) / live.length) : 0
        return { w, coins, pct: total ? Math.round((coins / total) * 100) : 0 }
      })
  return (
    <section aria-labelledby="by-title" className="rounded-card border bg-card shadow-xs">
      <h2 id="by-title" className="type-h3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        {t("bySeries")}
      </h2>
      {rows.length === 0 ? (
        <p className="p-5 text-[13px] leading-[18px] text-muted-foreground max-md:p-4">{t("bySeriesNone")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-5 max-md:p-4">
          {rows.map(({ w, coins, pct }) => (
            <li key={w.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[18px] font-semibold">
                  {w.cover ? <Image src={w.cover} alt="" width={56} height={72} className="h-9 w-7 shrink-0 rounded-[4px] object-cover" /> : null}
                  <span className="truncate">{w.title}</span>
                </span>
                <span className="shrink-0 text-[13px] leading-[18px] tabular-nums">{t("coinsPct", { coins: fmt(coins), pct })}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs leading-4 text-muted-foreground">
                {data.series ? (w.status === "published" ? t("metaFastPass") : t("metaWaiting")) : w.status === "published" ? t("metaLive", { count: 3 }) : t("metaWaiting")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Payouts({ data, payoutSet, onMethod }: { data: EarningsData; payoutSet: boolean; onMethod: () => void }) {
  const t = useTranslations("earnings")
  return (
    <section aria-labelledby="po-title" className="rounded-card border bg-card shadow-xs">
      <h2 id="po-title" className="type-h3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        {t("payouts")}
      </h2>
      <div className="flex flex-col gap-3.5 p-5 max-md:p-4">
        <div className="flex flex-col gap-1 rounded-[10px] border border-[#c9f1da] bg-brand-soft bg-[image:linear-gradient(135deg,#effcf4,#e3f9ec)] p-4">
          <span className="text-xs leading-4 text-muted-foreground">{t("available")}</span>
          <span className="type-h2">[USD AMOUNT]</span>
          <span className="text-xs leading-4 text-muted-foreground">{t("availableFrom", { coins: fmt(data.coins[data.coins.length - 1] ?? 0) })}</span>
        </div>
        {payoutSet ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-extrabold">
                  {data.method === "bank" ? "BANK" : "ABA"}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] leading-[18px] font-semibold">{data.method === "bank" ? t("otherBank") : t("abaBank")}</span>
                  <span className="text-xs leading-4 text-muted-foreground">[PAYOUT ACCOUNT]</span>
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={onMethod} aria-label={t("changeMethod")}>
                {t("change")}
              </Button>
            </div>
            <span className="text-xs leading-4 text-muted-foreground">{t("nextPayout")}</span>
          </>
        ) : (
          <Button variant="brand" className="w-full" onClick={onMethod}>
            {t("addMethod")}
          </Button>
        )}
      </div>
    </section>
  )
}

function History({ data, payoutSet }: { data: EarningsData; payoutSet: boolean }) {
  const t = useTranslations("earnings")
  const locale = useLocale()
  return (
    <section aria-labelledby="ph-title" className="rounded-card border bg-card shadow-xs">
      <h2 id="ph-title" className="type-h3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        {t("history")}
      </h2>
      {data.history.length === 0 ? (
        <p className="p-5 text-[13px] leading-[18px] text-muted-foreground max-md:p-4">{t("historyNone")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-5 max-md:p-4">
          {data.history.map(([iso, coins]) => (
            <li key={iso} className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-[13px] leading-[18px] font-semibold">{formatDate(iso, locale)}</span>
                <span className="text-xs leading-4 text-muted-foreground">{t("coinsCount", { coins: fmt(coins) })}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="text-[13px] leading-[18px]">[USD AMOUNT]</span>
                <Badge variant={payoutSet ? "brand" : "warn"}>{payoutSet ? t("paid") : t("onHold")}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MethodDialog({ open, onOpenChange, current }: { open: boolean; onOpenChange: (open: boolean) => void; current: real.PayoutMethod | null }) {
  const t = useTranslations("earnings")
  const qc = useQueryClient()
  const email = useAccountEmail()
  const failed = useFailed()
  const [method, setMethod] = useState<"aba" | "bank">(current ?? "aba")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (DEMO_MODE) {
      useAppStore.getState().setPayoutSet(true)
    } else {
      // Only the kind of account is saved: the account details come from the payout provider's form.
      setSaving(true)
      try {
        await real.setPayoutMethod(method)
        await qc.invalidateQueries({ queryKey: creatorKeys.earnings(email ?? "") })
      } catch (error) {
        failed(error)
        return
      } finally {
        setSaving(false)
      }
    }
    onOpenChange(false)
    toast.success(t("methodSaved"))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-40px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="type-h3">{t("methodTitle")}</DialogTitle>
          <DialogDescription>{t("methodDesc")}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t("methodTitle")} className="flex flex-col gap-2">
          <OptionCard selected={method === "aba"} onSelect={() => setMethod("aba")} title={t("abaBank")} description={t("abaDesc")} />
          <OptionCard selected={method === "bank"} onSelect={() => setMethod("bank")} title={t("otherBank")} description={t("otherBankDesc")} />
        </div>
        <div className="flex min-h-[120px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#a1a1aa] bg-[#fafafa] text-[13px] font-bold text-[#3f3f46]">
          [PAYOUT PROVIDER FORM]
        </div>
        <Button variant="brand" className="w-full" loading={saving} onClick={() => void save()}>
          {t("saveMethod")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function EarningsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-card max-md:h-[92px]" />
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[292px] rounded-card" />
          <Skeleton className="h-[240px] rounded-card" />
        </div>
        <Skeleton className="h-[272px] rounded-card" />
      </div>
    </div>
  )
}
