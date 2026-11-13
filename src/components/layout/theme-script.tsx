"use client"

import { themeInitScript } from "@/lib/theme-script"

/**
 * The first-paint theme script for <head> (Settings > Reading > Theme). The server HTML carries it as
 * `text/javascript`, so the browser runs it before first paint. When the client creates the element itself (the root
 * layout remounts on an en/km switch, error recovery, HMR) the script would never run anyway, and React 19 logs
 * "Encountered a script tag while rendering React component" for it; so the client copy is `text/plain` (inert, no
 * warning) and `suppressHydrationWarning` accepts the type mismatch. ThemeProvider (src/lib/theme.tsx) keeps `.dark`
 * in sync after hydration. Pattern from the Next.js guide "Preventing flash before hydration" > "Extracting a reusable
 * component". It has to be a Client Component: in the Server Component layout the `typeof window` check would only
 * ever run on the server.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  )
}
