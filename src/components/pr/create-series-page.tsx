"use client"

import { useQueryClient } from "@tanstack/react-query"
import { AlertCircleIcon, CheckIcon, ChevronLeftIcon, PlusIcon } from "lucide-react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CreatorNav, useStudioName } from "@/components/layout/creator-nav"
import { CreatorGate } from "@/components/pr/creator-gate"
import { OptionCard } from "@/components/pr/patterns"
import { NativeSelect, SmallSwitch } from "@/components/pr/settings-ui"
import {
  CardHead,
  DayChips,
  ErrorSummary,
  FieldHint,
  FieldLabel,
  StudioCard,
  TickList,
  PreviewCaption,
  DoneCard,
  fieldCol,
  fieldRow,
  selectInvalid,
  useFailToast,
  useHourLabel,
} from "@/components/pr/studio-kit"
import { Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { demoData, type Genre, type Weekday } from "@/data"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as api from "@/lib/api/creator"
import { UploadError, uploadImage } from "@/lib/api/uploads"
import { creatorKeys, useMySeries, useSeriesEdit } from "@/lib/creator"
import {
  AGES,
  DEFAULT_HOUR,
  GENRES,
  LANGS,
  MAX_TAGS,
  RELEASE_HOURS,
  SUMMARY_MAX,
  SUMMARY_MIN,
  TAG_MAX,
  TITLE_MAX,
  TITLE_MIN,
  WEEK,
  nextSampleCover,
  nextWorkId,
  sortDays,
  type Age,
  type Lang,
  type StudioGenre,
} from "@/lib/creator-studio"
import { withDemo } from "@/lib/demo-api"
import { useLocalize } from "@/lib/localize"
import { genreFromSlug, genreSlug } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Create series (spec §15, prototype CreateSeries/): four steps (Basics / Story / Cover / Publishing) with an error
 * summary per step, a reader preview on the side and drafts saved automatically, then the "in review" screen.
 * - Demo: the draft autosaves to the store's `draftSeries` (keyed "new" or by the work id, so `?draft=C3` continues the
 *   dashboard's draft); Submit puts the work in `myWorks` with status "review", where the admin series queue finds it.
 *   A cover is a sample cover from the demo catalogue (the prototype's "Cover uploaded").
 * - Real API: Save draft creates or updates the series as a draft (POST/PUT /creator/series), Submit also publishes it
 *   (the API has no review step yet), and the cover is a real upload. `?draft=<id>` continues one of the creator's
 *   series. The second genre, 16+ vs 18+, both languages as separate versions, more than one update day, the release
 *   time and Fast Pass stay in the local draft only (the API has no fields for them).
 */

type Format = "comic" | "novel"
type Draft = {
  format: Format
  title: string
  genre: StudioGenre | ""
  genre2: StudioGenre | ""
  age: Age
  lang: Lang
  summary: string
  tags: string[]
  cover: string
  /** Real API: the finished cover upload to send (null = keep the saved cover) */
  coverUploadId: string | null
  days: Weekday[]
  time: number
  fastPass: boolean
  agree: boolean
  /** Real API: the story status of a series being continued */
  run: "ongoing" | "completed" | "hiatus"
}
type Step = "basics" | "story" | "cover" | "publishing"
type Field = "title" | "genre" | "summary" | "cover" | "days" | "agree"
type Problem = { field: Field; text: string }

const STEPS: Step[] = ["basics", "story", "cover", "publishing"]
const TAG_IDEAS = ["khmer", "slowburn", "foundfamily", "magic", "schoollife"]
const AGE_API = { all: "all", "13": "teen", "16": "mature", "18": "mature" } as const
const LANG_API: Record<Lang, string[]> = { km: ["km"], en: ["en"], both: ["en", "km"] }

const blank = (): Draft => ({
  format: "comic",
  title: "",
  genre: "",
  genre2: "",
  age: "all",
  lang: "km",
  summary: "",
  tags: [],
  cover: "",
  coverUploadId: null,
  days: [],
  time: DEFAULT_HOUR,
  fastPass: false,
  agree: false,
  run: "ongoing",
})

/** A saved draft from the store, keeping only well-formed fields. */
function readDraft(value: unknown): Partial<Draft> {
  if (!value || typeof value !== "object") return {}
  const v = value as Record<string, unknown>
  const out: Partial<Draft> = {}
  const str = (k: keyof Draft) => (typeof v[k] === "string" ? (v[k] as string) : undefined)
  if (v.format === "comic" || v.format === "novel") out.format = v.format
  if (str("title") !== undefined) out.title = str("title")!.slice(0, TITLE_MAX)
  for (const k of ["genre", "genre2"] as const) {
    const g = str(k)
    if (g === "" || (g && (GENRES as readonly string[]).includes(g))) out[k] = g as StudioGenre | ""
  }
  if ((AGES as readonly unknown[]).includes(v.age)) out.age = v.age as Age
  if ((LANGS as readonly unknown[]).includes(v.lang)) out.lang = v.lang as Lang
  if (str("summary") !== undefined) out.summary = str("summary")!.slice(0, SUMMARY_MAX)
  if (Array.isArray(v.tags)) out.tags = v.tags.filter((x): x is string => typeof x === "string").slice(0, MAX_TAGS)
  if (str("cover") !== undefined) out.cover = str("cover")
  if (typeof v.coverUploadId === "string") out.coverUploadId = v.coverUploadId
  if (Array.isArray(v.days)) out.days = sortDays(v.days.filter((x): x is Weekday => (WEEK as unknown[]).includes(x)))
  if ((RELEASE_HOURS as readonly unknown[]).includes(v.time)) out.time = v.time as number
  if (typeof v.fastPass === "boolean") out.fastPass = v.fastPass
  if (typeof v.agree === "boolean") out.agree = v.agree
  return out
}

export function CreateSeriesPage() {
  const t = useTranslations("seriesForm")
  return (
    <CreatorGate title={t("newSeries")}>
      <CreatorNav active="new" />
      <Start />
    </CreatorGate>
  )
}

/** Picks the draft to continue: `?draft=<id>` (a demo work, or one of the creator's series in real mode) or a new one. */
function Start() {
  const params = useSearchParams()
  const draftId = params.get("draft")
  if (!DEMO_MODE && draftId) return <RealDraft id={draftId} />
  // Only a draft can be continued here; a series in review or live is changed in Manage series.
  const work = draftId ? useAppStore.getState().myWorks.find((w) => w.id === draftId && w.status === "draft") : undefined
  const seed: Partial<Draft> = work
    ? { format: work.format, title: work.title, genre: work.genre, summary: work.summary, cover: work.cover, days: [work.day] }
    : {}
  return <Wizard key={work?.id ?? "new"} workId={work?.id ?? null} seed={seed} />
}

function RealDraft({ id }: { id: string }) {
  const ts = useTranslations("states")
  const query = useSeriesEdit(id)
  if (query.isPending) return <WizardSkeleton />
  if (query.isError) {
    return (
      <div className="container pt-6 pb-16">
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={ts("errorTitle")}
          text={ts("errorDescription")}
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
              {ts("retry")}
            </Button>
          }
        />
      </div>
    )
  }
  const s = query.data
  const seed: Partial<Draft> = {
    format: s.type,
    title: s.title,
    genre: genreFromSlug(s.genre, GENRES) ?? "",
    lang: s.languages.includes("km") && s.languages.includes("en") ? "both" : s.languages.includes("en") ? "en" : "km",
    summary: s.summary,
    tags: s.tags.slice(0, MAX_TAGS),
    age: s.ageRating === "teen" ? "13" : s.ageRating === "mature" ? "18" : "all",
    cover: s.coverUrl ?? "",
    days: s.updateDay ? [s.updateDay] : [],
    run: s.status,
  }
  return <Wizard key={s.id} workId={s.id} seed={seed} />
}

function WizardSkeleton() {
  return (
    <div className="container flex flex-col gap-5 pt-6 pb-16" aria-hidden>
      <Skeleton className="h-12 w-72 max-w-full" />
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[520px] rounded-card" />
        <Skeleton className="h-[460px] rounded-card max-md:hidden" />
      </div>
    </div>
  )
}

function Wizard({ workId, seed }: { workId: string | null; seed: Partial<Draft> }) {
  const t = useTranslations("seriesForm")
  const td = useTranslations("data")
  const locale = useLocale()
  const loc = useLocalize()
  const qc = useQueryClient()
  const fail = useFailToast()
  const hourLabel = useHourLabel()
  const studioName = useStudioName()
  const myWorks = useAppStore((s) => s.myWorks)
  const realSeries = useMySeries({ q: "", visibility: "" }, !DEMO_MODE)
  const draftKey = workId ?? "new"

  const [d, setD] = useState<Draft>(() => ({ ...blank(), ...seed, ...readDraft(useAppStore.getState().draftSeries?.[draftKey]) }))
  // Real API: the series this draft has become (after Save draft), so the next save updates it.
  const [savedId, setSavedId] = useState<string | null>(DEMO_MODE ? null : workId)
  // A draft being continued opens at its first unfinished step.
  const [step, setStep] = useState<Step>(() => (workId ? firstOpenStep({ ...blank(), ...seed, ...readDraft(useAppStore.getState().draftSeries?.[draftKey]) }) : "basics"))
  const [tried, setTried] = useState<Partial<Record<Step, boolean>>>({})
  const [tagDraft, setTagDraft] = useState("")
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null)
  const [savedNow, setSavedNow] = useState(false)
  const [done, setDone] = useState<{ id: string; title: string; live: boolean; format: Format } | null>(null)
  const [coverProgress, setCoverProgress] = useState<number | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const autosave = useRef<ReturnType<typeof setTimeout>>(undefined)
  const headRef = useRef<HTMLHeadingElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const moved = useRef(false)

  useEffect(() => () => clearTimeout(autosave.current), [])
  // Moving between steps: start at the top and put the focus on the step title.
  useEffect(() => {
    if (!moved.current) return
    window.scrollTo({ top: 0 })
    headRef.current?.focus({ preventScroll: true })
  }, [step])

  // Titles already used: the catalogue and the creator's other series.
  const taken = new Set(
    (DEMO_MODE
      ? [...demoData.series.map((s) => s.title), ...myWorks.filter((w) => w.id !== workId).map((w) => w.title)]
      : (realSeries.data ?? []).filter((r) => r.series.id !== savedId).map((r) => r.series.title)
    ).map((x) => x.trim().toLowerCase())
  )
  const unit = d.format

  function problems(s: Step, v: Draft = d): Problem[] {
    const out: Problem[] = []
    const title = v.title.trim()
    if (s === "basics") {
      if (title.length < TITLE_MIN) out.push({ field: "title", text: t("errTitle") })
      else if (taken.has(title.toLowerCase())) out.push({ field: "title", text: t("errTitleTaken", { title }) })
      if (!v.genre) out.push({ field: "genre", text: t("errGenre") })
    }
    if (s === "story" && v.summary.trim().length < SUMMARY_MIN) out.push({ field: "summary", text: t("errSummary") })
    if (s === "cover" && !v.cover) out.push({ field: "cover", text: t("errCover") })
    if (s === "publishing") {
      if (!v.days.length) out.push({ field: "days", text: t("errDays") })
      if (!v.agree) out.push({ field: "agree", text: t("errAgree") })
    }
    return out
  }

  const ix = STEPS.indexOf(step)
  const shown = tried[step] ? problems(step) : []
  const bad = (f: Field) => shown.find((p) => p.field === f)?.text

  function saveLocal(next: Draft) {
    const store = useAppStore.getState()
    store.setDraftSeries({ ...(store.draftSeries ?? {}), [draftKey]: next })
    setSavedNow(true)
  }
  function update(patch: Partial<Draft>) {
    const next = { ...d, ...patch }
    setD(next)
    clearTimeout(autosave.current)
    autosave.current = setTimeout(() => saveLocal(next), 600)
  }
  function clearLocal() {
    clearTimeout(autosave.current)
    const store = useAppStore.getState()
    const rest = { ...(store.draftSeries ?? {}) }
    delete rest[draftKey]
    store.setDraftSeries(Object.keys(rest).length ? rest : null)
  }
  function go(s: Step) {
    moved.current = true
    setStep(s)
  }

  function addTag(raw: string) {
    const tag = raw.replace(/^#/, "").trim().toLowerCase().replace(/[\s,#]+/g, "").slice(0, TAG_MAX)
    setTagDraft("")
    if (!tag || d.tags.includes(tag) || d.tags.length >= MAX_TAGS) return
    update({ tags: [...d.tags, tag] })
  }

  // ---- cover
  async function pickFile(file: File) {
    setCoverError(null)
    setCoverProgress(0)
    try {
      const image = await uploadImage(file, "COVER", { onProgress: setCoverProgress })
      update({ cover: image.url ?? URL.createObjectURL(file), coverUploadId: image.id })
    } catch (e) {
      const err = e instanceof UploadError ? e : new UploadError("upload_failed")
      setCoverError(
        err.code === "image_too_small"
          ? t("uploadTooSmall", { width: err.detail.width ?? 0, min: err.detail.min ?? 0 })
          : t.has(`uploadError_${err.code}` as never)
            ? t(`uploadError_${err.code}` as never)
            : t("uploadError_upload_failed")
      )
    } finally {
      setCoverProgress(null)
    }
  }
  function pickCover() {
    if (!DEMO_MODE) return fileRef.current?.click()
    update({ cover: nextSampleCover(d.cover) })
    toast.success(t("coverSample"))
  }

  // ---- saving
  function toInput(v: Draft): api.SeriesInput {
    return {
      title: v.title.trim(),
      type: savedId ? undefined : v.format,
      genre: v.genre ? genreSlug(v.genre) : "",
      languages: LANG_API[v.lang],
      summary: v.summary.trim(),
      ageRating: AGE_API[v.age],
      updateDay: sortDays(v.days)[0] ?? null,
      status: v.run,
      tags: v.tags,
      coverUploadId: v.coverUploadId,
      bannerUploadId: null,
    }
  }

  async function saveDraft() {
    saveLocal(d)
    if (DEMO_MODE) {
      // A draft the dashboard lists (`?draft=C3`) gets the new basics too.
      const work = workId ? useAppStore.getState().myWorks.find((w) => w.id === workId) : undefined
      if (work && work.status === "draft") {
        useAppStore.getState().upsertWork({
          ...work,
          format: d.format,
          title: d.title.trim().length >= TITLE_MIN ? d.title.trim() : work.title,
          genre: (d.genre || work.genre) as Genre,
          summary: d.summary.trim(),
          cover: d.cover,
          day: sortDays(d.days)[0] ?? work.day,
        })
      }
      toast.success(t("draftSaved"))
      return
    }
    // The API needs the basics before it can keep a draft.
    if (problems("basics").length) {
      setTried((x) => ({ ...x, basics: true }))
      if (step !== "basics") go("basics")
      return
    }
    setBusy("draft")
    try {
      const s = savedId ? await api.updateSeries(savedId, toInput(d)) : await api.createSeries(toInput(d))
      setSavedId(s.id)
      setD((x) => ({ ...x, coverUploadId: null }))
      await qc.invalidateQueries({ queryKey: creatorKeys.all })
      toast.success(t("draftSaved"))
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    setBusy("submit")
    try {
      if (DEMO_MODE) {
        await withDemo(() => null)
        const store = useAppStore.getState()
        const existing = workId ? store.myWorks.find((w) => w.id === workId) : undefined
        const id = existing?.id ?? nextWorkId(store.myWorks)
        store.upsertWork({
          id,
          title: d.title.trim(),
          format: d.format,
          genre: d.genre as Genre,
          status: "review",
          eps: existing?.eps ?? 0,
          day: sortDays(d.days)[0] ?? "Sat",
          cover: d.cover,
          views: existing?.views ?? "0",
          subs: existing?.subs ?? "0",
          likes: existing?.likes ?? "0",
          summary: d.summary.trim(),
        })
        clearLocal()
        setDone({ id, title: d.title.trim(), live: false, format: d.format })
      } else {
        let s = savedId ? await api.updateSeries(savedId, toInput(d)) : await api.createSeries(toInput(d))
        setSavedId(s.id)
        if (s.visibility !== "published") s = await api.publishSeries(s.id)
        await qc.invalidateQueries({ queryKey: creatorKeys.all })
        clearLocal()
        setDone({ id: s.id, title: s.title, live: true, format: s.type })
      }
      window.scrollTo({ top: 0 })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  function next(e: React.FormEvent) {
    e.preventDefault()
    setTried((x) => ({ ...x, [step]: true }))
    if (problems(step).length) {
      window.scrollTo({ top: 0 })
      return
    }
    if (step !== "publishing") go(STEPS[ix + 1])
    else void submit()
  }

  if (done) {
    return (
      <div className="container pt-6 pb-16">
        <DoneCard
          title={t(done.live ? "doneLiveTitle" : "doneTitle", { title: done.title })}
          body={t(done.live ? "doneLiveBody" : "doneBody", { unit: done.format })}
        >
          <Button asChild variant="brand">
            <Link href={`/creator/upload?series=${done.id}`}>{t("uploadFirst", { unit: done.format })}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/creator">{t("backToDashboard")}</Link>
          </Button>
        </DoneCard>
      </div>
    )
  }

  const info = {
    basics: [t("basicsTitle"), t("basicsHint")],
    story: [t("storyTitle"), t("storyHint")],
    cover: [t("coverTitle"), t("coverHint")],
    publishing: [t("publishingTitle"), t("publishingHint", { unit })],
  }[step]
  const sumLen = d.summary.trim().length
  const ageHint = { all: t("ageHintAll"), "13": t("ageHint13"), "16": t("ageHint16"), "18": t("ageHint18") }[d.age]
  const ageLabel = (a: Age) => (a === "all" ? t("ageAll") : `${a}+`)
  // Short day names in English ("Sat, Sun"); Khmer uses the full names (its chips are one or two letters).
  const dayLabel = (x: Weekday) => (locale === "km" ? td(`dayFull.${x}`) : t(`dayChip.${x}`))
  const daysLong = sortDays(d.days).map((x) => td(`dayFull.${x}`))
  const ideas = TAG_IDEAS.filter((x) => !d.tags.includes(x)).slice(0, 4)
  const canTag = d.tags.length < MAX_TAGS
  const cover = d.cover

  return (
    <div className="container flex flex-col gap-5 pt-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-h2 break-words">{d.title.trim() || t("newSeries")}</h1>
          <p className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground" role="status">
            <CheckIcon className="size-3 shrink-0" aria-hidden />
            {savedNow ? t("savedJustNow") : t("savesAutomatically")}
          </p>
        </div>
        <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {STEPS.map((s, i) => {
            const cur = i === ix
            const isDone = i < ix
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={i > ix}
                  aria-current={cur ? "step" : undefined}
                  onClick={() => i < ix && go(s)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border bg-background pr-3 pl-1.5 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70",
                    cur && "border-foreground text-foreground",
                    isDone && "text-brand-ink hover:bg-accent"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums",
                      cur && "bg-foreground text-background",
                      isDone && "bg-primary text-primary-foreground"
                    )}
                  >
                    {isDone ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn(!cur && "max-lg:sr-only")}>
                    {t(`step.${s}`)}
                    {isDone ? <span className="sr-only"> ({t("tickDone")})</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <StudioCard className="flex flex-col">
          <form onSubmit={next} noValidate aria-labelledby="cs-step-title">
            <CardHead ref={headRef} id="cs-step-title" title={info[0]} hint={info[1]} />
            <div className="flex flex-col gap-5 p-5 max-md:p-4">
              <ErrorSummary title={t("fixToContinue", { count: shown.length })} items={shown.map((p) => p.text)} />

              {step === "basics" ? (
                <>
                  <div className={fieldCol}>
                    <FieldLabel id="cs-format-l" required>
                      {t("format")}
                    </FieldLabel>
                    <div role="radiogroup" aria-labelledby="cs-format-l" className="grid gap-2.5 md:grid-cols-2">
                      {(["comic", "novel"] as const).map((f) => (
                        <OptionCard
                          key={f}
                          selected={d.format === f}
                          onSelect={() => update({ format: f })}
                          title={<span className="text-[13px] leading-[18px] font-semibold">{t(f === "comic" ? "formatComic" : "formatNovel")}</span>}
                          description={t(f === "comic" ? "formatComicDesc" : "formatNovelDesc")}
                          disabled={!DEMO_MODE && !!savedId}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="cs-title" required>
                      {t("titleLabel")}
                    </FieldLabel>
                    <Input
                      id="cs-title"
                      value={d.title}
                      maxLength={TITLE_MAX}
                      aria-invalid={!!bad("title")}
                      aria-describedby="cs-title-h"
                      onChange={(e) => update({ title: e.target.value.slice(0, TITLE_MAX) })}
                    />
                    <FieldHint id="cs-title-h" error={!!bad("title")}>
                      {bad("title") ?? t("titleHint", { count: d.title.length, max: TITLE_MAX })}
                    </FieldHint>
                  </div>
                  <div className={fieldRow}>
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="cs-genre" required>
                        {t("mainGenre")}
                      </FieldLabel>
                      <NativeSelect
                        id="cs-genre"
                        value={d.genre}
                        className={selectInvalid}
                        aria-invalid={!!bad("genre")}
                        aria-describedby={bad("genre") ? "cs-genre-e" : undefined}
                        onChange={(e) => {
                          const g = e.target.value as StudioGenre | ""
                          update({ genre: g, genre2: d.genre2 === g ? "" : d.genre2 })
                        }}
                      >
                        <option value="">{t("chooseGenre")}</option>
                        {GENRES.map((g) => (
                          <option key={g} value={g}>
                            {loc.genre(g)}
                          </option>
                        ))}
                      </NativeSelect>
                      {bad("genre") ? (
                        <FieldHint id="cs-genre-e" error>
                          {bad("genre")}
                        </FieldHint>
                      ) : null}
                    </div>
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="cs-genre2" optional>
                        {t("secondGenre")}
                      </FieldLabel>
                      <NativeSelect id="cs-genre2" value={d.genre2} onChange={(e) => update({ genre2: e.target.value as StudioGenre | "" })}>
                        <option value="">{t("none")}</option>
                        {GENRES.filter((g) => g !== d.genre).map((g) => (
                          <option key={g} value={g}>
                            {loc.genre(g)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className={fieldRow}>
                    <div className={fieldCol}>
                      <FieldLabel id="cs-age-l" required>
                        {t("ageRating")}
                      </FieldLabel>
                      <Segmented
                        stretch
                        label={t("ageRating")}
                        value={d.age}
                        onChange={(a) => update({ age: a })}
                        options={AGES.map((a) => ({ value: a, label: ageLabel(a) }))}
                      />
                      <FieldHint>{ageHint}</FieldHint>
                    </div>
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="cs-lang" required>
                        {t("language")}
                      </FieldLabel>
                      <NativeSelect id="cs-lang" value={d.lang} onChange={(e) => update({ lang: e.target.value as Lang })}>
                        <option value="km">{t("langKm")}</option>
                        <option value="en">{t("langEn")}</option>
                        <option value="both">{t("langBoth")}</option>
                      </NativeSelect>
                    </div>
                  </div>
                </>
              ) : null}

              {step === "story" ? (
                <>
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="cs-sum" required>
                      {t("summaryLabel")}
                    </FieldLabel>
                    <Textarea
                      id="cs-sum"
                      rows={5}
                      maxLength={SUMMARY_MAX}
                      value={d.summary}
                      placeholder={t("summaryPlaceholder")}
                      aria-invalid={!!bad("summary")}
                      aria-describedby="cs-sum-h"
                      onChange={(e) => update({ summary: e.target.value.slice(0, SUMMARY_MAX) })}
                    />
                    <div className="flex justify-between gap-3">
                      <FieldHint id="cs-sum-h" error={!!bad("summary")}>
                        {bad("summary") ?? (sumLen < SUMMARY_MIN ? t("summaryMore", { count: SUMMARY_MIN - sumLen }) : t("looksGood"))}
                      </FieldHint>
                      <span className="shrink-0 text-xs leading-4 text-muted-foreground tabular-nums">
                        {d.summary.length}/{SUMMARY_MAX}
                      </span>
                    </div>
                  </div>
                  <div className={fieldCol}>
                    <FieldLabel htmlFor={canTag ? "cs-tag" : undefined} id="cs-tags-l">
                      {t("tagsLabel")} <span className="text-xs leading-4 font-normal text-muted-foreground">{t("tagsMax", { max: MAX_TAGS })}</span>
                    </FieldLabel>
                    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border border-input bg-background p-1.5 shadow-xs transition-colors focus-within:border-[#a1a1aa] focus-within:ring-[3px] focus-within:ring-[rgba(0,166,80,0.22)]">
                      <ul aria-labelledby="cs-tags-l" className="contents">
                        {d.tags.map((tag) => (
                          <li key={tag} className="inline-flex h-7 items-center gap-1 rounded-full bg-foreground pr-1 pl-2.5 text-[13px] font-medium text-background">
                            #{tag}
                            <button
                              type="button"
                              aria-label={t("removeTag", { tag })}
                              onClick={() => update({ tags: d.tags.filter((x) => x !== tag) })}
                              className="inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-sm leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      {canTag ? (
                        <input
                          id="cs-tag"
                          value={tagDraft}
                          placeholder={t("tagPlaceholder")}
                          aria-describedby="cs-tags-h"
                          className="h-7 min-w-[120px] flex-[1_1_140px] bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
                          onChange={(e) => {
                            const v = e.target.value
                            if (/[,\s]$/.test(v)) addTag(v)
                            else setTagDraft(v.slice(0, TAG_MAX))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addTag(tagDraft)
                            } else if (e.key === "Backspace" && !tagDraft && d.tags.length) {
                              update({ tags: d.tags.slice(0, -1) })
                            }
                          }}
                        />
                      ) : null}
                    </div>
                    <span id="cs-tags-h" className="sr-only">
                      {t("tagsHelp")}
                    </span>
                    {canTag && ideas.length ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs leading-4 text-muted-foreground">{t("popular")}</span>
                        {ideas.map((x) => (
                          <button
                            key={x}
                            type="button"
                            onClick={() => addTag(x)}
                            aria-label={t("addTag", { tag: x })}
                            className="inline-flex h-7 items-center rounded-full border bg-background px-3 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            + {x}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              {step === "cover" ? (
                <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className={fieldCol}>
                    <FieldLabel id="cs-cover-l" required>
                      {t("coverLabel")}
                    </FieldLabel>
                    {!DEMO_MODE ? (
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="sr-only"
                        tabIndex={-1}
                        aria-labelledby="cs-cover-l"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (file) void pickFile(file)
                        }}
                      />
                    ) : null}
                    {coverProgress !== null ? (
                      <div role="status" className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-[#a1a1aa] bg-[#fafafa] p-4 text-center max-md:aspect-auto max-md:min-h-[180px] dark:bg-muted">
                        <span className="text-[13px] leading-[18px] font-semibold">{t("coverUploading", { percent: coverProgress })}</span>
                        <Progress value={coverProgress} aria-label={t("coverLabel")} className="w-full" />
                      </div>
                    ) : cover ? (
                      <div className="flex flex-col gap-2">
                        <Image
                          src={cover}
                          alt={t("coverPreviewAlt")}
                          width={440}
                          height={587}
                          unoptimized={!DEMO_MODE}
                          className="aspect-[3/4] w-full rounded-card border object-cover max-md:max-w-[200px]"
                        />
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={pickCover}>
                            {t("replace")}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => update({ cover: "", coverUploadId: null })}>
                            {t("remove")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={pickCover}
                        aria-describedby={bad("cover") ? "cs-cover-e" : undefined}
                        onDragOver={(e) => {
                          if (e.dataTransfer.types.includes("Files")) {
                            e.preventDefault()
                            setDropping(true)
                          }
                        }}
                        onDragLeave={() => setDropping(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDropping(false)
                          const file = e.dataTransfer.files?.[0]
                          if (!file) return
                          if (DEMO_MODE) pickCover()
                          else void pickFile(file)
                        }}
                        className={cn(
                          "flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-[#a1a1aa] bg-[#fafafa] p-3 text-center transition-colors outline-none hover:border-primary hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-md:aspect-auto max-md:min-h-[180px] dark:bg-muted",
                          dropping && "border-primary bg-selected",
                          bad("cover") && "border-destructive"
                        )}
                      >
                        <PlusIcon className="size-[22px]" aria-hidden />
                        <span className="text-[13px] leading-[18px] font-semibold">{t("chooseCover")}</span>
                        <span className="text-xs leading-4 text-muted-foreground">{t("orDrag")}</span>
                      </button>
                    )}
                    {coverError ? (
                      <FieldHint error>
                        <span role="alert">{coverError}</span>
                      </FieldHint>
                    ) : bad("cover") ? (
                      <FieldHint id="cs-cover-e" error>
                        {bad("cover")}
                      </FieldHint>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2.5">
                    <span className="text-sm leading-5 font-medium">{t("requirements")}</span>
                    <TickList
                      items={[t("req1"), t("req2"), t("req3"), t("req4")].map((text) => ({ ok: !!cover, text }))}
                    />
                    <span className="pt-1.5 text-sm leading-5 font-medium">{t("squareThumb")}</span>
                    <div className="flex items-center gap-3">
                      <div className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-card bg-muted text-[11px] text-muted-foreground">
                        {cover ? (
                          <Image src={cover} alt="" width={144} height={192} unoptimized={!DEMO_MODE} className="absolute inset-x-0 top-0 h-[133%] w-full object-cover" />
                        ) : (
                          "1:1"
                        )}
                      </div>
                      <span className="text-xs leading-4 text-muted-foreground">{t("squareThumbHint")}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === "publishing" ? (
                <>
                  <div className={fieldCol}>
                    <FieldLabel id="cs-days-l" required>
                      {t("updateDays")}
                    </FieldLabel>
                    <DayChips value={d.days} onChange={(days) => update({ days: sortDays(days) })} labelledBy="cs-days-l" />
                    <FieldHint error={!!bad("days")}>
                      {bad("days") ??
                        (d.days.length
                          ? t("daysHintSet", { unit, days: listJoin(t, daysLong) })
                          : t("daysHintNone"))}
                    </FieldHint>
                  </div>
                  <div className={fieldRow}>
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="cs-time">{t("releaseTime")}</FieldLabel>
                      <NativeSelect id="cs-time" value={String(d.time)} aria-describedby="cs-time-h" onChange={(e) => update({ time: Number(e.target.value) })}>
                        {RELEASE_HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h)}
                          </option>
                        ))}
                      </NativeSelect>
                      <FieldHint id="cs-time-h">{t("releaseTimeHint")}</FieldHint>
                    </div>
                    <div className={fieldCol}>
                      <FieldLabel id="cs-fp-l">{t("fastPass")}</FieldLabel>
                      <div className="flex min-h-9 items-center justify-between gap-3">
                        <span id="cs-fp-d" className="text-[13px] leading-[18px]">
                          {t("fastPassDesc", { unit })}
                        </span>
                        <SmallSwitch checked={d.fastPass} onCheckedChange={(on) => update({ fastPass: on })} aria-labelledby="cs-fp-l" aria-describedby="cs-fp-d cs-fp-h" />
                      </div>
                      <FieldHint id="cs-fp-h">{t("fastPassHint", { unit })}</FieldHint>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="cs-agree"
                        checked={d.agree}
                        className="mt-px"
                        aria-invalid={!!bad("agree")}
                        aria-describedby={bad("agree") ? "cs-agree-e" : undefined}
                        onCheckedChange={(on) => update({ agree: on === true })}
                      />
                      <label htmlFor="cs-agree" className="text-[13px] leading-[18px]">
                        {t.rich("agree", {
                          link: (chunks) => (
                            <Link href="/legal/creator" className="underline underline-offset-2">
                              {chunks}
                            </Link>
                          ),
                        })}
                      </label>
                    </div>
                    {bad("agree") ? (
                      <FieldHint id="cs-agree-e" error>
                        {bad("agree")}
                      </FieldHint>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-t px-5 pt-4 pb-5 max-md:flex-wrap max-md:px-4 max-md:pb-4">
              {ix > 0 ? (
                <Button type="button" variant="ghost" onClick={() => go(STEPS[ix - 1])}>
                  <ChevronLeftIcon />
                  {t("back")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="ml-auto" loading={busy === "draft"} disabled={busy !== null} onClick={() => void saveDraft()}>
                {t("saveDraft")}
              </Button>
              <Button type="submit" variant="brand" loading={busy === "submit"} disabled={busy !== null} className="max-md:order-3 max-md:basis-full">
                {step === "publishing" ? t("submitForReview") : t("continue")}
              </Button>
            </div>
          </form>
        </StudioCard>

        <aside aria-label={t("readerPreview")} className="flex flex-col gap-3 max-md:hidden md:sticky md:top-20">
          <PreviewCaption>{t("readerPreview")}</PreviewCaption>
          <div className="overflow-hidden rounded-card border bg-card shadow-xs">
            <div className="relative flex aspect-[3/4] items-center justify-center bg-[#fafafa] bg-[image:repeating-linear-gradient(135deg,#f4f4f5_0_12px,#fafafa_12px_24px)] text-xs text-muted-foreground dark:bg-muted dark:bg-none">
              {cover ? <Image src={cover} alt="" fill sizes="300px" unoptimized={!DEMO_MODE} className="object-cover" /> : t("coverFallback")}
            </div>
            <div className="flex flex-col gap-1.5 p-3.5">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{d.genre ? loc.genre(d.genre) : t("genreFallback")}</Badge>
                <Badge variant="outline">{t(d.format === "comic" ? "formatComic" : "formatNovel")}</Badge>
                <Badge variant="outline">{ageLabel(d.age)}</Badge>
              </div>
              <span className="type-h4 break-words">{d.title.trim() || t("titleFallback")}</span>
              <span className="text-xs leading-4 text-muted-foreground">
                {t("previewBy", {
                  name: studioName,
                  schedule: d.days.length ? t("previewEvery", { days: sortDays(d.days).map(dayLabel).join(", ") }) : t("previewNoSchedule"),
                })}
              </span>
              <p className="text-xs leading-4 break-words text-[#3f3f46] dark:text-foreground">{d.summary.trim() || t("summaryFallback")}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/** The first step that still misses something (title uniqueness is checked when moving on). */
function firstOpenStep(d: Draft): Step {
  if (d.title.trim().length < TITLE_MIN || !d.genre) return "basics"
  if (d.summary.trim().length < SUMMARY_MIN) return "story"
  if (!d.cover) return "cover"
  return "publishing"
}

/** "Monday", "Monday and Thursday", "Monday, Thursday and Saturday" in the current language. */
function listJoin(t: ReturnType<typeof useTranslations<"seriesForm">>, items: string[]): string {
  if (items.length < 2) return items[0] ?? ""
  return t("listAnd", { a: items.slice(0, -1).join(", "), b: items[items.length - 1] })
}
