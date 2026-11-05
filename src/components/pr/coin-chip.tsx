import { useTranslations } from "next-intl"
import { CoinIcon } from "@/components/pr/coin-icon"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/** Pill with the coin balance. Links to /coins. */
export function CoinChip({ count, className }: { count: number; className?: string }) {
  const t = useTranslations("coins")
  return (
    <Link
      href="/coins"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-3 text-sm font-semibold tabular-nums transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <CoinIcon size={16} />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t("balanceLabel", { count })}</span>
    </Link>
  )
}
