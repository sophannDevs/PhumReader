"use client"

import { useTranslations } from "next-intl"
import { useLocale } from "next-intl"
import { EmptyState } from "@/components/pr/empty-state"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PaymentMethod, PurchaseStatus } from "@/data"
import { formatDate } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { useAppStore } from "@/lib/store"
import { ReceiptIcon } from "lucide-react"

const statusVariant = { Paid: "brand", Failed: "danger", Cancelled: "secondary" } as const

/** Purchase history from the store (newest first); `?demo=empty` shows the empty state. */
export function PurchaseHistory({ methods }: { methods: PaymentMethod[] }) {
  const t = useTranslations("coins")
  const locale = useLocale()
  const flag = useDemoFlag()
  const purchases = useAppStore((s) => s.purchases)
  const rows = flag === "empty" ? [] : purchases
  const label = (id: string) => methods.find((m) => m.id === id)?.label ?? id
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
                  <TableCell>{p.pack}</TableCell>
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
