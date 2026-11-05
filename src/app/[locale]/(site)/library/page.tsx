import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { LibraryPage } from "@/components/pr/library-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/library">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "library" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/library">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <LibraryPage />
}
