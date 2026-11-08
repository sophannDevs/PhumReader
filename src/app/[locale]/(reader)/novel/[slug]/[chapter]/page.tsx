import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { NovelReader, NovelSkeleton } from "@/components/pr/novel-reader"
import { episodesFor, getSeries, getSeriesBySlug } from "@/data"
import { redirect } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { routing } from "@/i18n/routing"

// Chapter 1 of every novel is prerendered; other chapters render on request.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getSeries()
      .filter((s) => s.type === "novel")
      .map((s) => ({ locale, slug: s.slug, chapter: "1" }))
  )
}

export async function generateMetadata({ params }: PageProps<"/[locale]/novel/[slug]/[chapter]">): Promise<Metadata> {
  const { locale, slug, chapter } = await params
  const series = getSeriesBySlug(slug)
  if (!series) return {}
  const t = await getTranslations({ locale, namespace: "reader" })
  return { title: `${series.title} · ${t("chapterLabel", { n: chapter })}` }
}

async function NovelContent({ params }: { params: PageProps<"/[locale]/novel/[slug]/[chapter]">["params"] }) {
  const { locale, slug, chapter } = await params
  setRequestLocale(locale)

  const series = getSeriesBySlug(slug)
  const n = Number(chapter)
  // The demo knows its series here; with the real API the page asks the API (series made by creators are not in the demo data).
  if (DEMO_MODE ? !series || !Number.isInteger(n) || n < 1 || n > episodesFor(slug).length : !Number.isInteger(n) || n < 1) notFound()
  // A comic opened under /novel goes to the comic reader.
  if (series?.type === "comic") redirect({ href: `/read/${slug}/${n}`, locale })

  return <NovelReader slug={slug} n={n} />
}

export default function Page({ params }: PageProps<"/[locale]/novel/[slug]/[chapter]">) {
  return (
    <Suspense fallback={<NovelSkeleton />}>
      <NovelContent params={params} />
    </Suspense>
  )
}
