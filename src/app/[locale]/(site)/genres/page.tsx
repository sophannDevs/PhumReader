import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { GenresPage } from "@/components/pr/genres-page"
import { fetchGenreNamesServer } from "@/lib/api/server"

export async function generateMetadata({ params }: PageProps<"/[locale]/genres">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "genresPage" })
  return { title: t("title") }
}

// /genres opens on Fantasy, the same default as the Home genre section.
export default async function Page({ params }: PageProps<"/[locale]/genres">) {
  const { locale } = await params
  setRequestLocale(locale)
  const all = await fetchGenreNamesServer()
  return <GenresPage genre={all.includes("Fantasy") ? "Fantasy" : all[0]} all={all} />
}
