"use client"

import { Button } from "@/components/ui/button"
import { useDemoFlag, useEpisodes, useHome, useSeries } from "@/lib/queries"

/** Dev-only probe for the fake API + TanStack Query hooks. Deleted in T53. */
export function KitQueries() {
  const flag = useDemoFlag()
  const series = useSeries("glass-compass")
  const episodes = useEpisodes("glass-compass")
  const home = useHome()

  const line = (label: string, q: { status: string; data?: unknown; isFetching: boolean }, summary: string) => (
    <li className="flex flex-wrap gap-x-3" data-query={label} data-status={q.status} data-fetching={q.isFetching}>
      <span className="font-semibold">{label}</span>
      <span data-slot="status">{q.status}</span>
      <span className="text-muted-foreground" data-slot="summary">
        {summary}
      </span>
    </li>
  )

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">Fake API</h2>
      <p className="type-body text-muted-foreground">
        Add <code>?demo=empty</code>, <code>?demo=error</code> or <code>?demo=slow</code> to the URL. Active flag:{" "}
        <b data-slot="flag">{flag ?? "none"}</b>
      </p>
      <ul className="flex flex-col gap-1 rounded-card border bg-card p-4 text-sm shadow-xs">
        {line("useSeries", series, series.data ? `${series.data.series.title} · ${series.data.stats.subscribers} subscribers` : series.error ? String(series.error) : "")}
        {line("useEpisodes", episodes, episodes.data ? `${episodes.data.length} episodes` : episodes.error ? String(episodes.error) : "")}
        {line(
          "useHome",
          home,
          home.data
            ? `${home.data.hero.length} hero, ${home.data.continueReading.length} continue, ${home.data.rankings.comics.length} ranked`
            : home.error
              ? String(home.error)
              : ""
        )}
      </ul>
      <div>
        <Button variant="outline" size="sm" onClick={() => { void series.refetch(); void episodes.refetch(); void home.refetch() }}>
          Refetch
        </Button>
      </div>
    </section>
  )
}
