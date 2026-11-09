import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { GenresFallback, GenresPage } from "@/components/pr/genres-page"
import { genres } from "@/data"
import { routing } from "@/i18n/routing"
import { fetchGenreNamesServer } from "@/lib/api/server"
import { genreFromSlug, genreSlug } from "@/lib/routes"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => genres().map((g) => ({ locale, genre: genreSlug(g) })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/genres/[genre]">): Promise<Metadata> {
  const { locale, genre } = await params
  const name = genreFromSlug(genre, await fetchGenreNamesServer())
  if (!name) return {}
  const t = await getTranslations({ locale, namespace: "genresPage" })
  return { title: `${t("title")} · ${name}` }
}

async function GenreContent({ params }: { params: PageProps<"/[locale]/genres/[genre]">["params"] }) {
  const { locale, genre } = await params
  setRequestLocale(locale)
  const all = await fetchGenreNamesServer()
  const name = genreFromSlug(genre, all)
  if (!name) notFound()
  return <GenresPage genre={name} all={all} />
}

export default function Page({ params }: PageProps<"/[locale]/genres/[genre]">) {
  return (
    <Suspense fallback={<GenresFallback />}>
      <GenreContent params={params} />
    </Suspense>
  )
}
