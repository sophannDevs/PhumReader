"use client"

import { BellIcon, BookOpenIcon, CoinsIcon, LogOutIcon, PenLineIcon, SearchIcon, ShieldCheckIcon, SlidersHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useSyncExternalStore } from "react"
import { CoinChip } from "@/components/pr/coin-chip"
import { LanguageButton } from "@/components/layout/language-switch"
import { Logo } from "@/components/layout/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link, usePathname } from "@/i18n/navigation"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

export type HeaderUser = { name: string; roles?: string[]; avatarUrl?: string | null }

/** The `format` query param (Web novels = /genres?format=novel), read without a Suspense boundary. */
function useFormatParam(): string | null {
  usePathname() // re-render on client navigations
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange)
      return () => window.removeEventListener("popstate", onChange)
    },
    () => new URLSearchParams(window.location.search).get("format"),
    () => null
  )
}

/**
 * Sticky site header (spec §0 "Header", foundations §8 "Header actions"): 64 px (56 px on phones), page colour at
 * 92% with blur. Right side, in order: search · language pill · coin chip · bell (logged in) · avatar menu.
 * At ≤420 px the gaps shrink to 4 px so everything fits in 390 px.
 */
export function SiteHeader({
  user,
  coins,
  unread = 0,
  onSearchOpen,
  onLogin,
  onLogout,
  className,
}: {
  user: HeaderUser | null
  coins: number
  /** Unread notifications (red count on the bell) */
  unread?: number
  onSearchOpen?: () => void
  /** Called before navigating to Log in / Sign up (saves `returnTo`). */
  onLogin?: () => void
  onLogout?: () => void
  className?: string
}) {
  const t = useTranslations("nav")
  const tc = useTranslations("coins")
  const pathname = usePathname()
  const format = useFormatParam()

  const navItems = [
    { key: "home", href: "/", current: pathname === "/" },
    { key: "rankings", href: "/rankings", current: pathname.startsWith("/rankings") },
    { key: "genres", href: "/genres", current: pathname.startsWith("/genres") && format !== "novel" },
    { key: "novels", href: "/genres?format=novel", current: pathname.startsWith("/genres") && format === "novel" },
  ] as const

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/92 backdrop-blur-[10px] backdrop-saturate-[1.6]", className)}>
      <div className="container flex h-14 items-center gap-2.5 md:h-16 md:gap-3 lg:gap-5">
        <Logo size="header" />

        <nav aria-label={t("main")} className="hidden items-center gap-0.5 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-control px-2 text-sm whitespace-nowrap transition-colors outline-none hover:bg-accent hover:text-foreground lg:px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                item.current ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 max-[420px]:gap-1">
          {/* Desktop: 280 px trigger with ⌘K; tablet: 36 px icon; phone: ghost icon */}
          <button
            type="button"
            onClick={onSearchOpen}
            aria-label={t("search")}
            className="hidden h-9 items-center justify-center gap-2 rounded-control border bg-muted text-sm text-muted-foreground transition-colors outline-none hover:bg-[#ececee] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:flex md:w-9 lg:w-[280px] lg:justify-start lg:pr-2 lg:pl-3"
          >
            <SearchIcon className="size-4 shrink-0" aria-hidden />
            <span className="hidden flex-1 truncate text-left lg:block">{t("searchPlaceholder")}</span>
            <kbd
              className="hidden h-5 items-center rounded-[4px] border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground lg:inline-flex"
              aria-hidden
            >
              ⌘K
            </kbd>
          </button>
          <Button variant="ghost" size="icon" aria-label={t("search")} onClick={onSearchOpen} className="md:hidden">
            <SearchIcon className="size-[18px]" />
          </Button>

          <LanguageButton />
          <CoinChip count={coins} />

          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative rounded-full">
                <Link href="/notifications" aria-label={unread > 0 ? t("bellUnread", { count: unread }) : t("notifications")}>
                  <BellIcon className="size-[18px]" />
                  {unread > 0 ? (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-0 h-4 min-w-4 rounded-full bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white tabular-nums ring-2 ring-background"
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("accountMenu")}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Avatar variant="brand">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback aria-hidden>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">{tc("balanceLabel", { count: coins })}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/library">
                      <BookOpenIcon /> {t("myLibrary")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications">
                      <BellIcon /> {t("notifications")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/coins">
                      <CoinsIcon /> {t("getCoins")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/creator">
                      <PenLineIcon /> {t("creatorDashboard")}
                    </Link>
                  </DropdownMenuItem>
                  {user.roles?.includes("ADMIN") ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <ShieldCheckIcon /> {t("admin")}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <SlidersHorizontalIcon /> {t("settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOutIcon /> {t("logOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link href="/login" onClick={onLogin}>
                  {t("logIn")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm" className="hidden md:inline-flex">
                <Link href="/login?mode=signup" onClick={onLogin}>
                  {t("signUp")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm" className="md:hidden">
                <Link href="/login" onClick={onLogin}>
                  {t("logIn")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
