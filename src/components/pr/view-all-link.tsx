import { ChevronRightIcon } from "lucide-react"
import { Link } from "@/i18n/navigation"

/** "View all >" link used at the top right of home sections. */
export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
      <ChevronRightIcon className="size-4" aria-hidden />
    </Link>
  )
}
