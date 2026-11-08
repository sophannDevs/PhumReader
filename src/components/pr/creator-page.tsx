"use client"

import { BanknoteIcon, ListIcon, LogInIcon, PenLineIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { BecomeCreatorDialog } from "@/components/pr/become-creator-dialog"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { RankRow } from "@/components/pr/rank-row"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useCreator } from "@/lib/queries"
import { useAppStore, useUser } from "@/lib/store"

const statCard = "flex flex-col gap-1 rounded-card border bg-card p-5 shadow-xs"

/** Creator dashboard (demo): stat cards, the stand-in creator's series, guidelines and earnings. */
export function CreatorPage() {
  const t = useTranslations("creator")
  const tt = useTranslations("toasts")
  const user = useUser()
  const pathname = usePathname()
  const query = useCreator()
  const router = useRouter()
  const [becoming, setBecoming] = useState(false)

  if (!user) {
    return (
      <div className="container py-10">
        <p className="type-eyebrow">{t("eyebrow")}</p>
        <h1 className="type-h1">{t("title")}</h1>
        <EmptyState
          icon={LogInIcon}
          title={t("loginTitle")}
          description={t("loginDesc")}
          className="py-16"
          action={
            <Button asChild variant="brand" size="lg">
              <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
                {t("login")}
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const stats = [
    { label: t("statSeries"), value: query.data ? String(query.data.series.length) : "…" },
    { label: t("statReaders"), value: query.data?.totals.views ?? "…" },
    { label: t("statLikes"), value: query.data?.totals.likes ?? "…" },
    { label: t("statEarnings"), value: query.data?.earnedCoins === undefined ? t("amount") : t("coinsAmount", { count: query.data.earnedCoins }) },
  ]
  const guidelines = [1, 2, 3] as const

  return (
    <div className="container flex flex-col gap-10 py-8 md:py-10">
      <header className="flex flex-col items-start gap-3">
        <p className="type-eyebrow">{t("eyebrow")}</p>
        <h1 className="type-h1">{t("title")}</h1>
        <p className="type-lead max-w-2xl">{t("intro")}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {DEMO_MODE ? (
            <Button variant="brand" size="lg" onClick={() => toast.success(tt("publishingSoon"))}>
              <PenLineIcon />
              {t("start")}
            </Button>
          ) : query.data?.isCreator ? (
            <Button asChild variant="brand" size="lg">
              <Link href="/creator/series/new">
                <PenLineIcon />
                {t("start")}
              </Link>
            </Button>
          ) : (
            <Button variant="brand" size="lg" disabled={query.isPending} onClick={() => setBecoming(true)}>
              <PenLineIcon />
              {t("start")}
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/creator/series">
              <ListIcon />
              {t("mySeries")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#guidelines">{t("guidelines")}</a>
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((s) => (
          <div key={s.label} className={statCard}>
            <dt className="type-small font-normal text-muted-foreground">{s.label}</dt>
            <dd className="text-2xl leading-8 font-bold tracking-tight tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="your-series-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="your-series-title" className="type-h2">
            {t("yourSeries")}
          </h2>
          {query.data?.name ? <p className="type-body text-muted-foreground">{t(DEMO_MODE ? "yourSeriesDesc" : "yourSeriesOwn", { name: query.data.name })}</p> : null}
        </div>
        {query.isPending ? (
          <div className="flex flex-col gap-4 rounded-card border p-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} thumb="h-[52px] w-10" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : query.data.series.length === 0 ? (
          <div className="rounded-card border bg-card">
            <EmptyState
              icon={PenLineIcon}
              title={t("empty")}
              description={t("emptyDesc")}
              action={
                DEMO_MODE ? undefined : (
                  <Button asChild variant="brand">
                    <Link href="/creator/series/new">
                      {t("startPublishing")}
                    </Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="rounded-card border bg-card p-2 shadow-xs">
            {query.data.series.map((s, i) => (
              <RankRow key={s.id} rank={i + 1} series={s} movement="—" />
            ))}
          </div>
        )}
      </section>

      <section id="guidelines" aria-labelledby="guidelines-title" className="flex scroll-mt-24 flex-col gap-3">
        <h2 id="guidelines-title" className="type-h2">
          {t("guidelines")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {guidelines.map((n) => (
            <div key={n} className={statCard}>
              <h3 className="type-h4">{t(`g${n}Title`)}</h3>
              <p className="type-body text-muted-foreground">{t(`g${n}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {DEMO_MODE ? null : <BecomeCreatorDialog open={becoming} onOpenChange={setBecoming} onDone={() => router.push("/creator/series")} />}

      <section id="earnings" aria-labelledby="earnings-title" className="flex scroll-mt-24 flex-col gap-3">
        <h2 id="earnings-title" className="type-h2">
          {t("earnings")}
        </h2>
        <Alert variant="brand" role="status">
          <BanknoteIcon />
          <AlertTitle>{t("earningsTitle")}</AlertTitle>
          <AlertDescription>{t("earningsBody")}</AlertDescription>
        </Alert>
      </section>
    </div>
  )
}

