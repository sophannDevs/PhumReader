import { PenLineIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import type { Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const fan = ["-rotate-6 translate-y-2", "rotate-3 translate-y-6", "rotate-6"] as const

/** Creator call-to-action: green-to-white gradient card with three fanned covers (desktop). */
export function CreatorCta({ covers, className }: { covers: Series[]; className?: string }) {
  const t = useTranslations("home")

  return (
    <section
      aria-labelledby="cta-title"
      className={cn(
        "relative overflow-hidden rounded-card border border-brand-soft-border bg-gradient-to-br from-brand-soft via-background to-background p-6 md:p-10",
        className
      )}
    >
      <div className="relative flex max-w-xl flex-col items-start gap-3">
        <p className="type-eyebrow">{t("ctaEyebrow")}</p>
        <h2 id="cta-title" className="type-h1">
          {t("ctaTitle")}
        </h2>
        <p className="type-lead">{t("ctaBody")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="brand" size="lg">
            <Link href="/creator">
              <PenLineIcon />
              {t("ctaStart")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/creator#guidelines">{t("ctaGuidelines")}</Link>
          </Button>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute top-1/2 right-10 hidden -translate-y-1/2 gap-3 lg:flex">
        {covers.slice(0, 3).map((s, i) => (
          <div
            key={s.id}
            className={cn("aspect-[3/4] w-32 overflow-hidden rounded-card border bg-muted shadow-md", fan[i])}
          >
            <Image src={s.cover} alt="" width={256} height={341} sizes="128px" className="size-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  )
}
