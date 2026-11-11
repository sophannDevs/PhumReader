import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000" }))
}

/** V1 route: a series is edited in Manage series > Series details in V2.1 (spec §21). Keeps the query string. */
async function Go({ params, searchParams }: PageProps<"/[locale]/creator/series/[id]/edit">): Promise<never> {
  const [{ locale, id }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams({ tab: "details" })
  for (const [key, value] of Object.entries(query)) {
    if (key === "tab" || value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  return redirect({ href: `/creator/series/${encodeURIComponent(id)}?${next}`, locale })
}

export default function Page(props: PageProps<"/[locale]/creator/series/[id]/edit">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
