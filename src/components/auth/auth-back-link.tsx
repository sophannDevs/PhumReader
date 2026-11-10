"use client"

import { ArrowLeftIcon } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { useAppStore } from "@/lib/store"

/** "← Back to PhumiReader": goes to `returnTo` (the page the reader came from) or `/`. */
export function AuthBackLink({ fallbackHref, label, lang }: { fallbackHref: string; label: string; lang: string }) {
  const returnTo = useAppStore((s) => s.returnTo)
  return (
    <Link
      href={returnTo ?? fallbackHref}
      className="hidden items-center gap-2 rounded-control text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      <span lang={lang}>{label}</span>
    </Link>
  )
}
