"use client"

import { ArrowRightIcon } from "@/components/animate-ui/icons/arrow-right"
import { BookOpenIcon } from "@/components/animate-ui/icons/book-open"
import { CalendarIcon } from "@/components/animate-ui/icons/calendar"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { UserIcon } from "@/components/animate-ui/icons/user"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ParticleBurst, useBurstOnPress } from "@/components/pr/particle-burst"
import { Skeleton } from "@/components/ui/skeleton"
import type { HeroSlideView } from "@/data"
import { Link } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { useSubscribe } from "@/lib/me"
import { readerHref, seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/**
 * Home spotlight (spec §1, prototype Home `.sp`): the main pick and a "Featured this week" list with every pick
 * visible. No autoplay; choosing a pick swaps the main card. Tablet: the list becomes a row; phone: round pills.
 */
export function Spotlight({ slides }: { slides: HeroSlideView[] }) {
  const t = useTranslations("home")
  const loc = useLocalize()
  const [index, setIndex] = useState(0)
  const slide = slides[Math.min(index, slides.length - 1)]
  if (!slide) return null

  return (
    <section aria-labelledby="sp-h">
      <h2 id="sp-h" className="sr-only">
        {t("featured")}
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <SpotlightMain slide={slide} />
        <div
          role="tablist"
          aria-label={t("featured")}
          className="flex gap-2 rounded-[20px] border bg-background p-2 max-md:overflow-x-auto max-md:border-0 max-md:p-0 max-md:[scrollbar-width:none] min-[1100px]:flex-col min-[1100px]:p-3"
        >
          <span className="type-eyebrow hidden px-1 pt-1 pb-0.5 min-[1100px]:block">{t("featured")}</span>
          {slides.map((s, i) => {
            const on = i === index
            return (
              <button
                key={s.series}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setIndex(i)}
                className={cn(
                  "flex min-w-0 flex-1 basis-0 items-center gap-3 rounded-card border p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "max-md:w-auto max-md:flex-none max-md:basis-auto max-md:rounded-full max-md:border-border max-md:py-1.5 max-md:pr-2.5 max-md:pl-1.5",
                  on ? "border-[#bbf0d0] bg-brand-soft" : "border-transparent hover:bg-accent"
                )}
              >
                <Image
                  src={s.seriesData.cover}
                  alt=""
                  width={112}
                  height={148}
                  sizes="56px"
                  className="h-[74px] w-14 shrink-0 rounded-control object-cover max-md:size-7 max-md:rounded-full"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs leading-4 font-semibold text-brand-ink max-md:hidden">{loc.tag(s.tag)}</span>
                  <span className="truncate text-[15px] leading-[22px] font-semibold max-md:text-[13px] max-md:leading-[18px]">
                    {s.seriesData.title}
                  </span>
                  <span className="truncate text-xs leading-4 text-muted-foreground max-md:hidden">
                    {t("pickMeta", { genre: loc.genre(s.seriesData.genre), likes: s.seriesData.likes })}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SpotlightMain({ slide }: { slide: HeroSlideView }) {
  const t = useTranslations("home")
  const loc = useLocalize()
  const s = slide.seriesData
  const novel = s.type === "novel"
  const { subscribed, toggle } = useSubscribe(s)
  const [subBurst, armSub] = useBurstOnPress(subscribed)

  return (
    <article
      aria-live="polite"
      className="relative flex min-h-[360px] items-center gap-8 overflow-hidden rounded-[20px] bg-[#09090b] px-12 py-10 text-[#fafafa] max-md:min-h-0 max-md:flex-col max-md:items-stretch max-md:rounded-[16px] max-md:p-0 max-md:pb-5"
    >
      <Image
        src={s.cover}
        alt=""
        fill
        sizes="(min-width: 768px) 900px, 100vw"
        priority
        className="object-cover opacity-45 blur-[40px] saturate-[1.3] max-md:!h-[58%] max-md:opacity-100 max-md:blur-none max-md:saturate-100 md:!-inset-10 md:!h-[calc(100%+80px)] md:!w-[calc(100%+80px)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.94)_0%,rgba(9,9,11,0.74)_60%,rgba(9,9,11,0.4)_100%)] max-md:bg-[linear-gradient(180deg,rgba(9,9,11,0.05)_0%,rgba(9,9,11,0.85)_44%,#09090b_66%)]"
      />
      <div className="relative z-[1] flex max-w-[540px] min-w-0 flex-auto flex-col gap-3 max-md:max-w-none max-md:gap-2.5 max-md:px-[18px] max-md:pt-[190px]">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="new">{loc.tag(slide.tag)}</Badge>
          <Badge variant="dark">{loc.genre(s.genre)}</Badge>
          <Badge variant="dark">{novel ? t("webNovel") : t("comic")}</Badge>
        </div>
        <h3 className="text-[44px] leading-[48px] font-bold tracking-[-0.03em] max-md:text-[28px] max-md:leading-8">{s.title}</h3>
        <p className="max-w-[46ch] text-base leading-[25px] text-[#d4d4d8] max-md:text-sm max-md:leading-[22px]">{slide.blurb}</p>
        <div className="flex flex-wrap items-center gap-3.5 text-xs leading-4 text-[#d4d4d8]">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3.5" aria-hidden />
            {s.creator}
          </span>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="size-3.5" aria-hidden />
            <span className="sr-only">{t("likesLabel")}</span>
            <Num>{s.likes}</Num>
          </span>
          {s.schedule ? (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3.5" aria-hidden />
              {loc.schedule(s)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-1.5">
          <Button asChild variant="brand" size="lg">
            <Link href={readerHref(s, 1)}>
              <BookOpenIcon />
              {novel ? t("startCh") : t("startEp")}
            </Link>
          </Button>
          <Button
            type="button"
            size="lg"
            aria-pressed={subscribed}
            onClick={() => {
              armSub()
              void toggle()
            }}
            className="border-white/20 bg-white/10 text-[#fafafa] hover:bg-white/[0.18]"
          >
            <ParticleBurst burst={subBurst}>{subscribed ? t("subscribed") : t("subscribe")}</ParticleBurst>
          </Button>
          <Button asChild variant="link" size="lg" className="text-[#fafafa] no-underline hover:text-white">
            <Link href={seriesHref(s)}>
              {t("details")}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
        <span className="text-xs leading-4 text-[#a1a1aa]">
          {t(novel ? "freeLineCh" : "freeLineEp", { n: s.freeEpisodes, fp: s.fastPassEpisodes })}
        </span>
      </div>
      <Link
        href={seriesHref(s)}
        aria-label={t("open", { title: s.title })}
        className="relative z-[1] ml-auto hidden aspect-[3/4] w-[220px] shrink-0 rotate-2 overflow-hidden rounded-[14px] shadow-[0_24px_60px_rgba(0,0,0,0.5)] transition-transform duration-300 outline-none hover:scale-[1.02] hover:rotate-0 focus-visible:ring-2 focus-visible:ring-ring md:block"
      >
        <Image src={s.cover} alt={t("coverAlt", { title: s.title })} fill sizes="220px" className="object-cover" />
      </Link>
    </article>
  )
}

export function SpotlightSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]" aria-hidden>
      <Skeleton className="h-[520px] rounded-[16px] md:h-[360px] md:rounded-[20px]" />
      <Skeleton className="h-12 rounded-full md:h-[90px] md:rounded-[20px] min-[1100px]:h-[360px]" />
    </div>
  )
}
