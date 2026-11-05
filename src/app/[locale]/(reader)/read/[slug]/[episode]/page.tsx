import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ComicReader, ReaderSkeleton } from "@/components/pr/comic-reader"
import { episodesFor, getSeries, getSeriesBySlug } from "@/data"
import { redirect } from "@/i18n/navigation"
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
  const { locale, slug, episode } = await params
  const series = getSeriesBySlug(slug)
  if (!series) return {}
  const t = await getTranslations({ locale, namespace: "reader" })
  return { title: `${series.title} · ${t("episodeLabel", { n: episode })}` }
}

async function ComicContent({ params }: { params: PageProps<"/[locale]/read/[slug]/[episode]">["params"] }) {
  const { locale, slug, episode } = await params
  setRequestLocale(locale)

  const series = getSeriesBySlug(slug)
  const n = Number(episode)
  if (!series || !Number.isInteger(n) || n < 1 || n > episodesFor(slug).length) notFound()
  // A web novel opened under /read goes to the novel reader.
  if (series.type === "novel") redirect({ href: `/novel/${slug}/${n}`, locale })

  return <ComicReader slug={slug} n={n} />
}

export default function Page({ params }: PageProps<"/[locale]/read/[slug]/[episode]">) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <ComicContent params={params} />
    </Suspense>
  )
}
