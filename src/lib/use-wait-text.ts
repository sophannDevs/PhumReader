"use client"

import { useTranslations } from "@/i18n/translations"
import { waitParts } from "@/lib/api/errors"

/** "Try again in 3 minutes." for a 429 answer's retry time, in the page's language. */
export function useWaitText(): (seconds: number) => string {
  const t = useTranslations("auth")
  return (seconds) => {
    const { unit, count } = waitParts(seconds)
    return unit === "minutes" ? t("waitMinutes", { count }) : t("waitSeconds", { count })
  }
}
