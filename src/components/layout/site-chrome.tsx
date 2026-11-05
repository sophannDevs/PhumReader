"use client"

import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { useSearch } from "@/components/layout/search-provider"
import { SiteHeader } from "@/components/layout/site-header"

// Connected wrappers: the server layout can't pass callbacks, so these read the
// search context. T19 also reads `user` / `coins` from the store here.
export function ConnectedHeader() {
  const { open } = useSearch()
  return <SiteHeader user={null} coins={3} onSearchOpen={open} />
}

export function ConnectedTabBar() {
  const { open } = useSearch()
  return <MobileTabBar loggedIn={false} onSearchOpen={open} />
}
