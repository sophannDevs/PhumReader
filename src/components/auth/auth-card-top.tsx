"use client"

import { useTranslations } from "@/i18n/translations"
import { useContextLine } from "@/components/auth/use-place-name"
import { LangPills } from "@/components/layout/language-switch"
import { useHydrated } from "@/lib/store"

/** Card top (`.au-top`): the context line and the English / ខ្មែរ pill toggle (switches the page language). */
export function AuthCardTop() {
  const t = useTranslations("auth")
  const line = useContextLine(useHydrated())

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-xs leading-4 font-medium text-brand-ink">{line}</span>
      {/* Same view after the switch: the step is in the address (?mode=…); the flow keeps what was typed (auth-flow.tsx). */}
      <LangPills label={t("language")} />
    </div>
  )
}
