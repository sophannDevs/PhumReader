import { HeartIcon } from "@/components/animate-ui/icons/heart"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { Badge } from "@/components/ui/badge"
import { Effect } from "@animate-ui/react/primitives/effects/effect"
import { Tilt, TiltContent } from "@animate-ui/react/primitives/effects/tilt"
import { Link } from "@/i18n/navigation"
import type { Series } from "@/data/types"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"
import { Num } from "@/i18n/num"

/**
 * Series card (V2.1 `.s-card`): 3:4 cover (10 px radius, hover zoom) with top-left badges, then a 14 px title
 * and 13 px muted lines. The lines under the title change per row:
 * - default: "creator · genre" and likes
 * - `hook`: a 2-line hook between the title and "creator · genre" (Recommended for you)
 * - `meta="creator"`: only the creator (Browse by genre)
 * - `footer`: replaces the likes line (Daily updates: "New today · ♥ 1.8M")
 * `badges="novel"` shows only the Novel badge; `badges="all"` also UP and NEW.
 */
export function SeriesCard({
  series,
  className,
  priority = false,
  sizes = "(min-width: 1280px) 190px, (min-width: 768px) 25vw, 38vw",
  hook,
  meta = "creatorGenre",
  footer,
  badges = "all",
  onClick,
}: {
  series: Series
  className?: string
  priority?: boolean
  /** Rendered width hint for next/image; the default matches the 6 / 4 column grids and the phone swipe rows. */
  sizes?: string
  hook?: string
  meta?: "creatorGenre" | "creator"
  footer?: React.ReactNode
  badges?: "all" | "novel" | "none"
  onClick?: () => void
}) {
  const t = useTranslations("cards")
  const loc = useLocalize()
  const up = badges === "all" && series.badges.up
  const isNew = badges === "all" && series.badges.isNew
  const novel = badges !== "none" && series.type === "novel"

  const card = (
    <Link
      href={seriesHref(series)}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col gap-2.5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <Tilt maxTilt={5} className="w-full">
        <TiltContent className="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-muted">
          <Image
            src={series.cover}
            alt={t("cover", { title: series.title })}
            width={360}
            height={480}
            sizes={sizes}
            priority={priority}
            className="cover-zoom size-full object-cover"
          />
          {up || isNew || novel ? (
            <div className="absolute top-2 left-2 flex gap-1">
              {up ? <Badge variant="up">{t("up")}</Badge> : null}
              {isNew ? <Badge variant="new">{t("new")}</Badge> : null}
              {novel ? <Badge variant="dark">{t("novel")}</Badge> : null}
            </div>
          ) : null}
        </TiltContent>
      </Tilt>
      <div className={cn("flex min-w-0 flex-col", hook ? "gap-[3px]" : "gap-0.5")}>
        <h3 className="truncate text-sm leading-5 font-semibold max-md:text-[13px] max-md:leading-[18px]">{series.title}</h3>
        {hook ? <p className="line-clamp-2 text-[12.5px] leading-[17px] text-[#52525b]">{hook}</p> : null}
        <p className="truncate text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">
          {meta === "creator" ? series.creator : `${series.creator} · ${loc.genre(series.genre)}`}
        </p>
        {footer !== undefined ? (
          footer
        ) : hook || meta === "creator" ? null : (
          <p className="flex items-center gap-1 text-[13px] leading-[18px] text-muted-foreground tabular-nums max-md:text-xs">
            <HeartIcon className="size-3" aria-hidden />
            <span aria-label={t("likes", { count: series.likes })}><Num>{series.likes}</Num></span>
          </p>
        )}
      </div>
    </Link>
  )

  // Cards above the fold (priority) render visible at once so they never flash or delay LCP.
  if (priority) return card
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView inViewMargin="0px 0px -40px 0px">
      {card}
    </Effect>
  )
}
