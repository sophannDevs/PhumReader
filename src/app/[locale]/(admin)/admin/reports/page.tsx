import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { AdminGate } from "@/components/layout/admin-shell"
import { Suspense } from "react"
import { SplitSkeleton } from "@/components/pr/admin-kit"
import { AdminReports } from "@/components/pr/admin-reports"

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/reports">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "admin" })
  return { title: t("metaTitle", { page: t("nav_reports") }), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?id= opens one item) needs a Suspense boundary.
  return (
    <AdminGate>
      <Suspense fallback={<SplitSkeleton />}>
        <AdminReports />
      </Suspense>
    </AdminGate>
  )
}
