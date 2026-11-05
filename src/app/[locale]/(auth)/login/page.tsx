import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { AuthFlow } from "@/components/auth/auth-flow"
import { Skeleton } from "@/components/ui/skeleton"

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  return { title: t("login") }
}

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    // useSearchParams (?mode=signup) needs a Suspense boundary.
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <AuthFlow />
    </Suspense>
  )
}
