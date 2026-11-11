import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { AdminGate } from "@/components/layout/admin-shell"
import { Suspense } from "react"
import { SplitSkeleton } from "@/components/pr/admin-kit"
import { AdminSeriesReview } from "@/components/pr/admin-series"

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/series">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "admin" })
  return { title: t("metaTitle", { page: t("nav_series") }), robots: { index: false } }
}

export default async function Page({ params }: PageProps<"/[locale]/admin/series">) {
  const { locale } = await params
  setRequestLocale(locale)
  // useSearchParams (?id= opens one item) needs a Suspense boundary.
  return (
    <AdminGate>
      <Suspense fallback={<SplitSkeleton />}>
        <AdminSeriesReview />
      </Suspense>
    </AdminGate>
  )
}
