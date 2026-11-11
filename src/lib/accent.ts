import { STORAGE_PREFIX } from "./storage-migration"

/**
 * Accent colour chosen in Settings > Appearance. Each preset overrides the brand tokens from globals.css on <html>,
 * so every `bg-primary`, `text-brand-ink`, focus ring … in the whole site follows the choice. "green" is the V2.1
 * default and sets nothing. Kept free of "use client" so the layout can inline it into the first-paint script.
 */
export const ACCENT_STORAGE_KEY = `${STORAGE_PREFIX}accent`

type Tokens = {
  primary: string
  hover: string
  fg: string
  ink: string
  soft: string
  softBorder: string
  selected: string
  ring: string
}

export const ACCENTS = {
  green: { primary: "#00dc64", hover: "#00c85a", fg: "#04210f", ink: "#047a3a", soft: "#e8fbf0", softBorder: "#bbf0d0", selected: "#f6fef9", ring: "#00a650" },
  blue: { primary: "#2563eb", hover: "#1d4ed8", fg: "#ffffff", ink: "#1d4ed8", soft: "#eff6ff", softBorder: "#bfdbfe", selected: "#f5f9ff", ring: "#2563eb" },
  purple: { primary: "#7c3aed", hover: "#6d28d9", fg: "#ffffff", ink: "#6d28d9", soft: "#f5f3ff", softBorder: "#ddd6fe", selected: "#faf8ff", ring: "#7c3aed" },
  pink: { primary: "#db2777", hover: "#be185d", fg: "#ffffff", ink: "#be185d", soft: "#fdf2f8", softBorder: "#fbcfe8", selected: "#fff7fb", ring: "#db2777" },
  orange: { primary: "#f97316", hover: "#ea580c", fg: "#2a1203", ink: "#c2410c", soft: "#fff7ed", softBorder: "#fed7aa", selected: "#fffaf5", ring: "#ea580c" },
  teal: { primary: "#14b8a6", hover: "#0d9488", fg: "#04201c", ink: "#0f766e", soft: "#f0fdfa", softBorder: "#99f6e4", selected: "#f7fffd", ring: "#0d9488" },
} as const satisfies Record<string, Tokens>

export type Accent = keyof typeof ACCENTS
export const ACCENT_IDS = Object.keys(ACCENTS) as Accent[]
export const DEFAULT_ACCENT: Accent = "green"

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && v in ACCENTS
}

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_STORAGE_KEY)
    return isAccent(v) ? v : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

const VARS: [string, keyof Tokens][] = [
  ["--primary", "primary"],
  ["--primary-hover", "hover"],
  ["--primary-foreground", "fg"],
  ["--brand-ink", "ink"],
  ["--brand-soft", "soft"],
  ["--brand-soft-border", "softBorder"],
  ["--selected", "selected"],
  ["--ring", "ring"],
]

export function applyAccent(accent: Accent) {
  const style = document.documentElement.style
  for (const [name, key] of VARS) {
    if (accent === DEFAULT_ACCENT) style.removeProperty(name)
    else style.setProperty(name, ACCENTS[accent][key])
  }
  document.documentElement.dataset.accent = accent
}

export function saveAccent(accent: Accent) {
  applyAccent(accent)
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent)
    window.dispatchEvent(new CustomEvent("phumireader:accent", { detail: accent }))
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/** Inline script run before first paint so a saved accent does not flash green. */
export const ACCENT_BOOT_SCRIPT = `(function(){try{var a=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});var P=${JSON.stringify(ACCENTS)};var t=P[a];if(!t||a==="green")return;var s=document.documentElement.style;var m={"--primary":"primary","--primary-hover":"hover","--primary-foreground":"fg","--brand-ink":"ink","--brand-soft":"soft","--brand-soft-border":"softBorder","--selected":"selected","--ring":"ring"};for(var k in m)s.setProperty(k,t[m[k]]);document.documentElement.dataset.accent=a}catch(e){}})()`
