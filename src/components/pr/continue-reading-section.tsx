"use client"

import { ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { ContinueCard } from "@/components/pr/continue-card"
import { SectionHeader } from "@/components/pr/section-header"
import { SkeletonRow } from "@/components/pr/skeletons"
import type { ContinueView } from "@/data"
import { Link } from "@/i18n/navigation"
import { useAppStore } from "@/lib/store"

/**
 * Continue reading: the demo entries, with the episode replaced by `lastRead`
 * when the reader has gone further (Assumption 8). Hidden when empty.
 */
export function ContinueReadingSection({ entries }: { entries: ContinueView[] }) {
  const t = useTranslations("home")
  const loggedIn = useAppStore((s) => s.user !== null)
  const lastRead = useAppStore((s) => s.lastRead)

  if (entries.length === 0) return null

  return (
    <section aria-labelledby="continue-title" className="flex flex-col gap-5">
      <SectionHeader
        id="continue-title"
        title={t("continueTitle")}
        subtitle={t(loggedIn ? "continueLoggedIn" : "continueLoggedOut")}
        action={
          <Link
            href="/library"
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("myLibrary")}
            <ChevronRightIcon className="size-4" aria-hidden />
          </Link>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {entries.map((entry) => {
          const further = lastRead[entry.seriesData.id] ?? 0
          return (
            <ContinueCard
              key={entry.series}
              series={entry.seriesData}
              episode={Math.max(entry.episode, further)}
              progress={entry.progress}
            />
          )
        })}
      </div>
    </section>
  )
}

export function ContinueReadingSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-card border p-3">
            <SkeletonRow thumb="h-16 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
