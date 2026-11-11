import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { AdminGate } from "@/components/layout/admin-shell"
import { AdminPage } from "@/components/pr/admin-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "admin" })
  return { title: t("metaTitle", { page: t("nav_overview") }), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <AdminGate>
      <AdminPage />
    </AdminGate>
  )
}
