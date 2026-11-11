import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"

/** V1 "My series" list: the V2.1 dashboard (/creator) has the list now. Keeps the query (?notice=…&series=…). */
async function Go({ params, searchParams }: PageProps<"/[locale]/creator/series">): Promise<never> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  const qs = next.toString()
  return redirect({ href: `/creator${qs ? `?${qs}` : ""}`, locale })
}

// The query string is read inside Suspense (Cache Components).
export default function Page(props: PageProps<"/[locale]/creator/series">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
