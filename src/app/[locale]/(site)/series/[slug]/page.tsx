import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { SeriesPage } from "@/components/pr/series-page"
import { getSeries, getSeriesBySlug } from "@/data"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => getSeries().map((s) => ({ locale, slug: s.slug })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/series/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const series = getSeriesBySlug(slug)
  return series ? { title: series.title, description: `${series.title} by ${series.creator}` } : {}
}

export default async function Page({ params }: PageProps<"/[locale]/series/[slug]">) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  // Unknown slugs 404 right away (the static selector, not the fake API).
  if (!getSeriesBySlug(slug)) notFound()
  return <SeriesPage slug={slug} />
}
