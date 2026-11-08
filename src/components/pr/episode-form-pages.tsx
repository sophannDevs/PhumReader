"use client"

import { LockIcon, SearchXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { CreatorGate } from "@/components/pr/creator-gate"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { EpisodeForm, type EpisodeSeries } from "@/components/pr/episode-form"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "@/i18n/navigation"
import { ApiError } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import { useEpisodeEdit, useMyEpisodes, useSeriesEdit } from "@/lib/creator"

function FormSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-5" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function Message({ icon: Icon, title, description }: { icon: typeof LockIcon; title: string; description: string }) {
  const t = useTranslations("episodeForm")
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={description}
      className="py-16"
      action={
        <Button asChild variant="outline">
          <Link href="/creator/series">{t("backToSeries")}</Link>
        </Button>
      }
    />
  )
}

/** The series the episode belongs to (403 and 404 explained), then the page body. */
function WithSeries({ id, heading, children }: { id: string; heading: (series: EpisodeSeries) => string; children: (series: EpisodeSeries) => React.ReactNode }) {
  const t = useTranslations("episodeForm")
  const query = useSeriesEdit(id)
  const status = query.error instanceof ApiError ? query.error.status : 0

  if (DEMO_MODE) return <Message icon={LockIcon} title={t("demoTitle")} description={t("demoDesc")} />
  if (query.isPending) return <FormSkeleton />
  if (status === 403) return <Message icon={LockIcon} title={t("notYoursTitle")} description={t("notYoursDesc")} />
  if (status === 404) return <Message icon={SearchXIcon} title={t("seriesNotFoundTitle")} description={t("seriesNotFoundDesc")} />
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  const s = query.data
  const series: EpisodeSeries = { id: s.id, slug: s.slug, title: s.title, type: s.type, visibility: s.visibility }
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/creator/series">{t("breadcrumbSeries")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/creator/series/${series.id}/edit`}>{series.title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{heading(series)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="type-h1">{heading(series)}</h1>
      {children(series)}
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="container py-8 md:py-10">{children}</div>
}

/** The next free number comes from the series' episodes (any status). */
function NewEpisode({ series }: { series: EpisodeSeries }) {
  const episodes = useMyEpisodes(series.id)
  // "Upload another" starts a blank form that suggests the number after the one just saved.
  const [again, setAgain] = useState<{ key: number; next: number | null }>({ key: 0, next: null })
  if (episodes.isPending) return <FormSkeleton />
  if (episodes.isError) return <ErrorState onRetry={() => void episodes.refetch()} />
  const next = again.next ?? Math.max(0, ...episodes.data.map((e) => e.number)) + 1
  return <EpisodeForm key={again.key} series={series} nextNumber={next} onAnother={(saved) => setAgain((a) => ({ key: a.key + 1, next: saved + 1 }))} />
}

/** /creator/series/[id]/episodes/new */
export function NewEpisodePage({ id }: { id: string }) {
  const t = useTranslations("episodeForm")
  return (
    <CreatorGate title={t("newTitle_comic")} eyebrow={t("eyebrow")}>
      <Frame>
        <WithSeries id={id} heading={(s) => t(s.type === "comic" ? "newTitle_comic" : "newTitle_novel")}>
          {(series) => <NewEpisode series={series} />}
        </WithSeries>
      </Frame>
    </CreatorGate>
  )
}

function EditEpisode({ series, n }: { series: EpisodeSeries; n: number }) {
  const t = useTranslations("episodeForm")
  const query = useEpisodeEdit(series.id, n)
  const status = query.error instanceof ApiError ? query.error.status : 0
  if (query.isPending) return <FormSkeleton />
  if (status === 404) return <Message icon={SearchXIcon} title={t("episodeNotFoundTitle")} description={t("episodeNotFoundDesc")} />
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  return <EpisodeForm key={query.data.number} series={series} initial={query.data} nextNumber={n} onAnother={() => undefined} />
}

/** /creator/series/[id]/episodes/[n]/edit */
export function EditEpisodePage({ id, n }: { id: string; n: number }) {
  const t = useTranslations("episodeForm")
  return (
    <CreatorGate title={t("editTitle_comic")} eyebrow={t("eyebrow")}>
      <Frame>
        <WithSeries id={id} heading={(s) => t(s.type === "comic" ? "editTitle_comic" : "editTitle_novel", { n })}>
          {(series) => <EditEpisode series={series} n={n} />}
        </WithSeries>
      </Frame>
    </CreatorGate>
  )
}
