import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/** Movement strings come from demo data: "▲ 2", "▼ 3", "NEW" or "—" (V2.1 `.rk-move`). */
export function Movement({ value, className }: { value: string; className?: string }) {
  const t = useTranslations("cards")
  const n = value.replace(/[^\d]/g, "")
  const base = "w-10 shrink-0 text-right text-xs font-semibold tabular-nums"
  if (value.startsWith("▲"))
    return (
      <span className={cn(base, "text-[#15803d]", className)} aria-label={t("moveUp", { n })}>
        <Num>{value}</Num>
      </span>
    )
  if (value.startsWith("▼"))
    return (
      <span className={cn(base, "text-[#b91c1c]", className)} aria-label={t("moveDown", { n })}>
        <Num>{value}</Num>
      </span>
    )
  if (value.toUpperCase() === "NEW")
    return (
      <span className={cn(base, "text-[#15803d]", className)} aria-label={t("moveNew")}>
        {t("new")}
      </span>
    )
  return (
    <span className={cn(base, "text-muted-foreground", className)} aria-label={t("moveSame")}>
      —
    </span>
  )
}

/** V2.1 `.rk-row`: rank number (green and larger for 1-3), 40x52 cover (48x64 for the top 3), title, meta, movement. */
export function RankRow({
  rank,
  series,
  movement,
  meta,
  className,
}: {
  rank: number
  series: Series
  movement: string
  /** Defaults to "creator · 1.6M views" */
  meta?: string
  className?: string
}) {
  const t = useTranslations("cards")
  const top = rank <= 3
  return (
    <Link
      href={seriesHref(series)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-control px-3 py-2 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <span
        aria-label={t("rank", { rank })}
        className={cn(
          "w-[22px] shrink-0 text-center font-bold tabular-nums",
          top ? "text-lg text-brand-ink" : "text-base text-muted-foreground"
        )}
      >
        <Num>{rank}</Num>
      </span>
      <Image
        src={series.cover}
        alt=""
        width={96}
        height={128}
        sizes="48px"
        className={cn("shrink-0 rounded-md bg-muted object-cover", top ? "h-16 w-12" : "h-[52px] w-10")}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-[22px] font-semibold">{series.title}</span>
        <span className="truncate text-xs leading-4 text-muted-foreground">
          {meta ?? `${series.creator} · ${t("views", { views: series.views })}`}
        </span>
      </span>
      <Movement value={movement} />
    </Link>
  )
}
