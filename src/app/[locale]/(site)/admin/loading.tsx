import { SkeletonRow } from "@/components/pr/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminLoading() {
  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10" aria-busy="true" aria-hidden>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-44" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-96 max-w-full rounded-control" />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card border bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Admin list table */}
      <div className="flex flex-col gap-3 rounded-card border bg-card p-5">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-48 rounded-control" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonRow key={i} thumb="size-10" />
        ))}
      </div>
    </div>
  )
}

