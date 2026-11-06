"use client"

import { AlertCircleIcon, ArrowDownIcon, ArrowUpIcon, CheckCircle2Icon, GripVerticalIcon, ImagePlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { MAX_EPISODE_BYTES, MAX_PANELS, canRetry, type PanelItem, type PanelUploads } from "@/lib/use-panel-uploads"
import { cn } from "@/lib/utils"

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)

/**
 * The comic panels of an episode: a drop area, then every panel in reading order with its own
 * progress. Reorder by dragging or with the Up / Down buttons, remove one, retry a failed one.
 * The strip of previews is the live picture of what readers will scroll through.
 */
export function PanelUploader({ uploads, error }: { uploads: PanelUploads; error?: string }) {
  const t = useTranslations("episodeForm")
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const { items } = uploads

  function addFrom(list: FileList | null) {
    if (list?.length) uploads.add(Array.from(list))
  }
  function move(index: number, to: number) {
    uploads.moveTo(index, to)
    setAnnouncement(t("panelMoved", { n: index + 1, position: to + 1 }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          // Files dropped from the computer; panels being reordered are handled by their own rows.
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
          addFrom(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
          dropping ? "border-primary bg-brand-soft" : "border-input bg-muted/40"
        )}
      >
        <ImagePlusIcon className="size-8 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="type-h4">{t("dropTitle")}</p>
          <p className="type-small font-normal text-muted-foreground">{t("dropRules", { max: MAX_PANELS, size: mb(MAX_EPISODE_BYTES) })}</p>
        </div>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choosePanels")}
          onChange={(e) => {
            addFrom(e.target.files)
            e.target.value = ""
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={items.length >= MAX_PANELS}>
          {t("choosePanels")}
        </Button>
      </div>

      {uploads.tooMany ? (
        <p role="alert" className="text-[13px] text-destructive">
          {t("tooManyPanels", { max: MAX_PANELS })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {items.length ? (
        <>
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="type-small font-medium">
                {t("panelsSummary", { done: uploads.done, total: uploads.total })}
                {uploads.failed ? <span className="text-destructive"> · {t("panelsFailed", { count: uploads.failed })}</span> : null}
              </p>
              <p className="type-small font-normal text-muted-foreground tabular-nums">
                {t("panelsSize", { size: mb(uploads.bytes), max: mb(MAX_EPISODE_BYTES) })}
              </p>
            </div>
            {uploads.busy ? <Progress value={uploads.percent} aria-label={t("overallProgress")} /> : null}
          </div>

          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t("panelsList")}>
            {items.map((item, index) => (
              <PanelCard
                key={item.key}
                item={item}
                index={index}
                last={index === items.length - 1}
                dragging={dragging === item.key}
                over={over === item.key && dragging !== item.key}
                onMove={(to) => move(index, to)}
                onRemove={() => uploads.remove(item.key)}
                onRetry={() => uploads.retry(item.key)}
                onDragStart={() => setDragging(item.key)}
                onDragEnd={() => {
                  setDragging(null)
                  setOver(null)
                }}
                onDragOver={() => dragging && setOver(item.key)}
                onDrop={() => {
                  const from = items.findIndex((i) => i.key === dragging)
                  if (from >= 0) move(from, index)
                  setDragging(null)
                  setOver(null)
                }}
              />
            ))}
          </ol>
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
        </>
      ) : null}
    </div>
  )
}

function PanelCard({
  item,
  index,
  last,
  dragging,
  over,
  onMove,
  onRemove,
  onRetry,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: PanelItem
  index: number
  last: boolean
  dragging: boolean
  over: boolean
  onMove: (to: number) => void
  onRemove: () => void
  onRetry: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: () => void
  onDrop: () => void
}) {
  const t = useTranslations("episodeForm")
  const n = index + 1
  const reason = item.error
    ? item.error.code === "image_too_small"
      ? t("panelTooSmall", { width: item.error.detail.width ?? 0, min: item.error.detail.min ?? 0 })
      : t.has(`uploadError_${item.error.code}` as never)
        ? t(`uploadError_${item.error.code}` as never)
        : t("uploadError_upload_failed")
    : ""
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", item.key)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          onDragOver()
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          onDrop()
        }
      }}
      className={cn(
        "flex flex-col gap-2 rounded-card border bg-card p-2 shadow-xs",
        dragging && "opacity-40",
        over && "ring-2 ring-primary",
        item.status === "error" && "border-destructive"
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.preview} alt={t("panelAlt", { n })} className="size-full object-cover" draggable={false} />
        <span className="absolute top-1.5 left-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-scrim px-1.5 text-xs font-semibold text-surface-foreground tabular-nums">
          {n}
        </span>
        <GripVerticalIcon className="absolute top-1.5 right-1.5 size-5 cursor-grab text-surface-foreground drop-shadow" aria-hidden />
        {item.status === "done" ? <CheckCircle2Icon className="absolute right-1.5 bottom-1.5 size-5 text-primary drop-shadow" aria-label={t("panelDone")} /> : null}
      </div>
      <p className="type-small truncate font-normal" title={item.name}>
        {item.name}
      </p>
      {item.status === "uploading" || item.status === "queued" ? (
        <div className="flex flex-col gap-1" aria-live="off">
          <Progress value={item.progress} aria-label={t("panelProgress", { n })} />
          <p className="type-small font-normal text-muted-foreground tabular-nums">{item.status === "queued" ? t("panelQueued") : `${item.progress}%`}</p>
        </div>
      ) : null}
      {item.status === "error" ? (
        <p role="alert" className="flex items-start gap-1 text-[13px] text-destructive">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {reason}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-1">
        {canRetry(item) ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCcwIcon />
            {t("retry")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={t("moveUp", { n })}>
          <ArrowUpIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={last} onClick={() => onMove(index + 1)} aria-label={t("moveDown", { n })}>
          <ArrowDownIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("removePanel", { n })} className="ml-auto">
          <Trash2Icon />
        </Button>
      </div>
    </li>
  )
}
