import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { redirect } from "@/i18n/navigation"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
  /** The /login step the old route opens. */
  mode: "signup" | "forgot" | "verify"
}

async function Go({ params, searchParams, mode }: Props): Promise<never> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams({ mode })
  for (const [key, value] of Object.entries(query)) {
    if (key === "mode" || value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  return redirect({ href: `/login?${next}`, locale })
}

/**
 * V1 routes /signup, /forgot and /verify are steps of /login in V2.1 (spec §0 "Routes"): a server redirect that
 * keeps the query string (`/verify?email=…` from emails keeps working). The query is request data, hence Suspense.
 */
export function LoginRedirect(props: Props) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
