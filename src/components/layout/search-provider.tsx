"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { SearchCommand } from "@/components/layout/search-command"

type SearchContextValue = { open: () => void }
const SearchContext = createContext<SearchContextValue>({ open: () => {} })

/** Opens the palette from anywhere: ⌘K / Ctrl+K, the header trigger, the phone Search tab. */
export const useSearch = () => useContext(SearchContext)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = useMemo<SearchContextValue>(() => ({ open: () => setOpen(true) }), [])
  const stable = useCallback((o: boolean) => setOpen(o), [])

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchCommand open={open} onOpenChange={stable} />
    </SearchContext.Provider>
  )
}
