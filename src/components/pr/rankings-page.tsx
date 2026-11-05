"use client"

import { TrophyIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { RankRow } from "@/components/pr/rank-row"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRankings } from "@/lib/queries"

/** Rankings: pill tabs Comics / Web novels and the full numbered list. */
export function RankingsPage() {
  const t = useTranslations("rankings")
  const th = useTranslations("home")
  const [kind, setKind] = useState<"comics" | "novels">("comics")
  const query = useRankings(kind)

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h1">{t("title")}</h1>
          <p className="type-lead">{t("subtitle")}</p>
        </div>
        <Tabs value={kind} onValueChange={(v) => setKind(v as "comics" | "novels")}>
          <TabsList>
            <TabsTrigger value="comics" className="px-4">
              {th("comics")}
            </TabsTrigger>
            <TabsTrigger value="novels" className="px-4">
              {th("novels")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-card border bg-card p-2 shadow-xs md:p-4">
        {query.isPending ? (
          <div className="flex flex-col gap-4 p-2" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonRow key={i} thumb="h-[52px] w-10" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState icon={TrophyIcon} title={t("empty")} description={t("emptyDesc")} />
        ) : (
          <ol className="flex flex-col gap-1">
            {query.data.map((r) => (
              <li key={r.series.id}>
                <RankRow rank={r.rank} series={r.series} movement={r.movement} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
