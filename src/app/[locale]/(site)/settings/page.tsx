import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { SettingsPage } from "@/components/pr/settings-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "settings" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <SettingsPage />
}
