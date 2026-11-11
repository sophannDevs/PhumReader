"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CheckIcon, ChevronRightIcon, SettingsIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AvatarRow,
  DeleteAccountDialog,
  Devices,
  EmailField,
  PasswordRow,
  fieldError,
  fieldHint,
  fieldLabel,
} from "@/components/pr/account-security"
import { CoinIcon } from "@/components/pr/coin-icon"
import { OptionCard } from "@/components/pr/patterns"
import { NativeSelect, SaveBar, SmallSwitch } from "@/components/pr/settings-ui"
import { Chip } from "@/components/pr/v2-primitives"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { type Locale } from "@/i18n/routing"
import * as account from "@/lib/api/account"
import { DEMO_MODE } from "@/lib/api/config"
import { withDemo } from "@/lib/demo-api"
import { fieldErrors } from "@/lib/api/errors"
import { formatShortDate, ictDate, initials } from "@/lib/format"
import { prefsFromApi, samePrefs, useAccountSettings } from "@/lib/notifications"
import { savePreferences } from "@/lib/preferences"
import { logOut, toUser } from "@/lib/session"
import {
  type AppSettings,
  type ReportStatus,
  defaultNotifPrefs,
  useAppStore,
  useCoins,
  useHydrated,
  useUser,
} from "@/lib/store"
import { unblockUser } from "@/lib/moderation"
import { ACCENT_IDS, ACCENTS, type Accent, readAccent, saveAccent } from "@/lib/accent"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

/**
 * Settings (spec §12, prototype Settings/): a side menu and one card per section. Account, Reading, Language and
 * region and Privacy switches are a form with a save bar ("You have unsaved changes · Discard / Save changes");
 * the app language, blocking, password, photo, downloads and account actions act at once.
 * Saving writes `settings` (+ `novelSettings.size`, the reader theme via useTheme, the display name). With the
 * real API the name goes to /me/profile and SettingsSync saves the reader theme and text size; the Notifications card
 * sums up the account's alert settings (changed on /notifications); the other choices stay on this device (the API
 * has no fields for them yet). "Request data download" is simulated in the demo; with the real API it shows "Coming
 * soon" with the button off (no export yet).
 */

type Form = Pick<
  AppSettings,
  "mode" | "quality" | "theme" | "size" | "autoNext" | "saveData" | "region" | "langs" | "publicLib" | "mature" | "google" | "facebook"
> & { name: string }

const SECTIONS = ["account", "reading", "language", "notifs", "privacy", "coins", "danger"] as const
type Section = (typeof SECTIONS)[number]

/** Settings text size presets → novel reader px (TEXT_SIZES 14–24) and the preview size (prototype). */
const SIZE_PX = { s: 16, m: 18, l: 20, xl: 22 } as const
const PREVIEW_PX = { s: 15, m: 17, l: 19, xl: 22 } as const
const sizeOfPx = (px: number): AppSettings["size"] => (px <= 16 ? "s" : px <= 18 ? "m" : px <= 20 ? "l" : "xl")

const STATUS_BADGE: Record<ReportStatus, "warn" | "brand" | "secondary"> = {
  "In review": "warn",
  Removed: "brand",
  "No violation found": "secondary",
}
const STATUS_KEY: Record<ReportStatus, string> = { "In review": "inReview", Removed: "removed", "No violation found": "noViolation" }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function Card({
  id,
  title,
  desc,
  danger,
  children,
}: {
  id: Section
  title: string
  desc?: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={`set-${id}`}
      aria-labelledby={`h-${id}`}
      className={cn("min-w-0 scroll-mt-20 rounded-card border bg-card shadow-xs", danger && "border-[#fecaca]")}
    >
      <div className="flex flex-col gap-1 px-5 pt-5 max-md:px-4 max-md:pt-4">
        <h2 id={`h-${id}`} className="type-h3">
          {title}
        </h2>
        {desc ? <p className={fieldHint}>{desc}</p> : null}
      </div>
      <div className="flex flex-col gap-[18px] p-5 max-md:p-4">{children}</div>
    </section>
  )
}

const Sep = () => <div className="h-px shrink-0 bg-border" />

/** A label + hint on the left, a control on the right (prototype `.st-row`). */
function Row({ id, label, hint, children }: { id?: string; label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 max-md:items-start">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={id} className={fieldLabel}>
          {label}
        </span>
        {hint ? <span className={fieldHint}>{hint}</span> : null}
      </div>
      <div className="flex shrink-0">{children}</div>
    </div>
  )
}

/** Pill track used as a radio group (`.tabs-list` + `.tabs-trigger`), with per-option aria-label / lang. */
function PillGroup<T extends string>({
  labelledBy,
  value,
  onChange,
  options,
  stretch = false,
}: {
  labelledBy: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; aria?: string; lang?: string }[]
  stretch?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px] text-muted-foreground [scrollbar-width:none]",
        stretch && "flex w-full"
      )}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            lang={o.lang}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-[30px] shrink-0 items-center justify-center rounded-[7px] px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              on && "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]",
              stretch && "flex-1",
              o.lang === "km" && "font-khmer"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsPage() {
  const t = useTranslations("settings")
  const queryClient = useQueryClient()
  const ta = useTranslations("account")
  const tt = useTranslations("toasts")
  const te = useTranslations("errors")
  const downloadSoonId = useId()
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const hydrated = useHydrated()
  const coins = useCoins()
  const settings = useAppStore((s) => s.settings)
  const novelSize = useAppStore((s) => s.novelSettings.size)
  const notifPrefs = useAppStore((s) => s.notifPrefs)
  // Real mode: the account's alert settings as SettingsSync loaded them (no request of its own; until then this browser's).
  const accountSettings = useAccountSettings(false).data
  const blocked = useAppStore((s) => s.blocked)
  const reports = useAppStore((s) => s.reports)
  const { theme, setTheme } = useTheme()
  const [accent, setAccent] = useState<Accent>("green")
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setAccent(readAccent())
  }, [])
  function pickAccent(next: Accent) {
    setAccent(next)
    saveAccent(next) // applied to the whole site at once, no Save needed
  }

  const [draft, setDraft] = useState<Partial<Form>>({})
  const [langErr, setLangErr] = useState(false)
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dlBusy, setDlBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [current, setCurrent] = useState<Section>("account")

  // What is saved now; the form is the saved values with the draft's changes on top.
  const base: Form = {
    ...settings,
    theme: theme ?? settings.theme,
    size: sizeOfPx(novelSize),
    name: user?.name ?? "",
  }
  const f: Form = { ...base, ...draft }
  const changed = (Object.keys(draft) as (keyof Form)[]).filter((k) => !same(draft[k], base[k]))
  const dirty = !!user && changed.length > 0
  const nameTrim = f.name.trim()
  const nameBad = nameTrim.length < 2

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setLangErr(false)
    if (key === "name") setNameErr(null)
  }

  // The side menu follows the section in view: the last one whose top is in the upper third of the window
  // (a click on the menu wins while the page scrolls to it).
  const lockUntil = useRef(0)
  const signedIn = !!user
  useEffect(() => {
    if (!signedIn) return
    let frame = 0
    const update = () => {
      frame = 0
      if (Date.now() < lockUntil.current) return
      const line = window.innerHeight * 0.35
      let cur: Section = "account"
      for (const s of SECTIONS) {
        const el = document.getElementById(`set-${s}`)
        if (el && el.getBoundingClientRect().top <= line) cur = s
      }
      setCurrent(cur)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [signedIn])

  async function save() {
    if (nameBad || !user) return
    setSaving(true)
    try {
      // Demo: every write goes through the fake API (300–800 ms, ?demo=error fails it).
      if (DEMO_MODE) await withDemo(() => undefined)
      if (nameTrim !== user.name) {
        if (DEMO_MODE) useAppStore.getState().login({ ...user, name: nameTrim })
        else useAppStore.getState().login(toUser(await account.patchProfile(nameTrim)))
      }
      // Real mode: the story languages belong to the account (V21-07), so every device shows the same stories.
      if (!DEMO_MODE && f.langs.join() !== settings.langs.join()) {
        await savePreferences(queryClient, user.email, { storyLanguages: [...f.langs] })
      }
    } catch (e) {
      setSaving(false)
      if (fieldErrors(e).displayName) setNameErr(t("nameInvalid"))
      else toast.error(t("saveFailed"))
      return
    }
    const store = useAppStore.getState()
    store.setSettings({
      mode: f.mode,
      quality: f.quality,
      theme: f.theme,
      size: f.size,
      autoNext: f.autoNext,
      saveData: f.saveData,
      region: f.region,
      langs: [...f.langs],
      publicLib: f.publicLib,
      mature: f.mature,
      google: f.google,
      facebook: f.facebook,
    })
    if (f.size !== base.size) store.setNovelSettings({ size: SIZE_PX[f.size] })
    if (f.theme !== base.theme) setTheme(f.theme)
    setDraft({})
    setSaving(false)
    toast.success(t("saved"))
  }

  function changeLanguage(next: Locale) {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    // The account remembers the language; the address decides the page's.
    if (!DEMO_MODE && user) void account.patchSettings({ language: next }).catch(() => undefined)
    toast(t(`langChanged.${next}`))
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, { locale: next })
  }

  function toggleLang(code: Locale) {
    const on = f.langs.includes(code)
    const next = on ? f.langs.filter((x) => x !== code) : [...f.langs, code]
    if (next.length === 0) return setLangErr(true)
    set("langs", next)
  }

  function logOutEverywhere() {
    if (DEMO_MODE) {
      useAppStore.getState().logout()
      toast.success(t("loggedOutAll"))
      return
    }
    // Every device is signed out, this one too.
    account.signOutEverywhere().then(
      () => void logOut().then(() => toast.success(t("loggedOutAll"))),
      () => toast.error(t("saveFailed"))
    )
  }

  function requestDownload() {
    setDlBusy(true)
    setTimeout(() => {
      setDlBusy(false)
      toast.success(t("downloadSent"))
    }, 1200)
  }

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="type-h1">{t("title")}</h1>
      <p className="text-[15px] leading-[26px] text-muted-foreground">{t("lead")}</p>
    </div>
  )

  if (!hydrated || !user) {
    return (
      <div className="container flex flex-col gap-5 pt-7 pb-16">
        {header}
        {hydrated ? (
          <div className="flex flex-col items-center gap-2.5 rounded-card border bg-card px-5 py-12 text-center shadow-xs">
            <SettingsIcon className="size-7 text-muted-foreground" aria-hidden />
            <h2 className="type-h3">{t("loginTitle")}</h2>
            <p className={fieldHint}>{t("loginText")}</p>
            <Button asChild variant="brand">
              <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
                {t("login")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  const switchRow = (key: "autoNext" | "saveData" | "publicLib" | "mature") => (
    <Row id={`t-${key}`} label={t(`switches.${key}.label`)} hint={t(`switches.${key}.desc`)}>
      <SmallSwitch checked={f[key]} aria-labelledby={`t-${key}`} onCheckedChange={(v) => set(key, v)} />
    </Row>
  )

  const alertPrefs = !DEMO_MODE && accountSettings ? prefsFromApi(accountSettings.notifications) : notifPrefs
  const customAlerts = !samePrefs(alertPrefs, defaultNotifPrefs)

  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16">
      {header}

      <div className="grid items-start gap-8 max-lg:gap-5 lg:grid-cols-[200px_minmax(0,760px)]">
        <nav
          aria-label={t("sections")}
          className="flex gap-0.5 max-lg:gap-1 max-lg:overflow-x-auto max-lg:border-b max-lg:pb-px max-lg:[scrollbar-width:none] lg:sticky lg:top-20 lg:flex-col"
        >
          {SECTIONS.map((s) => (
            <a
              key={s}
              href={`#set-${s}`}
              aria-current={current === s ? "true" : undefined}
              onClick={() => {
                lockUntil.current = Date.now() + 1000
                setCurrent(s)
              }}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current === s ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {t(`nav.${s}`)}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {/* Account */}
          <Card id="account" title={t("nav.account")} desc={t("accountDesc")}>
            <AvatarRow name={nameTrim || user.name} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="st-name" className={fieldLabel}>
                  {t("displayName")}
                </label>
                <Input
                  id="st-name"
                  value={f.name}
                  maxLength={30}
                  aria-invalid={nameBad || !!nameErr}
                  aria-describedby="st-name-h"
                  onChange={(e) => set("name", e.target.value.slice(0, 30))}
                />
                <span id="st-name-h" className={nameBad || nameErr ? fieldError : fieldHint}>
                  {nameErr ?? (nameBad ? t("nameShort") : t("nameHint", { count: nameTrim.length }))}
                </span>
              </div>
              <EmailField email={user.email} />
            </div>
            <Sep />
            <PasswordRow />
            <Sep />
            <span className={fieldLabel}>{t("connected")}</span>
            {(
              [
                ["google", "Google", "G"],
                ["facebook", "Facebook", "f"],
              ] as const
            ).map(([key, name, ic]) => {
              const on = f[key]
              return (
                <div key={key} className="-mt-1.5 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white text-sm font-extrabold">
                      {ic}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-[13px] leading-[18px] font-semibold">{name}</span>
                      <span className="text-xs leading-4 text-muted-foreground">
                        {on ? t("connectedNote", { name }) : t("notConnected")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={on ? "ghost" : "outline"}
                    size="sm"
                    className="shrink-0"
                    aria-label={`${on ? t("disconnect") : t("connect")} ${name}`}
                    onClick={() => set(key, !on)}
                  >
                    {on ? t("disconnect") : t("connect")}
                  </Button>
                </div>
              )
            })}
          </Card>

          {/* Reading */}
          <Card id="reading" title={t("nav.reading")} desc={t("readingDesc")}>
            <div className="flex flex-col gap-2">
              <span id="lbl-mode" className={fieldLabel}>
                {t("mode")}
              </span>
              <div role="radiogroup" aria-labelledby="lbl-mode" className="grid gap-2.5 md:grid-cols-2">
                {(["scroll", "page"] as const).map((m) => (
                  <OptionCard
                    key={m}
                    selected={f.mode === m}
                    onSelect={() => set("mode", m)}
                    title={<span className="text-[13px] leading-[18px] font-semibold">{t(`modes.${m}.label`)}</span>}
                    description={t(`modes.${m}.desc`)}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="st-q" className={fieldLabel}>
                  {t("quality")}
                </label>
                <NativeSelect id="st-q" value={f.quality} aria-describedby="st-q-h" onChange={(e) => set("quality", e.target.value as Form["quality"])}>
                  <option value="auto">{t("qualities.auto")}</option>
                  <option value="high">{t("qualities.high")}</option>
                  <option value="saver">{t("qualities.saver")}</option>
                </NativeSelect>
                <span id="st-q-h" className={fieldHint}>
                  {t(`qualityHints.${f.quality}`)}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <span id="lbl-theme" className={fieldLabel}>
                  {t("theme")}
                </span>
                <PillGroup
                  labelledBy="lbl-theme"
                  stretch
                  value={f.theme}
                  onChange={(v) => set("theme", v)}
                  options={[
                    { value: "light", label: t("themeLight") },
                    { value: "dark", label: t("themeDark") },
                    { value: "system", label: t("themeSystem") },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id="lbl-accent" className={fieldLabel}>
                {t("accent")}
              </span>
              <div role="radiogroup" aria-labelledby="lbl-accent" className="flex flex-wrap gap-3">
                {ACCENT_IDS.map((id) => {
                  const on = id === accent
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={t(`accents.${id}`)}
                      title={t(`accents.${id}`)}
                      onClick={() => pickAccent(id)}
                      style={{ backgroundColor: ACCENTS[id].primary }}
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-full border-2 border-background outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        on ? "shadow-[0_0_0_2px_var(--foreground)]" : "shadow-[0_0_0_1px_var(--border)]"
                      )}
                    >
                      {on && <CheckIcon className="size-4" style={{ color: ACCENTS[id].fg }} aria-hidden />}
                    </button>
                  )
                })}
              </div>
              <span className={fieldHint}>{t("accentHint")}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span id="lbl-size" className={fieldLabel}>
                {t("size")}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <PillGroup
                  labelledBy="lbl-size"
                  value={f.size}
                  onChange={(v) => set("size", v)}
                  options={(["s", "m", "l", "xl"] as const).map((z) => ({ value: z, label: t(`sizes.${z}.label`), aria: t(`sizes.${z}.aria`) }))}
                />
                <p
                  lang="en"
                  className="m-0 min-w-0 font-novel leading-[1.6] text-[#27272a]"
                  style={{ fontSize: PREVIEW_PX[f.size] }}
                >
                  {t("previewText")}
                </p>
              </div>
            </div>
            <Sep />
            {switchRow("autoNext")}
            {switchRow("saveData")}
          </Card>

          {/* Language and region */}
          <Card id="language" title={t("nav.language")}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <span id="lbl-app" className={fieldLabel}>
                  {t("appLanguage")}
                </span>
                <PillGroup
                  labelledBy="lbl-app"
                  stretch
                  value={locale}
                  onChange={changeLanguage}
                  options={[
                    { value: "en", label: "English", lang: "en" },
                    { value: "km", label: "ខ្មែរ", lang: "km" },
                  ]}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="st-region" className={fieldLabel}>
                  {t("region")}
                </label>
                <NativeSelect id="st-region" value={f.region} aria-describedby="st-region-h" onChange={(e) => set("region", e.target.value)}>
                  {(["KH", "TH", "VN", "OTHER"] as const).map((r) => (
                    <option key={r} value={r}>
                      {t(`regions.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
                <span id="st-region-h" className={fieldHint}>
                  {t("regionHint")}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id="lbl-cl" className={fieldLabel}>
                {t("storyLangs")}
              </span>
              <div role="group" aria-labelledby="lbl-cl" className="flex flex-wrap gap-2">
                <Chip check selected={f.langs.includes("en")} onClick={() => toggleLang("en")}>
                  <span lang="en">English</span>
                </Chip>
                <Chip check selected={f.langs.includes("km")} onClick={() => toggleLang("km")}>
                  <span lang="km" className="font-khmer">
                    ខ្មែរ
                  </span>
                  <span lang="en">(Khmer)</span>
                </Chip>
              </div>
              {langErr ? (
                <span role="alert" className={fieldError}>
                  {t("langsError")}
                </span>
              ) : null}
            </div>
          </Card>

          {/* Notifications */}
          <section id="set-notifs" aria-labelledby="h-notifs" className="min-w-0 scroll-mt-20 rounded-card border bg-card p-5 shadow-xs max-md:p-4">
            <div className="flex items-center justify-between gap-4 max-md:items-start">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 id="h-notifs" className="type-h3">
                  {t("nav.notifs")}
                </h2>
                <span className={fieldHint}>{customAlerts ? t("notifCustom") : t("notifSummary")}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/notifications#ns">
                  {t("manage")}
                  <ChevronRightIcon className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </section>

          {/* Privacy and safety */}
          <Card id="privacy" title={t("nav.privacy")}>
            {switchRow("publicLib")}
            {switchRow("mature")}
            <Sep />
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>{t("blocked")}</span>
              {blocked.length ? (
                <ul className="m-0 flex list-none flex-col divide-y rounded-[10px] border p-0">
                  {blocked.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-[13px] leading-[18px]">
                        <Avatar className="size-[26px] after:border-0">
                          <AvatarFallback className="text-[10px] font-semibold text-foreground">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{name}</span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t("unblockName", { name })}
                        onClick={() => {
                          void unblockUser(name, tt("actionFailed")).then((ok) => {
                            if (ok) toast.success(t("unblocked", { name }))
                          })
                        }}
                      >
                        {t("unblock")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={fieldHint}>{t("noBlocked")}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>{t("reports")}</span>
              {reports.length ? (
                <ul className="m-0 flex list-none flex-col divide-y rounded-[10px] border p-0">
                  {reports.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className="truncate text-[13px] leading-[18px]">{r.target.charAt(0).toUpperCase() + r.target.slice(1)}</span>
                        <span className="text-xs leading-4 text-muted-foreground">
                          {t("reportMeta", { id: r.id, date: formatShortDate(ictDate(r.at), locale) })}
                        </span>
                      </span>
                      <Badge variant={STATUS_BADGE[r.status]}>
                        {t(`status.${STATUS_KEY[r.status]}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={fieldHint}>{t("noReports")}</span>
              )}
            </div>
            <Sep />
            <Row label={t("download")} hint={t("downloadHint")}>
              {DEMO_MODE ? (
                <Button variant="outline" size="sm" disabled={dlBusy} onClick={requestDownload}>
                  {dlBusy ? t("preparing") : t("requestDownload")}
                </Button>
              ) : (
                // Real API: the account has no data export yet (bug 4), so the row stays with the button off.
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <Badge id={downloadSoonId} variant="warn">
                    {te("codes.comingSoon")}
                  </Badge>
                  <Button variant="outline" size="sm" disabled aria-describedby={downloadSoonId}>
                    {t("requestDownload")}
                  </Button>
                </span>
              )}
            </Row>
          </Card>

          {/* Coins and payments */}
          <section id="set-coins" aria-labelledby="h-coins" className="min-w-0 scroll-mt-20 rounded-card border bg-card p-5 shadow-xs max-md:p-4">
            <div className="flex items-center justify-between gap-4 max-md:items-start">
              <div className="flex min-w-0 items-center gap-3 max-md:items-start">
                <CoinIcon size={32} className="text-[13px]" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id="h-coins" className="type-h3">
                    {t("nav.coins")}
                  </h2>
                  <span className={fieldHint}>{t("coinsHint", { count: coins })}</span>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/coins#history-title">
                  {t("history")}
                  <ChevronRightIcon className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </section>

          {/* Account actions */}
          <Card id="danger" title={t("nav.danger")} danger>
            {DEMO_MODE ? null : (
              <>
                <Devices />
                <Sep />
              </>
            )}
            <Row label={t("logoutAll")} hint={t("logoutAllHint")}>
              <Button variant="outline" size="sm" onClick={logOutEverywhere}>
                {t("logoutAll")}
              </Button>
            </Row>
            <Sep />
            <Row label={ta("deleteAccount")} hint={t("deleteHint")}>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                {ta("deleteAccount")}
              </Button>
            </Row>
          </Card>
        </div>
      </div>

      {dirty ? (
        <SaveBar
          className="-mt-2"
          onDiscard={() => {
            setDraft({})
            setLangErr(false)
            setNameErr(null)
          }}
          onSave={() => void save()}
          saveDisabled={nameBad}
          saving={saving}
        />
      ) : null}

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  )
}
