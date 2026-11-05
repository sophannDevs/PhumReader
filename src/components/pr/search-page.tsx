"use client"

import { SearchIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SeriesCard } from "@/components/pr/series-card"
import { SkeletonCard } from "@/components/pr/skeletons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "@/i18n/navigation"
import { useSearchSeries } from "@/lib/queries"

const GRID = "grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5"

/** /search?q=: input prefilled from the URL (Enter updates it) and the matching series. */
export function SearchPage() {
  const t = useTranslations("search")
  const router = useRouter()
  const q = useSearchParams().get("q") ?? ""
  const [draft, setDraft] = useState(q)
  const query = useSearchSeries(q)

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-h1">{t("pageTitle")}</h1>
        <p className="type-lead">{t("pageSubtitle")}</p>
      </div>

      <form
        role="search"
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          router.push(draft.trim() ? `/search?q=${encodeURIComponent(draft.trim())}` : "/search")
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("pageTitle")}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="brand">
          {t("submit")}
        </Button>
      </form>

      {query.isPending ? (
        <div className={GRID} aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <section aria-live="polite" className="flex flex-col gap-4">
          <h2 className="type-h3">{q.trim() ? t("resultsFor", { count: query.data.length, q }) : t("popularHeading")}</h2>
          <div className={GRID}>
            {query.data.map((s) => (
              <SeriesCard key={s.id} series={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
