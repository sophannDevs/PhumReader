"use client"

import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { PaymentMethod, Purchase, PurchaseStatus } from "@/data"
import { Link } from "@/i18n/navigation"
import { formatDate, ictDate } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useDemoFlag } from "@/lib/queries"
import { cn } from "@/lib/utils"

const statusVariant = { Paid: "brand", Failed: "up", Cancelled: "secondary" } as const

/** Rows shown (prototype: the 6 newest). */
const MAX_ROWS = 6

export type HistoryRow = Purchase & { orderId?: string; at?: number }

export const receiptHref = (orderId: string) => `/coins/orders/${encodeURIComponent(orderId)}`

/**
 * Purchase history (newest first, prototype Shop `.tbl`): the store's orders in the demo, the API's otherwise.
 * Each item links to its Receipt; `?demo=empty` shows the empty state.
 */
export function PurchaseHistory({ methods, purchases }: { methods: PaymentMethod[]; purchases: HistoryRow[] }) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  const locale = useLocale()
  const flag = useDemoFlag()
  const rows = flag === "empty" ? [] : purchases.slice(0, MAX_ROWS)
  const label = (id: string) => {
    const m = methods.find((x) => x.id === id)
    return m ? loc.method(id, m).label : id
  }
  const statusLabel = (s: PurchaseStatus) => t(`status${s}`)
  const cell = "h-12 px-3.5 py-2 align-middle max-md:px-2"
  const head = "h-10 px-3.5 text-left align-middle text-[13px] font-medium text-muted-foreground max-md:px-2"

  return (
    <section id="history" aria-labelledby="history-title" className="flex min-w-0 scroll-mt-24 flex-col gap-3">
      <h2 id="history-title" className="type-h3">
        {t("historyTitle")}
      </h2>
      <div className="overflow-hidden rounded-card border bg-card shadow-xs">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-[13px] leading-[18px] text-muted-foreground">{t("noPurchases")}</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm max-md:text-[13px]">
            <thead className="bg-[#fafafa]">
              <tr className="border-b">
                <th scope="col" className={cn(head, "w-[124px] max-md:w-[100px]")}>
                  {t("colDate")}
                </th>
                <th scope="col" className={head}>
                  {t("colItem")}
                </th>
                <th scope="col" className={cn(head, "w-[170px] max-md:hidden")}>
                  {t("colMethod")}
                </th>
                <th scope="col" className={cn(head, "w-[80px] text-right max-md:w-[56px]")}>
                  {t("colCoins")}
                </th>
                <th scope="col" className={cn(head, "w-[110px] max-md:w-[84px]")}>
                  {t("colStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const date = formatDate(p.at ? ictDate(p.at) : p.date, locale)
                const item = loc.pack(p.pack)
                return (
                  <tr key={p.orderId ?? `${p.date}-${i}`} className="border-b last:border-b-0">
                    <td className={cn(cell, "whitespace-nowrap text-muted-foreground")}>{date}</td>
                    <td className={cn(cell, "font-semibold")}>
                      {p.orderId ? (
                        <Link
                          href={receiptHref(p.orderId)}
                          aria-label={t("openReceipt", { item, date })}
                          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {item}
                        </Link>
                      ) : (
                        item
                      )}
                    </td>
                    <td className={cn(cell, "text-muted-foreground max-md:hidden")}>{label(p.method)}</td>
                    <td className={cn(cell, "text-right tabular-nums")}>+{p.coins}</td>
                    <td className={cell}>
                      <Badge variant={statusVariant[p.status]} className="max-w-full">
                        {statusLabel(p.status)}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
