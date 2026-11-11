"use client"

import { useTranslations } from "@/i18n/translations"
import { CoinIcon } from "@/components/pr/coin-icon"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/motion"

/** Pill with the coin balance. Links to /coins. */
export function CoinChip({ count, className }: { count: number; className?: string }) {
  const t = useTranslations("coins")
  return (
    <Link
      href="/coins"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border bg-background pr-2.5 pl-1.5 text-[13px] font-semibold tabular-nums transition-colors max-[420px]:px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <CoinIcon size={20} />
      <span aria-hidden><AnimatedNumber value={count} /></span>
      <span className="sr-only">{t("balanceLabel", { count })}</span>
    </Link>
  )
}
