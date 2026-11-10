import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { DemoCrash } from "@/components/pr/demo-crash"
import { DEMO_MODE } from "@/lib/api/config"

export const metadata: Metadata = { robots: { index: false } }

// Demo mode only: a page that crashes in the browser, so the 500 page ((site)/error.tsx) can be seen and tried.
export default async function Page({ params }: PageProps<"/[locale]/demo/crash">) {
  const { locale } = await params
  setRequestLocale(locale)
  if (!DEMO_MODE) notFound()
  return <DemoCrash />
}
