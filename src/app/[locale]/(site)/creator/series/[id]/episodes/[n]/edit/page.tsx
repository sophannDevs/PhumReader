import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { SkeletonPage } from "@/components/pr/skeletons"
import { EditEpisodePage } from "@/components/pr/episode-form-pages"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000", n: "1" }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series/[id]/episodes/[n]/edit">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "episodeForm" })
  return { title: t("pageTitle") }
}

async function Content({ params }: { params: PageProps<"/[locale]/creator/series/[id]/episodes/[n]/edit">["params"] }) {
  const { locale, id, n } = await params
  setRequestLocale(locale)
  if (!/^[1-9]\d{0,5}$/.test(n)) notFound()
  return <EditEpisodePage id={id} n={Number(n)} />
}

export default function Page({ params }: PageProps<"/[locale]/creator/series/[id]/episodes/[n]/edit">) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content params={params} />
    </Suspense>
  )
}
