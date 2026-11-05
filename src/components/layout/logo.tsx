import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/** The green mark: rounded square with three dark bars. Decorative. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <rect x="8" y="9.5" width="16" height="2.4" rx="1.2" className="fill-primary-foreground" />
      <rect x="8" y="14.8" width="11.5" height="2.4" rx="1.2" className="fill-primary-foreground" />
      <rect x="8" y="20.1" width="16" height="2.4" rx="1.2" className="fill-primary-foreground" />
    </svg>
  )
}

const sizes = {
  header: { mark: "size-7", text: "text-[17px]" },
  footer: { mark: "size-7", text: "text-[15px]" },
  auth: { mark: "size-9", text: "text-2xl" },
} as const

/**
 * Mark + wordmark: "Phum" in brand ink, "Reader" in the foreground colour.
 * `tone="light"` is for dark backgrounds (auth panel). `khmer` adds a small ភូមិ underneath.
 */
export function Logo({
  size = "header",
  tone = "default",
  khmer = false,
  asLink = true,
  className,
}: {
  size?: keyof typeof sizes
  tone?: "default" | "light"
  khmer?: boolean
  asLink?: boolean
  className?: string
}) {
  const t = useTranslations("common")
  const s = sizes[size]

  const content = (
    <>
      <LogoMark className={s.mark} />
      <span className="flex flex-col leading-none max-[359px]:hidden">
        <span className={cn("font-bold tracking-tight", s.text)}>
          <span className={tone === "light" ? "text-primary" : "text-brand-ink"}>Phum</span>
          <span className={tone === "light" ? "text-surface-foreground" : "text-foreground"}>Reader</span>
        </span>
        {khmer ? (
          <span
            lang="km"
            aria-hidden
            className={cn(
              "mt-1 text-[10px] leading-none font-medium",
              tone === "light" ? "text-surface-quiet" : "text-muted-foreground"
            )}
          >
            {t("logoKhmer")}
          </span>
        ) : null}
      </span>
    </>
  )

  const base = cn("inline-flex items-center gap-2.5", className)
  if (!asLink) return <span className={base}>{content}</span>
  return (
    <Link
      href="/"
      className={cn(
        base,
        "rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {content}
    </Link>
  )
}
