"use client"

import type { CSSProperties } from "react"
import { type AppSettings, type NovelSettings, useAppStore } from "@/lib/store"
import { useTheme } from "@/lib/theme"

/**
 * Colours of the two readers (prototype Viewer `.vw` / `.vw.light` and Novel `.nr` / `.nr.sepia` / `.nr.dark`).
 * The readers set the shadcn tokens on their root, so the shared parts inside them (buttons, inputs, comment
 * threads) take the reader's colours. Dialogs and popovers render in a portal, outside the root: popovers carry
 * the same variables, dialogs stay light (as in the prototype).
 */

/** Comic reader, dark background: the zinc tokens of the prototype's `.vw`. Badges keep their light colours. */
const COMIC_DARK = {
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

export const comicVars = (bg: "dark" | "light"): CSSProperties | undefined => (bg === "dark" ? COMIC_DARK : undefined)

/** Novel reader themes (prototype `.nr.sepia` / `.nr.dark`); light uses the site tokens. */
const NOVEL_VARS: Record<NovelSettings["theme"], CSSProperties | undefined> = {
  light: undefined,
  sepia: {
    "--border": "#e3d6bf",
    "--input": "#e3d6bf",
    "--background": "#fbf6ec",
    "--accent": "#efe5d2",
    "--muted": "#efe5d2",
    "--card": "#fbf6ec",
    "--popover": "#fbf6ec",
  } as CSSProperties,
  dark: {
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

export const novelVars = (theme: NovelSettings["theme"]): CSSProperties | undefined => NOVEL_VARS[theme]

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
