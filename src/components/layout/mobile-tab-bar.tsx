"use client"

import { BookOpenIcon, CoinsIcon, HomeIcon, SearchIcon, UserIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const itemClass =
  "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-control px-1 py-1.5 text-center text-[11px] leading-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"

/**
 * Phone bottom tab bar (< 768 px, spec §0 "Phone tab bar"): Home, Search, Library, Coins, Me (or Log in).
 * Sticky at the bottom, white at 96% with blur. Search opens the search page; Me goes to Settings.
 */
export function MobileTabBar({
  loggedIn,
  onLogin,
}: {
  loggedIn: boolean
  /** Called before navigating to Log in (saves `returnTo`). */
  onLogin?: () => void
}) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)

  const tabs = [
    { key: "home", href: "/", icon: HomeIcon, label: t("home"), current: pathname === "/" },
    { key: "search", href: "/search", icon: SearchIcon, label: t("search"), current: is("/search") },
    { key: "library", href: "/library", icon: BookOpenIcon, label: t("tabLibrary"), current: is("/library") },
    { key: "coins", href: "/coins", icon: CoinsIcon, label: t("tabCoins"), current: is("/coins") },
    loggedIn
      ? { key: "me", href: "/settings", icon: UserIcon, label: t("tabMe"), current: is("/settings") }
      : { key: "me", href: "/login", icon: UserIcon, label: t("logIn"), current: is("/login") },
  ]

  return (
    <nav
      aria-label={t("tabs")}
      className="sticky bottom-0 z-40 border-t bg-background/96 px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-[10px] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {tabs.map(({ key, href, icon: Icon, label, current }) => (
          <li key={key} className="flex min-w-0 flex-1 justify-center">
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              onClick={key === "me" && !loggedIn ? onLogin : undefined}
              className={cn(itemClass, current ? "text-foreground" : "text-muted-foreground")}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
