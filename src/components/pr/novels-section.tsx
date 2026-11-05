"use client"

import { BookOpenIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { NovelCard } from "@/components/pr/novel-card"
import { SectionHeader } from "@/components/pr/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data"

const GRID = "grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"

/** Web novels: 6 NovelCards (3 columns on desktop, 1 on phones) and the reader badge. */
export function NovelsSection({ novels }: { novels: Series[] }) {
  const t = useTranslations("home")
  if (novels.length === 0) return null

  return (
    <section id="novels" aria-labelledby="novels-title" className="scroll-mt-24 flex flex-col gap-5">
      <SectionHeader
        id="novels-title"
        title={t("novelsTitle")}
        subtitle={t("novelsSubtitle")}
        action={
          <Badge variant="brand" className="hidden sm:inline-flex">
            <BookOpenIcon /> {t("novelsBadge")}
          </Badge>
        }
      />
      <div className={GRID}>
        {novels.map((s) => (
          <NovelCard key={s.id} series={s} />
        ))}
      </div>
    </section>
  )
}

export function NovelsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[138px] rounded-card" />
        ))}
      </div>
    </div>
  )
}
