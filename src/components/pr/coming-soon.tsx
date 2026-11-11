"use client"

import { HomeIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { ErrorHelp, ErrorHero, errorActions } from "@/components/pr/error-page"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"

const KNOWN = [
  "help-center",
  "terms",
  "privacy",
  "contact",
  "facebook",
  "telegram",
  "twitter",
  "youtube",
  "earnings",
  "guidelines",
  "status",
]

/**
 * "<Topic> is coming soon": the target of the footer's social buttons, "Service status" and other pages that don't
 * exist yet. Same look as the error pages (badge "Coming soon", the maintenance illustration).
 */
export function ComingSoon() {
  const t = useTranslations("comingSoon")
  const topic = useSearchParams().get("topic") ?? ""
  const name = KNOWN.includes(topic) ? t(`topics.${topic}`) : t("fallback")

  return (
    <ErrorHero kind="comingSoon" title={t("title", { topic: name })} body={t("body")}>
      <div className={errorActions}>
        <Button asChild variant="brand" size="lg">
          <Link href="/">
            <HomeIcon />
            {t("home")}
          </Link>
        </Button>
      </div>
      <ErrorHelp />
    </ErrorHero>
  )
}
