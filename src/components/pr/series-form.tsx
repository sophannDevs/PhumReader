"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2Icon, EyeOffIcon, PlusIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ImageUploadField, type ImageValue } from "@/components/pr/image-upload-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { genreSchema, weekdaySchema } from "@/data/types"
import { Link, useRouter } from "@/i18n/navigation"
import * as api from "@/lib/api/creator"
import { errorCode, fieldErrors, retryAfterSeconds } from "@/lib/api/errors"
import { creatorKeys } from "@/lib/creator"
import { useLocalize } from "@/lib/localize"
import { genreSlug } from "@/lib/routes"
import { useWaitText } from "@/lib/use-wait-text"

const LANGUAGES = ["en", "km"] as const
const AGE_RATINGS = ["all", "teen", "mature"] as const
const STATUSES = ["ongoing", "completed", "hiatus"] as const
const GENRES = genreSchema.options.map((name) => ({ name, slug: genreSlug(name) }))
const MAX_TAGS = 10
const TAG_MAX = 30

// The messages are keys of the "seriesForm" namespace; the form shows them in the current language.
const schema = z.object({
  type: z.enum(["comic", "novel"]),
  title: z.string().trim().min(1, "titleRequired").max(120, "titleLong"),
  genre: z.string().min(1, "genreRequired"),
  languages: z.array(z.enum(LANGUAGES)).min(1, "languageRequired"),
  summary: z.string().max(2000, "summaryLong"),
  tags: z.array(z.string().max(TAG_MAX)).max(MAX_TAGS, "tagsMany"),
  updateDay: z.union([z.literal(""), weekdaySchema]),
  ageRating: z.enum(AGE_RATINGS),
  status: z.enum(STATUSES),
  cover: z.custom<ImageValue | null>(),
  banner: z.custom<ImageValue | null>(),
  terms: z.boolean(),
})
type Values = z.infer<typeof schema>
type Key = Parameters<ReturnType<typeof useTranslations<"seriesForm">>>[0]

const field = "flex flex-col gap-1.5"
const errorText = "text-[13px] text-destructive"
const hintText = "type-small font-normal text-muted-foreground"
const selectClass =
  "h-9 w-full rounded-control border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive"

/** The series' own cover or banner as a form value (it has no upload id: nothing new to send). */
const saved = (url: string | null | undefined): ImageValue | null => (url ? { uploadId: null, url } : null)

/**
 * Create or edit a series (P4-14): type, title, genre, language, summary, tags, schedule, age rating,
 * cover and banner, and the terms. "Save draft" keeps it private; "Publish" needs a summary, a cover
 * and the terms. A published series can be changed or taken back to a draft.
 */
export function SeriesForm({ initial }: { initial?: api.SeriesEdit }) {
  const t = useTranslations("seriesForm")
  const ts = useTranslations("states")
  const tauth = useTranslations("auth")
  const loc = useLocalize()
  const waitText = useWaitText()
  const router = useRouter()
  const qc = useQueryClient()
  const editing = !!initial
  // The page stays mounted (hidden) behind the next one, so two forms can exist at once: ids must differ.
  const uid = useId()
  const [busy, setBusy] = useState<"draft" | "publish" | "unpublish" | null>(null)
  const [status, setStatus] = useState(initial?.visibility)
  const [tagDraft, setTagDraft] = useState("")
  const [tagError, setTagError] = useState<Key | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initial?.type ?? "comic",
      title: initial?.title ?? "",
      genre: initial?.genre ?? "",
      languages: (initial?.languages ?? ["en"]) as Values["languages"],
      summary: initial?.summary ?? "",
      tags: initial?.tags ?? [],
      updateDay: initial?.updateDay ?? "",
      ageRating: initial?.ageRating ?? "all",
      status: initial?.status ?? "ongoing",
      cover: saved(initial?.coverUrl),
      banner: saved(initial?.bannerUrl),
      terms: false,
    },
  })
  const errors: FieldErrors<Values> = form.formState.errors
  const tags = useWatch({ control: form.control, name: "tags" })
  const title = useWatch({ control: form.control, name: "title" })
  const summary = useWatch({ control: form.control, name: "summary" })
  const err = (message?: string) => (message ? t(message as Key) : undefined)

  function addTag() {
    const tag = tagDraft.trim().toLowerCase()
    if (!tag) return
    if (tag.length > TAG_MAX) return setTagError("tagLong")
    if (tags.length >= MAX_TAGS) return setTagError("tagsMany")
    setTagError(null)
    if (!tags.includes(tag)) form.setValue("tags", [...tags, tag], { shouldDirty: true })
    setTagDraft("")
  }

  /** Extra rules for publishing; returns whether they pass (and shows what is missing). */
  function publishable(values: Values): boolean {
    let ok = true
    if (!values.summary.trim()) {
      form.setError("summary", { message: "summaryNeeded" })
      ok = false
    }
    if (!values.cover) {
      form.setError("cover", { message: "coverNeeded" })
      ok = false
    }
    if (!values.terms) {
      form.setError("terms", { message: "termsNeeded" })
      ok = false
    }
    return ok
  }

  function toInput(values: Values): api.SeriesInput {
    return {
      title: values.title.trim(),
      type: editing ? undefined : values.type,
      genre: values.genre,
      languages: values.languages,
      summary: values.summary.trim(),
      ageRating: values.ageRating,
      updateDay: values.updateDay || null,
      status: values.status,
      tags: values.tags,
      // Only a new upload is sent; without one the API keeps the saved image.
      coverUploadId: values.cover?.uploadId ?? null,
      bannerUploadId: values.banner?.uploadId ?? null,
    }
  }

  /** The API's field errors next to their fields; anything else is one toast. */
  function failed(error: unknown) {
    const fields = fieldErrors(error)
    const map: Record<string, [keyof Values, string]> = {
      title: ["title", "titleRequired"],
      genre: ["genre", "genreRequired"],
      languages: ["languages", "languageRequired"],
      summary: ["summary", "summaryNeeded"],
      coverUploadId: ["cover", fields.coverUploadId === "required" ? "coverNeeded" : "uploadInvalid"],
      bannerUploadId: ["banner", "uploadInvalid"],
    }
    let shown = false
    for (const name of Object.keys(fields)) {
      const target = map[name]
      if (target) {
        form.setError(target[0], { message: target[1] })
        shown = true
      }
    }
    if (shown) return
    if (errorCode(error) === "hidden_by_admin") return toast.error(t("hiddenByAdmin"))
    const wait = retryAfterSeconds(error)
    if (wait !== undefined) toast.error(tauth("tooManyTitle"), { description: waitText(wait), duration: 5000 })
    else toast.error(ts("errorTitle"), { description: ts("errorDescription"), duration: 5000 })
  }

  async function save(values: Values, publish: boolean) {
    if (publish && !publishable(values)) return
    setBusy(publish ? "publish" : "draft")
    try {
      let series = editing ? await api.updateSeries(initial.id, toInput(values)) : await api.createSeries(toInput(values))
      if (publish && series.visibility !== "published") series = await api.publishSeries(series.id)
      await qc.invalidateQueries({ queryKey: creatorKeys.all })
      if (editing) {
        setStatus(series.visibility)
        form.setValue("cover", saved(series.coverUrl))
        form.setValue("banner", saved(series.bannerUrl))
        toast.success(publish ? t("published") : t("saved"))
      } else {
        toast.success(publish ? t("published") : t("savedDraft"))
        // The page stays mounted (hidden) after leaving it: start the next new series from a blank form.
        form.reset()
        setTagDraft("")
        router.push(`/creator/series?notice=series-created&series=${series.id}`)
      }
    } catch (error) {
      failed(error)
    } finally {
      setBusy(null)
    }
  }

  async function unpublish() {
    if (!initial) return
    setBusy("unpublish")
    try {
      await api.unpublishSeries(initial.id)
      await qc.invalidateQueries({ queryKey: creatorKeys.all })
      setStatus("draft")
      toast.success(t("unpublished"))
    } catch (error) {
      failed(error)
    } finally {
      setBusy(null)
    }
  }

  const live = status === "published"
  const hidden = status === "hidden"
  const submit = (publish: boolean) => form.handleSubmit((values) => save(values, publish))

  return (
    <form onSubmit={submit(false)} noValidate className="flex max-w-3xl flex-col gap-8">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={live ? "brand" : hidden ? "danger" : "secondary"}>{t(`status_${status ?? "draft"}`)}</Badge>
          {live ? (
            <Link href={`/series/${initial.slug}`} className="type-small font-normal underline underline-offset-2">
              {t("viewPublic")}
            </Link>
          ) : null}
        </div>
      ) : null}
      {hidden ? (
        <Alert variant="destructive" role="alert">
          <EyeOffIcon />
          <AlertTitle>{t("hiddenTitle")}</AlertTitle>
          <AlertDescription>{t("hiddenByAdmin")}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="flex flex-col gap-5">
        <legend className="type-h2 mb-1">{t("sectionBasics")}</legend>

        <div className={field}>
          <Label id={`${uid}-type-label`}>{t("type")}</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field: f }) => (
              <RadioGroup
                aria-labelledby={`${uid}-type-label`}
                value={f.value}
                onValueChange={f.onChange}
                disabled={editing}
                className="grid-cols-2 gap-3 sm:max-w-sm"
              >
                {(["comic", "novel"] as const).map((kind) => (
                  <Label
                    key={kind}
                    htmlFor={`${uid}-type-${kind}`}
                    className="flex cursor-pointer items-center gap-2 rounded-control border bg-background px-3 py-2.5 font-normal has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem id={`${uid}-type-${kind}`} value={kind} />
                    {t(kind === "comic" ? "typeComic" : "typeNovel")}
                  </Label>
                ))}
              </RadioGroup>
            )}
          />
          <p className={hintText}>{editing ? t("typeFixed") : t("typeHint")}</p>
        </div>

        <div className={field}>
          <Label htmlFor={`${uid}-series-title`}>{t("title")}</Label>
          <Input
            id={`${uid}-series-title`}
            maxLength={120}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? `${uid}-series-title-error` : undefined}
            {...form.register("title")}
          />
          <div className="flex justify-between gap-2">
            {errors.title ? (
              <p id={`${uid}-series-title-error`} className={errorText}>
                {err(errors.title.message)}
              </p>
            ) : (
              <span />
            )}
            <span className={`${hintText} tabular-nums`}>{title.length}/120</span>
          </div>
        </div>

        <div className={field}>
          <Label htmlFor={`${uid}-series-genre`}>{t("genre")}</Label>
          <select
            id={`${uid}-series-genre`}
            className={selectClass}
            aria-invalid={!!errors.genre}
            aria-describedby={errors.genre ? `${uid}-series-genre-error` : undefined}
            {...form.register("genre")}
          >
            <option value="">{t("genrePlaceholder")}</option>
            {GENRES.map((g) => (
              <option key={g.slug} value={g.slug}>
                {loc.genre(g.name)}
              </option>
            ))}
          </select>
          {errors.genre ? (
            <p id={`${uid}-series-genre-error`} className={errorText}>
              {err(errors.genre.message)}
            </p>
          ) : null}
        </div>

        <div className={field}>
          <Label id={`${uid}-languages-label`}>{t("languages")}</Label>
          <Controller
            control={form.control}
            name="languages"
            render={({ field: f }) => (
              <div role="group" aria-labelledby={`${uid}-languages-label`} className="flex flex-wrap gap-4">
                {LANGUAGES.map((code) => (
                  <div key={code} className="flex items-center gap-2">
                    <Checkbox
                      id={`${uid}-language-${code}`}
                      checked={f.value.includes(code)}
                      onCheckedChange={(on) => f.onChange(on === true ? [...f.value, code] : f.value.filter((c) => c !== code))}
                    />
                    <Label htmlFor={`${uid}-language-${code}`} className="font-normal" lang={code}>
                      {t(code === "en" ? "languageEn" : "languageKm")}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          />
          {errors.languages ? <p className={errorText}>{err(errors.languages.message)}</p> : null}
        </div>

        <div className={field}>
          <Label htmlFor={`${uid}-series-summary`}>{t("summary")}</Label>
          <Textarea
            id={`${uid}-series-summary`}
            rows={5}
            maxLength={2000}
            aria-invalid={!!errors.summary}
            aria-describedby={errors.summary ? `${uid}-series-summary-error` : `${uid}-series-summary-hint`}
            {...form.register("summary")}
          />
          <div className="flex justify-between gap-2">
            {errors.summary ? (
              <p id={`${uid}-series-summary-error`} className={errorText}>
                {err(errors.summary.message)}
              </p>
            ) : (
              <p id={`${uid}-series-summary-hint`} className={hintText}>
                {t("summaryHint")}
              </p>
            )}
            <span className={`${hintText} tabular-nums`}>{summary.length}/2000</span>
          </div>
        </div>

        <div className={field}>
          <Label htmlFor={`${uid}-series-tag`}>{t("tags")}</Label>
          <div className="flex gap-2">
            <Input
              id={`${uid}-series-tag`}
              value={tagDraft}
              maxLength={TAG_MAX + 1}
              placeholder={t("tagPlaceholder")}
              aria-describedby={`${uid}-series-tag-hint`}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <PlusIcon />
              {t("addTag")}
            </Button>
          </div>
          {tagError ? <p className={errorText}>{t(tagError)}</p> : null}
          <p id={`${uid}-series-tag-hint`} className={hintText}>
            {t("tagsHint", { max: MAX_TAGS })}
          </p>
          {tags.length ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("tags")}>
              {tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary" className="h-7 gap-1 pr-1 pl-2 text-[13px]">
                    {tag}
                    <button
                      type="button"
                      className="flex size-5 items-center justify-center rounded-full outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t("removeTag", { tag })}
                      onClick={() => form.setValue("tags", tags.filter((x) => x !== tag), { shouldDirty: true })}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="type-h2 mb-1">{t("sectionPublishing")}</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className={field}>
            <Label htmlFor={`${uid}-series-day`}>{t("schedule")}</Label>
            <select id={`${uid}-series-day`} className={selectClass} aria-describedby={`${uid}-series-day-hint`} {...form.register("updateDay")}>
              <option value="">{t("scheduleNone")}</option>
              {weekdaySchema.options.map((day) => (
                <option key={day} value={day}>
                  {loc.schedule(`Every ${day}`)}
                </option>
              ))}
            </select>
            <p id={`${uid}-series-day-hint`} className={hintText}>
              {t("scheduleHint")}
            </p>
          </div>

          {editing ? (
            <div className={field}>
              <Label htmlFor={`${uid}-series-status`}>{t("seriesStatus")}</Label>
              <select id={`${uid}-series-status`} className={selectClass} {...form.register("status")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`seriesStatus_${s}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className={field}>
          <Label id={`${uid}-rating-label`}>{t("ageRating")}</Label>
          <Controller
            control={form.control}
            name="ageRating"
            render={({ field: f }) => (
              <RadioGroup aria-labelledby={`${uid}-rating-label`} value={f.value} onValueChange={f.onChange} className="gap-2">
                {AGE_RATINGS.map((rating) => (
                  <div key={rating} className="flex items-start gap-2">
                    <RadioGroupItem id={`${uid}-rating-${rating}`} value={rating} className="mt-0.5" />
                    <Label htmlFor={`${uid}-rating-${rating}`} className="flex flex-col items-start gap-0 leading-5 font-normal">
                      <span className="font-medium">{t(`rating_${rating}`)}</span>
                      <span className={hintText}>{t(`rating_${rating}_desc`)}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="type-h2 mb-1">{t("sectionImages")}</legend>
        <Controller
          control={form.control}
          name="cover"
          render={({ field: f }) => (
            <ImageUploadField
              kind="COVER"
              label={t("cover")}
              hint={t("coverHint")}
              value={f.value}
              removable={f.value?.uploadId != null}
              error={err(errors.cover?.message)}
              onChange={(v) => {
                form.clearErrors("cover")
                // Removing a new upload goes back to the saved cover, if there is one.
                f.onChange(v ?? saved(initial?.coverUrl))
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="banner"
          render={({ field: f }) => (
            <ImageUploadField
              kind="BANNER"
              label={t("banner")}
              hint={t("bannerHint")}
              value={f.value}
              removable={f.value?.uploadId != null}
              error={err(errors.banner?.message)}
              onChange={(v) => {
                form.clearErrors("banner")
                f.onChange(v ?? saved(initial?.bannerUrl))
              }}
            />
          )}
        />
      </fieldset>

      <div className={field}>
        <div className="flex items-start gap-2">
          <Controller
            control={form.control}
            name="terms"
            render={({ field: f }) => (
              <Checkbox
                id={`${uid}-series-terms`}
                className="mt-0.5"
                checked={f.value}
                aria-invalid={!!errors.terms}
                aria-describedby={errors.terms ? `${uid}-series-terms-error` : undefined}
                onCheckedChange={(c) => {
                  form.clearErrors("terms")
                  f.onChange(c === true)
                }}
              />
            )}
          />
          <Label htmlFor={`${uid}-series-terms`} className="leading-5 font-normal">
            {t("terms")}{" "}
            <Link href="/creator#guidelines" className="underline underline-offset-2">
              {t("termsLink")}
            </Link>
          </Label>
        </div>
        {errors.terms ? (
          <p id={`${uid}-series-terms-error`} className={errorText}>
            {err(errors.terms.message)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild variant="ghost" size="lg">
          <Link href="/creator/series">{t("cancel")}</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
          {live ? (
            <>
              <Button type="button" variant="outline" size="lg" loading={busy === "unpublish"} disabled={busy !== null} onClick={() => void unpublish()}>
                {t("unpublish")}
              </Button>
              <Button type="submit" variant="brand" size="lg" loading={busy === "draft"} disabled={busy !== null}>
                {t("saveChanges")}
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" variant="outline" size="lg" loading={busy === "draft"} disabled={busy !== null}>
                {t("saveDraft")}
              </Button>
              <Button type="button" variant="brand" size="lg" loading={busy === "publish"} disabled={busy !== null || hidden} onClick={() => void submit(true)()}>
                <CheckCircle2Icon />
                {t("publish")}
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  )
}
