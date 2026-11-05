"use client"

import { useTranslations } from "next-intl"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SeriesCard } from "@/components/pr/series-card"
import { SkeletonCard } from "@/components/pr/skeletons"
import { toggleVariants } from "@/components/ui/toggle"
import { genres, type Genre } from "@/data"
import { Link } from "@/i18n/navigation"
import { useGenre } from "@/lib/queries"
import { genreHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"

const GRID = "grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5"

/** Genres: 8 chips (links, so the URL reflects the genre), "N series in <genre>" and the card grid. */
export function GenresPage({ genre }: { genre: Genre }) {
  const t = useTranslations("genresPage")
  const loc = useLocalize()
  const th = useTranslations("home")
  const query = useGenre(genre)

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-h1">{t("title")}</h1>
        <p className="type-lead">{query.data ? th("genreCount", { count: query.data.series.length, genre: loc.genre(genre) }) : " "}</p>
      </div>

      <nav aria-label={th("genres")} className="flex flex-wrap gap-2">
        {genres().map((g) => (
          <Link
            key={g}
            href={genreHref(g)}
            data-state={g === genre ? "on" : "off"}
            aria-current={g === genre ? "page" : undefined}
            className={cn(toggleVariants())}
          >
            {loc.genre(g)}
          </Link>
        ))}
      </nav>

      {query.isPending ? (
        <div className={GRID} aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.series.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyDesc")} />
      ) : (
        <div className={GRID}>
          {query.data.series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  )
}
