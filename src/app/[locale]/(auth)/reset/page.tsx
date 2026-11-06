import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { ResetView } from "@/components/auth/reset-view"
import { Skeleton } from "@/components/ui/skeleton"

export async function generateMetadata({ params }: PageProps<"/[locale]/reset">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  // The token is in the URL: keep the page out of search engines.
  return { title: t("resetTitle"), robots: { index: false, follow: false } }
}

export default async function ResetPage({ params }: PageProps<"/[locale]/reset">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    // useSearchParams (?token=) needs a Suspense boundary.
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <ResetView />
    </Suspense>
  )
}
