"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { initials } from "@/lib/format"
import { seriesHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { useLocalize } from "@/lib/localize"

const cardClass = "rounded-card border bg-card p-5 shadow-xs"

/** About the creator (Follow toggle) and You may also like (same genre). */
export function SeriesSidebar({
  series,
  related,
  creatorSeriesCount,
}: {
  series: Series
  related: Series[]
  creatorSeriesCount: number
}) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const tt = useTranslations("toasts")
  const following = useAppStore((s) => s.follows.includes(series.creator))

  return (
    <aside className="flex flex-col gap-4">
      <section aria-labelledby="creator-title" className={`${cardClass} flex flex-col gap-4`}>
        <h2 id="creator-title" className="type-h4">
          {t("creatorTitle")}
        </h2>
        <div className="flex items-center gap-3">
          <Avatar variant="brand" size="lg" className="size-11">
            <AvatarFallback>{initials(series.creator)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{series.creator}</span>
            <span className="type-caption font-normal text-muted-foreground">
              {t("seriesCount", { count: creatorSeriesCount })}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          aria-pressed={following}
          className="w-full"
          onClick={() => {
            useAppStore.getState().toggleFollow(series.creator)
            toast.success(tt(following ? "unfollowed" : "followed", { name: series.creator }))
          }}
        >
          {following ? t("following") : t("follow")}
        </Button>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className={`${cardClass} flex flex-col gap-4`}>
          <h2 id="related-title" className="type-h4">
            {t("related")}
          </h2>
          <ul className="flex flex-col gap-3">
            {related.map((s) => (
              <li key={s.id}>
                <Link
                  href={seriesHref(s)}
                  className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="relative h-[52px] w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image src={s.cover} alt="" width={80} height={104} sizes="40px" className="cover-zoom size-full object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="type-card-title truncate">{s.title}</span>
                    <span className="type-caption truncate font-normal text-muted-foreground">
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
  )
}
