"use client"

import { HeroCarousel } from "@/components/pr/hero-carousel"
import { ErrorState } from "@/components/pr/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useHome } from "@/lib/queries"

/** Home page body. Sections are added one task at a time (T20-T23); T46 completes their states. */
export function HomeContent() {
  const home = useHome()

  return (
    <div className="container flex flex-col gap-14 pt-6">
      {home.isPending ? (
        <Skeleton className="h-[560px] rounded-[16px] md:h-[470px] md:rounded-hero" />
      ) : home.isError ? (
        <ErrorState onRetry={() => void home.refetch()} />
      ) : home.data.hero.length > 0 ? (
        <HeroCarousel slides={home.data.hero} />
      ) : null}
    </div>
  )
}
