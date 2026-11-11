import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { HelpPage } from "@/components/pr/help-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "help" })
  return { title: t("metaTitle") }
}

export default async function Page({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HelpPage />
}
