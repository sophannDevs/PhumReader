"use client"

import { PenLineIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { Eyebrow, SectionHead } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { seriesHref } from "@/lib/routes"

/** Web novels (spec §1, prototype `.nv-grid`): 6 cards in 3 columns; two swipe rows on phones. */
export function NovelsSection({ novels }: { novels: Series[] }) {
  const t = useTranslations("home")
  const loc = useLocalize()
  if (novels.length === 0) return null

  return (
    <section id="novels" aria-labelledby="nv-h" className="flex scroll-mt-20 flex-col gap-4">
      <SectionHead id="nv-h" size="h2" title={t("novelsTitle")} subtitle={t("novelsSub")} />
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-3 max-md:-mx-4 max-md:auto-cols-[86%] max-md:grid-flow-col max-md:grid-cols-none max-md:grid-rows-2 max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&>*]:snap-start">
        {novels.slice(0, 6).map((s) => (
          <Link
            key={s.id}
            href={seriesHref(s)}
            className="flex items-center gap-3.5 rounded-card border bg-card p-3 shadow-xs transition-colors outline-none hover:border-border-hover hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="relative aspect-[3/4] w-[84px] shrink-0 overflow-hidden rounded-[10px] bg-muted">
              <Image src={s.cover} alt="" fill sizes="84px" className="object-cover" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <Badge variant="secondary" className="self-start">
                {loc.genre(s.genre)}
              </Badge>
              <span className="truncate text-[15px] leading-[22px] font-semibold">{s.title}</span>
              <span className="line-clamp-2 text-[12.5px] leading-[17px] text-soft-foreground">{loc.hook(s)}</span>
              <span className="text-xs leading-4 text-muted-foreground">
                {t("chaptersMeta", { creator: s.creator, count: s.freeEpisodes })}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Creator call-to-action (prototype `.cta`): green-to-white card, three covers on wide screens. */
export function CreatorCta({ covers }: { covers: Series[] }) {
  const t = useTranslations("home")
  return (
    <section aria-labelledby="cta-h">
      <div className="flex items-center justify-between gap-8 rounded-card border bg-[linear-gradient(120deg,#f0fdf5_0%,#ffffff_60%)] dark:bg-[image:linear-gradient(120deg,var(--brand-wash-from)_0%,var(--brand-wash-to)_60%)] px-10 py-8 shadow-xs max-md:px-5 max-md:py-6">
        <div className="flex max-w-[520px] flex-col gap-2">
          <Eyebrow>{t("ctaEyebrow")}</Eyebrow>
          <h2 id="cta-h" className="type-h2">
            {t("ctaTitle")}
          </h2>
          <p className="text-[15px] leading-6 text-muted-foreground">{t("ctaBody")}</p>
          <div className="flex flex-wrap gap-2 pt-1.5">
            <Button asChild variant="brand">
              <Link href="/creators/join">
                <PenLineIcon className="size-3.5" />
                {t("ctaStart")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/legal/creator">{t("ctaGuidelines")}</Link>
            </Button>
          </div>
        </div>
        <div aria-hidden className="hidden gap-3 min-[1100px]:flex">
          {covers.slice(0, 3).map((s, i) => (
            <span
              key={s.id}
              className="relative aspect-[3/4] w-24 overflow-hidden rounded-[10px] shadow-md"
              style={i === 1 ? { transform: "translateY(14px)" } : undefined}
            >
              <Image src={s.cover} alt="" fill sizes="96px" className="object-cover" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
