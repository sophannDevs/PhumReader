"use client"

import { useEffect } from "react"
import { useAppStore } from "@/lib/store"

/** Loads the persisted state after the first render (skipHydration), so SSR markup matches. */
export function StoreHydrator() {
  useEffect(() => {
    void useAppStore.persist.rehydrate()
  }, [])
  return null
}
