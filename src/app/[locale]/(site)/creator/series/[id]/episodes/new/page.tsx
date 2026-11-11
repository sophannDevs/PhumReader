import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000" }))
}

/** V1 route: episodes are uploaded on /creator/upload?series=<id> in V2.1 (spec §16). Keeps the query string. */
async function Go({ params, searchParams }: PageProps<"/[locale]/creator/series/[id]/episodes/new">): Promise<never> {
  const [{ locale, id }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams({ series: id })
  for (const [key, value] of Object.entries(query)) {
    if (key === "series" || value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  return redirect({ href: `/creator/upload?${next}`, locale })
}

export default function Page(props: PageProps<"/[locale]/creator/series/[id]/episodes/new">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
