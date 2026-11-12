"use client"

import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { Button } from "@/components/ui/button"
import type { Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { initials } from "@/lib/format"
import { seriesHref } from "@/lib/routes"
import { useFollow } from "@/lib/me"
import { useLocalize } from "@/lib/localize"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

const cardClass = "rounded-card border bg-card shadow-xs"

/** About the creator (Follow toggle) and You may also like (same genre), prototype Series `<aside>`. */
export function SeriesSidebar({
  series,
  related,
  creatorSeriesCount,
  creatorId,
}: {
  series: Series
  related: Series[]
  creatorSeriesCount: number
  /** Real API: the id the Follow button needs. */
  creatorId?: string
}) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const { following, toggle: toggleFollow } = useFollow(series, creatorId)

  return (
    <Effect asChild fade slide={{ direction: "up", offset: 12 }} delay={150}>
      <aside aria-label={t("more")} className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="creator-title" className={cardClass}>
          <h2 id="creator-title" className="type-h4 px-5 pt-5 max-md:px-4 max-md:pt-4">
            {t("creatorTitle")}
          </h2>
          <div className="flex flex-col gap-3 p-5 max-md:p-4">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials(series.creator)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="type-h4 truncate">{series.creator}</span>
                <span className="text-xs leading-4 text-muted-foreground">{t("seriesCount", { count: creatorSeriesCount })}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" aria-pressed={following} className="w-full" onClick={() => void toggleFollow()}>
              {following ? t("following") : t("follow")}
            </Button>
          </div>
        </section>

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className={cardClass}>
            <h2 id="related-title" className="type-h4 px-5 pt-5 max-md:px-4 max-md:pt-4">
              {t("related")}
            </h2>
            <ul className="flex flex-col gap-1 px-5 pt-3 pb-5 max-md:px-4 max-md:pb-4">
              {related.map((s) => (
                <li key={s.id}>
                  <Link
                    href={seriesHref(s)}
                    className="group -mx-1.5 flex items-center gap-2.5 rounded-lg p-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Image src={s.cover} alt="" width={80} height={104} sizes="40px" className="h-[52px] w-10 shrink-0 rounded-md object-cover" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] leading-[18px] font-semibold">{s.title}</span>
                      <span className="truncate text-xs leading-4 text-muted-foreground">
                        {s.creator} · {loc.genre(s.genre)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </Effect>
  )
}
