import { setRequestLocale } from "next-intl/server"
import { AuthSplitLayout } from "@/components/layout/auth-split-layout"
import { SearchProvider } from "@/components/layout/search-provider"
import { ConnectedHeader } from "@/components/layout/site-chrome"
import { SiteFooter } from "@/components/layout/site-footer"
import { SkipLink } from "@/components/layout/skip-link"

// V2.1 (screens 05-*): site header and footer around the mint panel + card; no phone tab bar (the prototype's
// Auth page has none).
export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <SearchProvider>
      <SkipLink />
      <ConnectedHeader />
      {/* The grey band runs into the footer's top border (screens 05-*). */}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <AuthSplitLayout>{children}</AuthSplitLayout>
      </main>
      <SiteFooter />
    </SearchProvider>
  )
}
