import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { ComingSoon } from "@/components/pr/coming-soon"

export async function generateMetadata({ params }: PageProps<"/[locale]/coming-soon">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "comingSoon" })
  return { title: t("title", { topic: t("fallback") }) }
}

export default async function Page({ params }: PageProps<"/[locale]/coming-soon">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense>
      <ComingSoon />
    </Suspense>
  )
}
