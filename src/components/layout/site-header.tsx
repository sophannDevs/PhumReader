"use client"

import { BookOpenIcon, CoinsIcon, LogOutIcon, PenLineIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CoinChip } from "@/components/pr/coin-chip"
import { Logo } from "@/components/layout/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

export type HeaderUser = { name: string }

// Targets per design/spec.md §0 until the pages exist (T43 moves Rankings / Genres).
const navItems = [
  { key: "home", href: "/", current: (p: string) => p === "/" },
  { key: "rankings", href: "/#rank", current: (p: string) => p.startsWith("/rankings") },
  { key: "genres", href: "/#genres", current: (p: string) => p.startsWith("/genres") },
  { key: "novels", href: "/#novels", current: () => false },
] as const

/**
 * Sticky site header: 64 px (56 px on phones), white at 92% with blur.
 * Props-driven (`user`, `coins`); T19 connects it to the store.
 */
export function SiteHeader({
  user,
  coins,
  onSearchOpen,
  onLogin,
  onLogout,
  className,
}: {
  user: HeaderUser | null
  coins: number
  onSearchOpen?: () => void
  /** Called before navigating to Log in / Sign up (T19 saves `returnTo`). */
  onLogin?: () => void
  onLogout?: () => void
  className?: string
}) {
  const t = useTranslations("nav")
  const tc = useTranslations("coins")
  const pathname = usePathname()

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/92",
        className
      )}
    >
      <div className="container flex h-14 items-center gap-3 md:h-16 md:gap-6">
        <Logo size="header" />

        <nav aria-label={t("main")} className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const current = item.current(pathname)
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-control px-3 py-1.5 text-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={onSearchOpen}
            className="hidden h-9 w-48 items-center xl:w-72 gap-2 rounded-control border bg-muted/60 px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:flex"
          >
            <SearchIcon className="size-4" aria-hidden />
            <span className="flex-1 truncate text-left">{t("searchPlaceholder")}</span>
            <kbd className="rounded border bg-background px-1.5 text-[11px] font-medium" aria-hidden>
              ⌘K
            </kbd>
          </button>
          <Button variant="ghost" size="icon" aria-label={t("search")} onClick={onSearchOpen} className="lg:hidden">
            <SearchIcon />
          </Button>

          <CoinChip count={coins} />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("accountMenu")}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Avatar variant="brand">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {tc("balanceLabel", { count: coins })}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/library">
                    <BookOpenIcon /> {t("myLibrary")}
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
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden lg:inline-flex">
                <Link href="/login" onClick={onLogin}>
                  {t("logIn")}
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm" className="lg:hidden">
                <Link href="/login" onClick={onLogin}>
                  {t("logIn")}
                </Link>
              </Button>
              <Button asChild variant="brand" className="hidden lg:inline-flex">
                <Link href="/login?mode=signup" onClick={onLogin}>
                  {t("signUp")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
