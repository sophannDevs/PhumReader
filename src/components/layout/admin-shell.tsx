"use client"

import { ShieldAlertIcon } from "@/components/animate-ui/icons/shield-alert"
import { LogInIcon } from "@/components/animate-ui/icons/log-in"
import { AnimateIcon } from "@animate-ui/react/icons"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef } from "react"
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight"
import { Logo } from "@/components/layout/logo"
import { SkipLink } from "@/components/layout/skip-link"
import { AdminDecisions, AdminError } from "@/components/pr/admin-kit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, usePathname } from "@/i18n/navigation"
import { ApiError } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import { priorityOf, useAdminQueues, useOverview, usePaymentCounts, useReports } from "@/lib/admin"
import { initials } from "@/lib/format"
import { isAdmin, useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

type Access = "wait" | "login" | "denied" | "error" | "ok"

/**
 * Who may use the admin area: demo mode checks the account's role (admin@phumireader.app), real mode asks the API
 * (GET /admin/overview answers 403 to everybody else).
 */
function useAdminAccess(): { access: Access; retry: () => void } {
  const user = useUser()
  const hydrated = useHydrated()
  const overview = useOverview()
  const access: Access = !hydrated
    ? "wait"
    : !user
      ? "login"
      : DEMO_MODE
        ? isAdmin(user)
          ? "ok"
          : "denied"
        : overview.isPending
          ? "wait"
          : overview.isError
            ? overview.error instanceof ApiError && overview.error.status === 403
              ? "denied"
              : "error"
            : "ok"
  return { access, retry: () => void overview.refetch() }
}

/**
 * AdminShell (foundations §8, prototype Admin `.ad-top` / `.ad-nav`): its own dark top bar, a 240 px white side menu
 * with counts (a sideways-scrolling row below 1024 px) and no site header, footer or tab bar. The menu shows for admins
 * only; every page renders inside AdminGate. Every decision goes through AdminDecisions (log + 6-second Undo).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { access } = useAdminAccess()
  const ok = access === "ok"
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-subtle">
      <SkipLink />
      <AdminTopBar showUser={ok} />
      <AdminDecisions>
        <div className={cn("flex flex-1 flex-col", ok && "lg:grid lg:grid-cols-[240px_minmax(0,1fr)]")}>
          {ok ? <AdminNav /> : null}
          <main id="main" tabIndex={-1} className="flex min-w-0 flex-col gap-5 px-4 pt-5 pb-12 outline-none md:px-8 md:pt-7 md:pb-16">
            {children}
          </main>
        </div>
      </AdminDecisions>
    </div>
  )
}

/**
 * Wraps every admin page (the layout always renders its page, so Next.js can check the route): a skeleton while the
 * account loads, Log in (with returnTo) when logged out, the same message for accounts that aren't admins.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { access, retry } = useAdminAccess()
  const user = useUser()
  if (access === "ok") return <>{children}</>
  if (access === "wait") {
    return (
      <div className="flex w-full flex-col gap-4" aria-hidden>
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-card max-md:h-[92px]" />
          ))}
        </div>
      </div>
    )
  }
  if (access === "error") return <AdminError onRetry={retry} />
  return <AccessCard denied={access === "denied"} email={user?.email ?? ""} />
}

function AdminTopBar({ showUser }: { showUser: boolean }) {
  const t = useTranslations("admin")
  const user = useUser()
  return (
    <header className="sticky top-0 z-40 bg-surface text-surface-foreground">
      <div className="flex h-14 items-center gap-2.5 px-4 md:px-6">
        <Logo tone="light" className="focus-visible:ring-offset-surface" />
        <Badge variant="dark">{t("badgeAdmin")}</Badge>
        {DEMO_MODE ? (
          <Badge variant="warn" className="max-md:hidden">
            {t("badgeDemo")}
          </Badge>
        ) : null}
        {showUser && user ? (
          <span className="ml-auto flex min-w-0 items-center gap-2 text-[13px] leading-[18px]">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground"
            >
              {initials(user.name)}
            </span>
            <span className="truncate max-md:sr-only">
              {user.name} · {t("role")}
            </span>
          </span>
        ) : null}
      </div>
    </header>
  )
}

/** Log in (with returnTo) when logged out; the same message when the account isn't an admin. */
function AccessCard({ denied, email }: { denied: boolean; email: string }) {
  const t = useTranslations("admin")
  const pathname = usePathname()
  const remember = () => useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)
  const Icon = denied ? ShieldAlertIcon : LogInIcon
  return (
    <section className="mx-auto mt-4 flex w-full max-w-xl flex-col items-center gap-3 rounded-card border bg-card px-5 py-12 text-center shadow-xs md:mt-8 md:px-8">
      <AnimateIcon asChild animateOnView>
        <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      </AnimateIcon>
      <h1 className="type-h3">{t("gateTitle")}</h1>
      <p className="max-w-md text-sm leading-[21px] text-muted-foreground">
        {denied ? t("gateDeniedText", { email }) : t("gateLoginText")}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild variant="brand" size="lg">
          <Link href="/login" onClick={remember}>
            {t("login")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </section>
  )
}

/** `count`: a number, or "N+" (an older API without the overview's payment counts, while more pages wait) */
type NavItem = { href: string; label: string; count?: number | string; urgent?: boolean }

/**
 * Side menu counts: demo – the demo queues; real mode – the series to review and the open reports from the API, and
 * for Payments the overview's open refund requests (V21-06) without the ones decided here. Like the prototype and the
 * demo, the Payments count is refund requests only; the overview's cards show "Paid but no coins" separately.
 */
function useNavCounts() {
  const queues = useAdminQueues()
  const overview = useOverview()
  const realReports = useReports(DEMO_MODE ? undefined : "open")
  const payments = usePaymentCounts()
  const loaded = !!queues.query.data
  if (DEMO_MODE) {
    return {
      series: loaded ? queues.series.length : undefined,
      reports: loaded ? queues.reports.length : undefined,
      urgent: queues.reports.some((r) => priorityOf(r.reason) === "urgent"),
      payments: loaded ? queues.refunds.length : undefined,
    }
  }
  return {
    series: queues.seriesTotal ?? overview.data?.seriesInReview,
    reports: overview.data?.openReports,
    urgent: realReports.items.some((r) => priorityOf(r.reason) === "urgent"),
    payments: payments.refunds,
  }
}

function AdminNav() {
  const t = useTranslations("admin")
  const pathname = usePathname()
  const counts = useNavCounts()
  const navRef = useRef<HTMLElement>(null)

  const items: NavItem[] = [
    { href: "/admin", label: t("nav_overview") },
    { href: "/admin/series", label: t("nav_series"), count: counts.series },
    { href: "/admin/reports", label: t("nav_reports"), count: counts.reports, urgent: counts.urgent },
    { href: "/admin/payments", label: t("nav_payments"), count: counts.payments },
  ]
  // V1 screens without a V2.1 design stay reachable in real mode (the demo has no data for them).
  const extras: NavItem[] = DEMO_MODE
    ? []
    : [
        { href: "/admin/users", label: t("nav_users") },
        { href: "/admin/content", label: t("nav_content") },
        { href: "/admin/orders", label: t("nav_orders") },
        { href: "/admin/audit", label: t("nav_audit") },
      ]

  // Phones: bring the current item into view when it starts off-screen.
  useEffect(() => {
    const nav = navRef.current
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !el || nav.scrollWidth <= nav.clientWidth) return
    if (el.offsetLeft + el.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = el.offsetLeft - 12
  }, [pathname])

  const link = (item: NavItem) => {
    const on = pathname === item.href
    return (
      <HighlightItem key={item.href} value={item.href} className="flex shrink-0 lg:shrink">
      <Link
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex min-h-[38px] grow items-center gap-2 rounded-[8px] px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:py-2 lg:whitespace-normal",
          on ? "text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {/* Khmer labels are longer: they wrap in the 240 px menu instead of being cut. */}
        <span className="min-w-0 grow text-left">{item.label}</span>
        {item.count ? (
          <Badge variant={item.urgent ? "up" : "secondary"} className="tabular-nums">
            {item.count}
            <span className="sr-only"> {t("navWaiting")}</span>
          </Badge>
        ) : null}
      </Link>
      </HighlightItem>
    )
  }

  const here = [...items, ...extras].find((x) => x.href === pathname)?.href ?? null

  return (
    <aside className="border-b bg-background lg:border-r lg:border-b-0">
      <nav
        ref={navRef}
        aria-label={t("navLabel")}
        className="flex gap-0.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:sticky lg:top-14 lg:flex-col lg:overflow-visible lg:py-5 [&::-webkit-scrollbar]:hidden"
      >
        {/* Animate UI Highlight: one pill slides behind the current menu item (the shell stays mounted between pages). */}
        <Highlight
          controlledItems
          click={false}
          value={here}
          className="inset-0 rounded-[8px] bg-muted"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        >
          {items.map(link)}
          {extras.length ? (
            <>
              <div aria-hidden className="my-2.5 hidden h-px bg-border lg:block" />
              {extras.map(link)}
            </>
          ) : null}
        </Highlight>
        <div aria-hidden className="my-2.5 hidden h-px bg-border lg:block" />
        <Link
          href="/legal/community"
          className="hidden h-[38px] shrink-0 items-center rounded-[8px] px-3 text-sm font-medium whitespace-nowrap text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:flex"
        >
          {t("nav_guidelines")}
        </Link>
      </nav>
    </aside>
  )
}
