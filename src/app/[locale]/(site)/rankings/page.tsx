import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
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
