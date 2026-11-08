import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ComicReader, ReaderSkeleton } from "@/components/pr/comic-reader"
import { episodesFor, getSeries, getSeriesBySlug } from "@/data"
import { redirect } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { fetchSeriesServer } from "@/lib/api/server"
import { routing } from "@/i18n/routing"

// Episode 1 of every comic is prerendered; other episodes render on request.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getSeries()
      .filter((s) => s.type === "comic")
      .map((s) => ({ locale, slug: s.slug, episode: "1" }))
  )
}

export async function generateMetadata({ params }: PageProps<"/[locale]/read/[slug]/[episode]">): Promise<Metadata> {
  "use cache"
  const { locale, slug, episode } = await params
  let series = getSeriesBySlug(slug)
  if (!series && !DEMO_MODE) {
    const detail = await fetchSeriesServer(slug).catch(() => null)
    if (detail) series = detail.series
  }
  if (!series) return {}
  const t = await getTranslations({ locale, namespace: "reader" })
  return { title: `${series.title} · ${t("episodeLabel", { n: episode })}` }
}

async function ComicContent({ params }: { params: PageProps<"/[locale]/read/[slug]/[episode]">["params"] }) {
  const { locale, slug, episode } = await params
  setRequestLocale(locale)

  const series = getSeriesBySlug(slug)
  const n = Number(episode)
  // The demo knows its series here; with the real API the page asks the API (series made by creators are not in the demo data).
  if (DEMO_MODE ? !series || !Number.isInteger(n) || n < 1 || n > episodesFor(slug).length : !Number.isInteger(n) || n < 1) notFound()
  // A web novel opened under /read goes to the novel reader.
  if (series?.type === "novel") redirect({ href: `/novel/${slug}/${n}`, locale })

  return <ComicReader slug={slug} n={n} />
}

export default async function Page({ params }: PageProps<"/[locale]/read/[slug]/[episode]">) {
  const { slug, episode } = await params
  const series = getSeriesBySlug(slug)
  const n = Number(episode)
  if (DEMO_MODE ? !series || !Number.isInteger(n) || n < 1 || n > episodesFor(slug).length : !Number.isInteger(n) || n < 1) notFound()
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <ComicContent params={params} />
    </Suspense>
  )
}
