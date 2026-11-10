"use client"

import { THEME_STORAGE_KEY } from "@/lib/theme-script"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * Light / dark / system theme. Replaces next-themes, whose inline <script> inside a client component
 * makes React 19 log a console error. The first-paint script (theme-script.ts) is rendered
 * by the server layout, so there is no flash of the wrong theme.
 */
export type Theme = "light" | "dark" | "system"


type ThemeContextValue = {
  theme: Theme | undefined
  resolvedTheme: "light" | "dark" | undefined
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: undefined,
  resolvedTheme: undefined,
  setTheme: () => {},
})

function readStored(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}

/**
 * V2.1 is light only (foundations.md: "Light theme only"); the stored choice is the *reader* theme
 * (Settings > Reading), used by the novel reader. So the site itself always stays light.
 */
function apply() {
  const root = document.documentElement
  root.classList.remove("dark")
  root.style.colorScheme = "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Undefined until mounted, so server and first client render agree (same as next-themes).
  const [theme, setThemeState] = useState<Theme | undefined>(undefined)
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setThemeState(readStored())
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDark(mq.matches)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener("change", onChange)
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) setThemeState(readStored())
    }
    window.addEventListener("storage", onStorage)
    return () => {
      mq.removeEventListener("change", onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const resolvedTheme = theme === undefined ? undefined : theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    if (resolvedTheme) apply()
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
    apply()
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
