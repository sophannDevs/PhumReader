import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { ReceiptPage } from "@/components/pr/receipt-page"
import { SkeletonPage } from "@/components/pr/skeletons"
import { routing } from "@/i18n/routing"

// Order numbers are only known at request time; the two demo orders (DEMO_ORDER_IDS in src/lib/store.ts, a client
// module) are built ahead.
const DEMO_ORDERS = ["TW-48213377", "TW-48190012"]

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DEMO_ORDERS.map((id) => ({ locale, id })))
}

export async function generateMetadata({ params }: PageProps<"/[locale]/coins/orders/[id]">): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: "receipt" })
  return { title: t("metaTitle", { id: decodeURIComponent(id) }) }
}

async function Content({ params }: { params: PageProps<"/[locale]/coins/orders/[id]">["params"] }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <ReceiptPage id={decodeURIComponent(id)} />
}

// The order number is read inside Suspense (Cache Components).
export default function Page({ params }: PageProps<"/[locale]/coins/orders/[id]">) {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content params={params} />
    </Suspense>
  )
}
