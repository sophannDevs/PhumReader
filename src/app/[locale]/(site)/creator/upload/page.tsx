import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { Suspense } from "react"
import { UploadEpisodePage } from "@/components/pr/upload-episode-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/upload">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "episodeForm" })
  return { title: t("pageTitle") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator/upload">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?series=, ?ep=) needs a Suspense boundary.
  return (
    <Suspense>
      <UploadEpisodePage />
    </Suspense>
  )
}
