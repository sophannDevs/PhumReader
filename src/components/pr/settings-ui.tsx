"use client"

import * as React from "react"
import { useTranslations } from "@/i18n/translations"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Small V2.1 controls shared by Library, Notifications and Settings (prototype shared.css):
 * - NativeSelect: `.select` (36 px, chevron on the right) on the animated Select (keeps the <select>-like API)
 * - SmallSwitch: `.switch` (36 × 20 px) on the shadcn Switch
 * - SaveBar: sticky dark bar "You have unsaved changes · Discard / Save changes" (foundations.md §8, Settings)
 */

/** What `NativeSelect` passes to `onChange`: the part of a change event the call sites read. */
export type SelectChange = { target: { value: string; name?: string } }

type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean; lang?: string }

/**
 * Radix Select forbids "" as an item value; an <option value=""> ("Choose…") maps to this and back.
 * Inside a <form>, Radix's hidden native select would submit "__pr-empty__" for that choice, so don't read
 * these fields from native FormData (the forms here read the value from `onChange` / react-hook-form).
 */
const EMPTY = "__pr-empty__"

/** Reads the <option> children (also inside fragments) into items. Groups are not supported (none are used). */
function readOptions(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return
    if (child.type === React.Fragment) {
      out.push(...readOptions(child.props.children))
    } else if (child.type === "option") {
      const p = child.props as React.ComponentProps<"option">
      const value = p.value ?? (typeof p.children === "string" || typeof p.children === "number" ? p.children : "")
      out.push({ value: String(value), label: p.children, disabled: p.disabled, lang: p.lang })
    }
  })
  return out
}

/**
 * The prototype's `.select` (36 px, chevron on the right), now on the animated Select (src/components/ui/select).
 * It keeps the native-select API of its call sites: `value`, `onChange(e)` with `e.target.value`, and
 * <option> children (an <option value=""> works as the "Choose…" entry). `id` and the aria props go on the
 * trigger button, so <label htmlFor> keeps working. The trigger and each option carry the raw value in `data-value`
 * (tests and e2e pick options by it). An auto-width trigger takes the width of its longest option.
 */
export function NativeSelect({
  className,
  wrapperClassName,
  children,
  value,
  onChange,
  name,
  required,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof SelectTrigger>, "value" | "defaultValue" | "onChange" | "children" | "name"> & {
  value: string
  onChange?: (event: SelectChange) => void
  name?: string
  required?: boolean
  wrapperClassName?: string
  children: React.ReactNode
}) {
  const options = readOptions(children)
  const toItem = (v: string) => (v === "" ? EMPTY : v)
  return (
    <span className={cn("relative inline-flex w-full min-w-0", wrapperClassName)}>
      <Select
        value={toItem(value)}
        onValueChange={(v) => onChange?.({ target: { value: v === EMPTY ? "" : v, name } })}
        name={name}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger className={className} data-value={value} {...props}>
          {/* Every label stacked in one grid cell, hidden: an auto-width trigger is as wide as its longest
              option, so it keeps its width when the choice changes (a full-width trigger clips them). */}
          <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden">
            <span className="col-start-1 row-start-1 min-w-0 truncate">
              <SelectValue />
            </span>
            {options.map((o) => (
              <span key={o.value} aria-hidden lang={o.lang} className="invisible col-start-1 row-start-1 whitespace-nowrap">
                {o.label}
              </span>
            ))}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={toItem(o.value)} data-value={o.value} disabled={o.disabled} lang={o.lang}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
