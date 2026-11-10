import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { GenresFallback, GenresPage } from "@/components/pr/genres-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/genres">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "genresPage" })
  return { title: t("title") }
}

// Genres / Web novels (spec §11): /genres?g=<Genre>&format=novel. The page reads the query (useSearchParams),
// hence the Suspense boundary.
export default async function Page({ params }: PageProps<"/[locale]/genres">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense fallback={<GenresFallback />}>
      <GenresPage />
    </Suspense>
  )
}
