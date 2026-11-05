"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { SectionEmpty } from "@/components/pr/section-empty"
import { SectionHeader } from "@/components/pr/section-header"
import { SeriesCard } from "@/components/pr/series-card"
import { SkeletonCard } from "@/components/pr/skeletons"
import { Toggle } from "@/components/ui/toggle"
import type { Genre, Series } from "@/data"

const GRID = "grid grid-cols-3 gap-3 md:gap-4 lg:gap-5"

/** Browse by genre: 8 round chips (one selected), "N series in <genre>", 3 x 2 grid. */
export function GenreSection({ genres, byGenre }: { genres: Genre[]; byGenre: Record<Genre, Series[]> }) {
  const t = useTranslations("home")
  const [genre, setGenre] = useState<Genre>(genres.includes("Fantasy") ? "Fantasy" : genres[0])
  const list = byGenre[genre] ?? []

  return (
    <section id="genres" aria-labelledby="genre-title" className="scroll-mt-24 flex flex-col gap-4">
      <SectionHeader
        id="genre-title"
        title={t("genreTitle")}
        subtitle={t("genreCount", { count: list.length, genre })}
      />
      <div role="group" aria-label={t("genres")} className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <Toggle key={g} pressed={g === genre} onPressedChange={() => setGenre(g)}>
            {g}
          </Toggle>
        ))}
      </div>
      {list.length === 0 ? (
        <SectionEmpty />
      ) : (
        <div className={GRID}>
          {list.slice(0, 6).map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </section>
  )
}

export function GenreSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
