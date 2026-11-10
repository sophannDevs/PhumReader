import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "00000000-0000-0000-0000-000000000000", n: "1" }))
}

/**
 * V1 route: an episode is edited on the Upload page in V2.1 (/creator/upload?series=<id>&ep=<n>: title, images or
 * text, release, Fast Pass, comments and note); Manage series opens it from "Replace images". Keeps the query string.
 */
async function Go({ params, searchParams }: PageProps<"/[locale]/creator/series/[id]/episodes/[n]/edit">): Promise<never> {
  const [{ locale, id, n }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams({ series: id })
  if (/^[1-9]\d{0,5}$/.test(n)) next.set("ep", n)
  for (const [key, value] of Object.entries(query)) {
    if (key === "series" || key === "ep" || value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  return redirect({ href: `/creator/upload?${next}`, locale })
}

export default function Page(props: PageProps<"/[locale]/creator/series/[id]/episodes/[n]/edit">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
