import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { NotificationsPage } from "@/components/pr/notifications-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/notifications">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "notifications" })
  return { title: t("title") }
}

export default async function Page({ params }: PageProps<"/[locale]/notifications">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <NotificationsPage />
}
