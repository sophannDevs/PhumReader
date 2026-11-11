"use client"

import { ChevronDownIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Small V2.1 controls shared by Library, Notifications and Settings (prototype shared.css):
 * - NativeSelect: `.select` (36 px, chevron on the right) on a native <select>
 * - SmallSwitch: `.switch` (36 × 20 px) on the shadcn Switch
 * - SaveBar: sticky dark bar "You have unsaved changes · Discard / Save changes" (foundations.md §8, Settings)
 */

export function NativeSelect({
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-flex w-full min-w-0", wrapperClassName)}>
      <select
        className={cn(
          "h-9 w-full min-w-0 cursor-pointer appearance-none rounded-control border border-input bg-background pr-8 pl-3 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-[#a1a1aa] focus-visible:ring-[3px] focus-visible:ring-[rgba(0,166,80,0.22)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}

/** The prototype's compact switch (36 × 20, 16 px thumb). */
export function SmallSwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "h-5 w-9 border-0 data-[state=unchecked]:bg-[#d4d4d8] [&>[data-slot=switch-thumb]]:size-4 [&>[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[18px] [&>[data-slot=switch-thumb]]:data-[state=unchecked]:translate-x-0.5",
        className
      )}
      {...props}
    />
  )
}

export function SaveBar({
  onDiscard,
  onSave,
  saveDisabled,
  saving,
  className,
}: {
  onDiscard: () => void
  onSave: () => void
  saveDisabled?: boolean
  saving?: boolean
  className?: string
}) {
  const t = useTranslations("settings")
  return (
    <div
      role="region"
      aria-label={t("unsavedRegion")}
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex w-[calc(100%-32px)] max-w-[760px] items-center justify-between gap-3 rounded-card bg-[#09090b] py-2.5 pr-3 pl-4 text-[#fafafa] shadow-md max-md:bottom-[72px] max-md:flex-wrap",
        className
      )}
    >
      <span className="text-[13px] leading-[18px] font-semibold">{t("unsaved")}</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="text-[#e4e4e7] hover:bg-white/10 hover:text-white" onClick={onDiscard}>
          {t("discard")}
        </Button>
        <Button variant="brand" size="sm" disabled={saveDisabled} loading={saving} onClick={onSave}>
          {t("saveChanges")}
        </Button>
      </div>
    </div>
  )
}
