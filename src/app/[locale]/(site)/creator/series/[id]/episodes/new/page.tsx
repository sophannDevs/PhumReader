import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { SkeletonPage } from "@/components/pr/skeletons"
import { NewEpisodePage } from "@/components/pr/episode-form-pages"
import { routing } from "@/i18n/routing"

// Series ids exist only in the database: one placeholder per language lets the page shell be built ahead.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000" }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series/[id]/episodes/new">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "episodeForm" })
  return { title: t("pageTitle") }
}

async function Content({ params }: { params: PageProps<"/[locale]/creator/series/[id]/episodes/new">["params"] }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <NewEpisodePage id={id} />
}

export default function Page({ params }: PageProps<"/[locale]/creator/series/[id]/episodes/new">) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content params={params} />
    </Suspense>
  )
}
