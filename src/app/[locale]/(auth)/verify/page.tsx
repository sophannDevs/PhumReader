import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { AuthFlow } from "@/components/auth/auth-flow"
import { Skeleton } from "@/components/ui/skeleton"

export async function generateMetadata({ params }: PageProps<"/[locale]/verify">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  return { title: t("verifyTitle"), robots: { index: false, follow: false } }
}

export default async function VerifyPage({ params }: PageProps<"/[locale]/verify">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    // useSearchParams (?email=) needs a Suspense boundary.
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <AuthFlow initial="verify" />
    </Suspense>
  )
}
