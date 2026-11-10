import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { SearchPage, SearchSkeleton } from "@/components/pr/search-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "search" })
  return { title: t("pageTitle") }
}

export default async function Page({ params }: PageProps<"/[locale]/search">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?q=) needs a Suspense boundary.
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPage />
    </Suspense>
  )
}
