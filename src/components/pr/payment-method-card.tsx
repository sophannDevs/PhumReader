"use client"

import { useTranslations } from "@/i18n/translations"
import { Badge } from "@/components/ui/badge"
import { RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import type { PaymentMethod } from "@/data/types"
import { useLocalize } from "@/lib/localize"
import { cn } from "@/lib/utils"

const tileLabel = { khqr: "KHQR", aba: "ABA", card: "CARD" } as const

/**
 * Payment method as a radio row card (prototype Shop `.radio-card.row-card`): dot, method tile, name and hint,
 * "Recommended". Render inside a `RadioGroup`; the item value is `method.id`.
 */
export function PaymentMethodCard({
  method,
  disabled = false,
  className,
}: {
  method: PaymentMethod
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations("packs.method")
  const text = useLocalize().method(method.id, method)
  const id = `method-${method.id}`

  return (
    <label
      htmlFor={id}
      className={cn(radioCardClassName, "items-center gap-3 rounded-[10px] bg-background p-3.5 shadow-xs", className)}
    >
      <RadioGroupItem id={id} value={method.id} disabled={disabled} className="border-[#a1a1aa]" />
      <span
        aria-hidden
        className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-extrabold tracking-[0.02em]"
      >
        {tileLabel[method.id]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] leading-[22px] font-semibold">{text.label}</span>
        <span className="text-xs leading-4 text-muted-foreground">{text.desc}</span>
      </span>
      {method.recommended ? <Badge variant="brand">{t("recommended")}</Badge> : null}
    </label>
  )
}
