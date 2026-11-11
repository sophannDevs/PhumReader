import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { AdminGate } from "@/components/layout/admin-shell"
import { AdminPayments } from "@/components/pr/admin-payments"

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/payments">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "admin" })
  return { title: t("metaTitle", { page: t("nav_payments") }), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <AdminGate>
      <AdminPayments />
    </AdminGate>
  )
}
