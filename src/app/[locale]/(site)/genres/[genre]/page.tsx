import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { GenresPage } from "@/components/pr/genres-page"
import { genres } from "@/data"
import { routing } from "@/i18n/routing"
import { genreFromSlug, genreSlug } from "@/lib/routes"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => genres().map((g) => ({ locale, genre: genreSlug(g) })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/genres/[genre]">): Promise<Metadata> {
  const { locale, genre } = await params
  const name = genreFromSlug(genre, genres())
  if (!name) return {}
  const t = await getTranslations({ locale, namespace: "genresPage" })
  return { title: `${t("title")} · ${name}` }
}

export default async function Page({ params }: PageProps<"/[locale]/genres/[genre]">) {
  const { locale, genre } = await params
  setRequestLocale(locale)
  const name = genreFromSlug(genre, genres())
  if (!name) notFound()
  return <GenresPage genre={name} />
}
