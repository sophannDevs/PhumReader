"use client"

import { TrendingUpIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { RankRow } from "@/components/pr/rank-row"
import { SectionEmpty } from "@/components/pr/section-empty"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RankingEntry } from "@/data"

/** Trending now card: pill tabs Comics / Web novels and 8 ranked rows with movement. */
export function TrendingSection({ comics, novels }: { comics: RankingEntry[]; novels: RankingEntry[] }) {
  const t = useTranslations("home")
  const [kind, setKind] = useState<"comics" | "novels">("comics")
  const rows = kind === "comics" ? comics : novels

  return (
    <section
      id="rank"
      aria-labelledby="trending-title"
      className="scroll-mt-24 rounded-card border bg-card p-5 shadow-xs md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="trending-title" className="type-h3 flex items-center gap-2">
            <TrendingUpIcon className="size-[18px]" aria-hidden />
            {t("trendingTitle")}
          </h2>
          <p className="type-small font-normal text-muted-foreground">{t("trendingSubtitle")}</p>
        </div>
        <Tabs value={kind} onValueChange={(v) => setKind(v as "comics" | "novels")}>
          <TabsList>
            <TabsTrigger value="comics" className="px-3.5">
              {t("comics")}
            </TabsTrigger>
            <TabsTrigger value="novels" className="px-3.5">
              {t("novels")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {rows.length === 0 ? (
        <SectionEmpty className="mt-4 rounded-card border border-dashed py-10" />
      ) : (
        <ol className="mt-4 flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.series.id}>
              <RankRow rank={r.rank} series={r.series} movement={r.movement} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function TrendingSkeleton() {
  return (
    <div className="rounded-card border p-6" aria-hidden>
      <div className="mb-5 h-6 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonRow key={i} thumb="h-[52px] w-10" />
        ))}
      </div>
    </div>
  )
}
