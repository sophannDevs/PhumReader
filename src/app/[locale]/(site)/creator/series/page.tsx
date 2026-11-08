import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { CreatorSeriesPage } from "@/components/pr/creator-series-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "creatorSeries" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator/series">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?notice=) needs a Suspense boundary.
  return (
    <Suspense>
      <CreatorSeriesPage />
    </Suspense>
  )
}
