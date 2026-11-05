"use client"

import { MinusIcon, PlusIcon, TypeIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type NovelSettings, useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export const TEXT_SIZES = [14, 16, 18, 20, 22, 24] as const

/**
 * Text size, theme, font and line spacing. Writes `novelSettings` in the store, so the
 * reader updates instantly. `themed` colours it with the reader tokens (inside the novel
 * reader); the Settings page (T41) uses it unthemed.
 */
export function ReadingSettingsControls({ themed = false, className }: { themed?: boolean; className?: string }) {
  const t = useTranslations("reader")
  const settings = useAppStore((s) => s.novelSettings)
  const set = useAppStore.getState().setNovelSettings
  const idx = Math.max(0, TEXT_SIZES.indexOf(settings.size as (typeof TEXT_SIZES)[number]))

  const quiet = themed ? "text-reader-quiet" : "text-muted-foreground"
  const track = themed ? "bg-reader-border/60" : ""
  const active = themed
    ? "group-data-[variant=pill]/tabs-list:data-active:bg-reader-page group-data-[variant=pill]/tabs-list:data-active:text-reader-text text-reader-quiet"
    : ""
  const stepper = themed
    ? "border-reader-border bg-transparent text-reader-text hover:bg-reader-border/60 hover:text-reader-text focus-visible:ring-offset-reader-page"
    : ""

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{t("textSize")}</span>
          <span className={cn("text-xs tabular-nums", quiet)}>{t("sizeLabel", { size: settings.size })}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            className={stepper}
            aria-label={t("decrease")}
            disabled={idx <= 0}
            onClick={() => set({ size: TEXT_SIZES[idx - 1] })}
          >
            <MinusIcon />
          </Button>
          <Progress value={(idx / (TEXT_SIZES.length - 1)) * 100} aria-label={t("textSize")} className={themed ? "bg-reader-border" : ""} />
          <Button
            variant="outline"
            size="icon-sm"
            className={stepper}
            aria-label={t("increase")}
            disabled={idx >= TEXT_SIZES.length - 1}
            onClick={() => set({ size: TEXT_SIZES[idx + 1] })}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("theme")}</span>
        <Tabs value={settings.theme} onValueChange={(v) => set({ theme: v as NovelSettings["theme"] })}>
          <TabsList className={cn("w-full", track)}>
            {(["light", "sepia", "dark"] as const).map((v) => (
              <TabsTrigger key={v} value={v} className={active}>
                {t(`theme${v[0].toUpperCase()}${v.slice(1)}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("font")}</span>
        <Tabs value={settings.font} onValueChange={(v) => set({ font: v as NovelSettings["font"] })}>
          <TabsList className={cn("w-full", track)}>
            <TabsTrigger value="sans" className={active}>
              {t("fontSans")}
            </TabsTrigger>
            <TabsTrigger value="serif" className={cn(active, "font-novel")}>
              {t("fontSerif")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="wide-spacing" className="text-sm font-semibold">
          {t("wide")}
        </label>
        <Switch id="wide-spacing" checked={settings.wide} onCheckedChange={(wide) => set({ wide })} />
      </div>
    </div>
  )
}

/** The "Aa" button in the novel reader bar: opens the controls in a themed popover. */
export function ReadingSettingsPopover() {
  const t = useTranslations("reader")
  const theme = useAppStore((s) => s.novelSettings.theme)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("settings")}
          className="gap-1.5 text-reader-text hover:bg-reader-border/60 hover:text-reader-text focus-visible:ring-offset-reader-page"
        >
          <TypeIcon />
          {t("settingsLabel")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-reader-theme={theme}
        className="w-72 border-reader-border bg-reader-page text-reader-text"
      >
        <ReadingSettingsControls themed />
      </PopoverContent>
    </Popover>
  )
}
