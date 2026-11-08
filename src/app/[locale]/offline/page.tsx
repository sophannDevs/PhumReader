import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { OfflineView } from "@/components/pr/offline-view"

export async function generateMetadata({ params }: PageProps<"/[locale]/offline">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "legal" })
  return { title: t("offline.title"), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <OfflineView />
}
