import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { HomeContent } from "@/components/pr/home-content"

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "common" })
  return { title: { absolute: `${t("siteName")} · ${t("tagline")}` }, description: t("tagline") }
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeContent />
}
