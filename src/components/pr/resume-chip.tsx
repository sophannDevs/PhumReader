"use client"

import { useTranslations } from "@/i18n/translations"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "You stopped at 40% · Continue / Start over" (prototype `.vw-resume` / `.nr-resume`): a pill that sticks under
 * the reader bar over the top of the page. Colours come from the reader root's tokens (card, input border).
 */
export function ResumeChip({
  pct,
  onContinue,
  onStartOver,
  className,
}: {
  /** 0..1 */
  pct: number
  onContinue: () => void
  onStartOver: () => void
  className?: string
}) {
  const t = useTranslations("reader")
  return (
    <div
      role="status"
      className={cn(
        "sticky top-[66px] z-[35] mx-auto mt-2.5 -mb-[54px] flex w-max max-w-[calc(100%-32px)] items-center gap-2.5 rounded-full border border-input bg-card py-1.5 pr-1.5 pl-3.5 text-card-foreground shadow-[0_10px_30px_rgba(0,0,0,0.4)] max-md:top-[60px]",
        className
      )}
    >
      <span className="text-[13px] leading-[18px] font-medium tabular-nums">{t("stoppedAt", { pct: Math.round(pct * 100) })}</span>
      <Button variant="brand" size="sm" onClick={onContinue}>
        {t("continue")}
      </Button>
      <Button variant="ghost" size="sm" onClick={onStartOver}>
        {t("startOver")}
      </Button>
    </div>
  )
}
