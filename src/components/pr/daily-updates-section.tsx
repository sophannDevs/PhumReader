"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { ScrollRow } from "@/components/pr/scroll-row"
import { SectionEmpty } from "@/components/pr/section-empty"
import { SectionHeader } from "@/components/pr/section-header"
import { SeriesCard } from "@/components/pr/series-card"
import { SkeletonCard } from "@/components/pr/skeletons"
import { ViewAllLink } from "@/components/pr/view-all-link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Series, Weekday } from "@/data"
import { today, weekdayOf } from "@/lib/format"

const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const seriesGridClass = "grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5"

/** Daily updates: pill tabs Mon-Sun (today is labelled "Today" and selected) and a 6-card grid. */
export function DailyUpdatesSection({ daily }: { daily: Record<Weekday, Series[]> }) {
  const t = useTranslations("home")
  const todayDay = weekdayOf(today)
  const [day, setDay] = useState<Weekday>(todayDay)

  return (
    <section aria-labelledby="daily-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <SectionHeader
          action={<ViewAllLink href="/genres" label={t("viewAll")} />}
          id="daily-title"
          title={t("dailyTitle")}
          subtitle={t("dailySubtitle", { day: t(`dayFull.${todayDay}`) })}
        />
        <Tabs value={day} onValueChange={(v) => setDay(v as Weekday)} className="max-w-full">
          <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              {DAYS.map((d) => (
                <TabsTrigger key={d} value={d} className="px-3.5" aria-controls={undefined}>
                  {d === todayDay ? t("today") : t(`days.${d}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>
      {(daily[day] ?? []).length === 0 ? (
        <SectionEmpty />
      ) : (
        <ScrollRow itemClassName="w-[132px] sm:w-[160px] lg:w-[190px]">
          {daily[day].map((s) => (
            <SeriesCard key={s.id} series={s} sizes="190px" />
          ))}
        </ScrollRow>
      )}
    </section>
  )
}

export function DailyUpdatesSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className={seriesGridClass}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
