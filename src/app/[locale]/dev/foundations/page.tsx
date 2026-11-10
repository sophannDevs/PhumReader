import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { FoundationsBoard } from "@/components/pr/foundations-board"

export const metadata: Metadata = { title: "Foundations · PhumiReader V2.1", robots: { index: false } }

/**
 * Developer reference that matches design/screens/00-foundations-desktop.png (checklist F02 / T02): tokens, type,
 * components and V2.1 patterns rendered with the real components. Development builds only; English only
 * (Assumption V2-19).
 */
export default async function Page({ params }: PageProps<"/[locale]/dev/foundations">) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { locale } = await params
  setRequestLocale(locale)
  return <FoundationsBoard />
}
