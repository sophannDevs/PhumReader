"use client"

import { ChevronRightIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { ContinueCard } from "@/components/pr/continue-card"
import { SkeletonRow } from "@/components/pr/skeletons"
import { phoneSwipeRow, SectionHead } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import type { ContinueView } from "@/data"
import { Link } from "@/i18n/navigation"
import { useContinueEntries } from "@/lib/me"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Continue reading (spec §1): 4 cards (2 on tablets, a swipe row on phones). The demo entries, with the episode
 * replaced by `lastRead` when the reader has gone further (V1 Assumption 8). Hidden when empty.
 */
export function ContinueReadingSection({ entries: demoEntries }: { entries: ContinueView[] }) {
  const entries = useContinueEntries(demoEntries)
  const t = useTranslations("home")
  const loggedIn = useAppStore((s) => s.user !== null)
  const lastRead = useAppStore((s) => s.lastRead)

  if (entries.length === 0) return null

  return (
    <section aria-labelledby="cr-h" className="flex flex-col gap-3.5">
      <SectionHead
        id="cr-h"
        title={t("continueTitle")}
        subtitle={t(loggedIn ? "continueLoggedIn" : "continueLoggedOut")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/library">
              {t("myLibrary")}
              <ChevronRightIcon className="size-3.5" />
            </Link>
          </Button>
        }
      />
      <div
        className={cn(
          "grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4",
          phoneSwipeRow,
          "max-md:auto-cols-[82%]"
        )}
      >
        {entries.map((entry) => (
          <ContinueCard
            key={entry.series}
            series={entry.seriesData}
            episode={Math.max(entry.episode, lastRead[entry.seriesData.id] ?? 0)}
            progress={entry.progress}
          />
        ))}
      </div>
    </section>
  )
}

export function ContinueReadingSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className={cn("grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4", phoneSwipeRow, "max-md:auto-cols-[82%]")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-card border p-2.5">
            <SkeletonRow thumb="h-16 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
