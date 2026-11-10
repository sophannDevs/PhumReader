"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "@/i18n/navigation"

/**
 * Demo only (/demo/crash): throws while rendering in the browser so the 500 page (error.tsx) can be seen. The 500
 * page's demo retry calls `recoverDemoCrash()` before it re-renders the route, so the second retry "works" and this
 * page then takes the reader Home, like the prototype's "Fixed. Taking you back…".
 */
const state = { recovered: false }

export function recoverDemoCrash() {
  state.recovered = true
}

const noSubscribe = () => () => {}

export function DemoCrash() {
  const router = useRouter()
  // Client render only: the server render (and the first hydration pass) stays quiet.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false)
  const crash = inBrowser && !state.recovered
  useEffect(() => {
    if (inBrowser && state.recovered) router.replace("/")
  }, [inBrowser, router])
  useEffect(
    () => () => {
      state.recovered = false
    },
    []
  )
  if (crash) throw new Error("Demo crash: shows the 500 page")
  return <div className="flex-1" />
}
