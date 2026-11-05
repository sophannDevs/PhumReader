"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import type { CoinPack, PaymentMethod } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useAppStore, useCoins, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

/** Coins the reader gets for a pack: coins + pack bonus + first-purchase bonus (same as the pack). */
export const packTotal = (pack: CoinPack, offer: boolean) => pack.coins + pack.bonus + (offer ? pack.coins : 0)

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 text-sm", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}

/** Order summary (Review step): totals for the chosen pack and method, then "Continue to payment". */
export function CheckoutCard({
  pack,
  method,
  offer,
  onContinue,
}: {
  pack: CoinPack
  method: PaymentMethod
  offer: boolean
  onContinue: () => void
}) {
  const t = useTranslations("coins")
  const router = useRouter()
  const user = useUser()
  const balance = useCoins()
  const total = packTotal(pack, offer)

  function proceed() {
    if (!user) {
      // Back here after logging in; the pack and method stay in `checkoutDraft`.
      useAppStore.getState().setReturnTo("/coins")
      router.push("/login")
      return
    }
    onContinue()
  }

  return (
    <section aria-labelledby="order-title" className="rounded-card border bg-card p-6 shadow-xs">
      <h2 id="order-title" className="type-h2">
        {t("orderSummary")}
      </h2>
      <dl className="mt-5 flex flex-col gap-3">
        <Row label={t("packLine", { coins: pack.coins })} value={t("balanceLabel", { count: pack.coins })} className="text-foreground" />
        {pack.bonus > 0 ? <Row label={t("packBonus")} value={<span className="text-brand-ink">+{pack.bonus}</span>} /> : null}
        {offer ? <Row label={t("firstBonus")} value={<span className="text-brand-ink">+{pack.coins}</span>} /> : null}
        <div className="flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
          <dt>{t("youGet")}</dt>
          <dd className="tabular-nums">{t("balanceLabel", { count: total })}</dd>
        </div>
        <Row
          label={t("total")}
          value={
            <span className="flex flex-col items-end">
              <span className="font-semibold">{pack.priceUSD}</span>
              <span className="type-caption font-normal text-muted-foreground">{pack.priceKHR}</span>
            </span>
          }
        />
        <Row label={t("payingWith")} value={method.label} className="[&_dd]:text-foreground" />
      </dl>
      <Button variant="brand" size="lg" className="mt-6 w-full" onClick={proceed}>
        {t("continuePay")}
      </Button>
      <p className="type-small mt-3 text-center font-normal text-muted-foreground tabular-nums">
        {t("balanceAfter", { count: balance + total })}
      </p>
    </section>
  )
}
