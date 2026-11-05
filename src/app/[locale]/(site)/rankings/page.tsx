import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { RankingsPage } from "@/components/pr/rankings-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/rankings">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "rankings" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/rankings">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <RankingsPage />
}
