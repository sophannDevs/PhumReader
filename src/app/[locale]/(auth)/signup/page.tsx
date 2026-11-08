import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { AuthFlow } from "@/components/auth/auth-flow"
import { Skeleton } from "@/components/ui/skeleton"

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "auth" })
  return { title: t("signupTitle") }
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    // useSearchParams (?email=) needs a Suspense boundary.
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <AuthFlow initial="signup" />
    </Suspense>
  )
}
