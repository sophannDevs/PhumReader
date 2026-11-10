import { STORAGE_PREFIX } from "./storage-migration"

/**
 * Storage key for the reader theme (Settings > Reading: light / dark / system). Kept out of theme.tsx ("use client")
 * so server code can read it. V2.1 keeps the site itself light only, so no first-paint script is needed.
 */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}theme`
