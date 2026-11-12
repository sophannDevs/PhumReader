import { STORAGE_PREFIX } from "./storage-migration"

/**
 * Storage key for the site theme (Settings > Reading: light / dark / system). Kept out of theme.tsx ("use client")
 * so server code (the root layout) can read it.
 */
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}theme`

/**
 * Inline script for <head>: sets the `dark` class and color-scheme on <html> before first paint, so a dark-theme
 * reader never sees a light flash. ThemeProvider (src/lib/theme.tsx) keeps it in sync after hydration.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");}r.style.colorScheme=d?"dark":"light";}catch(e){}})();`
