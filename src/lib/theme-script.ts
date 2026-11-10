import { STORAGE_MIGRATION_SCRIPT, STORAGE_PREFIX } from "./storage-migration"

/** Storage key and first-paint script for the theme. Kept out of theme.tsx ("use client") so the server layout can read the string. */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}theme`

/**
 * Runs in <head> before paint: first moves old `phumreader.` / `toonwave.` keys to `phumireader.` (once), then sets
 * the `dark` class on <html> from the stored choice or the OS.
 */
export const THEME_INIT_SCRIPT = `${STORAGE_MIGRATION_SCRIPT}try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`
