"use client"

import { useQueries } from "@tanstack/react-query"
import { CheckIcon, PlusIcon } from "lucide-react"
import { useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { genres, type Series } from "@/data"
import * as real from "@/lib/api/catalog"
import { DEMO_MODE } from "@/lib/api/config"
import * as demo from "@/lib/demo-api"
import { parseCount } from "@/lib/format"
import { useAskToLogin, useSubscribe } from "@/lib/me"
import { useDemoFlag } from "@/lib/queries"
import { useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Pieces shared by the browse pages (Search §7, Rankings §10, Genres / Web novels §11):
 * - LineTabs: the prototype's `.line-tabs` (underlined tabs with an optional count badge, arrow keys move)
 * - SubscribeButton: "+ Subscribe" / "✓ Subscribed" (or "+ Add" / "✓ Added"); logged-out readers are asked to log in
 * - useCatalog: every series, from the per-genre catalog query (same cache as `useGenre`)
 * - replaceQuery: changes the URL's query without a navigation (Next.js keeps useSearchParams in sync)
 * - seedOf / likesOf / viewsOf: stable numbers for the prototype's demo orderings
 */

export function LineTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idBase,
  className,
}: {
  items: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  label: string
  /** Tab ids are `${idBase}-tab-${value}`; they control `${idBase}-panel`. */
  idBase: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const n = items.length
    const j =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1
    if (j < 0) return
    e.preventDefault()
    onChange(items[j].value)
    refs.current[j]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b [scrollbar-width:none]", className)}>
      {items.map((it, i) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`${idBase}-tab-${it.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              on && "border-foreground text-foreground"
            )}
          >
            {it.label}
            {it.count !== undefined ? (
              <Badge variant="secondary" className="tabular-nums">
                {it.count}
              </Badge>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Subscribe toggle for a list row. The state shows once the stored state is loaded (no hydration mismatch). */
export function SubscribeButton({
  series,
  labels,
  ariaOn,
  ariaOff,
  filled = false,
  className,
}: {
  series: Series
  /** [not subscribed, subscribed] */
  labels: [string, string]
  /** aria-labels: "Unsubscribe from …" / "Subscribe to …" */
  ariaOn: string
  ariaOff: string
  /** Subscribed rows use the grey `secondary` button (Rankings) instead of the outline one (Search). */
  filled?: boolean
  className?: string
}) {
  const { subscribed: stored, toggle } = useSubscribe(series)
  const hydrated = useHydrated()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const subscribed = hydrated && stored
  return (
    <Button
      type="button"
      size="sm"
      variant={subscribed && filled ? "secondary" : "outline"}
      aria-pressed={subscribed}
      aria-label={subscribed ? ariaOn : ariaOff}
      onClick={() => (user ? void toggle() : askToLogin())}
      className={cn("shrink-0", className)}
    >
      {subscribed ? <CheckIcon className="size-3.5" aria-hidden /> : <PlusIcon className="size-3.5" aria-hidden />}
      {subscribed ? labels[1] : labels[0]}
    </Button>
  )
}

/** Every series (all genres), in catalog order. Uses the same query keys as `useGenre`, so pages share the cache. */
export function useCatalog() {
  const flag = useDemoFlag()
  const fetchGenre = DEMO_MODE ? demo.fetchGenre : real.fetchGenre
  const results = useQueries({
    queries: genres().map((g) => ({ queryKey: ["genre", g, flag], queryFn: () => fetchGenre(g) })),
  })
  const seen = new Set<string>()
  const series = results
    .flatMap((r) => r.data?.series ?? [])
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => seedOf(a.id) - seedOf(b.id))
  return {
    series,
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),
    refetch: () => results.forEach((r) => (r.isError ? void r.refetch() : undefined)),
  }
}

/** Sets (or removes, for null) query params in place: no navigation, no route loading state. */
export function replaceQuery(next: Record<string, string | null>) {
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(next)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
}

/** The demo's "S12" -> 12 (the prototype's pool order); other ids get a stable number from a small hash. */
export function seedOf(id: string): number {
  const m = /^S(\d+)$/.exec(id)
  if (m) return Number(m[1])
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 997) + 1
}

export const likesOf = (s: Series) => parseCount(s.likes)
export const viewsOf = (s: Series) => parseCount(s.views)
