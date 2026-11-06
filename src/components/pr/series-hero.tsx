"use client"

import { BookOpenIcon, CalendarIcon, CheckIcon, ChevronRightIcon, PlusIcon, Share2Icon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type { Series } from "@/data"
import { initials } from "@/lib/format"
import { genreHref, readerHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { useLocalize } from "@/lib/localize"

const ghostDark =
  "border-surface-border-strong bg-surface-panel/60 text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface"

/** Which episode the main button opens: 1, or "Continue" from the last read one (Assumption 7). */
export function useContinueTarget(series: Series): { episode: number; continuing: boolean } {
  const lastRead = useAppStore((s) => s.lastRead[series.id] ?? 0)
  const unlocked = useAppStore((s) => s.unlocked[series.id])
  if (lastRead <= 0) return { episode: 1, continuing: false }
  const next = lastRead + 1
  const readable = next <= series.totalEpisodes && (next <= series.freeEpisodes || !!unlocked?.includes(next))
  return { episode: readable ? next : lastRead, continuing: true }
}

export function SeriesHero({
  series,
  synopsis,
  stats,
}: {
  series: Series
  synopsis: string
  stats: { subscribers: string; comments: string }
}) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const tt = useTranslations("toasts")
  const subscribed = useAppStore((s) => s.subscriptions.includes(series.id))
  const { episode, continuing } = useContinueTarget(series)
  const novel = series.type === "novel"

  const readLabel = continuing
    ? t(novel ? "continueChapter" : "continueEpisode", { n: episode })
    : t(novel ? "readChapter" : "readEpisode")

  const statItems = [
    { label: t("views"), value: series.views },
    { label: t("likes"), value: series.likes },
    { label: t("subscribers"), value: stats.subscribers },
    { label: t(novel ? "chapters" : "episodes"), value: String(series.totalEpisodes) },
  ]

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(tt("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }

  return (
    <div className="relative isolate overflow-hidden bg-surface text-surface-foreground">
      <Image
        src={series.cover}
        alt=""
        fill
        sizes="100vw"
        priority
        className="-z-20 scale-150 object-cover opacity-50 blur-[80px]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-surface/60 via-surface/70 to-surface/95" />

      <div className="container flex flex-col gap-6 pt-6 pb-8 md:gap-8 md:pt-8 md:pb-10">
        <nav aria-label={t("breadcrumb")}>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-surface-quiet">
            <li>
              <Link href="/" className="rounded-sm outline-none hover:text-surface-foreground focus-visible:ring-2 focus-visible:ring-ring">
                {t("home")}
              </Link>
            </li>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <li>
              <Link
                href={genreHref(series.genre)}
                className="rounded-sm outline-none hover:text-surface-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {loc.genre(series.genre)}
              </Link>
            </li>
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <li aria-current="page" className="text-surface-foreground">
              {series.title}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-5 md:flex-row md:gap-10">
          <div className="w-[132px] shrink-0 md:w-60">
            <div className="aspect-[3/4] overflow-hidden rounded-card bg-surface-panel shadow-lg">
              <Image
                src={series.cover}
                alt={`${series.title} cover`}
                width={480}
                height={640}
                priority
                className="size-full object-cover"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="dark">{loc.genre(series.genre)}</Badge>
              <Badge variant="dark">{t(novel ? "novel" : "comic")}</Badge>
              {series.schedule ? (
                <Badge variant="dark">
                  <CalendarIcon /> {loc.schedule(series.schedule)}
                </Badge>
              ) : null}
              <Badge variant="new">{t(series.status === "completed" ? "completed" : "ongoing")}</Badge>
            </div>
            <h1 className="type-series-title">{series.title}</h1>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Avatar size="sm" className="size-6">
                <AvatarFallback className="bg-surface-foreground text-[10px] font-semibold text-surface">
                  {initials(series.creator)}
                </AvatarFallback>
              </Avatar>
              {series.creator}
            </p>
            <p className="type-lead max-w-2xl text-surface-foreground/80">{synopsis}</p>

            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {statItems.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dd className="text-xl leading-7 font-bold tabular-nums">{s.value}</dd>
                  <dt className="type-small font-normal text-surface-quiet">{s.label}</dt>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="brand" size="lg">
                <Link href={readerHref(series, episode)}>
                  <BookOpenIcon />
                  {readLabel}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                aria-pressed={subscribed}
                className={ghostDark}
                onClick={() => {
                  useAppStore.getState().toggleSubscription(series.id)
                  if (subscribed) toast.success(tt("unsubscribed"))
                  else toast.success(tt("subscribed", { title: series.title }))
                }}
              >
                {subscribed ? <CheckIcon /> : <PlusIcon />}
                {subscribed ? t("subscribed") : t("subscribe")}
              </Button>
              <Button variant="outline" size="icon" className={`${ghostDark} size-11`} aria-label={t("share")} onClick={share}>
                <Share2Icon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
