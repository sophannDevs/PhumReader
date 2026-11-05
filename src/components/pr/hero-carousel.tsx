"use client"

import { ArrowRightIcon, BookOpenIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, HeartIcon, PlusIcon, CheckIcon, UserIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import type { HeroSlideView } from "@/data"
import { Link } from "@/i18n/navigation"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type EmblaApi = Parameters<NonNullable<React.ComponentProps<typeof Carousel>["setApi"]>>[0]

const AUTOPLAY_MS = 7000

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(reducedMotionQuery)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedMotionQuery).matches, () => false)

/** Selected slide index, synced with Embla's `select` event. */
function useSelectedIndex(api: EmblaApi) {
  return useSyncExternalStore(
    (cb) => {
      api?.on("select", cb).on("reInit", cb)
      return () => {
        api?.off("select", cb).off("reInit", cb)
      }
    },
    () => api?.selectedScrollSnap() ?? 0,
    () => 0
  )
}

function SubscribeButton({ slide }: { slide: HeroSlideView }) {
  const t = useTranslations("home")
  const tt = useTranslations("toasts")
  const subscribed = useAppStore((s) => s.subscriptions.includes(slide.seriesData.id))

  return (
    <Button
      variant="outline"
      size="lg"
      aria-pressed={subscribed}
      className="border-surface-border-strong bg-surface-panel/60 text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface"
      onClick={() => {
        useAppStore.getState().toggleSubscription(slide.seriesData.id)
        if (subscribed) toast.success(tt("unsubscribed"))
        else toast.success(tt("subscribed", { title: slide.seriesData.title }))
      }}
    >
      {subscribed ? <CheckIcon /> : <PlusIcon />}
      {subscribed ? t("subscribed") : t("subscribe")}
    </Button>
  )
}

function Slide({ slide, priority }: { slide: HeroSlideView; priority: boolean }) {
  const t = useTranslations("home")
  const s = slide.seriesData

  return (
    <div className="relative isolate flex min-h-[560px] flex-col gap-6 overflow-hidden bg-surface px-5 pt-6 pb-20 text-surface-foreground md:min-h-[470px] md:flex-row md:items-center md:px-14 md:py-12">
      {/* Blurred cover as the backdrop */}
      <Image
        src={s.cover}
        alt=""
        fill
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="-z-20 scale-150 object-cover opacity-70 blur-[70px]"
        priority={priority}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-surface via-surface/70 to-transparent max-md:to-surface/50" />

      <div className="relative order-2 flex max-w-xl flex-1 flex-col items-start gap-4 md:order-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="new">{slide.tag}</Badge>
          <Badge variant="dark">{s.genre}</Badge>
        </div>
        <h2 className="type-hero">{s.title}</h2>
        <p className="type-lead text-surface-foreground/80">{slide.blurb}</p>
        <p className="type-small flex flex-wrap items-center gap-x-4 gap-y-1 font-normal text-surface-foreground/80 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="size-3.5" aria-hidden />
            {s.creator}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartIcon className="size-3.5" aria-hidden />
            {s.likes}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5" aria-hidden />
            {s.schedule}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button asChild variant="brand" size="lg">
            <Link href={readerHref(s, 1)}>
              <BookOpenIcon />
              {t(s.type === "novel" ? "readChapter" : "readEpisode")}
            </Link>
          </Button>
          <SubscribeButton slide={slide} />
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="text-surface-foreground hover:bg-surface-panel/60 hover:text-surface-foreground focus-visible:ring-offset-surface"
          >
            <Link href={seriesHref(s)}>
              {t("details")}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative order-1 shrink-0 max-md:w-36 md:order-2 md:mr-6 md:w-[270px]">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-card shadow-lg md:rotate-2">
          <Image
            src={s.cover}
            alt={s.title}
            width={540}
            height={720}
            priority={priority}
            className="size-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

/** Home hero: 3 slides, dots + arrows, autoplay every 7 s until any manual control is used. */
export function HeroCarousel({ slides }: { slides: HeroSlideView[] }) {
  const t = useTranslations("home")
  const [api, setApi] = useState<EmblaApi>()
  const [stopped, setStopped] = useState(false)
  const reduced = usePrefersReducedMotion()
  const index = useSelectedIndex(api)

  useEffect(() => {
    if (!api || stopped || reduced) return
    const id = setInterval(() => api.scrollNext(), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [api, stopped, reduced])

  // Dragging the slides counts as manual control too.
  useEffect(() => {
    if (!api) return
    const stop = () => setStopped(true)
    api.on("pointerDown", stop)
    return () => {
      api.off("pointerDown", stop)
    }
  }, [api])

  const go = useCallback(
    (fn: () => void) => {
      setStopped(true)
      fn()
    },
    []
  )

  return (
    <section className="relative">
      <div
        className="overflow-hidden rounded-[16px] md:rounded-hero"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") setStopped(true)
        }}
      >
        <Carousel opts={{ loop: true }} setApi={setApi} aria-label={t("heroLabel")}>
          <CarouselContent className="ml-0">
            {slides.map((slide, i) => (
              <CarouselItem
                key={slide.series}
                className="pl-0"
                aria-label={`${i + 1} / ${slides.length}`}
              >
                <Slide slide={slide} priority={i === 0} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <div className="pointer-events-none absolute inset-x-5 bottom-6 flex items-center justify-between md:inset-x-14">
        <div className="pointer-events-auto flex items-center gap-2" role="group" aria-label={t("heroControls")}>
          {slides.map((slide, i) => (
            <button
              key={slide.series}
              type="button"
              aria-label={t("goTo", { n: i + 1 })}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(() => api?.scrollTo(i))}
              className={cn(
                "h-2 rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                i === index ? "w-6 bg-primary" : "w-2 bg-surface-quiet/60 hover:bg-surface-quiet"
              )}
            />
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("prev")}
            onClick={() => go(() => api?.scrollPrev())}
            className="border-surface-border-strong bg-surface-panel/60 text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("next")}
            onClick={() => go(() => api?.scrollNext())}
            className="border-surface-border-strong bg-surface-panel/60 text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </section>
  )
}
