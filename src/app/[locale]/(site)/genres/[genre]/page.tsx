import { setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { genres } from "@/data"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { genreFromSlug, genreSlug } from "@/lib/routes"

// Known genre paths are prerendered, so the site chrome (usePathname) has the path without a request.
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => genres().map((g) => ({ locale, genre: genreSlug(g) })))
}

async function Go({ params, searchParams }: PageProps<"/[locale]/genres/[genre]">): Promise<never> {
  const [{ locale, genre }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const next = new URLSearchParams()
  const name = genreFromSlug(genre.toLowerCase(), genres())
  if (name) next.set("g", name)
  for (const [key, value] of Object.entries(query)) {
    if (key === "g" || value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) next.append(key, one)
  }
  const qs = next.toString()
  return redirect({ href: qs ? `/genres?${qs}` : "/genres", locale })
}

/**
 * V1 route /genres/[genre] (e.g. /genres/slice-of-life): Genres is one page in V2.1 (spec §0 "Routes"), so this is a
 * server redirect to /genres?g=Slice+of+life that keeps the rest of the query. An unknown genre opens All genres.
 */
export default function Page(props: PageProps<"/[locale]/genres/[genre]">) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  )
}
