"use client"

import { LockIcon, SearchXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CreatorGate } from "@/components/pr/creator-gate"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SeriesForm } from "@/components/pr/series-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { ApiError } from "@/lib/api/client"
import { useSeriesEdit } from "@/lib/creator"

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTranslations("seriesForm")
  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/creator/series">{t("breadcrumbSeries")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="type-h1">{title}</h1>
      {children}
    </div>
  )
}

/** The demo has no creator accounts, so there is nothing to save. */
function DemoNotice() {
  const t = useTranslations("seriesForm")
  return (
    <EmptyState
      icon={LockIcon}
      title={t("demoTitle")}
      description={t("demoDesc")}
      className="py-16"
      action={
        <Button asChild variant="outline">
          <Link href="/creator/series">{t("backToSeries")}</Link>
        </Button>
      }
    />
  )
}

/** /creator/series/new */
export function NewSeriesPage() {
  const t = useTranslations("seriesForm")
  return (
    <CreatorGate title={t("newTitle")} eyebrow={t("eyebrow")}>
      <Shell title={t("newTitle")}>{DEMO_MODE ? <DemoNotice /> : <SeriesForm />}</Shell>
    </CreatorGate>
  )
}

function EditLoader({ id }: { id: string }) {
  const t = useTranslations("seriesForm")
  const query = useSeriesEdit(id)
  const status = query.error instanceof ApiError ? query.error.status : 0

  if (DEMO_MODE) return <DemoNotice />
  if (query.isPending) {
    return (
      <div className="flex max-w-3xl flex-col gap-5" aria-hidden>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (status === 404 || status === 403) {
    return (
      <EmptyState
        icon={status === 403 ? LockIcon : SearchXIcon}
        title={t(status === 403 ? "notYoursTitle" : "notFoundTitle")}
        description={t(status === 403 ? "notYoursDesc" : "notFoundDesc")}
        className="py-16"
        action={
          <Button asChild variant="outline">
            <Link href="/creator/series">{t("backToSeries")}</Link>
          </Button>
        }
      />
    )
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  return <SeriesForm key={query.data.id} initial={query.data} />
}

/** /creator/series/[id]/edit */
export function EditSeriesPage({ id }: { id: string }) {
  const t = useTranslations("seriesForm")
  return (
    <CreatorGate title={t("editTitle")} eyebrow={t("eyebrow")}>
      <Shell title={t("editTitle")}>
        <EditLoader id={id} />
      </Shell>
    </CreatorGate>
  )
}
