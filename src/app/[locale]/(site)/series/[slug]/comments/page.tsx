import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { CommentsPage, CommentsPageSkeleton } from "@/components/pr/comments-page"
import { getSeries, getSeriesBySlug } from "@/data"
import { routing } from "@/i18n/routing"
import { DEMO_MODE } from "@/lib/api/config"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => getSeries().map((s) => ({ locale, slug: s.slug })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/series/[slug]/comments">): Promise<Metadata> {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "comments" })
  const series = getSeriesBySlug(slug)
  return { title: series ? t("pageTitle", { title: series.title }) : t("title") }
}

async function CommentsContent({ params }: { params: PageProps<"/[locale]/series/[slug]/comments">["params"] }) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  // Same as the series page: unknown demo slugs 404 right away; the real API is asked by the page.
  if (DEMO_MODE && !getSeriesBySlug(slug)) notFound()
  return <CommentsPage slug={slug} />
}

// Spec §23: /series/[slug]/comments (?ep=N). useSearchParams (?ep=) needs a Suspense boundary.
export default function Page({ params }: PageProps<"/[locale]/series/[slug]/comments">) {
  return (
    <Suspense fallback={<CommentsPageSkeleton />}>
      <CommentsContent params={params} />
    </Suspense>
  )
}
