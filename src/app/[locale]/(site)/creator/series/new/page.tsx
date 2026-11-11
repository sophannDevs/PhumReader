import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"

/** V1 route: Create series is /creator/new in V2.1 (spec §0 "Routes"). Keeps the query string. */
async function Go({ params, searchParams }: PageProps<"/[locale]/creator/series/new">): Promise<never> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  const qs = next.toString()
  return redirect({ href: `/creator/new${qs ? `?${qs}` : ""}`, locale })
}

// The query string is read inside Suspense (Cache Components).
export default function Page(props: PageProps<"/[locale]/creator/series/new">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
