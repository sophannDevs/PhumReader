import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { SeriesPage, SeriesSkeleton } from "@/components/pr/series-page"
import { getSeries, getSeriesBySlug } from "@/data"
import { routing } from "@/i18n/routing"
import { DEMO_MODE } from "@/lib/api/config"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => getSeries().map((s) => ({ locale, slug: s.slug })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/series/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const series = getSeriesBySlug(slug)
  return series ? { title: series.title, description: `${series.title} by ${series.creator}` } : {}
}

async function SeriesContent({ params }: { params: PageProps<"/[locale]/series/[slug]">["params"] }) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  // Unknown slugs 404 right away (the static selector, not the fake API). With the real API the page asks
  // the API, because series made by creators are not in the demo data.
  if (DEMO_MODE && !getSeriesBySlug(slug)) notFound()
  return <SeriesPage slug={slug} />
}

export default function Page({ params }: PageProps<"/[locale]/series/[slug]">) {
  return (
    <Suspense fallback={<SeriesSkeleton />}>
      <SeriesContent params={params} />
    </Suspense>
  )
}
