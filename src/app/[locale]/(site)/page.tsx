import { setRequestLocale } from "next-intl/server"
import { HomeContent } from "@/components/pr/home-content"

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeContent />
}
