import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { NewSeriesPage } from "@/components/pr/series-form-pages"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series/new">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "seriesForm" })
  return { title: t("newTitle") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator/series/new">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <NewSeriesPage />
}
