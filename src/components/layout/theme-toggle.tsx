"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "@/lib/theme"
import { useTranslations } from "next-intl"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"

const subscribe = () => () => {}

/** Header icon button: flips between light and dark (the Settings page also offers "System"). */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("nav")
  const { resolvedTheme, setTheme } = useTheme()
  // resolvedTheme is unknown on the server; render a neutral label until mounted.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={dark ? t("themeToLight") : t("themeToDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
