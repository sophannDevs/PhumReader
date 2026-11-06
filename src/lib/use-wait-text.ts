"use client"

import { useTranslations } from "next-intl"
import { waitParts } from "@/lib/api/errors"

/** "Try again in 3 minutes." for a 429 answer's retry time, in the page's language. */
export function useWaitText(): (seconds: number) => string {
  const t = useTranslations("auth")
  return (seconds) => {
    const { unit, count } = waitParts(seconds)
    return unit === "minutes" ? t("waitMinutes", { count }) : t("waitSeconds", { count })
  }
}
