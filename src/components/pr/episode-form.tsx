"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarClockIcon, CheckCircle2Icon, EyeIcon, InfoIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ChapterEditor, countWords, hasText, newBlock, type EditorBlock } from "@/components/pr/chapter-editor"
import { ImageUploadField, type ImageValue } from "@/components/pr/image-upload-field"
import { PanelUploader } from "@/components/pr/panel-uploader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Link } from "@/i18n/navigation"
import { revalidateCatalogTags } from "@/lib/actions/revalidate"
import * as api from "@/lib/api/creator"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { creatorKeys } from "@/lib/creator"
import { inlineMarks } from "@/lib/inline-marks"
import { readerHref } from "@/lib/routes"
import { MAX_EPISODE_BYTES, usePanelUploads, type PanelItem } from "@/lib/use-panel-uploads"
import { useWaitText } from "@/lib/use-wait-text"

const ZONE = "Asia/Phnom_Penh"
const OFFSET_MS = 7 * 3600 * 1000 // Phnom Penh is UTC+7 all year (no daylight saving)

/** "2026-11-07T09:30" typed for Phnom Penh -> the instant it means. */
/** The current time (a function so the lint rule about impure render code is not confused by handlers). */
const now = () => Date.now()

const instantOf = (local: string) => new Date(`${local.length === 16 ? `${local}:00` : local}+07:00`)
/** An instant -> "2026-11-07T09:30" in Phnom Penh time (what a datetime-local field shows). */
const localOf = (iso: string | number | Date) => new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16)

type Key = Parameters<ReturnType<typeof useTranslations<"episodeForm">>>[0]

const schema = z
  .object({
    number: z.string().regex(/^\d{0,6}$/, "numberInvalid"),
    title: z.string().trim().min(1, "titleRequired").max(120, "titleLong"),
    note: z.string().max(1000, "noteLong"),
    comments: z.boolean(),
    access: z.enum(["free", "fastpass"]),
    price: z.string(),
    days: z.string(),
    when: z.enum(["now", "schedule"]),
    at: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.number !== "" && Number(v.number) < 1) ctx.addIssue({ code: "custom", path: ["number"], message: "numberInvalid" })
    if (v.access === "fastpass") {
      const price = Number(v.price)
      const days = Number(v.days)
      if (!Number.isInteger(price) || price < 3 || price > 10) ctx.addIssue({ code: "custom", path: ["price"], message: "priceRange" })
      if (!Number.isInteger(days) || days < 1 || days > 90) ctx.addIssue({ code: "custom", path: ["days"], message: "daysRange" })
    }
  })
type Values = z.infer<typeof schema>

const field = "flex flex-col gap-1.5"
const errorText = "text-[13px] text-destructive"
const hintText = "type-small font-normal text-muted-foreground"

export type EpisodeSeries = { id: string; slug: string; title: string; type: "comic" | "novel"; visibility: string }

type Done = { number: number; status: "draft" | "scheduled" | "published"; at?: string }

/**
 * Add an episode (comic) or chapter (novel), or edit one (P4-15): number and title, the panels or the
 * chapter text, a square thumbnail, the creator's note, comments on or off, Free or Fast Pass, and
 * when it goes live (now, scheduled in Phnom Penh time, or kept as a draft). A preview shows what readers get.
 */
export function EpisodeForm({
  series,
  initial,
  nextNumber,
  onAnother,
}: {
  series: EpisodeSeries
  initial?: api.EpisodeEdit
  nextNumber: number
  onAnother: (savedNumber: number) => void
}) {
  const t = useTranslations("episodeForm")
  const ts = useTranslations("states")
  const tauth = useTranslations("auth")
  const locale = useLocale()
  const waitText = useWaitText()
  const qc = useQueryClient()
  const uid = useId()
  const editing = !!initial
  const comic = series.type === "comic"
  const live = initial?.status === "published"

  const uploads = usePanelUploads(
    (initial?.panels ?? []).map(
      (p, i): PanelItem => ({ key: p.uploadId, name: t("panelAlt", { n: i + 1 }), bytes: 0, preview: p.url, status: "done", progress: 100, uploadId: p.uploadId })
    )
  )
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    initial?.blocks.length ? initial.blocks.map((b) => newBlock(b.type as EditorBlock["type"], b.text ?? "")) : [newBlock()]
  )
  const [thumb, setThumb] = useState<ImageValue | null>(initial?.thumbnailUrl ? { uploadId: null, url: initial.thumbnailUrl } : null)
  const [thumbError, setThumbError] = useState<string | undefined>()
  const [contentError, setContentError] = useState<string | undefined>()
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [done, setDone] = useState<Done | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: editing ? String(initial.number) : "",
      title: initial?.title ?? "",
      note: initial?.creatorNote ?? "",
      comments: initial?.commentsEnabled ?? true,
      access: initial?.priceCoins ? "fastpass" : "free",
      price: String(initial?.priceCoins ?? 5),
      days: String(initial?.freeAfterDays ?? 7),
      when: initial?.status === "scheduled" ? "schedule" : "now",
      at: initial?.status === "scheduled" && initial.publishedAt ? localOf(initial.publishedAt) : "",
    },
  })
  const errors = form.formState.errors
  const access = useWatch({ control: form.control, name: "access" })
  const when = useWatch({ control: form.control, name: "when" })
  const title = useWatch({ control: form.control, name: "title" })
  const note = useWatch({ control: form.control, name: "note" })
  const err = (message?: string) => (message ? t(message as Key) : undefined)
  // The earliest time offered for a scheduled release: one minute from when the form opened.
  const [minAt] = useState(() => localOf(now() + 60_000))
  const showTime = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: ZONE }).format(new Date(iso))

  /** What the content needs before the episode can go live; returns whether it is fine. */
  function checkContent(goingLive: boolean): boolean {
    setContentError(undefined)
    if (comic) {
      if (uploads.busy) return fail(t("waitForUploads"))
      if (uploads.failed) return fail(t("fixFailedPanels"))
      if (uploads.bytes > MAX_EPISODE_BYTES) return fail(t("content_episode_too_large"))
      if (goingLive && uploads.total === 0) return fail(t("content_required_panels"))
    } else if (goingLive && !hasText(blocks)) {
      return fail(t("content_required_text"))
    }
    return true
  }
  function fail(message: string) {
    setContentError(message)
    return false
  }

  function failed(error: unknown) {
    const fields = fieldErrors(error)
    let shown = false
    if (fields.number) {
      form.setError("number", { message: fields.number === "number_taken" ? "numberTaken" : "numberInvalid" })
      shown = true
    }
    if (fields.title) {
      form.setError("title", { message: "titleRequired" })
      shown = true
    }
    if (fields["publish.at"]) {
      form.setError("at", { message: fields["publish.at"] === "schedule_in_past" ? "scheduleInPast" : "scheduleRequired" })
      shown = true
    }
    if (fields.thumbnailUploadId) {
      setThumbError(t("thumbnailInvalid"))
      shown = true
    }
    const content = fields.imageUploadIds ?? fields.blocks
    if (content) {
      const key = `content_${content}` as Key
      setContentError(t.has(key as never) ? t(key) : t("content_invalid"))
      shown = true
    }
    if (shown) return
    if (errorCode(error) === "episode_published") return toast.error(t("alreadyLive"))
    const wait = retryAfterSeconds(error)
    if (wait !== undefined) toast.error(tauth("tooManyTitle"), { description: waitText(wait), duration: 5000 })
    else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
  }

  async function save(values: Values, goLive: boolean) {
    let at: string | undefined
    if (goLive && !live && values.when === "schedule") {
      if (!values.at) return form.setError("at", { message: "scheduleRequired" })
      const instant = instantOf(values.at)
      if (Number.isNaN(instant.getTime()) || instant.getTime() <= now()) return form.setError("at", { message: "scheduleInPast" })
      at = instant.toISOString()
    }
    if (!checkContent(goLive || live)) return

    const input: api.EpisodeInput = {
      title: values.title.trim(),
      number: editing ? undefined : values.number ? Number(values.number) : null,
      thumbnailUploadId: thumb?.uploadId ?? null,
      creatorNote: values.note.trim() || null,
      commentsEnabled: values.comments,
      fastPass: values.access === "fastpass" ? { priceCoins: Number(values.price), freeAfterDays: Number(values.days) } : undefined,
      publish: live ? { mode: "now" } : !goLive ? { mode: "draft" } : at ? { mode: "scheduled", at } : { mode: "now" },
      imageUploadIds: comic ? uploads.items.flatMap((i) => (i.uploadId ? [i.uploadId] : [])) : null,
      blocks: comic
        ? null
        : blocks
            .filter((b) => b.type === "scene-break" || b.text.trim() !== "")
            .map((b) => (b.type === "scene-break" ? { type: b.type } : { type: b.type, text: b.text.trim() })),
    }
    setBusy(goLive ? "publish" : "draft")
    try {
      const saved = editing ? await api.updateEpisode(series.id, initial.number, input) : await api.createEpisode(series.id, input)
      await qc.invalidateQueries({ queryKey: creatorKeys.all })
      void revalidateCatalogTags(["home", `series-${series.slug}`, `episodes-${series.slug}`, "series", "catalog"])
      setDone({ number: saved.number, status: saved.status as Done["status"], at: saved.publishedAt ?? undefined })
    } catch (error) {
      failed(error)
    } finally {
      setBusy(null)
    }
  }

  const submit = (goLive: boolean) => form.handleSubmit((values) => save(values, goLive))

  if (done) {
    const readable = done.status === "published" && series.visibility === "published"
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <Alert variant="brand" role="status">
          <CheckCircle2Icon />
          <AlertTitle>{t(`done_${done.status}`, { n: done.number })}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>{done.status === "scheduled" && done.at ? t("doneScheduledAt", { time: showTime(done.at) }) : t(`doneDesc_${done.status}`)}</span>
            {done.status === "published" && series.visibility !== "published" ? <span>{t("seriesStillDraft")}</span> : null}
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {readable ? (
            <Button asChild variant="brand" size="lg">
              <Link href={readerHref({ slug: series.slug, type: series.type }, done.number)}>{t("viewEpisode")}</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg">
              <Link href={`/creator/series/${series.id}/episodes/${done.number}/edit`}>{t("editEpisode")}</Link>
            </Button>
          )}
          {editing ? (
            <Button type="button" variant={readable ? "outline" : "brand"} size="lg" onClick={() => setDone(null)}>
              {t("keepEditing")}
            </Button>
          ) : (
            <Button type="button" variant={readable ? "outline" : "brand"} size="lg" onClick={() => onAnother(done.number)}>
              {t("uploadAnother")}
            </Button>
          )}
          <Button asChild variant="ghost" size="lg">
            <Link href={`/creator/series?notice=episode-added&series=${series.id}`}>{t("backToSeries")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  const idOf = (name: string) => `${uid}-${name}`

  return (
    <form onSubmit={submit(false)} noValidate className="flex max-w-3xl flex-col gap-8">
      {series.visibility !== "published" ? (
        <Alert role="status">
          <InfoIcon />
          <AlertTitle>{t("seriesDraftTitle")}</AlertTitle>
          <AlertDescription>
            {t("seriesDraftDesc")}{" "}
            <Link href={`/creator/series/${series.id}/edit`} className="underline underline-offset-2">
              {t("seriesDraftLink")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {editing ? (
        <div className="flex items-center gap-2">
          <Badge variant={live ? "brand" : "secondary"}>{t(`status_${initial.status}` as Key)}</Badge>
        </div>
      ) : null}

      <fieldset className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <legend className="type-h2 mb-1">{t(comic ? "sectionEpisode" : "sectionChapter")}</legend>
        <div className={field}>
          <Label htmlFor={idOf("number")}>{t("number")}</Label>
          <Input
            id={idOf("number")}
            inputMode="numeric"
            disabled={editing}
            placeholder={String(nextNumber)}
            aria-invalid={!!errors.number}
            aria-describedby={errors.number ? idOf("number-error") : idOf("number-hint")}
            {...form.register("number")}
          />
          {errors.number ? (
            <p id={idOf("number-error")} className={errorText}>
              {err(errors.number.message)}
            </p>
          ) : (
            <p id={idOf("number-hint")} className={hintText}>
              {editing ? t("numberFixed") : t("numberHint", { n: nextNumber })}
            </p>
          )}
        </div>
        <div className={field}>
          <Label htmlFor={idOf("title")}>{t("title")}</Label>
          <Input
            id={idOf("title")}
            maxLength={120}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? idOf("title-error") : undefined}
            {...form.register("title")}
          />
          <div className="flex justify-between gap-2">
            {errors.title ? (
              <p id={idOf("title-error")} className={errorText}>
                {err(errors.title.message)}
              </p>
            ) : (
              <span />
            )}
            <span className={`${hintText} tabular-nums`}>{title.length}/120</span>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="type-h2 mb-1">{t(comic ? "sectionPanels" : "sectionText")}</legend>
        {comic ? <PanelUploader uploads={uploads} error={contentError} /> : <ChapterEditor blocks={blocks} onChange={setBlocks} error={contentError} />}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="type-h2 mb-1">{t("sectionDetails")}</legend>
        <ImageUploadField
          kind="THUMBNAIL"
          label={t("thumbnail")}
          hint={t("thumbnailHint")}
          aspect="aspect-square w-32"
          value={thumb}
          removable={thumb?.uploadId != null}
          error={thumbError}
          onChange={(v) => {
            setThumbError(undefined)
            setThumb(v ?? (initial?.thumbnailUrl ? { uploadId: null, url: initial.thumbnailUrl } : null))
          }}
        />
        <div className={field}>
          <Label htmlFor={idOf("note")}>{t("note")}</Label>
          <Textarea id={idOf("note")} rows={3} maxLength={1000} aria-describedby={idOf("note-hint")} {...form.register("note")} />
          <div className="flex justify-between gap-2">
            <p id={idOf("note-hint")} className={hintText}>
              {t("noteHint")}
            </p>
            <span className={`${hintText} tabular-nums`}>{note.length}/1000</span>
          </div>
          {errors.note ? <p className={errorText}>{err(errors.note.message)}</p> : null}
        </div>
        <Controller
          control={form.control}
          name="comments"
          render={({ field: f }) => (
            <div className="flex items-start gap-3">
              <Switch id={idOf("comments")} checked={f.value} onCheckedChange={f.onChange} aria-describedby={idOf("comments-hint")} />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={idOf("comments")}>{t("comments")}</Label>
                <p id={idOf("comments-hint")} className={hintText}>
                  {t(f.value ? "commentsOn" : "commentsOff")}
                </p>
              </div>
            </div>
          )}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="type-h2 mb-1">{t("sectionAccess")}</legend>
        <Controller
          control={form.control}
          name="access"
          render={({ field: f }) => (
            <RadioGroup aria-label={t("sectionAccess")} value={f.value} onValueChange={f.onChange} className="gap-3">
              {(["free", "fastpass"] as const).map((kind) => (
                <div key={kind} className="flex items-start gap-2">
                  <RadioGroupItem id={idOf(`access-${kind}`)} value={kind} className="mt-0.5" />
                  <Label htmlFor={idOf(`access-${kind}`)} className="flex flex-col items-start gap-0 leading-5 font-normal">
                    <span className="font-medium">{t(kind === "free" ? "accessFree" : "accessFastPass")}</span>
                    <span className={hintText}>{t(kind === "free" ? "accessFreeDesc" : "accessFastPassDesc")}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        {access === "fastpass" ? (
          <div className="grid max-w-md gap-5 sm:grid-cols-2">
            <div className={field}>
              <Label htmlFor={idOf("price")}>{t("price")}</Label>
              <Input id={idOf("price")} inputMode="numeric" aria-invalid={!!errors.price} aria-describedby={idOf("price-hint")} {...form.register("price")} />
              {errors.price ? (
                <p className={errorText}>{err(errors.price.message)}</p>
              ) : (
                <p id={idOf("price-hint")} className={hintText}>
                  {t("priceHint")}
                </p>
              )}
            </div>
            <div className={field}>
              <Label htmlFor={idOf("days")}>{t("days")}</Label>
              <Input id={idOf("days")} inputMode="numeric" aria-invalid={!!errors.days} aria-describedby={idOf("days-hint")} {...form.register("days")} />
              {errors.days ? (
                <p className={errorText}>{err(errors.days.message)}</p>
              ) : (
                <p id={idOf("days-hint")} className={hintText}>
                  {t("daysHint")}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </fieldset>

      {live ? (
        <Alert role="status">
          <InfoIcon />
          <AlertDescription>{t("alreadyLiveNote")}</AlertDescription>
        </Alert>
      ) : (
        <fieldset className="flex flex-col gap-4">
          <legend className="type-h2 mb-1">{t("sectionWhen")}</legend>
          <Controller
            control={form.control}
            name="when"
            render={({ field: f }) => (
              <RadioGroup aria-label={t("sectionWhen")} value={f.value} onValueChange={f.onChange} className="gap-3">
                {(["now", "schedule"] as const).map((kind) => (
                  <div key={kind} className="flex items-center gap-2">
                    <RadioGroupItem id={idOf(`when-${kind}`)} value={kind} />
                    <Label htmlFor={idOf(`when-${kind}`)} className="font-normal">
                      {t(kind === "now" ? "whenNow" : "whenSchedule")}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          />
          {when === "schedule" ? (
            <div className={`${field} max-w-xs`}>
              <Label htmlFor={idOf("at")}>{t("scheduleAt")}</Label>
              <Input
                id={idOf("at")}
                type="datetime-local"
                min={minAt}
                aria-invalid={!!errors.at}
                aria-describedby={errors.at ? idOf("at-error") : idOf("at-hint")}
                {...form.register("at")}
              />
              {errors.at ? (
                <p id={idOf("at-error")} className={errorText}>
                  {err(errors.at.message)}
                </p>
              ) : (
                <p id={idOf("at-hint")} className={hintText}>
                  {t("scheduleHint")}
                </p>
              )}
            </div>
          ) : null}
        </fieldset>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild variant="ghost" size="lg">
          <Link href="/creator/series">{t("cancel")}</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
          <Button type="button" variant="outline" size="lg" onClick={() => setPreviewing(true)}>
            <EyeIcon />
            {t("preview")}
          </Button>
          {live ? (
            <Button type="button" variant="brand" size="lg" loading={busy === "publish"} disabled={busy !== null} onClick={() => void submit(true)()}>
              {t("saveChanges")}
            </Button>
          ) : (
            <>
              <Button type="submit" variant="outline" size="lg" loading={busy === "draft"} disabled={busy !== null}>
                {t("saveDraft")}
              </Button>
              <Button type="button" variant="brand" size="lg" loading={busy === "publish"} disabled={busy !== null} onClick={() => void submit(true)()}>
                {when === "schedule" ? <CalendarClockIcon /> : <CheckCircle2Icon />}
                {t(when === "schedule" ? "schedule" : "publishNow")}
              </Button>
            </>
          )}
        </div>
      </div>

      <PreviewDialog
        open={previewing}
        onOpenChange={setPreviewing}
        title={title || t("untitled")}
        number={editing ? initial.number : Number(form.getValues("number")) || nextNumber}
        comic={comic}
        panels={uploads.items.map((i) => i.preview)}
        blocks={blocks}
      />
    </form>
  )
}

/** What readers will get: the panels one under the other, or the chapter text, in a phone-sized column. */
function PreviewDialog({
  open,
  onOpenChange,
  title,
  number,
  comic,
  panels,
  blocks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  number: number
  comic: boolean
  panels: string[]
  blocks: EditorBlock[]
}) {
  const t = useTranslations("episodeForm")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>{t("previewDesc")}</DialogDescription>
        </DialogHeader>
        <div data-reader-theme="light" className="flex flex-col gap-4 rounded-card bg-reader-page p-4 text-reader-text">
          <div>
            <p className="type-eyebrow">{t("previewEpisode", { n: number })}</p>
            <h3 className="type-h2">{title}</h3>
          </div>
          {comic ? (
            panels.length ? (
              <div className="flex flex-col">
                {panels.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${src}-${i}`} src={src} alt={t("panelAlt", { n: i + 1 })} className="w-full" />
                ))}
              </div>
            ) : (
              <p className="type-body text-reader-quiet">{t("previewNoPanels")}</p>
            )
          ) : hasText(blocks) ? (
            <div className="flex flex-col gap-[1.1em]">
              {blocks.map((b) =>
                b.type === "scene-break" ? (
                  <p key={b.id} aria-hidden className="py-2 text-center tracking-[1em] text-reader-quiet">
                    * * *
                  </p>
                ) : b.text.trim() === "" ? null : b.type === "heading" ? (
                  <h4 key={b.id} className="pt-2 text-[1.25em] leading-snug font-semibold">
                    {inlineMarks(b.text)}
                  </h4>
                ) : b.type === "quote" ? (
                  <blockquote key={b.id} className="border-l-[3px] border-primary pl-4 italic">
                    {inlineMarks(b.text)}
                  </blockquote>
                ) : (
                  <p key={b.id}>{inlineMarks(b.text)}</p>
                )
              )}
              <p className="type-small text-reader-quiet">{t("wordCount", { count: countWords(blocks) })}</p>
            </div>
          ) : (
            <p className="type-body text-reader-quiet">{t("previewNoText")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
