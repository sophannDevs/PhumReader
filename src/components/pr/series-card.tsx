import { HeartIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** 3:4 cover, UP / NEW / Novel badges top-left, title, "creator · genre", likes. */
export function SeriesCard({
  series,
  className,
  priority = false,
}: {
  series: Series
  className?: string
  priority?: boolean
}) {
  const t = useTranslations("cards")
  const showBadges = series.badges.up || series.badges.isNew || series.type === "novel"

  return (
    <Link
      href={seriesHref(series)}
      className={cn(
        "group flex min-w-0 flex-col gap-2 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card bg-muted">
        <Image
          src={series.cover}
          alt={t("cover", { title: series.title })}
          width={360}
          height={480}
          priority={priority}
          className="cover-zoom size-full object-cover"
        />
        {showBadges ? (
          <div className="absolute top-2 left-2 flex gap-1">
            {series.badges.up ? <Badge variant="up">{t("up")}</Badge> : null}
            {series.badges.isNew ? <Badge variant="new">{t("new")}</Badge> : null}
            {series.type === "novel" ? <Badge variant="dark">{t("novel")}</Badge> : null}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="type-card-title truncate">{series.title}</h3>
        <p className="type-small truncate font-normal text-muted-foreground">
          {series.creator} · {series.genre}
        </p>
        <p className="type-small flex items-center gap-1 font-normal text-muted-foreground tabular-nums">
          <HeartIcon className="size-3.5" aria-hidden />
          <span aria-label={t("likes", { count: series.likes })}>{series.likes}</span>
        </p>
      </div>
    </Link>
  )
}
