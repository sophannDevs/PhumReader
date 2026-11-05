import Image from "next/image"
import { useTranslations } from "next-intl"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** Movement strings come from demo data: "▲ 2", "▼ 3", "NEW" or "—". */
function Movement({ value }: { value: string }) {
  const t = useTranslations("cards")
  const n = value.replace(/[^\d]/g, "")

  if (value.startsWith("▲"))
    return (
      <span className="type-small font-semibold text-brand-ink tabular-nums" aria-label={t("moveUp", { n })}>
        {value}
      </span>
    )
  if (value.startsWith("▼"))
    return (
      <span className="type-small font-semibold text-destructive tabular-nums" aria-label={t("moveDown", { n })}>
        {value}
      </span>
    )
  if (value.toUpperCase() === "NEW")
    return (
      <span className="type-small font-semibold text-brand-ink">
        {t("new")}
      </span>
    )
  return (
    <span className="type-small text-muted-foreground" aria-label={t("moveSame")}>
      —
    </span>
  )
}

/** Rank number (green for 1-3), 40x52 cover, title, "creator · views", movement. */
export function RankRow({
  rank,
  series,
  movement,
  className,
}: {
  rank: number
  series: Series
  movement: string
  className?: string
}) {
  const t = useTranslations("cards")

  return (
    <Link
      href={seriesHref(series)}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-card px-2 py-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <span
        aria-label={t("rank", { rank })}
        className={cn(
          "w-6 shrink-0 text-center text-base tabular-nums",
          rank <= 3 ? "font-bold text-brand-ink" : "font-medium text-muted-foreground"
        )}
      >
        {rank}
      </span>
      <div className="relative h-[52px] w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={series.cover}
          alt={t("cover", { title: series.title })}
          width={80}
          height={104}
          sizes="40px"
          className="cover-zoom size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="type-card-title truncate">{series.title}</h3>
        <p className="type-caption truncate font-normal text-muted-foreground">
          {series.creator} · {t("views", { views: series.views })}
        </p>
      </div>
      <Movement value={movement} />
    </Link>
  )
}
