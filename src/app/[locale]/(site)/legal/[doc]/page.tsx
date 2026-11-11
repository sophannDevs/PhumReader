import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { Suspense } from "react"
import { isPolicyId, POLICY_IDS } from "@/components/pr/legal-docs"
import { LegalPage } from "@/components/pr/legal-page"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => POLICY_IDS.map((doc) => ({ locale, doc })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params
  if (!isPolicyId(doc)) return {}
  const t = await getTranslations({ locale, namespace: "legal" })
  return { title: t(`docs.${doc}`) }
}

async function Content({ params }: { params: PageProps<"/[locale]/legal/[doc]">["params"] }) {
  const { locale, doc } = await params
  setRequestLocale(locale)
  if (!isPolicyId(doc)) notFound()
  return <LegalPage doc={doc} />
}

// Unknown documents 404; the five policies are built ahead. The document is read inside Suspense (Cache Components).
export default function Page({ params }: PageProps<"/[locale]/legal/[doc]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Content params={params} />
    </Suspense>
  )
}
