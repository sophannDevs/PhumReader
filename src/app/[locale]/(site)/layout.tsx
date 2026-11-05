import { setRequestLocale } from "next-intl/server"
import { SkipLink } from "@/components/layout/skip-link"
import { SearchProvider } from "@/components/layout/search-provider"
import { SiteFooter } from "@/components/layout/site-footer"
import { ConnectedHeader, ConnectedTabBar } from "@/components/layout/site-chrome"

// Header + main + footer + phone tab bar. User and coins are placeholders
// until T19 wires the chrome to the store.
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Layouts render in parallel with the root layout, so each one sets the locale itself.
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <SearchProvider>
      <SkipLink />
      <ConnectedHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <SiteFooter />
      <ConnectedTabBar />
    </SearchProvider>
  )
}
