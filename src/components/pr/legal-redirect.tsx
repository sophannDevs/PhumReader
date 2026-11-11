import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import type { PolicyId } from "@/data"
import { redirect } from "@/i18n/navigation"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
  doc: PolicyId
}

async function Go({ params, searchParams, doc }: Props): Promise<never> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  const qs = next.toString()
  return redirect({ href: `/legal/${doc}${qs ? `?${qs}` : ""}`, locale })
}

/** V1 routes /terms and /privacy moved to /legal/[doc] (spec §0 "Routes"): a server redirect that keeps the query. */
export function LegalRedirect(props: Props) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
