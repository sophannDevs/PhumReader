"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { useTranslations } from "@/i18n/translations"
import { packTotal } from "@/components/pr/checkout-flow"
import { CoinIcon } from "@/components/pr/coin-icon"
import { Badge } from "@/components/ui/badge"
import { RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import type { CoinPack } from "@/data/types"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Coin pack as a radio card (prototype Shop `.radio-card`). Render inside a `RadioGroup`; the item value is
 * `String(pack.coins)` and the radio's id `pack-<coins>`. Shows the bonus and its %, "You get N · ≈ N episodes"
 * (with the first-purchase bonus when `firstPurchaseOffer`), the price placeholders, and the tag: "Covers it"
 * (`covers`, coming from a locked episode) replaces Popular / Best value.
 */
export function PackCard({
  pack,
  firstPurchaseOffer = false,
  price,
  unit = "episode",
  covers = false,
  disabled = false,
  index = 0,
  className,
}: {
  pack: CoinPack
  firstPurchaseOffer?: boolean
  /** Fast Pass price in coins (for "≈ N episodes") */
  price: number
  unit?: "episode" | "chapter"
  covers?: boolean
  disabled?: boolean
  /** Position in the grid: staggers the entrance (capped at 10 steps) */
  index?: number
  className?: string
}) {
  const t = useTranslations("packs")
  const id = `pack-${pack.coins}`
  const total = packTotal(pack, firstPurchaseOffer)
  const count = price > 0 ? Math.floor(total / price) : 0
  const about = t(unit === "chapter" ? "aboutChapters" : "aboutEpisodes", { count })

  const tag = covers ? (
    <Badge variant="warn">{t("coversIt")}</Badge>
  ) : pack.tag === "Popular" ? (
    <Badge variant="new">{t("popular")}</Badge>
  ) : pack.tag === "Best value" ? (
    <Badge variant="default">{t("bestValue")}</Badge>
  ) : null

  return (
    <AnimateIcon asChild animateOnHover>
      <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 50} inView>
        <label
        htmlFor={id}
        className={cn(
          radioCardClassName,
          "min-h-[168px] flex-col items-start gap-1.5 rounded-[10px] bg-background p-3.5 shadow-xs max-md:min-h-[140px]",
          className
        )}
      >
        <span className="flex min-h-[22px] w-full items-center justify-between gap-2">
          <RadioGroupItem id={id} value={String(pack.coins)} disabled={disabled} className="border-[#a1a1aa]" />
          {tag}
        </span>
        <span className="flex items-center gap-2">
          <CoinIcon size={20} />
          <span className="text-2xl leading-[30px] font-semibold tracking-[-0.02em] tabular-nums max-md:text-xl max-md:leading-[26px]">
            <Num>{pack.coins}</Num>
          </span>
          <span className="sr-only">{t("coinsLabel", { count: pack.coins })}</span>
        </span>
        <span className={cn("text-xs leading-4", pack.bonus > 0 ? "text-brand-ink" : "text-muted-foreground")}>
          {pack.bonus > 0 ? t("bonus", { count: pack.bonus, pct: Math.round((pack.bonus / pack.coins) * 100) }) : t("noBonus")}
        </span>
        <span className="text-xs leading-4 text-muted-foreground">
          {total !== pack.coins ? `${t("youGet", { count: total })} · ${about}` : about}
        </span>
        <span className="mt-auto pt-1 text-[13px] leading-[18px] font-semibold">{pack.priceUSD}</span>
        <span className="text-xs leading-4 text-muted-foreground">{pack.priceKHR}</span>
        </label>
      </Effect>
    </AnimateIcon>
  )
}
