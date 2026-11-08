"use client"

import { CheckCircle2Icon, PenLineIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CreatorGate } from "@/components/pr/creator-gate"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import type { MySeries, Visibility } from "@/lib/api/creator"
import { useMySeries } from "@/lib/creator"
import { formatCount } from "@/lib/format"
import { useCreator } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"

type Filter = "" | Visibility
const FILTERS: Filter[] = ["", "published", "draft"]

/** The page header with the "Create series" button. */
function Header({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("creatorSeries")
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">{t("eyebrow")}</p>
        <h1 className="type-h1">{t("title")}</h1>
      </div>
      {DEMO_MODE ? (
        <Button variant="brand" size="lg" onClick={onCreate}>
          <PlusIcon />
          {t("create")}
        </Button>
      ) : (
        <Button asChild variant="brand" size="lg">
          <Link href="/creator/series/new">
            <PlusIcon />
            {t("create")}
          </Link>
        </Button>
      )}
    </header>
  )
}

/** "Series created" / "Episode published" with the next step (arrives as ?notice=…&series=<id>). */
function Notice() {
  const t = useTranslations("creatorSeries")
  const params = useSearchParams()
  const notice = params.get("notice")
  const id = params.get("series")
  if (!id || (notice !== "series-created" && notice !== "episode-added")) return null
  const created = notice === "series-created"
  return (
    <Alert variant="brand" role="status">
      <CheckCircle2Icon />
      <AlertTitle>{created ? t("noticeCreated") : t("noticeEpisode")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>{created ? t("noticeCreatedDesc") : t("noticeEpisodeDesc")}</span>
        <Button asChild variant="brand" size="sm">
          <Link href={`/creator/series/${id}/episodes/new`}>
            <PlusIcon />
            {created ? t("addFirst") : t("addAnother")}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function Row({ item }: { item: MySeries }) {
  const t = useTranslations("creatorSeries")
  const tt = useTranslations("toasts")
  const { series, visibility } = item
  const live = visibility === "published"
  const title = <span className="truncate font-semibold">{series.title}</span>
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 md:flex-nowrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={series.cover} alt={t("cover", { title: series.title })} className="h-[52px] w-10 shrink-0 rounded-md object-cover" />
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
        {live ? (
          <Link href={seriesHref(series)} className="min-w-0 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        <p className="type-small font-normal text-muted-foreground">
          {t(series.type === "novel" ? "typeNovel" : "typeComic")} · {t("episodes", { count: series.totalEpisodes })}
          {live ? ` · ${t("readers", { count: series.views })}` : ""}
          {live && !DEMO_MODE ? ` · ${t("subscribers", { count: formatCount(item.subscribers) })}` : ""}
        </p>
      </div>
      <Badge variant={visibility === "published" ? "brand" : visibility === "hidden" ? "danger" : "secondary"}>{t(`status_${visibility}`)}</Badge>
      <div className="ml-auto flex shrink-0 gap-2">
        {DEMO_MODE ? (
          <Button variant="outline" size="sm" onClick={() => toast.success(tt("publishingSoon"))}>
            <PlusIcon />
            {t("addEpisode")}
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/creator/series/${series.id}/episodes/new`}>
                <PlusIcon />
                {t("addEpisode")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/creator/series/${series.id}/edit`}>
                <PenLineIcon />
                {t("edit")}
              </Link>
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

export function CreatorSeriesSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card border p-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonRow key={i} thumb="h-[52px] w-10" />
      ))}
    </div>
  )
}

/** /creator/series: the creator's own series with search, a status filter, Create series and Add episode. */
export function CreatorSeriesPage() {
  const t = useTranslations("creatorSeries")
  return (
    <CreatorGate title={t("title")} eyebrow={t("eyebrow")}>
      <SeriesList />
    </CreatorGate>
  )
}

function SeriesList() {
  const t = useTranslations("creatorSeries")
  const tt = useTranslations("toasts")
  const dashboard = useCreator()
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("")

  // The search runs a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => setQ(search), 250)
    return () => clearTimeout(id)
  }, [search])

  const real = useMySeries({ q, visibility: filter }, true)

  // The demo shows the stand-in creator's series, filtered here; the real API filters on the server.
  const demoItems: MySeries[] = (dashboard.data?.series ?? [])
    .filter((s) => filter !== "draft" && s.title.toLowerCase().includes(q.trim().toLowerCase()))
    .map((series) => ({ series, visibility: "published", subscribers: 0, comments: 0 }))
  const items = DEMO_MODE ? demoItems : (real.data ?? [])
  const pending = DEMO_MODE ? dashboard.isPending : real.isPending
  const error = DEMO_MODE ? dashboard.isError : real.isError
  const filtering = q.trim() !== "" || filter !== ""

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <Header onCreate={() => toast.success(tt("publishingSoon"))} />
      <Notice />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="pl-9"
          />
        </div>
        <Tabs value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : (v as Filter))}>
          <TabsList aria-label={t("filterLabel")}>
            {FILTERS.map((f) => (
              <TabsTrigger key={f || "all"} value={f || "all"}>
                {t(`filter_${f || "all"}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {pending ? (
        <CreatorSeriesSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => void (DEMO_MODE ? dashboard : real).refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-card border bg-card">
          {filtering ? (
            <EmptyState icon={SearchIcon} title={t("noMatchTitle")} description={t("noMatchDesc")} />
          ) : (
            <EmptyState
              icon={PenLineIcon}
              title={t("emptyTitle")}
              description={t("emptyDesc")}
              action={
                DEMO_MODE ? undefined : (
                  <Button asChild variant="brand">
                    <Link href="/creator/series/new">
                      <PlusIcon />
                      {t("create")}
                    </Link>
                  </Button>
                )
              }
            />
          )}
        </div>
      ) : (
        <ul className="divide-y rounded-card border bg-card shadow-xs" aria-label={t("title")}>
          {items.map((item) => (
            <Row key={item.series.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}
