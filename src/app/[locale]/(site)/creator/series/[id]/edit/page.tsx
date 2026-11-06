import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { SkeletonPage } from "@/components/pr/skeletons"
import { EditSeriesPage } from "@/components/pr/series-form-pages"
import { routing } from "@/i18n/routing"

// Series ids exist only in the database. One placeholder id per language lets the page shell be built
// ahead; every real id is rendered when it is first opened.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000" }))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/creator/series/[id]/edit">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "seriesForm" })
  return { title: t("editTitle") }
}

async function Content({ params }: { params: PageProps<"/[locale]/creator/series/[id]/edit">["params"] }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <EditSeriesPage id={id} />
}

// The id is only known at request time, so it is read inside Suspense.
export default function Page({ params }: PageProps<"/[locale]/creator/series/[id]/edit">) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content params={params} />
    </Suspense>
  )
}
