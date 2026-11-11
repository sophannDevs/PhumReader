"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircleIcon, ArrowDownIcon, ArrowUpIcon, LayersIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CreatorNav } from "@/components/layout/creator-nav"
import { CreatorGate } from "@/components/pr/creator-gate"
import { OptionCard } from "@/components/pr/patterns"
import { NativeSelect } from "@/components/pr/settings-ui"
import {
  CardHead,
  DoneCard,
  ErrorSummary,
  FieldHint,
  FieldLabel,
  PreviewCaption,
  StudioCard,
  SwitchRow,
  TickList,
  fieldCol,
  fieldRow,
  useDayDate,
  useFailToast,
  useHourLabel,
} from "@/components/pr/studio-kit"
import { StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Weekday } from "@/data"
import { Link, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as api from "@/lib/api/creator"
import { creatorKeys, useEpisodeEdit, useMyEpisodes, useMySeries } from "@/lib/creator"
import {
  DEFAULT_HOUR,
  FAST_PASS_COINS,
  FREE_AFTER_DAYS,
  MIN_WORDS,
  NOTE_MAX,
  PANEL_MAX_WIDTH,
  RELEASE_HOURS,
  TITLE_MAX,
  TITLE_MIN,
  countWords,
  demoEpisodes,
  ictAt,
  onOrAfter,
} from "@/lib/creator-studio"
import { withDemo } from "@/lib/demo-api"
import { addDays, ictDate, today } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { useAppStore } from "@/lib/store"
import { MAX_PANELS, canRetry, demoPanelUpload, usePanelUploads, type PanelItem } from "@/lib/use-panel-uploads"
import { cn } from "@/lib/utils"

/**
 * Upload episode (spec §16, prototype Upload/): choose the series (the number fills in), the title, the images (comics:
 * list with progress, ↑↓, remove, size errors) or the text (novels: at least 300 words), the release (now or a slot in
 * ICT), Fast Pass, comments and the creator's note; a checklist and a phone preview on the side; a sticky Save draft /
 * Publish bar; then "Episode N is scheduled". `?series=<id>` picks the series, `&ep=<n>` edits an episode instead.
 * - Demo: the series are the store's `myWorks` (not drafts); images are the creator's own files with a simulated
 *   upload; publishing adds one to the work's episode count. Save draft only marks the draft as saved.
 * - Real API: POST/PUT /creator/series/{id}/episodes(/{n}) with the uploaded panels (or the text as blocks: empty lines
 *   split paragraphs, "# " starts a heading, "> " a quote, "* * *" a scene break). Fast Pass is 5 coins, free after 7 days.
 *   A series in review or with changes requested is marked "in review" in the series list, like in demo mode.
 */

type Format = "comic" | "novel"
type UploadSeries = { id: string; title: string; format: Format; day: Weekday | null; inReview: boolean; draft: boolean }
type EditData = {
  n: number
  title: string
  live: boolean
  scheduledAt: number | null
  panels: PanelItem[]
  text: string
  fastPass: boolean
  comments: boolean
  note: string
}
type Done = { n: number; mode: "now" | "scheduled" | "saved"; at: number | null }

const SAMPLE_BYTES = 1.6 * 1024 * 1024

export function UploadEpisodePage() {
  const t = useTranslations("episodeForm")
  return (
    <CreatorGate title={t("pageTitle")}>
      <CreatorNav active="upload" />
      <Loader />
    </CreatorGate>
  )
}

function useUploadSeries() {
  const flag = useDemoFlag()
  const works = useAppStore((s) => s.myWorks)
  const demo = useQuery({
    queryKey: ["studio-upload", flag],
    queryFn: () => withDemo(() => true, { empty: () => false }),
    enabled: DEMO_MODE,
  })
  const real = useMySeries({ q: "", visibility: "" }, !DEMO_MODE)
  if (DEMO_MODE) {
    const list: UploadSeries[] = demo.data
      ? works
          .filter((w) => w.status !== "draft")
          .map((w) => ({ id: w.id, title: w.title, format: w.format, day: w.day, inReview: w.status === "review" || w.status === "changes", draft: false }))
      : []
    return { list, pending: demo.isPending, error: demo.isError, retry: () => void demo.refetch() }
  }
  const list: UploadSeries[] = (real.data ?? [])
    .filter((r) => r.visibility !== "hidden")
    .map((r) => ({
      id: r.series.id,
      title: r.series.title,
      format: r.series.type,
      day: r.series.updateDay,
      inReview: r.visibility === "review" || r.visibility === "changes",
      draft: r.visibility === "draft",
    }))
  return { list, pending: real.isPending, error: real.isError, retry: () => void real.refetch() }
}

function Loader() {
  const t = useTranslations("episodeForm")
  const ts = useTranslations("states")
  const params = useSearchParams()
  const router = useRouter()
  const { list, pending, error, retry } = useUploadSeries()
  const wanted = params.get("series")
  const epParam = params.get("ep")
  const edit = epParam && /^[1-9]\d{0,5}$/.test(epParam) ? Number(epParam) : null
  const series = list.find((s) => s.id === wanted) ?? (edit ? undefined : list[0])

  if (pending) return <UploadSkeleton />
  if (error) {
    return (
      <div className="container pt-6 pb-16">
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={ts("errorTitle")}
          text={ts("errorDescription")}
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={retry}>
              {ts("retry")}
            </Button>
          }
        />
      </div>
    )
  }
  if (!series) {
    return (
      <div className="container flex flex-col gap-5 pt-6 pb-16">
        <h1 className="type-h2">{t("pageTitle")}</h1>
        <StateBox
          icon={LayersIcon}
          title={t(list.length ? "seriesMissingTitle" : "noSeriesTitle")}
          text={t(list.length ? "seriesMissingText" : "noSeriesText")}
          action={
            <Button asChild variant={list.length ? "outline" : "brand"} size="sm" className="mt-1">
              <Link href={list.length ? "/creator" : "/creator/new"}>{t(list.length ? "backToDashboard" : "newSeries")}</Link>
            </Button>
          }
        />
      </div>
    )
  }
  const pick = (id: string) => router.replace(`/creator/upload?series=${encodeURIComponent(id)}`, { scroll: false })
  return edit ? <EditLoader series={series} n={edit} /> : <NewEpisode series={series} options={list} onSeries={pick} />
}

function UploadSkeleton() {
  return (
    <div className="container flex flex-col gap-5 pt-6 pb-16" aria-hidden>
      <Skeleton className="h-12 w-64 max-w-full" />
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[220px] rounded-card" />
          <Skeleton className="h-[260px] rounded-card" />
        </div>
        <Skeleton className="h-[180px] rounded-card" />
      </div>
    </div>
  )
}

/** The next number: the demo work's count + 1, or after the highest of the series' episodes (real API). */
function NewEpisode({ series, options, onSeries }: { series: UploadSeries; options: UploadSeries[]; onSeries: (id: string) => void }) {
  const eps = useAppStore((s) => s.myWorks.find((w) => w.id === series.id)?.eps ?? 0)
  const real = useMyEpisodes(series.id, !DEMO_MODE)
  const last = DEMO_MODE ? eps : real.data ? Math.max(0, ...real.data.map((e) => e.number)) : null
  return <UploadForm series={series} options={options} onSeries={onSeries} prev={last} />
}

/** `&ep=<n>`: the episode to edit (demo: the generated list; real API: GET …/episodes/{n}). */
function EditLoader({ series, n }: { series: UploadSeries; n: number }) {
  const t = useTranslations("episodeForm")
  const ts = useTranslations("states")
  const work = useAppStore((s) => s.myWorks.find((w) => w.id === series.id))
  const real = useEpisodeEdit(series.id, n)
  let data: EditData | null | undefined
  if (DEMO_MODE) {
    const ep = work ? demoEpisodes(work, today).find((e) => e.n === n) : undefined
    data = ep
      ? {
          n,
          title: ep.title,
          live: ep.state === "published" || ep.state === "fastpass" || ep.state === "hidden",
          scheduledAt: ep.at ?? null,
          panels:
            series.format === "comic" && ep.thumb
              ? [{ key: `saved-${n}`, name: `ep${n}_01.jpg`, bytes: SAMPLE_BYTES, preview: ep.thumb, status: "done", progress: 100, uploadId: `demo-saved-${n}`, width: 800, height: 2400 }]
              : [],
          text: "",
          fastPass: ep.state === "fastpass" || ep.state === "scheduled",
          comments: true,
          note: "",
        }
      : null
  } else if (real.data) {
    const e = real.data
    data = {
      n: e.number,
      title: e.title,
      live: e.status === "published",
      scheduledAt: e.status === "scheduled" && e.publishedAt ? Date.parse(e.publishedAt) : null,
      panels: e.panels.map((p, i) => ({
        key: p.uploadId,
        name: t("panelName", { n: i + 1 }),
        bytes: 0,
        preview: p.url,
        status: "done" as const,
        progress: 100,
        uploadId: p.uploadId,
        width: p.width,
        height: p.height,
      })),
      text: blocksToText(e.blocks),
      fastPass: !!e.priceCoins,
      comments: e.commentsEnabled,
      note: e.creatorNote ?? "",
    }
  } else if (real.isError) {
    data = null
  }

  if (data === undefined) return <UploadSkeleton />
  if (!data) {
    return (
      <div className="container pt-6 pb-16">
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={DEMO_MODE ? t("episodeMissingTitle") : ts("errorTitle")}
          text={DEMO_MODE ? t("episodeMissingText") : ts("errorDescription")}
          action={
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href={`/creator/series/${series.id}`}>{t("backToSeries")}</Link>
            </Button>
          }
        />
      </div>
    )
  }
  return <UploadForm key={`${series.id}:${n}`} series={series} options={[series]} prev={n - 1} edit={data} />
}

function UploadForm({
  series,
  options,
  onSeries,
  prev,
  edit,
}: {
  series: UploadSeries
  options: UploadSeries[]
  onSeries?: (id: string) => void
  /** The number before this one; null while it loads */
  prev: number | null
  edit?: EditData
}) {
  const t = useTranslations("episodeForm")
  const qc = useQueryClient()
  const fail = useFailToast()
  const dayDate = useDayDate()
  const hourLabel = useHourLabel()
  const [now] = useState(() => Date.now())
  const base = DEMO_MODE ? today : ictDate(now)
  const dates = Array.from({ length: 7 }, (_, k) => addDays(base, k + 1))
  const comic = series.format === "comic"
  const unit = series.format
  const live = !!edit?.live

  const uploads = usePanelUploads(edit?.panels ?? [], { upload: DEMO_MODE ? demoPanelUpload : undefined })
  const [title, setTitle] = useState(edit?.title ?? "")
  const [text, setText] = useState(edit?.text ?? "")
  const [when, setWhen] = useState<"now" | "schedule">(edit && !edit.scheduledAt ? "now" : "schedule")
  const [date, setDate] = useState(() => {
    if (edit?.scheduledAt) return ictDate(edit.scheduledAt)
    return series.day ? onOrAfter(series.day, dates[0]) : dates[0]
  })
  const [hour, setHour] = useState(() => (edit?.scheduledAt ? new Date(edit.scheduledAt + 7 * 3_600_000).getUTCHours() : DEFAULT_HOUR))
  const [fastPass, setFastPass] = useState(edit?.fastPass ?? true)
  const [comments, setComments] = useState(edit?.comments ?? true)
  const [note, setNote] = useState(edit?.note ?? "")
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null)
  const [savedNow, setSavedNow] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  // Real API: the episode a "Save draft" created, so the next save updates it.
  const [savedNumber, setSavedNumber] = useState<number | null>(edit?.n ?? null)
  const [dropping, setDropping] = useState(false)
  const [announce, setAnnounce] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const n = edit?.n ?? savedNumber ?? (prev === null ? null : prev + 1)
  const items = uploads.items
  const badImgs = items.filter((i) => i.status === "error")
  const loading = uploads.busy
  const words = countWords(text)
  const at = ictAt(date, hour)
  const whenText = t("whenAt", { date: dayDate(date), time: hourLabel(hour) })
  const freeOn = dayDate(addDays(when === "now" || live ? base : date, FREE_AFTER_DAYS))
  // A schedule slot must still be ahead (real time in real mode).
  const slots = dates.includes(date) ? dates : [date, ...dates]

  const errors: string[] = []
  if (title.trim().length < TITLE_MIN) errors.push(t("errTitle", { unit }))
  if (comic && !items.length) errors.push(t("errImages"))
  if (comic && badImgs.length) errors.push(t("errBadImages", { count: badImgs.length }))
  if (comic && loading) errors.push(t("errUploading"))
  if (!comic && words < MIN_WORDS) errors.push(t("errWords", { min: MIN_WORDS, count: words }))
  const shown = tried ? errors : []
  const titleBad = tried && title.trim().length < TITLE_MIN

  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(""), 2000)
    return () => clearTimeout(id)
  }, [announce])

  function input(publish: api.EpisodeInput["publish"]): api.EpisodeInput {
    return {
      title: title.trim(),
      number: edit || savedNumber ? undefined : null,
      thumbnailUploadId: null,
      creatorNote: note.trim() || null,
      commentsEnabled: comments,
      fastPass: fastPass ? { priceCoins: FAST_PASS_COINS, freeAfterDays: FREE_AFTER_DAYS } : undefined,
      publish,
      imageUploadIds: comic ? items.flatMap((i) => (i.uploadId ? [i.uploadId] : [])) : null,
      blocks: comic ? null : textToBlocks(text),
    }
  }
  async function send(publish: api.EpisodeInput["publish"]) {
    const number = edit?.n ?? savedNumber
    const saved = number ? await api.updateEpisode(series.id, number, input(publish)) : await api.createEpisode(series.id, input(publish))
    setSavedNumber(saved.number)
    await qc.invalidateQueries({ queryKey: creatorKeys.all })
    return saved
  }

  async function saveDraft() {
    if (DEMO_MODE) {
      setSavedNow(true)
      toast.success(t("draftSaved"))
      return
    }
    if (title.trim().length < TITLE_MIN || loading || badImgs.length) {
      setTried(true)
      window.scrollTo({ top: 0 })
      return
    }
    setBusy("draft")
    try {
      await send({ mode: "draft" })
      setSavedNow(true)
      toast.success(t("draftSaved"))
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault()
    if (errors.length) {
      setTried(true)
      window.scrollTo({ top: 0 })
      return
    }
    setBusy("publish")
    try {
      const mode: Done["mode"] = live ? "saved" : when === "now" ? "now" : "scheduled"
      if (DEMO_MODE) {
        await withDemo(() => null)
        const store = useAppStore.getState()
        const work = store.myWorks.find((w) => w.id === series.id)
        if (work && !edit) store.upsertWork({ ...work, eps: work.eps + 1 })
        setDone({ n: n ?? 1, mode, at: mode === "scheduled" ? at : null })
      } else {
        const saved = await send(live ? { mode: "now" } : when === "now" ? { mode: "now" } : { mode: "scheduled", at: new Date(at).toISOString() })
        setDone({ n: saved.number, mode, at: saved.publishedAt ? Date.parse(saved.publishedAt) : null })
      }
      window.scrollTo({ top: 0 })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  function another() {
    uploads.clear()
    setTitle("")
    setText("")
    setNote("")
    setTried(false)
    setSavedNow(false)
    setSavedNumber(null)
    setDone(null)
    window.scrollTo({ top: 0 })
  }

  function move(index: number, to: number) {
    uploads.moveTo(index, to)
    setAnnounce(t("movedTo", { position: to + 1 }))
  }

  if (done) {
    const doneAt = done.at ? t("whenAt", { date: dayDate(ictDate(done.at)), time: hourLabel(new Date(done.at + 7 * 3_600_000).getUTCHours()) }) : whenText
    return (
      <div className="container pt-6 pb-16">
        <DoneCard
          title={t(done.mode === "saved" ? "doneSavedTitle" : done.mode === "now" ? "doneLiveTitle" : "doneScheduledTitle", { unit, n: done.n })}
          body={done.mode === "saved" ? t("doneSavedBody") : done.mode === "now" ? t("doneLiveBody") : t("doneScheduledBody", { when: doneAt })}
        >
          {edit ? (
            <Button asChild variant="brand">
              <Link href={`/creator/series/${series.id}`}>{t("backToSeries")}</Link>
            </Button>
          ) : (
            <Button type="button" variant="brand" onClick={another}>
              {t("uploadNext", { unit, n: done.n + 1 })}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/creator">{t("backToDashboard")}</Link>
          </Button>
        </DoneCard>
      </div>
    )
  }

  const mb = (bytes: number) => Math.max(bytes ? 0.1 : 0, Math.round((bytes / (1024 * 1024)) * 10) / 10).toLocaleString("en-US")
  const nLabel = n === null ? "…" : String(n)
  const shownAs = t("shownAs", { unit, n: nLabel, title: title.trim() || t("titleWord") })
  const primaryLabel = live ? t("saveChanges") : when === "now" ? t("publishNow", { unit }) : t("scheduleFor", { date: dayDate(date) })

  return (
    <div className="container flex flex-col gap-5 pt-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-h2">{edit ? t("editTitle", { unit, n: edit.n }) : t("uploadTitle", { unit })}</h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {series.title} · {t("unitN", { unit, n: nLabel })}
          </p>
        </div>
        <span className="text-xs leading-4 text-muted-foreground" role="status">
          {savedNow ? t("savedJustNow") : ""}
        </span>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={publish} noValidate className="flex min-w-0 flex-col gap-5">
          <ErrorSummary title={t("fixBeforePublishing", { count: shown.length })} items={shown} />

          <StudioCard aria-labelledby="up-details">
            <CardHead id="up-details" title={t("details")} />
            <div className="flex flex-col gap-[18px] p-5 max-md:p-4">
              <div className={fieldRow}>
                <div className={fieldCol}>
                  <FieldLabel htmlFor="up-series">{t("series")}</FieldLabel>
                  <NativeSelect id="up-series" value={series.id} disabled={!!edit || !onSeries} onChange={(e) => onSeries?.(e.target.value)}>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.inReview ? t("seriesInReview", { title: o.title }) : o.draft ? t("seriesDraft", { title: o.title }) : o.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className={fieldCol}>
                  <span className="text-sm leading-5 font-medium" id="up-no-l">
                    {t("numberLabel", { unit })}
                  </span>
                  <div aria-labelledby="up-no-l" role="group" className="flex h-9 min-w-0 items-center gap-2.5 rounded-control border bg-[#fafafa] px-3 dark:bg-muted">
                    <strong className="text-sm tabular-nums">{nLabel}</strong>
                    <span className="truncate text-xs leading-4 text-muted-foreground">
                      {edit ? t("numberFixed") : prev ? t("numberNext", { unit, n: prev }) : prev === 0 ? t("numberFirst", { unit }) : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className={fieldCol}>
                <FieldLabel htmlFor="up-title" required>
                  {t("titleLabel", { unit })}
                </FieldLabel>
                <Input
                  id="up-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder={t(comic ? "titlePlaceholderComic" : "titlePlaceholderNovel")}
                  aria-invalid={titleBad}
                  aria-describedby="up-title-h"
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                />
                <FieldHint id="up-title-h" error={titleBad}>
                  {titleBad ? t("titleMissing") : shownAs}
                </FieldHint>
              </div>
            </div>
          </StudioCard>

          <StudioCard aria-labelledby="up-content">
            <CardHead
              id="up-content"
              title={comic ? t("images") : t("chapterText")}
              aside={
                comic ? (
                  <span className="text-xs leading-4 text-muted-foreground tabular-nums">
                    {items.length ? t("imagesSummary", { count: items.length, mb: mb(uploads.bytes) }) : t("noImages")}
                  </span>
                ) : null
              }
            />
            <div className="flex flex-col gap-3.5 p-5 max-md:p-4">
              {comic ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      if (e.target.files?.length) uploads.add(Array.from(e.target.files))
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    disabled={items.length >= MAX_PANELS}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("Files")) {
                        e.preventDefault()
                        setDropping(true)
                      }
                    }}
                    onDragLeave={() => setDropping(false)}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes("Files")) return
                      e.preventDefault()
                      setDropping(false)
                      uploads.add(Array.from(e.dataTransfer.files))
                    }}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-[#a1a1aa] bg-[#fafafa] px-4 py-7 text-center transition-colors outline-none hover:border-primary hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-muted",
                      dropping && "border-primary bg-selected",
                      tried && !items.length && "border-destructive"
                    )}
                  >
                    <PlusIcon className="size-[22px]" aria-hidden />
                    <span className="text-[13px] leading-[18px] font-semibold">{items.length ? t("addMoreImages") : t("chooseImages")}</span>
                    <span className="text-xs leading-4 text-muted-foreground">{t("imageRules", { max: MAX_PANELS })}</span>
                  </button>
                  {uploads.tooMany ? (
                    <FieldHint error>
                      <span role="alert">{t("tooManyImages", { max: MAX_PANELS })}</span>
                    </FieldHint>
                  ) : null}
                  {items.length ? (
                    <ol aria-label={t("imagesInOrder")} className="m-0 flex list-none flex-col overflow-hidden rounded-[10px] border p-0">
                      {items.map((item, i) => (
                        <ImageRow
                          key={item.key}
                          item={item}
                          index={i}
                          last={i === items.length - 1}
                          mb={mb}
                          onMove={(to) => move(i, to)}
                          onRemove={() => {
                            uploads.remove(item.key)
                            toast(t("imageRemoved", { name: item.name }))
                          }}
                          onRetry={() => uploads.retry(item.key)}
                        />
                      ))}
                    </ol>
                  ) : null}
                  <p className="sr-only" role="status" aria-live="polite">
                    {announce}
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="up-text" className="sr-only">
                    {t("chapterText")}
                  </label>
                  <Textarea
                    id="up-text"
                    rows={14}
                    value={text}
                    placeholder={t("textPlaceholder")}
                    aria-invalid={tried && words < MIN_WORDS}
                    aria-describedby="up-text-h"
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[280px] font-novel text-base leading-[1.7]"
                  />
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <FieldHint id="up-text-h" error={tried && words < MIN_WORDS}>
                      {words < MIN_WORDS ? t("wordsNeeded", { min: MIN_WORDS }) : t("looksGood")}
                    </FieldHint>
                    <span className="text-xs leading-4 text-muted-foreground tabular-nums">
                      {t("wordsRead", { count: words, mins: Math.max(1, Math.round(words / 220)) })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </StudioCard>

          <StudioCard aria-labelledby="up-release">
            <CardHead id="up-release" title={t("release")} />
            <div className="flex flex-col gap-4 p-5 max-md:p-4">
              {live ? (
                <p className="rounded-lg border bg-[#fafafa] px-4 py-3 text-[13px] leading-[19px] text-muted-foreground dark:bg-muted">{t("liveNote", { unit })}</p>
              ) : (
                <>
                  <div role="radiogroup" aria-label={t("whenLabel")} className="grid gap-2.5 md:grid-cols-2">
                    <OptionCard selected={when === "now"} onSelect={() => setWhen("now")} title={<span className="text-[13px] leading-[18px] font-semibold">{t("publishNowOption")}</span>} description={t("publishNowDesc")} />
                    <OptionCard selected={when === "schedule"} onSelect={() => setWhen("schedule")} title={<span className="text-[13px] leading-[18px] font-semibold">{t("scheduleOption")}</span>} description={t("scheduleDesc")} />
                  </div>
                  {when === "schedule" ? (
                    <div className={fieldRow}>
                      <div className={fieldCol}>
                        <FieldLabel htmlFor="up-date">{t("date")}</FieldLabel>
                        <NativeSelect id="up-date" value={date} onChange={(e) => setDate(e.target.value)}>
                          {slots.map((x) => (
                            <option key={x} value={x}>
                              {dayDate(x)}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className={fieldCol}>
                        <FieldLabel htmlFor="up-time">{t("timeIct")}</FieldLabel>
                        <NativeSelect id="up-time" value={String(hour)} onChange={(e) => setHour(Number(e.target.value))}>
                          {(RELEASE_HOURS as readonly number[]).concat(RELEASE_HOURS.includes(hour as never) ? [] : [hour]).map((h) => (
                            <option key={h} value={h}>
                              {hourLabel(h)}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              <div className="h-px bg-border" />
              <SwitchRow
                id="up-fp"
                label={t("fastPass")}
                desc={fastPass ? t("fastPassOn", { coins: FAST_PASS_COINS, date: freeOn }) : t("fastPassOff")}
                checked={fastPass}
                onChange={setFastPass}
              />
              <SwitchRow id="up-cm" label={t("allowComments")} desc={t("allowCommentsDesc")} checked={comments} onChange={setComments} />
              <div className={fieldCol}>
                <FieldLabel htmlFor="up-note" optional>
                  {t("creatorNote")}
                </FieldLabel>
                <Textarea
                  id="up-note"
                  rows={2}
                  maxLength={NOTE_MAX}
                  value={note}
                  placeholder={t("notePlaceholder", { unit })}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  className="min-h-[68px]"
                />
                <span className="self-end text-xs leading-4 text-muted-foreground tabular-nums">
                  {note.length}/{NOTE_MAX}
                </span>
              </div>
            </div>
          </StudioCard>

          <div className="sticky bottom-4 z-20 flex items-center justify-end gap-2 rounded-xl border bg-background/95 p-2.5 shadow-md backdrop-blur-sm max-md:bottom-[72px] max-md:[&>*]:flex-1">
            {!live ? (
              <Button type="button" variant="outline" loading={busy === "draft"} disabled={busy !== null} onClick={() => void saveDraft()}>
                {t("saveDraft")}
              </Button>
            ) : null}
            <Button type="submit" variant="brand" size="lg" loading={busy === "publish"} disabled={busy !== null}>
              {primaryLabel}
            </Button>
          </div>
        </form>

        <aside className="flex min-w-0 flex-col gap-4 md:sticky md:top-20">
          <StudioCard aria-labelledby="up-check">
            <CardHead id="up-check" size="h4" title={t("beforePublish")} />
            <TickList
              mark="!"
              className="px-5 pt-3 pb-5"
              items={[
                { ok: title.trim().length >= TITLE_MIN, text: t("checkTitle") },
                comic
                  ? { ok: items.length > 0 && !badImgs.length && !loading, text: t("checkImages", { ready: items.length - badImgs.length, total: items.length }) }
                  : { ok: words >= MIN_WORDS, text: t("wordsNeeded", { min: MIN_WORDS }) },
                { ok: true, text: live ? t("checkLive") : when === "now" ? t("checkNow") : t("checkScheduled", { when: whenText }) },
                { ok: true, text: fastPass ? t("checkFastPass", { coins: FAST_PASS_COINS }) : t("checkFree") },
              ]}
            />
          </StudioCard>
          <section aria-label={t("phonePreview")} className="flex flex-col gap-2 max-md:hidden">
            <PreviewCaption>{t("phonePreview")}</PreviewCaption>
            <div className="w-[220px] self-center overflow-hidden rounded-[28px] border-8 border-[#09090b] bg-white shadow-md max-lg:w-[200px]">
              <div className="flex flex-col border-b border-[#e4e4e7] px-2.5 py-2 text-[#09090b]">
                <span className="text-xs leading-4 font-semibold">{t("unitN", { unit, n: nLabel })}</span>
                <span className="truncate text-xs leading-4 text-[#71717a]">{title.trim() || t("untitled")}</span>
              </div>
              <div className="flex h-[300px] flex-col overflow-hidden bg-[#fafafa]">
                {comic ? (
                  items.filter((i) => i.status !== "error").length ? (
                    items
                      .filter((i) => i.status !== "error")
                      .slice(0, 3)
                      .map((i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i.key} src={i.preview} alt="" className="h-[150px] w-full shrink-0 object-cover" />
                      ))
                  ) : (
                    <span className="px-3 py-10 text-center text-xs leading-4 text-[#71717a]">{t("previewImages")}</span>
                  )
                ) : (
                  <p className="m-0 p-3 font-novel text-[11px] leading-[1.7] whitespace-pre-wrap text-[#27272a]">{text.trim() ? text.trim().slice(0, 420) : t("previewText")}</p>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

/** One image in reading order (foundations §8 ListRowActions; error rows #FEF2F2). */
function ImageRow({
  item,
  index,
  last,
  mb,
  onMove,
  onRemove,
  onRetry,
}: {
  item: PanelItem
  index: number
  last: boolean
  mb: (bytes: number) => string
  onMove: (to: number) => void
  onRemove: () => void
  onRetry: () => void
}) {
  const t = useTranslations("episodeForm")
  const err = item.error
  const message = err
    ? err.code === "image_too_wide"
      ? t("imgTooWide", { width: err.detail.width ?? 0, min: err.detail.min ?? 0, max: PANEL_MAX_WIDTH })
      : err.code === "image_too_small"
        ? t("imgTooNarrow", { width: err.detail.width ?? 0, min: err.detail.min ?? 0, max: PANEL_MAX_WIDTH })
        : t.has(`uploadError_${err.code}` as never)
          ? t(`uploadError_${err.code}` as never)
          : t("uploadError_upload_failed")
    : ""
  const uploading = item.status === "uploading" || item.status === "queued"
  const size = item.bytes ? t("imgSize", { mb: mb(item.bytes) }) : ""
  const meta = err
    ? message
    : uploading
      ? item.status === "queued"
        ? t("imgWaiting")
        : t("imgUploading", { percent: item.progress })
      : item.width && item.height
        ? [t("imgPixels", { w: item.width, h: item.height }), size].filter(Boolean).join(" · ")
        : size
  return (
    <li className={cn("flex items-center gap-3 bg-background py-2 pr-2 pl-3 not-first:border-t max-md:gap-2.5 max-md:pl-2", err && "bg-destructive-soft")}>
      <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">{index + 1}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.preview} alt="" className="h-[52px] w-9 shrink-0 rounded-[4px] bg-muted object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[13px] leading-[18px] font-medium">{item.name}</span>
        {item.status === "uploading" ? <Progress value={item.progress} className="h-1.5" aria-label={t("imgUploadingLabel", { name: item.name })} /> : null}
        <span className={cn("text-xs leading-4", err ? "font-medium text-destructive" : "text-muted-foreground")} role={err ? "alert" : undefined}>
          {meta}
        </span>
      </div>
      <div className="flex shrink-0 gap-0.5">
        {canRetry(item) ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onRetry} aria-label={t("retryImage", { name: item.name })}>
            <RotateCcwIcon />
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={t("moveUp", { name: item.name })}>
          <ArrowUpIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={last} onClick={() => onMove(index + 1)} aria-label={t("moveDown", { name: item.name })}>
          <ArrowDownIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("removeImage", { name: item.name })}>
          <XIcon />
        </Button>
      </div>
    </li>
  )
}

/** Chapter text → the API's blocks: empty lines split paragraphs; "# " heading, "> " quote, "* * *" scene break. */
function textToBlocks(text: string): api.EpisodeInput["blocks"] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      if (/^(\*\s*){3}$/.test(chunk)) return { type: "scene-break" }
      if (chunk.startsWith("# ")) return { type: "heading", text: chunk.slice(2).trim() }
      if (chunk.startsWith("> ")) return { type: "quote", text: chunk.replace(/^>\s?/gm, "").replace(/\s*\n\s*/g, " ").trim() }
      return { type: "paragraph", text: chunk.replace(/\s*\n\s*/g, " ") }
    })
}

/** The API's blocks → the text box (the inverse of `textToBlocks`). */
function blocksToText(blocks: { type: string; text?: string | null }[]): string {
  return blocks
    .map((b) => (b.type === "scene-break" ? "* * *" : b.type === "heading" ? `# ${b.text ?? ""}` : b.type === "quote" ? `> ${b.text ?? ""}` : (b.text ?? "")))
    .join("\n\n")
}
