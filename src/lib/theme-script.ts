import { STORAGE_MIGRATION_SCRIPT, STORAGE_PREFIX } from "./storage-migration"

/**
 * Storage key for the reader theme (Settings > Reading: light / dark / system). Kept out of theme.tsx ("use client")
 * so the server layout can read it. V2.1 keeps the site itself light only.
 */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}theme`

/** Runs in <head> before paint: moves old `phumreader.` / `toonwave.` keys to `phumireader.` (once). */
export const THEME_INIT_SCRIPT = `${STORAGE_MIGRATION_SCRIPT}try{document.documentElement.style.colorScheme="light"}catch(e){}`
