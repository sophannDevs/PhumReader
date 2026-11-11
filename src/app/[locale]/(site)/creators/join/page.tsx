import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { JoinPage } from "@/components/pr/join-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/creators/join">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "join" })
  return { title: t("metaTitle"), description: t("metaDesc") }
}

export default async function Page({ params }: PageProps<"/[locale]/creators/join">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <JoinPage />
}
