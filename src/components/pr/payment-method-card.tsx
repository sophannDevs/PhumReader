"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import type { PaymentMethod } from "@/data/types"
import { cn } from "@/lib/utils"

const tileLabel = { khqr: "KHQR", aba: "ABA", card: "CARD" } as const

/** Payment method as a radio card. Render inside a `RadioGroup`; the item value is `method.id`. */
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
  const id = `method-${method.id}`

  return (
    <label htmlFor={id} className={cn(radioCardClassName, "items-center", className)}>
      <RadioGroupItem id={id} value={method.id} disabled={disabled} />
      <span
        aria-hidden
        className="flex h-8 w-10 shrink-0 items-center justify-center rounded-control bg-muted text-[10px] font-bold tracking-wide"
      >
        {tileLabel[method.id]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{method.label}</span>
        <span className="type-caption font-normal text-muted-foreground">{method.desc}</span>
      </span>
      {method.recommended ? <Badge variant="brand">{t("recommended")}</Badge> : null}
    </label>
  )
}
