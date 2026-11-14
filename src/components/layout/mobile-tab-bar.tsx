"use client"

import { useSyncExternalStore } from "react"
import { CoinsIcon } from "lucide-react"
import { AnimateIcon } from "@animate-ui/react/icons"
import { BookOpenIcon } from "@/components/animate-ui/icons/book-open"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import { SearchIcon } from "@/components/animate-ui/icons/search"
import { UserIcon } from "@/components/animate-ui/icons/user"
import {
  BottomNavigation,
  BottomNavigationHighlight,
  BottomNavigationHighlightItem,
  BottomNavigationItem,
  BottomNavigationLabel,
} from "@animate-ui/react/primitives/bottom-navigation"
import { useTranslations } from "@/i18n/translations"
import { Link, usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const DESKTOP = "(min-width: 768px)"

/**
 * True from 768 px up. The bar is not rendered there (CSS `display: none` is not enough: Animate UI still
 * starts animations on scroll, and the browser throws "commitStyles: Target element is not rendered").
 * The server assumes a phone, so the bar is in the first HTML.
 */
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP)
      mq.addEventListener("change", notify)
      return () => mq.removeEventListener("change", notify)
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  )
}

const itemClass =
  "flex h-[3.5rem] w-[clamp(3.5rem,17vw,4.5rem)] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-center text-[11px] leading-[14px] font-medium transition-colors outline-none data-[minimized]:size-12 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"

/**
 * Phone bottom tab bar (< 768 px, spec §0 "Phone tab bar"): Home, Search, Library, Coins, Me (or Log in).
 * Floating pill, fixed at the bottom; minimizes to icons on scroll (Animate UI). Search opens the search page; Me goes to Settings.
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
  const desktop = useIsDesktop()
  const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`)

  const tabs = [
    {
      key: "home",
      href: "/",
      icon: HomeIcon,
      label: t("home"),
      current: pathname === "/",
    },
    {
      key: "search",
      href: "/search",
      icon: SearchIcon,
      label: t("search"),
      current: is("/search"),
    },
    {
      key: "library",
      href: "/library",
      icon: BookOpenIcon,
      label: t("tabLibrary"),
      current: is("/library"),
    },
    {
      key: "coins",
      href: "/coins",
      icon: CoinsIcon,
      label: t("tabCoins"),
      current: is("/coins"),
    },
    loggedIn
      ? {
          key: "me",
          href: "/settings",
          icon: UserIcon,
          label: t("tabMe"),
          current: is("/settings"),
        }
      : {
          key: "me",
          href: "/login",
          icon: UserIcon,
          label: t("logIn"),
          current: is("/login"),
        },
  ]

  if (desktop) return null

  return (
    <>
      {/* Constant space so the fixed bar never changes the page height (that made it flip while at the bottom). */}
      <div
        aria-hidden
        className="h-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom))] md:hidden"
      />
      <BottomNavigation
        value={tabs.find((x) => x.current)?.key}
        scrollBehavior="minimize"
        aria-label={t("tabs")}
        className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center md:hidden"
      >
        <BottomNavigationHighlight className="absolute inset-y-1 rounded-full bg-muted">
          <ul className="flex items-stretch rounded-full bg-background/95 px-1 shadow-lg ring-1 ring-border backdrop-blur-[10px]">
            {tabs.map(({ key, href, icon: Icon, label, current }) => (
              <li key={key} className="flex min-w-0 justify-center">
                <BottomNavigationHighlightItem
                  value={key}
                  className="flex justify-center"
                >
                  <AnimateIcon asChild animateOnHover>
                    <BottomNavigationItem
                      asChild
                      value={key}
                      className={cn(
                        itemClass,
                        current ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Link
                        href={href}
                        aria-current={current ? "page" : undefined}
                        onClick={
                          key === "me" && !loggedIn ? onLogin : undefined
                        }
                      >
                        <Icon className="size-5" aria-hidden />
                        <BottomNavigationLabel>{label}</BottomNavigationLabel>
                      </Link>
                    </BottomNavigationItem>
                  </AnimateIcon>
                </BottomNavigationHighlightItem>
              </li>
            ))}
          </ul>
        </BottomNavigationHighlight>
      </BottomNavigation>
    </>
  )
}
