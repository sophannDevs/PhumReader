"use client"

import type { CSSProperties } from "react"
import { type AppSettings, type NovelSettings, useAppStore } from "@/lib/store"
import { useTheme } from "@/lib/theme"

/**
 * Colours of the two readers (prototype Viewer `.vw` / `.vw.light` and Novel `.nr` / `.nr.sepia` / `.nr.dark`).
 * The readers set the shadcn tokens on their root, so the shared parts inside them (buttons, inputs, comment
 * threads) take the reader's colours, whatever the site theme is. Dialogs and popovers render in a portal, outside
 * the root: popovers carry the same variables, dialogs follow the site theme (Settings > Reading > Theme).
 */

/** The full light zinc set (globals.css `:root`), so a light reader stays light when the site is dark. */
const LIGHT_BASE = {
  colorScheme: "light",
  "--background": "#ffffff",
  "--foreground": "#09090b",
  "--card": "#ffffff",
  "--card-foreground": "#09090b",
  "--popover": "#ffffff",
  "--popover-foreground": "#09090b",
  "--muted": "#f4f4f5",
  "--muted-foreground": "#6b6b74",
  "--secondary": "#f4f4f5",
  "--secondary-foreground": "#18181b",
  "--accent": "#f4f4f5",
  "--accent-foreground": "#18181b",
  "--border": "#e4e4e7",
  "--input": "#e4e4e7",
  "--ring": "#00a650",
  "--brand-ink": "#047a3a",
  "--brand-soft": "#e8fbf0",
  "--brand-soft-border": "#bbf0d0",
  "--subtle": "#fafafa",
  "--soft-foreground": "#3f3f46",
  "--strong-foreground": "#27272a",
  "--border-strong": "#a1a1aa",
  "--border-hover": "#d4d4d8",
  "--track": "#d4d4d8",
  "--brand-line": "#c9f1da",
  "--shine": "#ffffff",
  "--primary-hover": "#00c85a",
  "--selected": "#f6fef9",
  "--destructive": "#dc2626",
  "--destructive-soft": "#fef2f2",
  "--destructive-border": "#fecaca",
  "--destructive-ink": "#991b1b",
  "--warning": "#b45309",
  "--warning-soft": "#fffbeb",
  "--warning-border": "#fde68a",
  "--warning-ink": "#92400e",
  "--up": "#fee2e2",
  "--up-foreground": "#b91c1c",
  "--info-soft": "#eff6ff",
  "--info-ink": "#1d4ed8",
  "--brand-wash-from": "#effcf4",
  "--brand-wash-to": "#ffffff",
  "--shadow-xs": "0 1px 2px rgba(9, 9, 11, 0.05)",
  "--shadow-md": "0 4px 12px rgba(9, 9, 11, 0.08)",
  "--shadow-lg": "0 16px 48px rgba(9, 9, 11, 0.16)",
} as CSSProperties

/** The page-level neutral steps in dark (globals.css `.dark`), so a dark reader stays dark on a light site. */
const DARK_STEPS = {
  "--subtle": "#111113",
  "--soft-foreground": "#d4d4d8",
  "--strong-foreground": "#e4e4e7",
  "--border-strong": "#71717a",
  "--border-hover": "#3f3f46",
  "--track": "#3f3f46",
  "--brand-line": "#14532d",
  "--shine": "rgba(255, 255, 255, 0.06)",
  "--primary-hover": "#33e583",
  "--brand-soft": "#052e16",
  "--brand-soft-border": "#14532d",
  "--selected": "#0a1f13",
  "--destructive": "#ef4444",
  "--destructive-soft": "#2a0f10",
  "--destructive-border": "#7f1d1d",
  "--destructive-ink": "#fca5a5",
  "--warning": "#f59e0b",
  "--warning-soft": "#271a05",
  "--warning-border": "#78350f",
  "--warning-ink": "#fcd34d",
  "--info-soft": "#172554",
  "--info-ink": "#93c5fd",
  "--brand-wash-from": "#0a1f13",
  "--brand-wash-to": "var(--card)",
  "--shadow-xs": "0 1px 2px rgba(0, 0, 0, 0.4)",
  "--shadow-md": "0 4px 12px rgba(0, 0, 0, 0.5)",
  "--shadow-lg": "0 16px 48px rgba(0, 0, 0, 0.6)",
} as CSSProperties

/** Comic reader, dark background: the zinc tokens of the prototype's `.vw`. Badges keep their light colours. */
const COMIC_DARK = {
  ...DARK_STEPS,
  colorScheme: "dark",
  "--background": "#09090b",
  "--foreground": "#fafafa",
  "--card": "#18181b",
  "--card-foreground": "#fafafa",
  "--muted": "#27272a",
  "--muted-foreground": "#a1a1aa",
  "--secondary": "#27272a",
  "--secondary-foreground": "#fafafa",
  "--accent": "#27272a",
  "--accent-foreground": "#fafafa",
  "--border": "#27272a",
  "--input": "#3f3f46",
  "--ring": "#00dc64",
  "--brand-ink": "#4ade80",
} as CSSProperties

/** Comic reader, light background (prototype `.vw.light`): the light zinc set, even on a dark site. */
const COMIC_LIGHT = LIGHT_BASE

export const comicVars = (bg: "dark" | "light"): CSSProperties => (bg === "dark" ? COMIC_DARK : COMIC_LIGHT)

/** Novel reader themes (prototype `.nr` / `.nr.sepia` / `.nr.dark`), independent of the site theme. */
const NOVEL_VARS: Record<NovelSettings["theme"], CSSProperties> = {
  light: LIGHT_BASE,
  sepia: {
    ...LIGHT_BASE,
    "--border": "#e3d6bf",
    "--input": "#e3d6bf",
    "--background": "#fbf6ec",
    "--accent": "#efe5d2",
    "--muted": "#efe5d2",
    "--card": "#fbf6ec",
    "--popover": "#fbf6ec",
    "--foreground": "#09090b",
    "--muted-foreground": "#6b6b74",
    "--brand-ink": "#047a3a",
    "--ring": "#00a650",
  } as CSSProperties,
  dark: {
    ...DARK_STEPS,
    colorScheme: "dark",
    "--border": "#27272a",
    "--input": "#3f3f46",
    "--background": "#18181b",
    "--accent": "#27272a",
    "--card": "#18181b",
    "--foreground": "#fafafa",
    "--muted": "#27272a",
    "--muted-foreground": "#a1a1aa",
    "--popover": "#18181b",
    "--ring": "#00dc64",
    "--brand-ink": "#4ade80",
  } as CSSProperties,
}

export const novelVars = (theme: NovelSettings["theme"]): CSSProperties => NOVEL_VARS[theme]

/** Settings > Reading text size presets (A− A A+ A++). */
export const SETTINGS_SIZE_PX: Record<AppSettings["size"], number> = { s: 16, m: 18, l: 20, xl: 22 }

/**
 * The novel reader's settings. Until the reader picks its own in the Aa popover (`novelCustom`), the size and the
 * theme come from Settings: the text size preset and the reader theme (light / dark / system).
 */
export function useNovelSettings() {
  const stored = useAppStore((s) => s.novelSettings)
  const custom = useAppStore((s) => s.novelCustom)
  const preset = useAppStore((s) => s.settings.size)
  const { resolvedTheme } = useTheme()
  const settings: NovelSettings = custom
    ? stored
    : { ...stored, size: SETTINGS_SIZE_PX[preset] ?? stored.size, theme: resolvedTheme ?? stored.theme }
  const choose = (patch: Partial<NovelSettings>) => useAppStore.getState().chooseNovelSettings({ ...settings, ...patch })
  return { settings, choose }
}
