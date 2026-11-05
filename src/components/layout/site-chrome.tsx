"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { useSearch } from "@/components/layout/search-provider"
import { SiteHeader } from "@/components/layout/site-header"
import { usePathname } from "@/i18n/navigation"
import { useAppStore, useCoins, useUser } from "@/lib/store"

/** Remember the current page so Log in / Sign up can send the reader back (not from the login page itself). */
function useSaveReturnTo() {
  const pathname = usePathname()
  return () => {
    if (pathname.startsWith("/login")) return
    useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)
  }
}

// Connected wrappers: the server layout can't pass callbacks, so these read the
// search context and the store.
export function ConnectedHeader() {
  const { open } = useSearch()
  const user = useUser()
  const coins = useCoins()
  const t = useTranslations("toasts")
  const saveReturnTo = useSaveReturnTo()

  return (
    <SiteHeader
      user={user}
      coins={coins}
      onSearchOpen={open}
      onLogin={saveReturnTo}
      onLogout={() => {
        useAppStore.getState().logout()
        toast.success(t("loggedOut"))
      }}
    />
  )
}

export function ConnectedTabBar() {
  const { open } = useSearch()
  const user = useUser()
  const saveReturnTo = useSaveReturnTo()
  return <MobileTabBar loggedIn={!!user} onSearchOpen={open} onLogin={saveReturnTo} />
}
