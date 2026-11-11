import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { Suspense } from "react"
import { CreateSeriesPage } from "@/components/pr/create-series-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/new">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "seriesForm" })
  return { title: t("newSeries") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator/new">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?draft=) needs a Suspense boundary.
  return (
    <Suspense>
      <CreateSeriesPage />
    </Suspense>
  )
}
