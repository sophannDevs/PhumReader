import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { AdminGate } from "@/components/layout/admin-shell"
import { AdminV1Page } from "@/components/pr/admin-page"

// A V1 admin screen without a V2.1 design, kept reachable in real mode (side menu).
export async function generateMetadata({ params }: PageProps<"/[locale]/admin/audit">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "admin" })
  return { title: t("metaTitle", { page: t("nav_audit") }), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <AdminGate>
      <AdminV1Page section="audit" />
    </AdminGate>
  )
}
