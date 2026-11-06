"use client"

import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "@/lib/theme"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { ReadingSettingsControls } from "@/components/layout/reading-settings"
import { DisplayNameEditor, SecuritySection } from "@/components/pr/account-security"
import { EmptyState } from "@/components/pr/empty-state"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { type Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { DEMO_MODE } from "@/lib/api/config"
import { patchSettings } from "@/lib/api/account"
import { initials } from "@/lib/format"
import { logOut } from "@/lib/session"
import { useAppStore, useUser } from "@/lib/store"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { MonitorIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react"

function ReadingPreview() {
  const t = useTranslations("settings")
  const ns = useAppStore((s) => s.novelSettings)
  return (
    <div
      data-reader-theme={ns.theme}
      style={{ "--novel-size": `${ns.size}px`, "--novel-leading": ns.wide ? 1.85 : 1.6 } as React.CSSProperties}
      className="rounded-card border border-reader-border bg-reader-page p-4 text-reader-text"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-reader-quiet">{t("preview")}</p>
      <p className={cn("type-novel", ns.font === "serif" && "font-novel")}>{t("previewText")}</p>
    </div>
  )
}

function ThemeChoice() {
  const t = useTranslations("settings")
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const options = [
    ["system", t("themeSystem"), MonitorIcon],
    ["light", t("themeLight"), SunIcon],
    ["dark", t("themeDark"), MoonIcon],
  ] as const
  return (
    <RadioGroup
      value={mounted ? (theme ?? "system") : ""}
      onValueChange={setTheme}
      aria-labelledby="theme-title"
      className="grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {options.map(([value, label, Icon]) => (
        <label key={value} htmlFor={`theme-${value}`} className={radioCardClassName}>
          <RadioGroupItem id={`theme-${value}`} value={value} />
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">{label}</span>
        </label>
      ))}
    </RadioGroup>
  )
}

const card = "flex flex-col gap-4 rounded-card border bg-card p-6 shadow-xs"

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={card}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="type-h3">
          {title}
        </h2>
        {desc ? <p className="type-small font-normal text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** Settings: profile, language, reading defaults, notifications and account actions. */
export function SettingsPage() {
  const t = useTranslations("settings")
  const tt = useTranslations("toasts")
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const notifications = useAppStore((s) => s.notifications)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const restoreFocus = useRestoreFocus()

  function changeLanguage(next: string) {
    if (next === locale) return
    useAppStore.getState().setLang(next as Locale)
    // The account remembers the language; the address decides the page's.
    if (!DEMO_MODE && user) void patchSettings({ language: next as Locale }).catch(() => undefined)
    router.replace(`${pathname}${window.location.search}`, { locale: next as Locale })
  }

  return (
    <div className="container flex max-w-[720px] flex-col gap-5 py-8 md:py-10">
      <h1 className="type-h1">{t("title")}</h1>

      <Section id="profile-title" title={t("profile")}>
        {user ? (
          <div className="flex flex-wrap items-center gap-4">
            <Avatar variant="brand" size="lg" className="size-14 text-lg">
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <dl className="flex min-w-0 flex-col gap-1 text-sm">
              <div>
                <dt className="sr-only">{t("displayName")}</dt>
                <dd className="text-base font-semibold">{user.name}</dd>
              </div>
              <div>
                <dt className="sr-only">{t("email")}</dt>
                <dd className="truncate text-muted-foreground">{user.email}</dd>
              </div>
            </dl>
            {DEMO_MODE ? null : (
              <div className="ml-auto">
                <DisplayNameEditor />
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={UserIcon}
            title={t("profileLoggedOut")}
            className="py-6"
            action={
              <Button asChild variant="brand">
                <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
                  {t("login")}
                </Link>
              </Button>
            }
          />
        )}
      </Section>

      <Section id="theme-title" title={t("appearance")} desc={t("appearanceDesc")}>
        <ThemeChoice />
      </Section>

      <Section id="language-title" title={t("language")} desc={t("languageDesc")}>
        <RadioGroup value={locale} onValueChange={changeLanguage} aria-labelledby="language-title" className="grid-cols-2 gap-3">
          {([
            ["en", "English"],
            ["km", "ខ្មែរ"],
          ] as const).map(([value, label]) => (
            <label key={value} htmlFor={`lang-${value}`} className={radioCardClassName}>
              <RadioGroupItem id={`lang-${value}`} value={value} />
              <span lang={value} className="text-sm font-semibold">
                {label}
              </span>
            </label>
          ))}
        </RadioGroup>
      </Section>

      <Section id="reading-title" title={t("reading")} desc={t("readingDesc")}>
        <ReadingSettingsControls />
        <ReadingPreview />
      </Section>

      <Section id="notify-title" title={t("notifications")} desc={DEMO_MODE || !user ? t("notifyNote") : t("notifySaved")}>
        {(
          [
            ["episodes", "notifyEpisodes", "notifyEpisodesDesc"],
            ["fastPass", "notifyFastPass", "notifyFastPassDesc"],
          ] as const
        ).map(([key, label, desc]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor={`notify-${key}`} className="text-sm font-semibold">
                {t(label)}
              </Label>
              <span className="type-small font-normal text-muted-foreground">{t(desc)}</span>
            </div>
            <Switch
              id={`notify-${key}`}
              checked={notifications[key]}
              onCheckedChange={(v) => useAppStore.getState().setNotification(key, v)}
            />
          </div>
        ))}
      </Section>

      {!DEMO_MODE && user ? <SecuritySection card={card} /> : null}

      {DEMO_MODE || user ? (
      <Section id="account-title" title={t("account")}>
        {user ? (
          <div className="flex items-center justify-between gap-4">
            <span className="type-small font-normal text-muted-foreground">{t("logOutDesc")}</span>
            <Button
              variant="outline"
              onClick={() => {
                void logOut().then(() => toast.success(tt("loggedOut")))
              }}
            >
              {t("logOut")}
            </Button>
          </div>
        ) : null}
        {DEMO_MODE ? (
          <div className="flex items-center justify-between gap-4">
            <span className="type-small font-normal text-muted-foreground">{t("resetDesc")}</span>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              {t("reset")}
            </Button>
          </div>
        ) : null}
      </Section>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent {...restoreFocus}>
          <DialogHeader>
            <DialogTitle>{t("resetTitle")}</DialogTitle>
            <DialogDescription>{t("resetBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                useAppStore.getState().resetDemo()
                setConfirmOpen(false)
                toast.success(tt("demoReset"))
              }}
            >
              {t("confirmReset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
