import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="container max-w-2xl flex flex-col gap-8 py-8" aria-busy="true" aria-hidden>
      <Skeleton className="h-9 w-36" />

      {/* Profile Section */}
      <section className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface-panel p-5">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-20 rounded-control" />
        </div>
      </section>

      {/* Appearance Section */}
      <section className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface-panel p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-control" />
          <Skeleton className="h-16 rounded-control" />
          <Skeleton className="h-16 rounded-control" />
        </div>
      </section>

      {/* Language Section */}
      <section className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface-panel p-5">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
        </div>
      </section>

      {/* Reading Section */}
      <section className="flex flex-col gap-4 rounded-card border border-surface-border bg-surface-panel p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full rounded-control" />
      </section>
    </div>
  )
}

