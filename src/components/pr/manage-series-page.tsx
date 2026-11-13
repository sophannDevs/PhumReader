"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SearchXIcon } from "lucide-react"
import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { ArrowUpDownIcon } from "@/components/animate-ui/icons/arrow-up-down"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { ClockIcon } from "@/components/animate-ui/icons/clock"
import { InfoIcon } from "@/components/animate-ui/icons/info"
import { UploadIcon } from "@/components/animate-ui/icons/upload"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { CreatorNav, useOwnHandle } from "@/components/layout/creator-nav"
import { LineTabs } from "@/components/pr/browse-kit"
import { CreatorGate } from "@/components/pr/creator-gate"
import { NativeSelect } from "@/components/pr/settings-ui"
import {
  DayChips,
  FieldHint,
  FieldLabel,
  StudioCard,
  SwitchRow,
  Tick,
  fieldCol,
  fieldRow,
  useDayDate,
  useCoverUploadErrorText,
  useFailToast,
  useHourLabel,
  useReviewItemLabel,
} from "@/components/pr/studio-kit"
import { Chip, Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Genre, Weekday } from "@/data"
import { Link, useRouter } from "@/i18n/navigation"
import { ApiError } from "@/lib/api/client"
import { DEMO_MODE } from "@/lib/api/config"
import * as api from "@/lib/api/creator"
import { errorCode } from "@/lib/api/errors"
import { uploadImage } from "@/lib/api/uploads"
import { creatorKeys, useMyEpisodes, useMySeries, useSeriesEdit } from "@/lib/creator"
import {
  BREAK_NOTE_MAX,
  DEFAULT_HOUR,
  FAST_PASS_AHEAD,
  FAST_PASS_COINS,
  GENRES,
  SUMMARY_MAX,
  SUMMARY_MIN,
  TITLE_MAX,
  TITLE_MIN,
  demoEpisodes,
  hasContactDetails,
  ictAt,
  isReviewItem,
  nextSampleCover,
  sortDays,
  submittedOn,
  submittedSummary,
  type StudioEpisode,
  type StudioGenre,
} from "@/lib/creator-studio"
import { withDemo } from "@/lib/demo-api"
import { addDays, formatCount, formatShortDate, ictDate, today } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useDemoFlag } from "@/lib/queries"
import { genreFromSlug, genreSlug } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Manage series (spec §21, prototype Manage/): header with the cover, status, "View as reader" and Upload; the reviewer's
 * changes with Fix / Mark fixed and Resubmit; tabs (in the address as ?tab=episodes|details|fast-pass|settings) for the
 * episode list (filters, sort, Show more, edit, hide, delete drafts), series details, Fast Pass and settings.
 * - Demo: the series is one of the store's `myWorks` with a generated episode list (`demoEpisodes`); the changes come
 *   from `reviewNotes[id]` (admin "Request changes": keys, translated here), else the two automatic-check items of the
 *   demo review. Resubmit sets the status back to "review" (the admin queue lists it again). Mark fixed, episode edits,
 *   the story status, the break message, more than one update day, Fast Pass, comments and hiding the series last for
 *   the visit.
 * - Real API: GET/PUT /creator/series/{id}, the episode list, PUT …/episodes/{n} (title, release slot) and DELETE for
 *   drafts; hiding the series unpublishes it. The status is the series' visibility; the reviewer's changes, note and
 *   submission date come from its `review` (V21-01): Mark fixed / Undo call PUT / DELETE …/review/items/{item} and
 *   Resubmit POST …/submit. V21-02: the details (story status with the break message, every update day), the Fast Pass
 *   tab and the comments switch are saved with PUT …/series/{id}, which replaces the whole series, so every save sends
 *   the saved series with only its own fields changed (`inputFrom`). Hide / Show call POST …/episodes/{n}/hide|show
 *   (`hiddenAt`; an episode an admin took down shows as hidden without Show), and Delete series calls DELETE
 *   …/series/{id} (only while no episode was ever published; 409 has_published_episodes otherwise).
 */

type Format = "comic" | "novel"
type Status = "published" | "review" | "changes" | "draft" | "hidden"
type Run = "ongoing" | "hiatus" | "completed"
type Tab = "episodes" | "details" | "fast-pass" | "settings"
type Filter = "all" | "live" | "scheduled" | "drafts"
type Details = { title: string; summary: string; genre: StudioGenre; run: Run; note: string; days: Weekday[]; cover: string; coverUploadId: string | null }
/** The series-wide Fast Pass (V21-02): on/off and how many episodes ahead (1–5). */
type FastPass = { on: boolean; n: number }

type Model = {
  id: string
  title: string
  cover: string
  format: Format
  genre: StudioGenre
  status: Status
  days: Weekday[]
  summary: string
  run: Run
  /** The "On break" message (real API; "" in demo mode) */
  breakMessage: string
  fastPass: FastPass
  /** The series' comments switch */
  comments: boolean
  subs: string
  views: string
  /** "View as reader": the public series page, or the creator's profile in demo mode */
  readerHref: string
  episodes: StudioEpisode[]
  /** The reviewer's requested changes (keys; an older demo save keeps the label) and note, while changes are requested */
  review: { items: { item: string; fixed: boolean }[]; note: string } | null
  /** ISO date the series was submitted for review */
  submitted: string | null
}

type Actions = {
  saveDetails: (d: Details, titleChanged: boolean) => Promise<void>
  saveEpisode: (n: number, title: string, at: number | null) => Promise<void>
  deleteDraft: (n: number) => Promise<void>
  hideEpisode: (n: number, hide: boolean) => Promise<void>
  /** The series-wide Fast Pass (demo: for the visit) */
  saveFastPass: (fp: FastPass) => Promise<void>
  /** The series' comments switch (demo: for the visit) */
  saveComments: (on: boolean) => Promise<void>
  setVisible: (visible: boolean) => Promise<void>
  deleteSeries: () => Promise<void>
  /** Mark a requested change fixed or not fixed (demo: for the visit) */
  markFixed: (item: string, fixed: boolean) => Promise<void>
  resubmit: () => Promise<void>
  /** Uploads a new cover: demo picks a sample; real mode asks for a file first (null = cancelled) */
  pickCover: (current: string) => Promise<{ url: string; uploadId: string | null } | null>
}

const TABS: Tab[] = ["episodes", "details", "fast-pass", "settings"]
const PAGE = 8
/** Review answers that mean this page shows an old state of the review (real API). */
const STALE_REVIEW = new Set(["no_changes_requested", "item_not_requested", "already_in_review", "already_published", "changes_not_fixed"])

export function ManageSeriesPage({ id }: { id: string }) {
  const t = useTranslations("manage")
  return (
    <CreatorGate title={t("pageTitle")}>
      <CreatorNav active="dashboard" />
      {DEMO_MODE ? <DemoManage id={id} /> : <RealManage id={id} />}
    </CreatorGate>
  )
}

// ------------------------------------------------------------------------------------------------ loading

function ManageSkeleton() {
  return (
    <div className="container flex flex-col gap-5 pt-5 pb-16" aria-hidden>
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-[18px]">
        <Skeleton className="h-28 w-[84px] rounded-[10px]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-[420px] rounded-card" />
    </div>
  )
}

function Problem({ missing, onRetry }: { missing?: boolean; onRetry?: () => void }) {
  const t = useTranslations("manage")
  const ts = useTranslations("states")
  return (
    <div className="container pt-6 pb-16">
      <StateBox
        icon={missing ? SearchXIcon : AlertCircleIcon}
        tone={missing ? "default" : "bad"}
        title={missing ? t("notFoundTitle") : ts("errorTitle")}
        text={missing ? t("notFoundText") : ts("errorDescription")}
        action={
          missing ? (
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/creator">{t("backToDashboard")}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
              {ts("retry")}
            </Button>
          )
        }
      />
    </div>
  )
}

function DemoManage({ id }: { id: string }) {
  const t = useTranslations("manage")
  const router = useRouter()
  const flag = useDemoFlag()
  const handle = useOwnHandle()
  const work = useAppStore((s) => s.myWorks.find((w) => w.id === id))
  const review = useAppStore((s) => s.reviewNotes[id] ?? null)
  const query = useQuery({ queryKey: creatorKeys.manageDemo(id, flag), queryFn: () => withDemo(() => true, { empty: () => false }) })
  if (query.isPending) return <ManageSkeleton />
  if (query.isError) return <Problem onRetry={() => void query.refetch()} />
  if (!work) return <Problem missing />

  const changes = work.status === "changes"
  const model: Model = {
    id: work.id,
    title: work.title,
    cover: work.cover,
    format: work.format,
    genre: work.genre,
    status: work.status,
    days: [work.day],
    summary: changes ? submittedSummary(work) : work.summary,
    run: "ongoing",
    breakMessage: "",
    fastPass: { on: work.status === "published", n: FAST_PASS_AHEAD },
    comments: true,
    subs: work.subs,
    views: work.views,
    readerHref: handle ? `/creators/${handle}` : "/creator",
    episodes: query.data ? demoEpisodes(work, today) : [],
    review: review ? { items: review.items.map((item) => ({ item, fixed: false })), note: review.note } : null,
    submitted: submittedOn(work.id),
  }
  const store = () => useAppStore.getState()
  const current = () => store().myWorks.find((w) => w.id === id) ?? work
  const actions: Actions = {
    saveDetails: async (d) => {
      await withDemo(() => null)
      store().upsertWork({ ...current(), title: d.title.trim(), summary: d.summary.trim(), genre: d.genre as Genre, cover: d.cover, day: sortDays(d.days)[0] ?? current().day })
    },
    saveEpisode: async () => void (await withDemo(() => null)),
    deleteDraft: async () => void (await withDemo(() => null)),
    hideEpisode: async () => void (await withDemo(() => null)),
    saveFastPass: async () => undefined,
    saveComments: async () => undefined,
    setVisible: async () => void (await withDemo(() => null)),
    deleteSeries: async () => {
      await withDemo(() => null)
      const s = store()
      useAppStore.setState({ myWorks: s.myWorks.filter((w) => w.id !== id) })
      s.setReviewNote(id, null)
      if (s.draftSeries?.[id]) {
        const rest = { ...s.draftSeries }
        delete rest[id]
        s.setDraftSeries(Object.keys(rest).length ? rest : null)
      }
      toast.success(t("seriesDeleted"))
      router.push("/creator")
    },
    markFixed: async () => undefined,
    resubmit: async () => store().setWorkStatus(id, "review"),
    pickCover: async (cur) => ({ url: nextSampleCover(cur, 6), uploadId: null }),
  }
  return <ManageView key={`${id}:${!!query.data}`} model={model} actions={actions} />
}

function RealManage({ id }: { id: string }) {
  const coverErrorText = useCoverUploadErrorText()
  const tm = useTranslations("manage")
  const qc = useQueryClient()
  const router = useRouter()
  const edit = useSeriesEdit(id)
  const eps = useMyEpisodes(id)
  const mine = useMySeries({ q: "", visibility: "" }, true)
  const [now] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  const filePick = useRef<((file: File | null) => void) | null>(null)

  const status = edit.error instanceof ApiError ? edit.error.status : 0
  if (edit.isPending || eps.isPending) return <ManageSkeleton />
  if (status === 403 || status === 404) return <Problem missing />
  if (edit.isError || eps.isError) return <Problem onRetry={() => void Promise.all([edit.refetch(), eps.refetch()])} />

  const s = edit.data
  const review = s.review ?? null
  const row = mine.data?.find((r) => r.series.id === id)
  const episodes: StudioEpisode[] = eps.data
    .map((e): StudioEpisode => {
      const released = e.publishedAt ? ictDate(Date.parse(e.publishedAt)) : undefined
      const fast = e.status === "published" && !!e.priceCoins && !!e.freeAt && Date.parse(e.freeAt) > now
      // Hidden: by the creator (`hiddenAt`, V21-02; Show puts it back) or taken down by an admin (status "hidden").
      const takenDown = e.status === "hidden"
      const hidden = takenDown || (e.status === "published" && !!e.hiddenAt)
      return {
        n: e.number,
        title: e.title,
        state: e.status === "scheduled" ? "scheduled" : e.status === "draft" ? "draft" : hidden ? "hidden" : fast ? "fastpass" : "published",
        thumb: e.thumbnailUrl ?? null,
        views: e.status === "published" ? e.views : null,
        likes: e.status === "published" ? e.likes : null,
        comments: null,
        released,
        free: fast && e.freeAt ? ictDate(Date.parse(e.freeAt)) : undefined,
        at: e.status === "scheduled" && e.publishedAt ? Date.parse(e.publishedAt) : undefined,
        hiddenSince: !takenDown && e.hiddenAt ? ictDate(Date.parse(e.hiddenAt)) : undefined,
        takenDown,
      }
    })
    .sort((a, b) => a.n - b.n)
  const model: Model = {
    id,
    title: s.title,
    cover: s.coverUrl ?? "",
    format: s.type,
    genre: genreFromSlug(s.genre, GENRES) ?? "Drama",
    status: s.visibility,
    days: sortDays(s.updateDays ?? []),
    summary: s.summary,
    run: s.status,
    breakMessage: s.status === "hiatus" ? (s.breakMessage ?? "") : "",
    fastPass: { on: (s.fastPass ?? api.DEFAULT_SERIES_FAST_PASS).on, n: (s.fastPass ?? api.DEFAULT_SERIES_FAST_PASS).ahead },
    comments: s.commentsEnabled ?? true,
    subs: formatCount(row?.subscribers ?? 0),
    views: row?.series.views ?? "0",
    readerHref: `/series/${s.slug}`,
    episodes,
    review:
      s.visibility === "changes"
        ? { items: (review?.items ?? []).map((x) => ({ item: x.item, fixed: x.fixed })), note: review?.note ?? "" }
        : null,
    submitted: review ? ictDate(Date.parse(review.submittedAt)) : null,
  }
  const refresh = () => qc.invalidateQueries({ queryKey: creatorKeys.all })
  // Mark fixed and Resubmit only mark the cached series stale: reloading it now would reset the page (e.g. the
  // "Resubmitted" note); the next visit loads it again. When the review moved on meanwhile (another device resubmitted,
  // an admin decided), the error says so and the page reloads the latest.
  const later = () => void qc.invalidateQueries({ queryKey: creatorKeys.all, refetchType: "none" })
  const reloadWhenStale = (error: unknown) => {
    if (STALE_REVIEW.has(errorCode(error) ?? "")) void refresh()
    return error
  }
  // PUT replaces the whole series (V21-02): every save sends the saved series with only its own fields changed.
  const save = async (patch: Partial<api.SeriesInput>) => {
    await api.updateSeries(id, { ...api.inputFrom(s), ...patch })
    await refresh()
  }
  const actions: Actions = {
    saveDetails: (d) =>
      save({
        title: d.title.trim(),
        genre: genreSlug(d.genre),
        // The form lists every genre; one the creator picks as the main genre can't stay the second one.
        secondGenre: s.secondGenre && s.secondGenre !== genreSlug(d.genre) ? s.secondGenre : null,
        summary: d.summary.trim(),
        status: d.run,
        breakMessage: d.run === "hiatus" ? d.note.trim() || null : null,
        updateDays: sortDays(d.days),
        coverUploadId: d.coverUploadId,
      }),
    saveFastPass: (fp) => save({ fastPass: { on: fp.on, ahead: fp.n } }),
    saveComments: (on) => save({ commentsEnabled: on }),
    saveEpisode: async (n, title, at) => {
      const cur = await api.fetchEpisodeEdit(id, n)
      await api.updateEpisode(id, n, {
        title: title.trim(),
        thumbnailUploadId: null,
        creatorNote: cur.creatorNote ?? null,
        commentsEnabled: cur.commentsEnabled,
        fastPass: cur.priceCoins ? { priceCoins: cur.priceCoins, freeAfterDays: cur.freeAfterDays ?? 7 } : undefined,
        publish:
          cur.status === "published"
            ? { mode: "now" }
            : cur.status === "scheduled" && (at ?? cur.publishedAt)
              ? { mode: "scheduled", at: new Date(at ?? Date.parse(cur.publishedAt!)).toISOString() }
              : { mode: "draft" },
        imageUploadIds: s.type === "comic" ? cur.panels.map((p) => p.uploadId) : null,
        blocks: s.type === "comic" ? null : cur.blocks.map((b) => ({ type: b.type, text: b.text })),
      })
      await refresh()
    },
    deleteDraft: async (n) => {
      await api.deleteEpisode(id, n)
      await refresh()
    },
    hideEpisode: async (n, hide) => {
      try {
        await (hide ? api.hideEpisode(id, n) : api.showEpisode(id, n))
      } catch (error) {
        // An admin took it down, or it is no longer published: load the list as it is now.
        if (["episode_hidden", "episode_not_published"].includes(errorCode(error) ?? "")) void refresh()
        throw error
      }
      // Only the list is stale; reloading the series now would reset the page.
      void qc.invalidateQueries({ queryKey: creatorKeys.all, refetchType: "none" })
    },
    setVisible: async (visible) => {
      await (visible ? api.publishSeries(id) : api.unpublishSeries(id))
      await refresh()
    },
    deleteSeries: async () => {
      try {
        await api.deleteSeries(id)
      } catch (error) {
        // An episode came out meanwhile (e.g. a scheduled one): the list shows it and Delete is blocked.
        if (errorCode(error) === "has_published_episodes") void refresh()
        throw error
      }
      // Not reloaded here (the series is gone: this page would show "not found"); the dashboard loads the list again.
      await qc.invalidateQueries({ queryKey: creatorKeys.all, refetchType: "none" })
      toast.success(tm("seriesDeleted"))
      router.push("/creator")
    },
    markFixed: async (item, fixed) => {
      if (!isReviewItem(item)) return
      try {
        await (fixed ? api.markReviewItemFixed(id, item) : api.unmarkReviewItemFixed(id, item))
      } catch (error) {
        throw reloadWhenStale(error)
      }
      later()
    },
    resubmit: async () => {
      try {
        await api.submitSeries(id)
      } catch (error) {
        throw reloadWhenStale(error)
      }
      later()
    },
    pickCover: () =>
      new Promise((resolve, reject) => {
        filePick.current = (file) => {
          filePick.current = null
          if (!file) return resolve(null)
          uploadImage(file, "COVER").then(
            (image) => resolve({ url: image.url ?? URL.createObjectURL(file), uploadId: image.id }),
            (e: unknown) => reject(new Error(coverErrorText(e)))
          )
        }
        fileRef.current?.click()
      }),
  }
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          e.target.value = ""
          filePick.current?.(file)
        }}
      />
      <ManageView key={`${id}:${edit.dataUpdatedAt}`} model={model} actions={actions} />
    </>
  )
}

// ------------------------------------------------------------------------------------------------ the page

type Dialogs =
  | { kind: "edit"; ep: StudioEpisode; title: string; at: number | null; tried: boolean }
  | { kind: "hide"; ep: StudioEpisode }
  | { kind: "delete"; ep: StudioEpisode }
  | { kind: "hideSeries"; typed: string }
  | { kind: "deleteSeries" }
  | null

function ManageView({ model, actions }: { model: Model; actions: Actions }) {
  const t = useTranslations("manage")
  const tf = useTranslations("seriesForm")
  const td = useTranslations("data")
  const ts = useTranslations("states")
  const locale = useLocale()
  const loc = useLocalize()
  const fail = useFailToast()
  const reviewLabel = useReviewItemLabel()
  const dayDate = useDayDate()
  const hourLabel = useHourLabel()
  const router = useRouter()
  const params = useSearchParams()
  const unit = model.format

  const tabParam = params.get("tab")
  const tab: Tab = (TABS as string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "episodes"

  const [eps, setEps] = useState<StudioEpisode[]>(model.episodes)
  const [filter, setFilter] = useState<Filter>("all")
  const [newest, setNewest] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const initial: Details = {
    title: model.title,
    summary: model.summary,
    genre: model.genre,
    run: model.run,
    note: model.breakMessage,
    days: model.days,
    cover: model.cover,
    coverUploadId: null,
  }
  const [saved, setSaved] = useState<Details>(initial)
  const [f, setF] = useState<Details>(initial)
  const [savingDetails, setSavingDetails] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  // Demo review: the cover counts as fixed once a new one is saved.
  const [coverFixed, setCoverFixed] = useState(model.status !== "changes")
  const [manualFixed, setManualFixed] = useState<Record<number, boolean>>(() =>
    Object.fromEntries((model.review?.items ?? []).map((x, i) => [i, x.fixed]))
  )
  const [fixing, setFixing] = useState<number | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmitted, setResubmitted] = useState(false)
  const [fp, setFp] = useState<FastPass>(model.fastPass)
  const [fpSaved, setFpSaved] = useState<FastPass>(model.fastPass)
  const [fpBusy, setFpBusy] = useState(false)
  const [comments, setComments] = useState(model.comments)
  const [commentsBusy, setCommentsBusy] = useState(false)
  const [hidden, setHidden] = useState(model.status === "hidden")
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [busy, setBusy] = useState(false)

  const status: Status = model.status === "changes" && resubmitted ? "review" : model.status
  const changes = model.status === "changes" && !resubmitted
  const canUpload = status === "published" || status === "review"
  const isLive = (e: StudioEpisode) => e.state === "published" || e.state === "fastpass"
  const groups: Record<Filter, (e: StudioEpisode) => boolean> = {
    all: () => true,
    live: isLive,
    scheduled: (e) => e.state === "scheduled",
    drafts: (e) => e.state === "draft" || e.state === "hidden",
  }
  const list = eps.filter(groups[filter]).sort((a, b) => (newest ? b.n - a.n : a.n - b.n))
  const visible = list.slice(0, shown)
  const liveCount = eps.filter(isLive).length
  const publishedEver = eps.some((e) => e.state !== "draft" && e.state !== "scheduled")

  function pickTab(next: Tab) {
    const q = new URLSearchParams(params.toString())
    if (next === "episodes") q.delete("tab")
    else q.set("tab", next)
    const qs = q.toString()
    router.replace(`/creator/series/${encodeURIComponent(model.id)}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  const label = (e: StudioEpisode) => t("epLabel", { unit, n: e.n, title: e.title || t("untitledDraft") })
  const slotLabel = (at: number) => t("slot", { date: dayDate(ictDate(at)), time: hourLabel(new Date(at + 7 * 3_600_000).getUTCHours()) })
  const when = (e: StudioEpisode) => {
    const released = e.released ? formatShortDate(e.released, locale) : ""
    switch (e.state) {
      case "fastpass":
        return t("whenFastPass", { released, free: e.free ? formatShortDate(e.free, locale) : "" })
      case "scheduled":
        return e.at ? t("whenScheduled", { slot: slotLabel(e.at) }) : t("notScheduled")
      case "draft":
        return e.ready ? t("readyForLaunch") : t("notScheduled")
      case "hidden":
        if (e.takenDown) return t("takenDown")
        return e.hiddenSince ? t("whenHidden", { date: formatShortDate(e.hiddenSince, locale) }) : t("hiddenNow")
      default:
        return released ? t("whenReleased", { date: released }) : ""
    }
  }
  const badge = { published: "brand", fastpass: "warn", scheduled: "default", draft: "secondary", hidden: "outline" } as const

  // ---- review items
  const contact = hasContactDetails(saved.summary)
  type Fix = { title: string; desc: string; ok: boolean; manual?: number; item?: string }
  const fixes: Fix[] = model.review
    ? model.review.items.map((x, i) => ({
        title: reviewLabel(x.item),
        desc: i === 0 && model.review?.note ? t("reviewerNote", { note: model.review.note }) : t("markFixedHint"),
        ok: !!manualFixed[i],
        manual: i,
        item: x.item,
      }))
    : [
        { title: t("fixContactTitle"), desc: t("fixContactDesc"), ok: !contact },
        { title: t("fixCoverTitle"), desc: t("fixCoverDesc"), ok: coverFixed },
      ]
  const fixed = fixes.filter((x) => x.ok).length

  async function setFixed(x: Fix, on: boolean) {
    const i = x.manual
    if (i === undefined || x.item === undefined || fixing !== null) return
    setFixing(i)
    setManualFixed((m) => ({ ...m, [i]: on }))
    try {
      await actions.markFixed(x.item, on)
    } catch (error) {
      setManualFixed((m) => ({ ...m, [i]: !on }))
      fail(error)
    } finally {
      setFixing(null)
    }
  }

  async function resubmit() {
    if (fixed < fixes.length || fixing !== null || resubmitting) return
    setResubmitting(true)
    try {
      await actions.resubmit()
      setResubmitted(true)
      toast.success(t("resubmittedToast"))
    } catch (error) {
      fail(error)
    } finally {
      setResubmitting(false)
    }
  }

  // ---- details
  const dirty = JSON.stringify(f) !== JSON.stringify(saved)
  const titleShort = f.title.trim().length < TITLE_MIN
  const sumContact = hasContactDetails(f.summary)
  const sumShort = f.summary.trim().length < SUMMARY_MIN
  const titleChanged = f.title.trim() !== saved.title.trim()

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    if (titleShort || sumShort || sumContact || !f.days.length) {
      toast.error(!f.days.length && !titleShort && !sumShort && !sumContact ? t("chooseDay") : t("fixHighlighted"))
      return
    }
    setSavingDetails(true)
    try {
      await actions.saveDetails(f, titleChanged)
      const next = { ...f, title: f.title.trim(), coverUploadId: null }
      setSaved(next)
      setF(next)
      if (f.cover !== saved.cover) setCoverFixed(true)
      toast.success(titleChanged && status === "published" ? t("savedTitleReview") : t("detailsSaved"))
    } catch (error) {
      fail(error)
    } finally {
      setSavingDetails(false)
    }
  }
  async function replaceCover() {
    setCoverError(null)
    setCoverBusy(true)
    try {
      const next = await actions.pickCover(f.cover)
      if (next) {
        setF((x) => ({ ...x, cover: next.url, coverUploadId: next.uploadId }))
        if (DEMO_MODE) toast.success(t("coverSample"))
      }
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : tf("uploadError_upload_failed"))
    } finally {
      setCoverBusy(false)
    }
  }

  // ---- dialogs
  async function confirm() {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.kind === "edit") {
        if (dialog.title.trim().length < TITLE_MIN) {
          setDialog({ ...dialog, tried: true })
          return
        }
        await actions.saveEpisode(dialog.ep.n, dialog.title, dialog.at)
        setEps((all) => all.map((x) => (x.n === dialog.ep.n ? { ...x, title: dialog.title.trim(), at: dialog.at ?? x.at } : x)))
        toast.success(t("episodeSaved", { unit, n: dialog.ep.n }))
      } else if (dialog.kind === "hide") {
        await actions.hideEpisode(dialog.ep.n, true)
        setEps((all) => all.map((x) => (x.n === dialog.ep.n ? { ...x, state: "hidden", hiddenSince: DEMO_MODE ? today : ictDate(Date.now()) } : x)))
        toast.success(t("episodeHidden", { unit, n: dialog.ep.n }))
      } else if (dialog.kind === "delete") {
        await actions.deleteDraft(dialog.ep.n)
        setEps((all) => all.filter((x) => x.n !== dialog.ep.n))
        toast.success(t("draftDeleted"))
      } else if (dialog.kind === "hideSeries") {
        if (dialog.typed.trim() !== saved.title.trim()) return
        await actions.setVisible(false)
        setHidden(true)
        toast.success(t("seriesHidden"))
      } else if (dialog.kind === "deleteSeries") {
        await actions.deleteSeries()
      }
      setDialog(null)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }
  async function showEpisode(e: StudioEpisode) {
    try {
      await actions.hideEpisode(e.n, false)
      setEps((all) => all.map((x) => (x.n === e.n ? { ...x, state: x.free ? "fastpass" : "published", hiddenSince: undefined } : x)))
      toast.success(t("episodeShown", { unit, n: e.n }))
    } catch (error) {
      fail(error)
    }
  }
  async function saveFastPass() {
    setFpBusy(true)
    try {
      await actions.saveFastPass(fp)
      setFpSaved(fp)
      toast.success(fp.on ? t("fpSaved", { unit, count: fp.n }) : t("fpTurnedOff"))
    } catch (error) {
      fail(error)
    } finally {
      setFpBusy(false)
    }
  }
  async function switchComments(on: boolean) {
    if (commentsBusy) return
    setComments(on)
    setCommentsBusy(true)
    try {
      await actions.saveComments(on)
      toast.success(on ? t("commentsOn") : t("commentsOff"))
    } catch (error) {
      setComments(!on)
      fail(error)
    } finally {
      setCommentsBusy(false)
    }
  }
  async function showSeries() {
    try {
      await actions.setVisible(true)
      setHidden(false)
      toast.success(t("seriesShown"))
    } catch (error) {
      fail(error)
    }
  }

  // ---- header
  const statusBadge =
    status === "published" && hidden
      ? { variant: "outline" as const, text: t("statusHiddenSeries") }
      : status === "published"
        ? { variant: "brand" as const, text: t("statusPublished") }
        : status === "review"
          ? { variant: "warn" as const, text: t("statusReview") }
          : status === "changes"
            ? { variant: "up" as const, text: t("statusChanges") }
            : status === "hidden"
              ? { variant: "outline" as const, text: t("statusHiddenSeries") }
              : { variant: "secondary" as const, text: t("statusDraft") }
  const daysLong = sortDays(saved.days).map((d) => td(`dayFull.${d}`))
  const every = daysLong.length ? t("every", { days: daysLong.length > 1 ? tf("listAnd", { a: daysLong.slice(0, -1).join(", "), b: daysLong[daysLong.length - 1] }) : daysLong[0] }) : ""
  const meta =
    status === "published" || status === "hidden"
      ? [t("metaPublished", { count: liveCount }), t("metaSubs", { count: model.subs }), t("metaViews", { count: model.views }), every].filter(Boolean).join(" · ")
      : status === "draft"
        ? [t("metaEpisodes", { unit, count: eps.length }), t("metaNotSubmitted")].join(" · ")
        : [t("metaReady", { unit, count: eps.length }), model.submitted ? t("metaSubmitted", { date: formatShortDate(model.submitted, locale) }) : ""].filter(Boolean).join(" · ")
  const runLabel = { ongoing: t("runOngoing"), hiatus: t("runHiatus"), completed: t("runCompleted") }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "live", label: t("filterPublished") },
    { id: "scheduled", label: t("filterScheduled") },
    { id: "drafts", label: t("filterDrafts") },
  ]

  return (
    <div className="container flex flex-col gap-5 pt-5 pb-16">
      <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
        <Link href="/creator" className="shrink-0 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {t("dashboard")}
        </Link>
        <ChevronRightIcon className="size-3 shrink-0" aria-hidden />
        <span aria-current="page" className="truncate text-foreground">
          {saved.title}
        </span>
      </nav>

      <section className="flex items-center gap-[18px] max-md:flex-wrap max-md:gap-3">
        {saved.cover ? (
          <Image
            src={saved.cover}
            alt=""
            width={168}
            height={224}
            unoptimized={!DEMO_MODE}
            className="aspect-[3/4] w-[84px] shrink-0 rounded-[10px] border object-cover max-md:w-16"
          />
        ) : (
          <span aria-hidden className="aspect-[3/4] w-[84px] shrink-0 rounded-[10px] border bg-muted max-md:w-16" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-md:basis-full">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
            <Badge variant="outline">{tf(unit === "novel" ? "formatNovel" : "formatComic")}</Badge>
            <Badge variant="outline">{loc.genre(saved.genre)}</Badge>
            <Badge variant="outline">{runLabel[saved.run]}</Badge>
          </div>
          <h1 className="type-h2 break-words">{saved.title}</h1>
          <span className="text-[13px] leading-[18px] text-muted-foreground">{meta}</span>
        </div>
        <div className="flex shrink-0 gap-2 max-md:w-full max-md:[&>*]:flex-1">
          <Button asChild variant="outline">
            <Link href={model.readerHref}>{t("viewAsReader")}</Link>
          </Button>
          {canUpload ? (
            <Button asChild variant="brand">
              <Link href={`/creator/upload?series=${encodeURIComponent(model.id)}`}>
                <UploadIcon />
                {t("upload", { unit })}
              </Link>
            </Button>
          ) : status === "draft" ? (
            <Button asChild variant="brand">
              <Link href={`/creator/new?draft=${encodeURIComponent(model.id)}`}>{t("continueSetup")}</Link>
            </Button>
          ) : null}
        </div>
      </section>

      {changes ? (
        <section aria-labelledby="mg-review-h" className="flex items-start gap-3 rounded-lg border border-destructive-border bg-destructive-soft px-4 py-3.5 text-destructive-ink">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 id="mg-review-h" className="text-sm leading-5 font-semibold">
                {t("changesTitle")}
              </h2>
              <p className="text-[13px] leading-[19px]">{t("changesDesc", { count: fixes.length })}</p>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {fixes.map((x, i) => (
                <li
                  key={`${i}-${x.title}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] border bg-background px-3 py-2.5 text-soft-foreground",
                    x.ok ? "border-brand-line" : "border-destructive-border"
                  )}
                >
                  <Tick ok={x.ok} mark="!" />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-[13px] leading-[18px] font-semibold">
                      {x.title}
                      <span className="sr-only"> ({x.ok ? tf("tickDone") : tf("tickTodo")})</span>
                    </span>
                    <span className="text-xs leading-4">{x.desc}</span>
                  </span>
                  {!x.ok ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      loading={fixing !== null && fixing === x.manual}
                      disabled={fixing !== null}
                      onClick={() => (x.manual !== undefined ? void setFixed(x, true) : pickTab("details"))}
                    >
                      {x.manual !== undefined ? t("markFixed") : t("fix")}
                    </Button>
                  ) : x.manual !== undefined ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      loading={fixing === x.manual}
                      disabled={fixing !== null}
                      aria-label={t("undoFixedLabel", { item: x.title })}
                      onClick={() => void setFixed(x, false)}
                    >
                      {ts("undo")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="brand"
                size="sm"
                loading={resubmitting}
                disabled={fixed < fixes.length || fixing !== null}
                onClick={() => void resubmit()}
              >
                {t("resubmit")}
              </Button>
              <span className="text-xs leading-4">
                {t("fixedCount", { fixed, total: fixes.length })}
                {fixed < fixes.length && !model.review ? ` · ${t("saveInDetails")}` : ""}
              </span>
            </div>
          </div>
        </section>
      ) : null}
      {resubmitted ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-soft px-4 py-3.5 text-warning-ink">
          <ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="text-[13px] leading-[19px]">{t("resubmittedNote")}</span>
        </div>
      ) : null}

      <LineTabs
        idBase="mg"
        label={t("tabsLabel")}
        value={tab}
        onChange={pickTab}
        items={TABS.map((id) => ({
          value: id,
          label:
            id === "episodes" ? t("tabEpisodes", { unit }) : id === "details" ? t("tabDetails") : id === "fast-pass" ? t("tabFastPass") : t("tabSettings"),
          // No badge while the series has no episodes.
          count: id === "episodes" ? eps.length || undefined : undefined,
        }))}
        className="[&::-webkit-scrollbar]:hidden"
      />

      <Effect key={tab} asChild fade slide={{ direction: "up", offset: 8 }}>
        <div role="tabpanel" id="mg-panel" aria-labelledby={`mg-tab-${tab}`} className="flex min-w-0 flex-col gap-5 outline-none">
          {tab === "episodes" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
                  {filters.map((x) => (
                    <Chip
                      key={x.id}
                      selected={filter === x.id}
                      count={eps.filter(groups[x.id]).length}
                      onClick={() => {
                        setFilter(x.id)
                        setShown(PAGE)
                      }}
                    >
                      {x.label}
                    </Chip>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewest((v) => !v)} aria-label={t("sortLabel", { order: newest ? t("newestFirst") : t("oldestFirst") })}>
                  <ArrowUpDownIcon className="size-3.5" />
                  {newest ? t("newestFirst") : t("oldestFirst")}
                </Button>
              </div>
              {visible.length ? (
                <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border p-0" aria-label={t("tabEpisodes", { unit })}>
                  {visible.map((e) => {
                    const draft = e.state === "draft"
                    const isHidden = e.state === "hidden"
                    return (
                      <li key={e.n} className="flex items-center gap-3.5 bg-background px-3.5 py-2.5 not-first:border-t max-md:flex-wrap max-md:gap-3 max-md:px-3">
                        {e.thumb ? (
                          <Image src={e.thumb} alt="" width={96} height={96} unoptimized={!DEMO_MODE} className={cn("size-12 shrink-0 rounded-lg object-cover", isHidden && "opacity-50")} />
                        ) : (
                          <span aria-hidden className="size-12 shrink-0 rounded-lg bg-muted" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={cn("truncate text-[13px] leading-[18px] font-semibold", isHidden && "opacity-50")}>{label(e)}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={badge[e.state]}>{t(`state.${e.state}`)}</Badge>
                            <span className="text-xs leading-4 text-muted-foreground">{when(e)}</span>
                          </div>
                        </div>
                        {e.views !== null ? (
                          <div className="flex shrink-0 gap-[18px] text-xs leading-4 text-muted-foreground max-md:hidden">
                            <span>{t.rich("statViews", { count: formatCount(e.views), b: (c) => <strong className="font-semibold text-foreground tabular-nums">{c}</strong> })}</span>
                            {e.likes !== null ? <span>{t.rich("statLikes", { count: formatCount(e.likes), b: (c) => <strong className="font-semibold text-foreground tabular-nums">{c}</strong> })}</span> : null}
                            {e.comments !== null ? <span>{t.rich("statComments", { count: formatCount(e.comments), b: (c) => <strong className="font-semibold text-foreground tabular-nums">{c}</strong> })}</span> : null}
                          </div>
                        ) : null}
                        <div className="flex shrink-0 gap-1 max-md:w-full max-md:pl-[60px]">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={t("editLabel", { label: label(e) })}
                            onClick={() => setDialog({ kind: "edit", ep: e, title: e.title, at: e.at ?? null, tried: false })}
                          >
                            {t("edit")}
                          </Button>
                          {!draft && e.state !== "scheduled" && !e.takenDown ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={t(isHidden ? "showLabel" : "hideLabel", { unit, n: e.n })}
                              onClick={() => (isHidden ? void showEpisode(e) : setDialog({ kind: "hide", ep: e }))}
                            >
                              {isHidden ? t("show") : t("hide")}
                            </Button>
                          ) : null}
                          {draft ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={t("deleteLabel", { label: label(e) })}
                              onClick={() => setDialog({ kind: "delete", ep: e })}
                            >
                              {t("delete")}
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-card border bg-card px-5 py-9 text-center shadow-xs">
                  <h2 className="type-h4">{!eps.length ? t("emptyTitle", { unit }) : filter === "scheduled" ? t("emptyScheduledTitle") : t("emptyFilterTitle", { unit })}</h2>
                  <p className="text-[13px] leading-[18px] text-muted-foreground">
                    {!eps.length ? t("emptyText", { unit }) : filter === "scheduled" ? t("emptyScheduledText", { unit }) : t("emptyFilterText")}
                  </p>
                  {!eps.length && canUpload ? (
                    <Button asChild variant="brand" size="sm" className="mt-1">
                      <Link href={`/creator/upload?series=${encodeURIComponent(model.id)}`}>{t("uploadFirst", { unit })}</Link>
                    </Button>
                  ) : null}
                </div>
              )}
              {list.length > shown ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[13px] leading-[18px] text-muted-foreground" role="status">
                    {t("showing", { shown: visible.length, total: list.length })}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShown((x) => x + PAGE)}>
                    {t("showMore")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "details" ? (
            <StudioCard>
              <form onSubmit={saveDetails} noValidate aria-label={t("tabDetails")}>
                <div className="flex flex-col gap-[18px] p-5 max-md:p-4">
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="md-title">{tf("titleLabel")}</FieldLabel>
                    <Input id="md-title" value={f.title} maxLength={TITLE_MAX} aria-invalid={titleShort} aria-describedby="md-title-h" onChange={(e) => setF({ ...f, title: e.target.value.slice(0, TITLE_MAX) })} />
                    <FieldHint id="md-title-h" error={titleShort}>
                      {titleShort ? t("titleMissing") : titleChanged && status === "published" ? t("titleReview") : `${f.title.length}/${TITLE_MAX}`}
                    </FieldHint>
                  </div>
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="md-sum">{tf("summaryLabel")}</FieldLabel>
                    <Textarea
                      id="md-sum"
                      rows={4}
                      maxLength={SUMMARY_MAX}
                      value={f.summary}
                      aria-invalid={sumContact || sumShort}
                      aria-describedby="md-sum-h"
                      onChange={(e) => setF({ ...f, summary: e.target.value.slice(0, SUMMARY_MAX) })}
                    />
                    <div className="flex justify-between gap-3">
                      <FieldHint id="md-sum-h" error={sumContact || sumShort}>
                        {sumContact ? t("summaryContact") : sumShort ? t("summaryShort", { min: SUMMARY_MIN }) : tf("looksGood")}
                      </FieldHint>
                      <span className="shrink-0 text-xs leading-4 text-muted-foreground tabular-nums">
                        {f.summary.length}/{SUMMARY_MAX}
                      </span>
                    </div>
                  </div>
                  <div className={fieldRow}>
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="md-genre">{tf("mainGenre")}</FieldLabel>
                      <NativeSelect id="md-genre" value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value as StudioGenre })}>
                        {GENRES.map((g) => (
                          <option key={g} value={g}>
                            {loc.genre(g)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className={fieldCol}>
                      <FieldLabel id="md-run-l">{t("storyStatus")}</FieldLabel>
                      <Segmented
                        stretch
                        label={t("storyStatus")}
                        value={f.run}
                        onChange={(run) => setF({ ...f, run })}
                        options={[
                          { value: "ongoing", label: runLabel.ongoing },
                          { value: "hiatus", label: runLabel.hiatus },
                          { value: "completed", label: runLabel.completed },
                        ]}
                      />
                      <FieldHint>{f.run === "ongoing" ? t("runOngoingHint", { unit }) : f.run === "hiatus" ? t("runHiatusHint") : t("runCompletedHint", { unit })}</FieldHint>
                    </div>
                  </div>
                  {f.run === "hiatus" ? (
                    <div className={fieldCol}>
                      <FieldLabel htmlFor="md-note">{t("breakMessage")}</FieldLabel>
                      <Input
                        id="md-note"
                        value={f.note}
                        maxLength={BREAK_NOTE_MAX}
                        placeholder={t("breakPlaceholder")}
                        aria-describedby="md-note-h"
                        onChange={(e) => setF({ ...f, note: e.target.value.slice(0, BREAK_NOTE_MAX) })}
                      />
                      <FieldHint id="md-note-h">{t("breakHint")}</FieldHint>
                    </div>
                  ) : null}
                  <div className={fieldCol}>
                    <FieldLabel id="md-days-l">{tf("updateDays")}</FieldLabel>
                    <DayChips value={f.days} onChange={(days) => setF({ ...f, days: sortDays(days) })} labelledBy="md-days-l" />
                    {!f.days.length ? <FieldHint error>{t("chooseDay")}</FieldHint> : null}
                  </div>
                  <div className={fieldCol}>
                    <FieldLabel id="md-cover-l">{tf("coverLabel")}</FieldLabel>
                    <div className="flex items-end gap-3.5">
                      {f.cover ? (
                        <Image
                          src={f.cover}
                          alt={t("currentCover")}
                          width={192}
                          height={256}
                          unoptimized={!DEMO_MODE}
                          className={cn("aspect-[3/4] w-24 rounded-[10px] border object-cover", !coverFixed && f.cover === saved.cover && "outline-2 outline-offset-2 outline-destructive")}
                        />
                      ) : (
                        <span aria-hidden className="aspect-[3/4] w-24 rounded-[10px] border bg-muted" />
                      )}
                      <div className="flex flex-col items-start gap-1.5">
                        <Button type="button" variant="outline" size="sm" loading={coverBusy} onClick={() => void replaceCover()} aria-describedby="md-cover-h">
                          {t("replaceCover")}
                        </Button>
                        <FieldHint id="md-cover-h" error={!!coverError || (!coverFixed && f.cover === saved.cover)}>
                          {coverError ?? (!coverFixed && f.cover === saved.cover ? t("coverWatermark") : t("coverRules"))}
                        </FieldHint>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t px-5 pt-4 pb-5 max-md:px-4 max-md:pb-4">
                  <Button type="button" variant="ghost" disabled={!dirty || savingDetails} onClick={() => setF(saved)}>
                    {t("discard")}
                  </Button>
                  <Button type="submit" variant="brand" disabled={!dirty} loading={savingDetails}>
                    {t("saveChanges")}
                  </Button>
                </div>
              </form>
            </StudioCard>
          ) : null}

          {tab === "fast-pass" ? (
            <StudioCard className="flex flex-col gap-[18px] p-5 max-md:p-4">
              <SwitchRow
                id="mg-fp"
                strong
                label={tf("fastPass")}
                // Free after ahead × 7 ÷ update days, rounded up (V21-02): a weekly series with 3 ahead waits 21 days.
                desc={t("fpDesc", { unit, coins: FAST_PASS_COINS, days: api.seriesFreeAfterDays(fp.n, saved.days.length) })}
                checked={fp.on}
                onChange={(on) => setFp({ ...fp, on })}
              />
              {fp.on ? (
                <>
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="mg-fp-n">{t("fpAhead", { unit })}</FieldLabel>
                    <NativeSelect id="mg-fp-n" value={String(fp.n)} wrapperClassName="max-w-[240px]" aria-describedby="mg-fp-h" onChange={(e) => setFp({ ...fp, n: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldHint id="mg-fp-h">{t("fpHint", { unit, count: fp.n })}</FieldHint>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm leading-5 font-medium" id="mg-fp-q">
                      {t("rightNow")}
                    </span>
                    <ul aria-labelledby="mg-fp-q" className="m-0 flex list-none flex-col rounded-[10px] border p-0">
                      {eps.some((e) => e.state === "fastpass") ? (
                        eps
                          .filter((e) => e.state === "fastpass")
                          .map((e) => (
                            <li key={e.n} className="flex items-center justify-between gap-3 px-3 py-2.5 not-first:border-t">
                              <span className="min-w-0 truncate text-[13px] leading-[18px]">{label(e)}</span>
                              <span className="shrink-0 text-xs leading-4 text-muted-foreground">{e.free ? t("freeOn", { date: formatShortDate(e.free, locale) }) : ""}</span>
                            </li>
                          ))
                      ) : (
                        <li className="px-3 py-2.5 text-[13px] leading-[18px]">{t("fpNone", { unit })}</li>
                      )}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border px-4 py-3.5">
                  <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-[13px] leading-[19px]">{t("fpOff", { unit })}</span>
                </div>
              )}
              <div>
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  loading={fpBusy}
                  disabled={fp.on === fpSaved.on && fp.n === fpSaved.n}
                  onClick={() => void saveFastPass()}
                >
                  {t("fpSave")}
                </Button>
              </div>
            </StudioCard>
          ) : null}

          {tab === "settings" ? (
            <StudioCard className="flex flex-col gap-4 p-5 max-md:p-4">
              <SwitchRow
                id="mg-cm"
                label={t("allowComments")}
                desc={t("allowCommentsDesc", { unit })}
                checked={comments}
                onChange={(on) => void switchComments(on)}
              />
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between gap-3 max-md:flex-wrap">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] leading-[18px] font-semibold">{hidden ? t("showSeriesTitle") : t("hideSeriesTitle")}</span>
                  <span className="text-xs leading-4 text-muted-foreground">{hidden ? t("showSeriesDesc") : t("hideSeriesDesc")}</span>
                </span>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => (hidden ? void showSeries() : setDialog({ kind: "hideSeries", typed: "" }))}>
                  {hidden ? t("showSeries") : t("hideSeries")}
                </Button>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between gap-3 max-md:flex-wrap">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] leading-[18px] font-semibold">{t("deleteSeries")}</span>
                  <span className="text-xs leading-4 text-muted-foreground" id="mg-del-d">
                    {publishedEver ? t("deleteBlocked", { unit }) : t("deleteDesc")}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  aria-describedby="mg-del-d"
                  disabled={publishedEver}
                  onClick={() => setDialog({ kind: "deleteSeries" })}
                >
                  {t("deleteSeries")}
                </Button>
              </div>
            </StudioCard>
          ) : null}
        </div>
      </Effect>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        {dialog ? (
          <DialogContent role={dialog.kind === "edit" ? "dialog" : "alertdialog"} className="gap-4">
            {dialog.kind === "edit" ? (
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void confirm()
                }}
              >
                <DialogHeader>
                  <DialogTitle>{t("editTitle", { unit, n: dialog.ep.n })}</DialogTitle>
                  <DialogDescription className="sr-only">{label(dialog.ep)}</DialogDescription>
                </DialogHeader>
                <div className={fieldCol}>
                  <FieldLabel htmlFor="ed-title">{tf("titleLabel")}</FieldLabel>
                  <Input
                    id="ed-title"
                    value={dialog.title}
                    maxLength={TITLE_MAX}
                    aria-invalid={dialog.tried && dialog.title.trim().length < TITLE_MIN}
                    aria-describedby={dialog.tried && dialog.title.trim().length < TITLE_MIN ? "ed-title-e" : undefined}
                    onChange={(e) => setDialog({ ...dialog, title: e.target.value.slice(0, TITLE_MAX) })}
                  />
                  {dialog.tried && dialog.title.trim().length < TITLE_MIN ? (
                    <FieldHint id="ed-title-e" error>
                      {t("titleMissing")}
                    </FieldHint>
                  ) : null}
                </div>
                {dialog.ep.state === "scheduled" && dialog.at ? (
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="ed-slot">{t("releaseSlot")}</FieldLabel>
                    <NativeSelect id="ed-slot" value={String(dialog.at)} onChange={(e) => setDialog({ ...dialog, at: Number(e.target.value) })}>
                      {slotsFor(dialog.ep.at ?? dialog.at).map((x) => (
                        <option key={x} value={x}>
                          {slotLabel(x)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
                {dialog.ep.state === "published" || dialog.ep.state === "fastpass" || dialog.ep.state === "hidden" ? (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-xs leading-4 text-muted-foreground">{t("replaceImagesHint", { unit })}</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/creator/upload?series=${encodeURIComponent(model.id)}&ep=${dialog.ep.n}`}>{t(unit === "novel" ? "editText" : "replaceImages")}</Link>
                    </Button>
                  </div>
                ) : null}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => setDialog(null)}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit" variant="brand" loading={busy}>
                    {t("save")}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {dialog.kind === "hide"
                      ? t("hideTitle", { unit, n: dialog.ep.n })
                      : dialog.kind === "delete"
                        ? t("deleteDraftTitle")
                        : dialog.kind === "hideSeries"
                          ? t("hideSeriesConfirm", { title: saved.title })
                          : t("deleteSeriesConfirm", { title: saved.title })}
                  </DialogTitle>
                  <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">
                    {dialog.kind === "hide"
                      ? dialog.ep.state === "fastpass"
                        ? t("hideFastPassBody")
                        : t("hideBody")
                      : dialog.kind === "delete"
                        ? t("deleteDraftBody", { label: label(dialog.ep) })
                        : dialog.kind === "hideSeries"
                          ? t("hideSeriesBody")
                          : t("deleteSeriesBody")}
                  </DialogDescription>
                </DialogHeader>
                {dialog.kind === "hideSeries" ? (
                  <div className={fieldCol}>
                    <FieldLabel htmlFor="cf-title">{t("typeTitle")}</FieldLabel>
                    <Input id="cf-title" autoComplete="off" value={dialog.typed} placeholder={saved.title} onChange={(e) => setDialog({ ...dialog, typed: e.target.value })} />
                  </div>
                ) : null}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => setDialog(null)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant={dialog.kind === "hide" ? "brand" : "destructive"}
                    loading={busy}
                    disabled={dialog.kind === "hideSeries" && dialog.typed.trim() !== saved.title.trim()}
                    onClick={() => void confirm()}
                  >
                    {dialog.kind === "hide"
                      ? t("hideEpisode", { unit })
                      : dialog.kind === "delete"
                        ? t("deleteDraft")
                        : dialog.kind === "hideSeries"
                          ? t("hideSeries")
                          : t("deleteSeries")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}

/** Release slots a scheduled episode can move to: the same day at 6 and 8 PM, the next day and a week later (6 PM). */
function slotsFor(at: number): number[] {
  const day = ictDate(at)
  const slots = [ictAt(day, DEFAULT_HOUR), ictAt(day, 20), ictAt(addDays(day, 1), DEFAULT_HOUR), ictAt(addDays(day, 7), DEFAULT_HOUR)]
  return slots.includes(at) ? slots : [at, ...slots]
}
