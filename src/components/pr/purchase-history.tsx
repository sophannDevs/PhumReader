"use client"

import { useTranslations } from "next-intl"
import { useLocale } from "next-intl"
import { EmptyState } from "@/components/pr/empty-state"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PaymentMethod, Purchase, PurchaseStatus } from "@/data"
import { formatDate } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { ReceiptIcon } from "lucide-react"
import { useLocalize } from "@/lib/localize"

const statusVariant = { Paid: "brand", Failed: "danger", Cancelled: "secondary" } as const

/** Purchase history (newest first): the store's in the demo, the API's orders otherwise; `?demo=empty` shows the empty state. */
export function PurchaseHistory({ methods, purchases }: { methods: PaymentMethod[]; purchases: (Purchase & { orderId?: string })[] }) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  const locale = useLocale()
  const flag = useDemoFlag()
  const rows = flag === "empty" ? [] : purchases
  const label = (id: string) => {
    const m = methods.find((x) => x.id === id)
    return m ? loc.method(id, m).label : id
  }
  const statusLabel = (s: PurchaseStatus) => t(`status${s}`)

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="type-h3">
        {t("historyTitle")}
      </h2>
      {rows.length === 0 ? (
        <div className="rounded-card border bg-card">
          <EmptyState icon={ReceiptIcon} title={t("noPurchases")} description={t("noPurchasesDesc")} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("colDate")}</TableHead>
                <TableHead>{t("colItem")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colMethod")}</TableHead>
                <TableHead className="text-right">{t("colCoins")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p, i) => (
                <TableRow key={`${p.date}-${p.orderId ?? i}`}>
                  <TableCell className="text-muted-foreground">{formatDate(p.date, locale)}</TableCell>
                  <TableCell>{loc.pack(p.pack)}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{label(p.method)}</TableCell>
                  <TableCell className="text-right tabular-nums">+{p.coins}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status]}>{statusLabel(p.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
