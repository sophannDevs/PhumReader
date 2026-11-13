import { api, ApiError, type Schemas } from "@/lib/api/client"

/**
 * Image uploads for creators (P3-07): ask for a presigned URL, PUT the file straight to object
 * storage (with progress), then ask the API to check it and make its WebP variants.
 */

export type UploadKind = Schemas["UploadView"]["kind"]
export type UploadedImage = Schemas["UploadView"]

/** A19 and the API's own rules: JPG or PNG, 20 MB, and the smallest width for each kind. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MIN_WIDTH: Record<UploadKind, number> = { COVER: 600, BANNER: 800, THUMBNAIL: 300, PANEL: 800, AVATAR: 200 }

/** Why an image was refused: the API's codes (image_too_small, …) plus network_error, upload_cancelled. */
export class UploadError extends Error {
  constructor(
    readonly code: string,
    /** For image_too_small: the width found and the minimum. */
    readonly detail: { width?: number; min?: number } = {}
  ) {
    super(code)
    this.name = "UploadError"
  }
}

/** The image's pixel size, read in the browser; a file that isn't a readable image rejects with corrupt_image. */
export function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new UploadError("corrupt_image"))
    }
    img.src = url
  })
}

/** The same checks the API makes, so a wrong file is refused before it is sent. */
export async function checkImage(file: File, kind: UploadKind): Promise<void> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") throw new UploadError("unsupported_type")
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("file_too_large")
  const { width, height } = await readSize(file)
  if (width < MIN_WIDTH[kind]) throw new UploadError("image_too_small", { width, min: MIN_WIDTH[kind] })
  if ((kind === "THUMBNAIL" || kind === "AVATAR") && width !== height) throw new UploadError("not_square")
}

function put(url: string, headers: Record<string, string>, file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError("upload_failed")))
    xhr.onerror = () => reject(new UploadError("network_error"))
    xhr.onabort = () => reject(new UploadError("upload_cancelled"))
    signal?.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

/** Uploads one image; resolves with the finished upload (`url` is its largest WebP variant). */
export async function uploadImage(
  file: File,
  kind: UploadKind,
  options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}
): Promise<UploadedImage> {
  await checkImage(file, kind)
  try {
    const ticket = await api.post<Schemas["UploadTicket"]>("/creator/uploads", { kind, contentType: file.type, size: file.size })
    await put(ticket.uploadUrl, ticket.headers, file, options.onProgress, options.signal)
    return await api.post<UploadedImage>(`/creator/uploads/${ticket.id}/complete`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) throw new UploadError(error.code, { min: MIN_WIDTH[kind] })
    throw error
  }
}
