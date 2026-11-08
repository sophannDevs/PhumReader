"use client"

import { ImageIcon, RefreshCwIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadError, uploadImage, type UploadKind } from "@/lib/api/uploads"
import { cn } from "@/lib/utils"

/** A finished image: the id to send with the form (null for the one already saved) and where to show it. */
export type ImageValue = { uploadId: string | null; url: string }

/**
 * One image the creator picks: shows the current image, uploads a new file with progress, and says
 * why a file was refused (wrong type, too big, too narrow). The file goes straight to storage.
 */
export function ImageUploadField({
  kind,
  label,
  hint,
  value,
  onChange,
  error,
  aspect = "aspect-[3/4] w-32",
  removable = true,
}: {
  kind: Extract<UploadKind, "COVER" | "BANNER" | "THUMBNAIL" | "AVATAR">
  label: string
  hint: string
  value: ImageValue | null
  onChange: (value: ImageValue | null) => void
  error?: string
  aspect?: string
  /** Show Remove (a saved image cannot be removed, only replaced). */
  removable?: boolean
}) {
  const t = useTranslations("seriesForm")
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [failure, setFailure] = useState<UploadError | null>(null)
  const [fileName, setFileName] = useState("")

  // A picked file's preview is a local object URL; free it when it is replaced or the field goes away.
  const preview = useRef<string | null>(null)
  useEffect(() => () => void (preview.current && URL.revokeObjectURL(preview.current)), [])
  useEffect(() => () => abort.current?.abort(), [])

  async function pick(file: File) {
    setFailure(null)
    setFileName(file.name)
    setProgress(0)
    const controller = new AbortController()
    abort.current = controller
    try {
      const image = await uploadImage(file, kind, { onProgress: setProgress, signal: controller.signal })
      if (preview.current) URL.revokeObjectURL(preview.current)
      preview.current = URL.createObjectURL(file)
      onChange({ uploadId: image.id, url: preview.current })
    } catch (e) {
      if (e instanceof UploadError && e.code === "upload_cancelled") return
      setFailure(e instanceof UploadError ? e : new UploadError("upload_failed"))
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  const uploading = progress !== null
  const message = failure
    ? failure.code === "image_too_small"
      ? t("uploadTooSmall", { width: failure.detail.width ?? 0, min: failure.detail.min ?? 0 })
      : t.has(`uploadError_${failure.code}` as never)
        ? t(`uploadError_${failure.code}` as never)
        : t("uploadError_upload_failed")
    : undefined
  const shown = message ?? error

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
      </span>
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-card border bg-muted text-muted-foreground",
            kind === "BANNER" ? "aspect-[16/6] w-full max-w-md" : aspect
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={t("imageAlt", { label })} className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-hint${shown ? ` ${id}-error` : ""}`}
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) void pick(file)
            }}
          />
          {uploading ? (
            <div className="flex flex-col gap-2" role="status" aria-live="polite">
              <p className="type-small truncate font-normal">{t("uploading", { name: fileName })}</p>
              <Progress value={progress} aria-label={t("uploadProgress", { label })} />
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => abort.current?.abort()}>
                <XIcon />
                {t("cancelUpload")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
                {value ? <RefreshCwIcon /> : <UploadIcon />}
                {value ? t("replaceImage") : t("chooseImage")}
              </Button>
              {value && removable ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                  <Trash2Icon />
                  {t("removeImage")}
                </Button>
              ) : null}
            </div>
          )}
          <p id={`${id}-hint`} className="type-small font-normal text-muted-foreground">
            {hint}
          </p>
          {shown ? (
            <p id={`${id}-error`} role="alert" className="text-[13px] text-destructive">
              {shown}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
