import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { MaintenanceView } from "@/components/pr/maintenance-view"

export async function generateMetadata({ params }: PageProps<"/[locale]/maintenance">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "errors" })
  return { title: t("codes.maintenance"), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/maintenance">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <MaintenanceView />
}
