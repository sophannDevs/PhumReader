"use client"

import { MinusIcon, PlusIcon, SlidersHorizontalIcon, TypeIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId } from "react"
import { toast } from "sonner"
import { novelVars, useNovelSettings } from "@/components/pr/reader-theme"
import { Segmented } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { type NovelSettings, useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export const TEXT_SIZES = [14, 16, 18, 20, 22, 24] as const

// ---------------------------------------------------------------- comic reader (gear)

/** `.vw-seg`: equal options on a black track, the chosen one grey. */
function DarkSeg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-xs leading-4 text-surface-quiet">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[9px] bg-surface p-[3px]">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-[30px] rounded-[7px] text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel",
                on ? "bg-surface-border-strong text-white" : "text-surface-quiet hover:text-surface-foreground"
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[13px] leading-[18px]">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="focus-visible:ring-offset-surface-panel" />
    </div>
  )
}

/**
 * The gear of the comic reader bar (spec §3 "Settings panel", prototype `.vw-set`): reading mode (`settings.mode`),
 * background (`readerBg`), width (`readerWidth`), auto-open next episode (`settings.autoNext`) and data saver
 * (`settings.saveData`). Always dark, like the episode list.
 */
export function ComicSettingsPopover({ triggerClassName }: { triggerClassName?: string }) {
  const t = useTranslations("reader")
  const settings = useAppStore((s) => s.settings)
  const bg = useAppStore((s) => s.readerBg)
  const width = useAppStore((s) => s.readerWidth)
  const store = useAppStore.getState

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("settings")} className={triggerClassName}>
          <SlidersHorizontalIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label={t("settings")}
        className="w-[300px] gap-3.5 rounded-xl border-surface-border bg-surface-panel p-4 text-surface-foreground shadow-[0_16px_48px_rgba(0,0,0,0.5)] max-md:w-[280px]"
      >
        <DarkSeg
          label={t("readingMode")}
          value={settings.mode}
          onChange={(mode) => store().setSettings({ mode })}
          options={[
            { value: "scroll", label: t("modeScroll") },
            { value: "page", label: t("modePage") },
          ]}
        />
        <DarkSeg
          label={t("background")}
          value={bg}
          onChange={(v) => store().setReaderBg(v)}
          options={[
            { value: "dark", label: t("bgDark") },
            { value: "light", label: t("bgLight") },
          ]}
        />
        <DarkSeg
          label={t("width")}
          value={width}
          onChange={(v) => store().setReaderWidth(v)}
          options={[
            { value: "fit", label: t("widthFit") },
            { value: "narrow", label: t("widthNarrow") },
          ]}
        />
        <SwitchRow label={t("autoNext")} checked={settings.autoNext} onChange={(autoNext) => store().setSettings({ autoNext })} />
        <SwitchRow
          label={t("dataSaver")}
          checked={settings.saveData}
          onChange={(saveData) => {
            store().setSettings({ saveData })
            toast(t(saveData ? "dataSaverOn" : "dataSaverOff"))
          }}
        />
        <p className="text-xs leading-4 text-surface-quiet">{t("settingsNote")}</p>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------- novel reader (Aa)

/**
 * Text size, theme, font and line spacing of the novel reader (spec §4 "Settings popover"). Changes save all four to
 * `novelSettings` (from then on the reader keeps its own; before that it follows Settings, see useNovelSettings).
 * Coloured by the reader theme variables of the popover.
 */
export function ReadingSettingsControls({ className }: { className?: string }) {
  const t = useTranslations("reader")
  const { settings, choose } = useNovelSettings()
  const idx = Math.max(0, TEXT_SIZES.indexOf(settings.size as (typeof TEXT_SIZES)[number]))
  const stepper = "border-border bg-background text-reader-text hover:bg-accent hover:text-reader-text"
  const wideId = useId()

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("textSize")}</span>
          <span className="text-xs text-reader-quiet tabular-nums">{t("sizeLabel", { size: settings.size })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className={stepper}
            aria-label={t("decrease")}
            disabled={idx <= 0}
            onClick={() => choose({ size: TEXT_SIZES[idx - 1] })}
          >
            <MinusIcon className="size-3.5" />
          </Button>
          <Progress value={((idx + 1) / TEXT_SIZES.length) * 100} aria-label={t("textSize")} aria-valuetext={t("sizeLabel", { size: settings.size })} className="flex-1" />
          <Button
            variant="outline"
            size="icon-sm"
            className={stepper}
            aria-label={t("increase")}
            disabled={idx >= TEXT_SIZES.length - 1}
            onClick={() => choose({ size: TEXT_SIZES[idx + 1] })}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("theme")}</span>
        <Segmented
          stretch
          label={t("theme")}
          value={settings.theme}
          onChange={(theme: NovelSettings["theme"]) => choose({ theme })}
          options={[
            { value: "light", label: t("themeLight") },
            { value: "sepia", label: t("themeSepia") },
            { value: "dark", label: t("themeDark") },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("font")}</span>
        <Segmented
          stretch
          label={t("font")}
          value={settings.font}
          onChange={(font: NovelSettings["font"]) => choose({ font })}
          options={[
            { value: "sans", label: t("fontSans") },
            { value: "serif", label: t("fontSerif") },
          ]}
        />
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor={wideId} className="text-sm font-semibold">
          {t("wide")}
        </label>
        <Switch
          id={wideId}
          checked={settings.wide}
          onCheckedChange={(wide) => choose({ wide })}
          className="[&_[data-slot=switch-thumb]]:bg-white"
        />
      </div>
    </div>
  )
}

/** The "Aa" button of the novel reader bar: the controls in a popover coloured like the page. */
export function ReadingSettingsPopover({ triggerClassName }: { triggerClassName?: string }) {
  const t = useTranslations("reader")
  const { settings } = useNovelSettings()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("settings")} className={triggerClassName}>
          <TypeIcon className="size-3.5" aria-hidden />
          <span className="max-md:hidden">{t("settingsLabel")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label={t("settings")}
        data-reader-theme={settings.theme}
        style={novelVars(settings.theme)}
        className="w-[300px] border-border bg-card text-reader-text max-md:w-[280px]"
      >
        <ReadingSettingsControls />
      </PopoverContent>
    </Popover>
  )
}
