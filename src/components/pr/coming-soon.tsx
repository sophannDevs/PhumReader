"use client"

import { HourglassIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"

/** "<Topic> is coming soon": the target of footer Help links and other pages that do not exist yet. */
export function ComingSoon() {
  const t = useTranslations("comingSoon")
  const topic = useSearchParams().get("topic") ?? ""
  const known = ["help-center", "terms", "privacy", "contact", "facebook", "twitter", "youtube", "earnings", "guidelines"]
  const name = known.includes(topic) ? t(`topics.${topic}`) : t("fallback")

  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-card bg-muted text-muted-foreground">
        <HourglassIcon className="size-7" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h1 className="type-h1">{t("title", { topic: name })}</h1>
        <p className="type-lead">{t("body")}</p>
      </div>
      <Button asChild variant="brand" size="lg">
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  )
}
