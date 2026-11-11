import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { EarningsPage } from "@/components/pr/earnings-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/earnings">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "earnings" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/creator/earnings">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <EarningsPage />
}
