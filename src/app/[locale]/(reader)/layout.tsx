import { setRequestLocale } from "next-intl/server"
import { SkipLink } from "@/components/layout/skip-link"

// Readers are full-bleed: no site header, footer or tab bar. Each reader page
// draws its own bar (ComicReaderBar / NovelReaderBar) and sets its own colours.
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <SkipLink />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </div>
  )
}
