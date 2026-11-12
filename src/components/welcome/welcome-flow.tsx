"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { useQueryClient } from "@tanstack/react-query"
import { BellIcon } from "@/components/animate-ui/icons/bell"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { ChevronLeftIcon } from "@/components/animate-ui/icons/chevron-left"
import { InfoIcon } from "@/components/animate-ui/icons/info"
import Image from "next/image"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/layout/logo"
import { SkipLink } from "@/components/layout/skip-link"
import { Chip, Segmented } from "@/components/pr/v2-primitives"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ParticleBurst, SuccessBurst, useBurstOnPress } from "@/components/pr/particle-burst"
import { demoData, getSeries, getSeriesById, seriesByGenre, type Genre } from "@/data"
import { usePathname, useRouter } from "@/i18n/navigation"
import type { Locale } from "@/i18n/routing"
import { patchSettings } from "@/lib/api/account"
import { DEMO_MODE } from "@/lib/api/config"
import { putSubscription } from "@/lib/api/me"
import { firstName, parseCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { meKeys } from "@/lib/me"
import { saveAlertPrefs } from "@/lib/notifications"
import { savePreferences } from "@/lib/preferences"
import { useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

type Step = "language" | "genres" | "alerts" | "done"
type Format = "all" | "comic" | "novel"
type SetupState = {
  step: Step
  /** Story languages; null = keep Settings' current list */
  stories: Locale[] | null
  picked: Genre[]
  format: Format
  alerts: boolean
  /** Why "Turn on alerts" did not work */
  denied: "denied" | "unsupported" | null
  /** Series ids added on the Done step */
  subs: string[]
  /** "Continue" was pressed on Genres without a pick */
  tried: boolean
}

const ORDER: Step[] = ["language", "genres", "alerts", "done"]
const START: SetupState = { step: "language", stories: null, picked: [], format: "all", alerts: false, denied: null, subs: [], tried: false }

/**
 * Kept outside React while the tab is open: picking the app language loads the other locale's page (a new React
 * tree), and the setup continues where it was. Cleared when the setup is finished or skipped.
 */
let draft: SetupState | null = null

const LANG_CARDS: { value: Locale; big: string; small: string }[] = [
  { value: "km", big: "ខ្មែរ", small: "ភាសាខ្មែរ" },
  { value: "en", big: "English", small: "English" },
]

/** The genre picture cards use one cover per genre, as in the prototype (the n-th series of the n-th genre). */
const GENRE_CARDS = demoData.genres.map((g, i) => {
  const list = seriesByGenre(g)
  return { genre: g, cover: (list[i % Math.max(1, list.length)] ?? list[0])?.cover }
})

const byViews = (a: { views: string }, b: { views: string }) => parseCount(b.views) - parseCount(a.views)

/**
 * First-time setup /welcome (spec §24, design/prototype-src/Welcome): shown once after sign-up, "Skip for now"
 * at any time. 1 app language (switches the UI now) + story languages, 2 genres (at least one) + format,
 * 3 alerts (the browser's real permission prompt), Done: 4 matching series with + Add, then "Start reading"
 * saves prefs, subscriptions and settings.langs, sets `welcomed` and returns to `welcomeNext` (default Home).
 */
export function WelcomeFlow() {
  const t = useTranslations("welcome")
  const tt = useTranslations("toasts")
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const localize = useLocalize()
  const hydrated = useHydrated()
  const user = useUser()
  const storeLangs = useAppStore((s) => s.settings.langs)
  const [state, setState] = useState<SetupState>(() => draft ?? START)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    draft = state
  }, [state])
  // Next.js keeps a page that was left alive but hidden (Activity): after "Start reading" or "Skip for now"
  // (draft cleared), a later visit starts over instead of showing the old Done step.
  useEffect(() => () => setState(draft ?? START), [])

  const ix = ORDER.indexOf(state.step)
  const stories = state.stories ?? storeLangs
  const update = (patch: Partial<SetupState>) => setState((s) => ({ ...s, ...patch }))
  const go = (step: Step) => {
    update({ step, tried: false })
    window.scrollTo(0, 0)
  }

  function pickLang(next: Locale) {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    if (!DEMO_MODE && user) void patchSettings({ language: next }).catch(() => undefined)
    router.replace(pathname, { locale: next })
  }

  function toggleStory(l: Locale) {
    const list = stories.includes(l) ? stories.filter((x) => x !== l) : [...stories, l]
    if (!list.length) {
      toast(t("keepOne"))
      return
    }
    update({ stories: list })
  }

  async function allow() {
    if (!("Notification" in window)) {
      update({ denied: "unsupported" })
      return
    }
    let result: NotificationPermission
    try {
      result = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission
    } catch {
      result = "denied"
    }
    if (result === "granted") {
      update({ alerts: true, denied: null })
      toast.success(t("alertsOn"))
      go("done")
    } else if (result === "denied") {
      update({ denied: "denied" })
    }
    // "default": the prompt was closed; the reader can ask again or choose "Not now".
  }

  function leave() {
    const store = useAppStore.getState()
    const next = store.welcomeNext ?? "/"
    store.setWelcomed(true)
    store.setWelcomeNext(null)
    draft = null
    router.replace(next)
  }

  async function finish() {
    const store = useAppStore.getState()
    // Real mode saves the picks to the account (so Home follows on every device); a failure keeps them in this browser.
    savePreferences(queryClient, user?.email, { genres: state.picked, storyLanguages: stories }).catch(() => toast.error(tt("actionFailed")))
    // Real mode saves it to the account (New episodes push); a failure keeps the reader's other choices.
    if (state.alerts) void saveAlertPrefs(queryClient, user?.email, { update: [true, store.notifPrefs.update[1]] }).catch(() => undefined)
    const added = state.subs.filter((id) => !store.subscriptions.includes(id))
    if (DEMO_MODE || !user) {
      store.setSubscriptions([...added, ...store.subscriptions])
    } else if (added.length) {
      // The API keeps subscriptions; the reader can retry from the series page if one fails.
      setSaving(true)
      await Promise.allSettled(
        added.flatMap((id) => {
          const series = getSeriesById(id)
          return series ? [putSubscription(series.slug, true)] : []
        })
      )
      void queryClient.invalidateQueries({ queryKey: meKeys.subscriptions(user.email) })
    }
    leave()
  }

  const picks = (() => {
    const all = getSeries()
    const match = all
      .filter((s) => state.picked.includes(s.genre) && (state.format === "all" || s.type === state.format))
      .sort(byViews)
      .slice(0, 4)
    return match.length ? match : [...all].sort(byViews).slice(0, 4)
  })()

  const genreNames = state.picked.slice(0, 3).map((g) => localize.genre(g)).join(", ")
  const doneLine = [
    state.picked.length ? t(state.picked.length > 3 ? "doneGenresMore" : "doneGenres", { genres: genreNames }) : "",
    state.alerts ? t("doneAlertsOn") : t("doneAlertsLater"),
  ]
    .filter(Boolean)
    .join(" ")
  const name = firstName(user?.name ?? "")

  return (
    <div
      className="flex min-h-svh flex-1 flex-col"
      style={{ background: "radial-gradient(900px 400px at 50% -10%, #d9f7e6 0%, rgba(217,247,230,0) 70%), #fafafa" }}
    >
      <SkipLink />
      <header className="flex h-16 items-center justify-between px-6 max-md:px-4">
        <Logo />
        {state.step !== "done" ? (
          <Button variant="ghost" size="sm" onClick={leave}>
            {t("skip")}
          </Button>
        ) : null}
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-2.5 px-6 pt-4 pb-6 text-center outline-none max-md:px-4 max-md:pt-2 max-md:pb-4"
      >
        {state.step !== "done" ? (
          // Screens 24-*: three segments and "Step N of 3" (not the numbered StepsBar).
          <div className="flex flex-col items-center gap-2" role="group" aria-label={t("stepsLabel")}>
            <div className="flex gap-[7px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn("h-1 w-12 rounded-full", i <= ix ? "bg-primary" : "bg-[#e4e4e7]")} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">{t("stepOf", { n: ix + 1, total: 3 })}</p>
          </div>
        ) : null}

        {/* Each step fades up when it opens (the key restarts the effect). */}
        <Effect key={state.step} fade slide={{ direction: "up", offset: 12 }} className="flex w-full flex-col items-center">
          {!hydrated ? null : state.step === "language" ? (
            <section aria-labelledby="wl-title" className="flex w-full flex-col items-center gap-[18px] pt-3">
              <Title>{name ? t("langTitle", { name }) : t("langTitleNoName")}</Title>
              <Sub>{t("langSub")}</Sub>
              <div role="group" aria-label={t("appLang")} className="grid w-full grid-cols-2 gap-3">
                {LANG_CARDS.map((c) => {
                  const on = c.value === locale
                  return (
                    <button
                      key={c.value}
                      type="button"
                      lang={c.value}
                      aria-pressed={on}
                      onClick={() => pickLang(c.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border bg-white px-4 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        on && "border-primary bg-selected shadow-[0_0_0_2px_var(--primary)]"
                      )}
                    >
                      <span className={cn("text-[26px] leading-[34px] font-bold", c.value === "km" && "font-khmer")}>{c.big}</span>
                      <span className="text-[13px] leading-[18px] text-muted-foreground">{c.small}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span id="wl-stories" className="text-sm leading-5 font-medium">
                  {t("storiesLabel")}
                </span>
                <div role="group" aria-labelledby="wl-stories" className="flex flex-wrap justify-center gap-2">
                  {LANG_CARDS.map((c) => (
                    <Chip key={c.value} check selected={stories.includes(c.value)} onClick={() => toggleStory(c.value)}>
                      <span lang={c.value} className={c.value === "km" ? "font-khmer" : undefined}>
                        {c.big}
                      </span>
                    </Chip>
                  ))}
                </div>
              </div>
            </section>
          ) : state.step === "genres" ? (
            <section aria-labelledby="wl-title" className="flex w-full flex-col items-center gap-[18px] pt-3">
              <Title>{t("genresTitle")}</Title>
              <Sub>{t("genresSub")}</Sub>
              <div role="group" aria-label={t("genresLabel")} className="grid w-full grid-cols-4 gap-2.5 max-md:grid-cols-2">
                {GENRE_CARDS.map(({ genre, cover }) => {
                  const on = state.picked.includes(genre)
                  return (
                    <AnimateIcon asChild animateOnHover key={genre}><button
                     
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update({ picked: on ? state.picked.filter((g) => g !== genre) : [...state.picked, genre], tried: false })
                      }
                      className={cn(
                        "relative flex flex-col overflow-hidden rounded-[14px] border-2 border-transparent bg-white shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        on && "border-primary"
                      )}
                    >
                      {cover ? (
                        <Image src={cover} alt="" width={240} height={180} sizes="(max-width: 767px) 50vw, 150px" className="aspect-[4/3] w-full object-cover" />
                      ) : null}
                      <span className="p-2 text-[13px] font-semibold">{localize.genre(genre)}</span>
                      {on ? (
                        <span
                          aria-hidden
                          className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        >
                          <CheckIcon className="size-3.5" />
                        </span>
                      ) : null}
                    </button></AnimateIcon>
                  )
                })}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm leading-5 font-medium">{t("format")}</span>
                <Segmented<Format>
                  label={t("format")}
                  value={state.format}
                  onChange={(format) => update({ format })}
                  options={[
                    { value: "all", label: t("formatAll") },
                    { value: "comic", label: t("formatComic") },
                    { value: "novel", label: t("formatNovel") },
                  ]}
                />
              </div>
              {state.tried && !state.picked.length ? (
                <p role="alert" className="text-[13px] leading-[18px] font-medium text-destructive">
                  {t("genreErr")}
                </p>
              ) : null}
            </section>
          ) : state.step === "alerts" ? (
            <section aria-labelledby="wl-title" className="flex w-full flex-col items-center gap-[18px] pt-3">
              <span
                aria-hidden
                className="flex size-[72px] items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(0,166,80,0.3)]"
              >
                <BellIcon className="size-7" />
              </span>
              <Title>{t("alertsTitle")}</Title>
              <Sub>{t("alertsSub")}</Sub>
              <ul className="flex flex-col gap-2.5 text-left">
                {(["perk1", "perk2", "perk3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2.5 text-sm text-[#27272a]">
                    <CheckIcon className="size-3.5 shrink-0 text-brand-ink" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
              {state.denied ? (
                <Alert variant="warning" role="status" className="text-left">
                  <InfoIcon aria-hidden />
                  <AlertDescription className="text-[13px] leading-[19px] text-warning-ink">{t(state.denied)}</AlertDescription>
                </Alert>
              ) : null}
            </section>
          ) : (
            <section aria-labelledby="wl-title" className="flex w-full flex-col items-center gap-[18px] pt-3">
              <SuccessBurst>
                <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-[26px]" />
                </span>
              </SuccessBurst>
              <Title>{t("doneTitle")}</Title>
              <Sub>{doneLine}</Sub>
              <div className="flex w-full flex-col gap-2.5">
                <span className="text-sm leading-5 font-medium">{t("startWith")}</span>
                <ul className="flex flex-col overflow-hidden rounded-xl border bg-white">
                  {picks.map((s) => {
                    const on = state.subs.includes(s.id)
                    return (
                      <li key={s.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                        <Image src={s.cover} alt="" width={40} height={52} className="h-[52px] w-10 shrink-0 rounded-md object-cover" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                          <span className="truncate text-[13px] leading-[18px] font-semibold">{s.title}</span>
                          <span className="truncate text-xs leading-4 text-muted-foreground">
                            {t("meta", { genre: localize.genre(s.genre), likes: s.likes })}
                          </span>
                        </span>
                        <AddPick
                          on={on}
                          label={t(on ? "removeAria" : "addAria", { title: s.title })}
                          onToggle={() => update({ subs: on ? state.subs.filter((x) => x !== s.id) : [...state.subs, s.id] })}
                        >
                          {on ? t("added") : t("add")}
                        </AddPick>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          )}
        </Effect>
      </main>

      <footer
        className="sticky bottom-0 mx-auto flex w-full max-w-[640px] items-center gap-2 px-6 pt-4 pb-6 max-md:px-4 max-md:pt-3 max-md:pb-5"
        style={{ background: "linear-gradient(rgba(250,250,250,0), #fafafa 30%)" }}
      >
        {ix > 0 && state.step !== "done" ? (
          <Button variant="ghost" onClick={() => go(ORDER[ix - 1])}>
            <ChevronLeftIcon aria-hidden />
            {t("back")}
          </Button>
        ) : null}
        {state.step === "language" || state.step === "genres" ? (
          <Button
            variant="brand"
            size="lg"
            className="ml-auto"
            onClick={() => (state.step === "genres" && !state.picked.length ? update({ tried: true }) : go(ORDER[ix + 1]))}
          >
            {t("continue")}
          </Button>
        ) : null}
        {state.step === "alerts" ? (
          <>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                update({ alerts: false })
                go("done")
              }}
            >
              {t("notNow")}
            </Button>
            <Button variant="brand" size="lg" onClick={() => void allow()}>
              <BellIcon aria-hidden />
              {t("turnOn")}
            </Button>
          </>
        ) : null}
        {state.step === "done" ? (
          <Button variant="brand" size="lg" className="w-full" loading={saving} onClick={() => void finish()}>
            {state.subs.length ? t("startCount", { count: state.subs.length }) : t("start")}
          </Button>
        ) : null}
      </footer>
    </div>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1
      id="wl-title"
      className="m-0 max-w-[22ch] text-[30px] leading-[38px] font-extrabold tracking-[-0.02em] text-balance max-md:text-2xl max-md:leading-[31px]"
    >
      {children}
    </h1>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[15px] leading-[23px] text-muted-foreground">{children}</p>
}

/** Done step "Add" / "Added" toggle: the label bursts into a small ring of dots when the reader adds the series. */
function AddPick({ on, label, onToggle, children }: { on: boolean; label: string; onToggle: () => void; children: ReactNode }) {
  const [burst, arm] = useBurstOnPress(on)
  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "secondary" : "outline"}
      aria-pressed={on}
      aria-label={label}
      onClick={() => {
        arm()
        onToggle()
      }}
    >
      <ParticleBurst burst={burst}>{children}</ParticleBurst>
    </Button>
  )
}
