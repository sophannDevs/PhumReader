"use client"

import { useTranslations } from "next-intl"
import { CoinIcon } from "@/components/pr/coin-icon"
import { Badge } from "@/components/ui/badge"
import { RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import type { CoinPack } from "@/data/types"
import { cn } from "@/lib/utils"

/**
 * Coin pack as a radio card. Render inside a `RadioGroup`; the item value is
 * `String(pack.coins)`. `firstPurchaseOffer` adds the "+N first" bonus line.
 */
export function PackCard({
  pack,
  firstPurchaseOffer = false,
  disabled = false,
  className,
}: {
  pack: CoinPack
  firstPurchaseOffer?: boolean
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations("packs")
  const id = `pack-${pack.coins}`

  const bonusParts = [
    pack.bonus > 0 ? t("bonus", { count: pack.bonus }) : t("noBonus"),
    ...(firstPurchaseOffer ? [t("first", { count: pack.coins })] : []),
  ]

  return (
    <label htmlFor={id} className={cn(radioCardClassName, "flex-col gap-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <RadioGroupItem id={id} value={String(pack.coins)} disabled={disabled} />
        {pack.tag === "Popular" ? <Badge variant="new">{t("popular")}</Badge> : null}
        {pack.tag === "Best value" ? <Badge variant="default">{t("bestValue")}</Badge> : null}
      </div>
      <div className="flex items-center gap-2">
        <CoinIcon size={20} />
        <span className="text-2xl leading-8 font-semibold tracking-tight tabular-nums">{pack.coins}</span>
        <span className="sr-only">{t("coinsLabel", { count: pack.coins })}</span>
      </div>
      <p className="type-caption min-h-8 font-normal text-brand-ink">{bonusParts.join(" · ")}</p>
      <div className="mt-1 flex flex-col">
        <span className="text-sm font-semibold">{pack.priceUSD}</span>
        <span className="type-caption font-normal text-muted-foreground">{pack.priceKHR}</span>
      </div>
    </label>
  )
}
