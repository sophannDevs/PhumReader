import { CoinsSkeleton } from "@/components/pr/coins-page"
import { Skeleton } from "@/components/ui/skeleton"

export default function CoinsLoading() {
  return (
    <div className="container flex flex-col gap-8 py-8" aria-busy="true" aria-hidden>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>

      {/* Balance card */}
      <Skeleton className="h-28 w-full rounded-card" />

      {/* Packs and methods */}
      <CoinsSkeleton />
    </div>
  )
}
