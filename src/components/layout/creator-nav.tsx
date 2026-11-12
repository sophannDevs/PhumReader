"use client"

import { PencilLineIcon as PenLineIcon } from "@/components/animate-ui/icons/pencil-line"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef } from "react"
import { Link, usePathname } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useCreator } from "@/lib/queries"
import { creatorHandle } from "@/lib/routes"
import { useAppStore, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * CreatorNav (foundations §8, prototype cnav.html `.c-hero` + `.cnav`): the grey band under the site header on every
 * creator page, with "Creator studio · {name}" and underline tabs Dashboard, New series, Upload episode, Earnings,
 * Public profile. The current tab comes from the address (Manage series counts as Dashboard, like the prototype);
 * pass `active` to override it. On phones the tabs scroll sideways and the current one is scrolled into view.
 */

export type CreatorTab = "dashboard" | "new" | "upload" | "earnings" | "profile"

/** The signed-in account's profile handle ("Dara Vann" → "dara-vann"), or null when logged out. */
export function useOwnHandle(): string | null {
  const user = useUser()
  const dashboard = useCreator()
  // Real API (V21-05): the creator's own handle comes with the dashboard.
  if (!DEMO_MODE) return dashboard.data?.handle ?? null
  return user ? creatorHandle(user.name) : null
}

/** The creator's display name: the saved profile name, else the real API's pen name, else the account name. */
export function useStudioName(): string {
  const user = useUser()
  const profile = useAppStore((s) => s.profile)
  const dashboard = useCreator()
  const handle = user ? creatorHandle(user.name) : ""
  if (profile?.name.trim() && (!profile.handle || profile.handle === handle)) return profile.name
  if (!DEMO_MODE && dashboard.data?.name) return dashboard.data.name
  return user?.name ?? ""
}

function activeFrom(path: string): CreatorTab | undefined {
  if (path === "/creator" || path.startsWith("/creator/series")) return "dashboard"
  if (path.startsWith("/creator/new")) return "new"
  if (path.startsWith("/creator/upload")) return "upload"
  if (path.startsWith("/creator/earnings")) return "earnings"
  if (path.startsWith("/creators/")) return "profile"
  return undefined
}

export function CreatorNav({ active, className }: { active?: CreatorTab; className?: string }) {
  const t = useTranslations("creator")
  const pathname = usePathname()
  const name = useStudioName()
  const handle = useOwnHandle()
  const current = active ?? activeFrom(pathname)
  const navRef = useRef<HTMLElement>(null)

  const tabs: { id: CreatorTab; href: string; label: string }[] = [
    { id: "dashboard", href: "/creator", label: t("navDashboard") },
    { id: "new", href: "/creator/new", label: t("navNew") },
    { id: "upload", href: "/creator/upload", label: t("navUpload") },
    { id: "earnings", href: "/creator/earnings", label: t("navEarnings") },
    { id: "profile", href: handle ? `/creators/${handle}?view=owner` : "/creator", label: t("navProfile") },
  ]

  // Phones: bring the current tab into view when it starts off-screen (Earnings, Public profile).
  useEffect(() => {
    const nav = navRef.current
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !el) return
    if (el.offsetLeft + el.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = el.offsetLeft - 16
  }, [current])

  return (
    <div className={cn("border-b bg-[#fafafa]", className)}>
      <div className="container flex flex-col gap-3.5 pt-6">
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
          <PenLineIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{t("studio", { name })}</span>
        </p>
        <nav
          ref={navRef}
          aria-label={t("navLabel")}
          className="relative -mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const on = tab.id === current
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-t-sm border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
