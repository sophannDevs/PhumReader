"use client"

import { CheckIcon, CircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { passwordChecks } from "@/components/auth/auth-schemas"
import { cn } from "@/lib/utils"

/** The strength bar and the four live password rules under a new-password field (Sign up, Reset). */
export function PasswordRules({ password, id }: { password: string; id: string }) {
  const t = useTranslations("auth")
  const checks = passwordChecks(password)
  const met = checks.filter(Boolean).length
  return (
    <>
      <div role="img" aria-label={t("strength", { count: met })} data-met={met} className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-filled={i < met}
            className={cn("h-1.5 rounded-full bg-muted transition-colors", i < met && (met >= 3 ? "bg-primary" : "bg-coin"))}
          />
        ))}
      </div>
      <ul id={id} className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((ok, i) => (
          <li
            key={i}
            data-met={ok}
            className={cn("flex items-center gap-1.5 text-[13px]", ok ? "text-brand-ink" : "text-muted-foreground")}
          >
            {ok ? <CheckIcon className="size-3.5" aria-hidden /> : <CircleIcon className="size-3.5" aria-hidden />}
            {t(`rule${i}` as "rule0")}
            <span className="sr-only">{ok ? t("ruleMet") : t("ruleUnmet")}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
