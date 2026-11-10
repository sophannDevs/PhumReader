import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { WelcomeFlow } from "@/components/welcome/welcome-flow"

export async function generateMetadata({ params }: PageProps<"/[locale]/welcome">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "welcome" })
  return { title: t("metaTitle"), robots: { index: false, follow: false } }
}

// First-time setup (spec §24, screens 24-*): its own top bar (logo + Skip for now), no site header, footer or
// tab bar, so the route sits outside the (site) group.
export default async function WelcomePage({ params }: PageProps<"/[locale]/welcome">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <WelcomeFlow />
}
