import Image from "next/image"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"

/** Bordered card: 84 px cover, genre badge, title, "creator · N chapters". */
export function NovelCard({ series, className }: { series: Series; className?: string }) {
  const t = useTranslations("cards")
  const loc = useLocalize()

  return (
    <Link
      href={seriesHref(series)}
      className={cn(
        "group flex min-w-0 items-center gap-4 rounded-card border bg-card p-3 shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <div className="relative aspect-[3/4] w-[84px] shrink-0 overflow-hidden rounded-control bg-muted">
        <Image
          src={series.cover}
          alt={t("cover", { title: series.title })}
          width={168}
          height={224}
          sizes="84px"
          className="cover-zoom size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Badge variant="secondary">{loc.genre(series.genre)}</Badge>
        <h3 className="type-h4 w-full truncate">{series.title}</h3>
        <p className="type-small w-full truncate font-normal text-muted-foreground">
          {series.creator} · {t("chapters", { count: series.freeEpisodes })}
        </p>
      </div>
    </Link>
  )
}
