import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { CreatorPage } from "@/components/pr/creator-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "creator" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?notice= from the V1 forms) needs a Suspense boundary.
  return (
    <Suspense>
      <CreatorPage />
    </Suspense>
  )
}
