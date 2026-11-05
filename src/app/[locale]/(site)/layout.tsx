import { getTranslations, setRequestLocale } from "next-intl/server"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"

// Header + main + footer + phone tab bar. User and coins are placeholders
// until T19 wires the chrome to the store.
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Layouts render in parallel with the root layout, so each one sets the locale itself.
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("nav")
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        {t("skip")}
      </a>
      <SiteHeader user={null} coins={3} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar loggedIn={false} />
    </>
  )
}
