import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/** The green mark (V2.1): 28 px rounded square with three stroked lines. Decorative. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground",
        className
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M3 4.5h10M3 8h10M3 11.5h6" />
      </svg>
    </span>
  )
}

const sizes = {
  header: { mark: "size-7", text: "text-[17px] max-[420px]:text-[15px]" },
  footer: { mark: "size-7", text: "text-[13px]" },
  auth: { mark: "size-9", text: "text-2xl" },
} as const

/**
 * Mark + wordmark (foundations.md §8): "Phumi" (ភូមិ in Khmer) in the foreground colour + "Reader" in brand ink.
 * `tone="light"` is for dark backgrounds (auth panel, reader and admin bars): "Reader" uses --primary.
 */
export function Logo({
  size = "header",
  tone = "default",
  asLink = true,
  className,
}: {
  size?: keyof typeof sizes
  tone?: "default" | "light"
  asLink?: boolean
  className?: string
}) {
  const t = useTranslations("common")
  const locale = useLocale()
  const s = sizes[size]

  const content = (
    <>
      <LogoMark className={s.mark} />
      <span
        className={cn(
          "font-bold whitespace-nowrap",
          locale === "km" ? "font-khmer tracking-normal" : "tracking-[-0.03em]",
          s.text,
          tone === "light" ? "text-surface-foreground" : "text-foreground",
          "max-[339px]:hidden"
        )}
      >
        <span lang={locale === "km" ? "km" : undefined}>{t("logoFirst")}</span>
        <span className={tone === "light" ? "text-primary" : "text-brand-ink"}>Reader</span>
      </span>
    </>
  )

  const base = cn("inline-flex items-center gap-2 max-[420px]:gap-1.5", className)
  if (!asLink) return <span className={base}>{content}</span>
  return (
    <Link
      href="/"
      aria-label={t("homeAria")}
      className={cn(
        base,
        "rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {content}
    </Link>
  )
}
