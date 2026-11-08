"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { uploadImage, UploadError } from "@/lib/api/uploads"

/** A19: at most 100 images and 200 MB per episode; a few files travel at once. */
export const MAX_PANELS = 100
export const MAX_EPISODE_BYTES = 200 * 1024 * 1024
const PARALLEL = 3

export type PanelItem = {
  key: string
  name: string
  bytes: number
  /** Where the thumbnail comes from: a local object URL while uploading, the stored image once saved. */
  preview: string
  status: "queued" | "uploading" | "done" | "error"
  progress: number
  /** Set once the API has checked the image. */
  uploadId: string | null
  error?: UploadError
}

/** These failures need another file, not another try. */
const NOT_RETRYABLE = new Set(["unsupported_type", "file_too_large", "image_too_small", "corrupt_image", "too_many_pixels", "not_square"])
export const canRetry = (item: PanelItem) => item.status === "error" && !!item.error && !NOT_RETRYABLE.has(item.error.code)

let counter = 0

/**
 * The comic panels of one episode: files are added by picking or dropping them, sent three at a
 * time with their own progress, kept in reading order (move, remove) and a failed file can be
 * tried again without touching the others.
 */
export function usePanelUploads(initial: PanelItem[] = []) {
  const [items, setItems] = useState<PanelItem[]>(initial)
  const files = useRef(new Map<string, File>())
  const aborts = useRef(new Map<string, AbortController>())
  const started = useRef(new Set<string>())
  const previews = useRef(new Set<string>())
  const [tooMany, setTooMany] = useState(false)

  const patch = useCallback((key: string, change: Partial<PanelItem>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i))), [])

  const start = useCallback(
    async (key: string) => {
      const file = files.current.get(key)
      if (!file) return
      const controller = new AbortController()
      aborts.current.set(key, controller)
      patch(key, { status: "uploading", progress: 0, error: undefined })
      try {
        const image = await uploadImage(file, "PANEL", { signal: controller.signal, onProgress: (progress) => patch(key, { progress }) })
        patch(key, { status: "done", progress: 100, uploadId: image.id })
      } catch (error) {
        if (error instanceof UploadError && error.code === "upload_cancelled") return
        patch(key, { status: "error", error: error instanceof UploadError ? error : new UploadError("upload_failed") })
      } finally {
        aborts.current.delete(key)
      }
    },
    [patch]
  )

  // Start queued files as slots free up.
  useEffect(() => {
    let free = PARALLEL - items.filter((i) => i.status === "uploading").length
    for (const item of items) {
      if (free <= 0) break
      if (item.status === "queued" && !started.current.has(item.key)) {
        started.current.add(item.key)
        free -= 1
        void start(item.key)
      }
    }
  }, [items, start])

  // Leaving the page stops what is still being sent and frees the previews.
  useEffect(() => {
    const running = aborts.current
    const urls = previews.current
    return () => {
      running.forEach((c) => c.abort())
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // Reading the current count for "how many more fit" (kept out of the state updater, which must stay pure).
  const count = useRef(initial.length)
  useEffect(() => {
    count.current = items.length
  }, [items.length])

  const add = useCallback((list: File[]) => {
    const room = Math.max(0, MAX_PANELS - count.current)
    setTooMany(list.length > room)
    const created = list.slice(0, room).map((file): PanelItem => {
      const key = `new-${++counter}`
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      files.current.set(key, file)
      return { key, name: file.name, bytes: file.size, preview, status: "queued", progress: 0, uploadId: null }
    })
    count.current += created.length
    setItems((all) => [...all, ...created])
  }, [])

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort()
    files.current.delete(key)
    started.current.delete(key)
    setTooMany(false)
    setItems((all) => all.filter((i) => i.key !== key))
  }, [])

  const moveTo = useCallback((from: number, to: number) => {
    setItems((all) => {
      if (from === to || from < 0 || to < 0 || from >= all.length || to >= all.length) return all
      const next = [...all]
      next.splice(to, 0, ...next.splice(from, 1))
      return next
    })
  }, [])

  /** Tries one failed file again; the others are not touched. */
  const retry = useCallback(
    (key: string) => {
      started.current.delete(key)
      patch(key, { status: "queued", progress: 0, error: undefined })
    },
    [patch]
  )

  const clear = useCallback(() => {
    aborts.current.forEach((c) => c.abort())
    files.current.clear()
    started.current.clear()
    setTooMany(false)
    setItems([])
  }, [])

  const summary = useMemo(
    () => ({
      total: items.length,
      done: items.filter((i) => i.status === "done").length,
      failed: items.filter((i) => i.status === "error").length,
      busy: items.some((i) => i.status === "queued" || i.status === "uploading"),
      bytes: items.reduce((sum, i) => sum + i.bytes, 0),
      /** 0..100 over all files, counting the part already sent of each. */
      percent: items.length ? Math.round(items.reduce((sum, i) => sum + (i.status === "done" ? 100 : i.progress), 0) / items.length) : 0,
    }),
    [items]
  )

  return { items, add, remove, moveTo, retry, clear, tooMany, ...summary }
}

export type PanelUploads = ReturnType<typeof usePanelUploads>
