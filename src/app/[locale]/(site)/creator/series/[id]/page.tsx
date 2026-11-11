import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { Suspense } from "react"
import { ManageSeriesPage } from "@/components/pr/manage-series-page"
import { SkeletonPage } from "@/components/pr/skeletons"
import { routing } from "@/i18n/routing"

// Series ids exist only in the store (demo) or the database: one placeholder per language lets the page shell be
// built ahead; every real id is rendered when it is first opened.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000" }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series/[id]">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "manage" })
  return { title: t("pageTitle") }
}

async function Content({ params }: { params: PageProps<"/[locale]/creator/series/[id]">["params"] }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <ManageSeriesPage id={id} />
}

// The id is only known at request time, so it is read inside Suspense (Cache Components); ?tab= is read on the client.
export default function Page({ params }: PageProps<"/[locale]/creator/series/[id]">) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content params={params} />
    </Suspense>
  )
}
