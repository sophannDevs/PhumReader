import { setRequestLocale } from "next-intl/server"

// Readers are full-bleed: no site header, footer or tab bar. Each reader page
// draws its own bar (ComicReaderBar / NovelReaderBar) and sets its own colours.
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  setRequestLocale(locale)
  return <div className="flex min-h-svh flex-1 flex-col">{children}</div>
}
