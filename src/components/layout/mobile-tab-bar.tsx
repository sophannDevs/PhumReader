"use client"

import { BookOpenIcon, CoinsIcon, HomeIcon, SearchIcon, UserIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const itemClass =
  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-control px-1 py-2 text-[11px] leading-none font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"

/**
 * Phone bottom tab bar (< 768 px), sticky, with safe-area padding. Current tab
 * is dark, the rest muted. Me goes to Settings when logged in, else Log in.
 */
export function MobileTabBar({
  loggedIn,
  onSearchOpen,
  onLogin,
}: {
  loggedIn: boolean
  onSearchOpen?: () => void
  /** Called before navigating to Log in (T19 saves `returnTo`). */
  onLogin?: () => void
}) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)

  const tabs = [
    { key: "home", href: "/", icon: HomeIcon, current: pathname === "/" },
    { key: "library", href: "/library", icon: BookOpenIcon, current: is("/library") },
    { key: "coins", href: "/coins", icon: CoinsIcon, current: is("/coins") },
  ] as const
  const label = { home: t("home"), library: t("tabLibrary"), coins: t("tabCoins") }

  const tone = (current: boolean) => (current ? "text-foreground" : "text-muted-foreground")

  return (
    <nav
      aria-label={t("tabs")}
      className="sticky bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch px-1">
        <li className="flex flex-1">
          <Link
            href="/"
            aria-current={tabs[0].current ? "page" : undefined}
            className={cn(itemClass, tone(tabs[0].current))}
          >
            <HomeIcon className="size-5" aria-hidden />
            {label.home}
          </Link>
        </li>
        <li className="flex flex-1">
          <button type="button" onClick={onSearchOpen} className={cn(itemClass, tone(false))}>
            <SearchIcon className="size-5" aria-hidden />
            {t("search")}
          </button>
        </li>
        {tabs.slice(1).map(({ key, href, icon: Icon, current }) => (
          <li key={key} className="flex flex-1">
            <Link href={href} aria-current={current ? "page" : undefined} className={cn(itemClass, tone(current))}>
              <Icon className="size-5" aria-hidden />
              {label[key as "library" | "coins"]}
            </Link>
          </li>
        ))}
        <li className="flex flex-1">
          {loggedIn ? (
            <Link
              href="/settings"
              aria-current={is("/settings") ? "page" : undefined}
              className={cn(itemClass, tone(is("/settings")))}
            >
              <UserIcon className="size-5" aria-hidden />
              {t("tabMe")}
            </Link>
          ) : (
            <Link href="/login" onClick={onLogin} className={cn(itemClass, tone(is("/login")))}>
              <UserIcon className="size-5" aria-hidden />
              {t("logIn")}
            </Link>
          )}
        </li>
      </ul>
    </nav>
  )
}
