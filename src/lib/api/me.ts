import type { ContinueView } from "@/data/selectors"
import type { Series } from "@/data/types"
import { allPages, toSeries } from "@/lib/api/catalog"
import { api, type Schemas } from "@/lib/api/client"
import { formatDate } from "@/lib/format"

/**
 * The signed-in reader's own data from the real API (Stage 1 Step 5 part 3): what they did in a
 * series, subscriptions, reading history, unlocked episodes, likes, bookmarks, progress and
 * comments. The hooks in `src/lib/me.ts` pick these or the demo's store.
 */

// ---------------------------------------------------------------- the reader in one series

export type Viewer = {
  /** Highest episode opened. */
  lastRead: number
  /** Episode numbers unlocked with coins. */
  unlocked: number[]
  followingCreator: boolean
}

export const NO_VIEWER: Viewer = { lastRead: 0, unlocked: [], followingCreator: false }

export async function fetchViewer(slug: string): Promise<Viewer> {
  const v = await api.get<Schemas["SeriesViewer"]>(`/series/${slug}/me`)
  return { lastRead: v.lastRead, unlocked: v.unlocked, followingCreator: v.followingCreator }
}

export const putSubscription = (slug: string, on: boolean) =>
  on ? api.put(`/series/${slug}/subscription`) : api.delete(`/series/${slug}/subscription`)

export const putFollow = (creatorId: string, on: boolean) =>
  on ? api.put(`/creators/${creatorId}/follow`) : api.delete(`/creators/${creatorId}/follow`)

export const putEpisodeLike = (slug: string, n: number, on: boolean) =>
  on
    ? api.put<Schemas["EpisodeLikeState"]>(`/series/${slug}/episodes/${n}/like`)
    : api.delete<Schemas["EpisodeLikeState"]>(`/series/${slug}/episodes/${n}/like`)

export const putBookmark = (slug: string, n: number, on: boolean) =>
  on ? api.put(`/series/${slug}/episodes/${n}/bookmark`) : api.delete(`/series/${slug}/episodes/${n}/bookmark`)

/** Where the reader is: the episode opened and how far (0..1). */
export const saveProgress = (slug: string, episode: number, progress: number) =>
  api.put(`/series/${slug}/progress`, { episode, progress })

// ---------------------------------------------------------------- library

/** Continue reading, most recent first; `readAt` (ISO) is when it was last read (Library > Recently read). */
export async function fetchHistory(): Promise<(ContinueView & { readAt?: string })[]> {
  const list = await allPages<Schemas["HistoryEntry"]>("/me/history", { sort: "recent" })
  return list.map((h) => ({
    series: h.seriesData.slug,
    seriesData: toSeries(h.seriesData),
    episode: h.episode,
    progress: h.progress,
    readAt: h.readAt,
  }))
}

export async function fetchSubscriptions(): Promise<Series[]> {
  const list = await allPages<Schemas["SubscriptionEntry"]>("/me/subscriptions", { sort: "recent" })
  return list.map((e) => toSeries(e.series))
}

/** Unlocked episode numbers grouped by series, series in the order of the most recent unlock. */
export async function fetchUnlocked(): Promise<{ series: Series; numbers: number[] }[]> {
  const list = await allPages<Schemas["UnlockedEntry"]>("/me/unlocked", { sort: "recent" })
  const groups = new Map<string, { series: Series; numbers: number[] }>()
  for (const e of list) {
    const group = groups.get(e.series.id) ?? { series: toSeries(e.series), numbers: [] }
    group.numbers.push(e.episode.n)
    groups.set(e.series.id, group)
  }
  return [...groups.values()].map((g) => ({ ...g, numbers: g.numbers.sort((a, b) => a - b) }))
}

export type RemovedHistory = Schemas["RemovedHistoryEntry"][]
export type RemovedSubscriptions = Schemas["RemovedSubscription"][]

export async function removeFromHistory(seriesId: string): Promise<RemovedHistory> {
  return (await api.post<Schemas["RemovedHistory"]>("/me/history/remove", { seriesIds: [seriesId] })).items
}

export const restoreHistory = (items: RemovedHistory) => api.post("/me/history/restore", { items })

export async function removeSubscription(seriesId: string): Promise<RemovedSubscriptions> {
  return (await api.post<Schemas["RemovedSubscriptions"]>("/me/subscriptions/remove", { seriesIds: [seriesId] })).items
}

export const restoreSubscriptions = (items: RemovedSubscriptions) => api.post("/me/subscriptions/restore", { items })

// ---------------------------------------------------------------- comments

/** One comment as the list shows it, with what the API says about the reader and it. */
export type ApiComment = {
  id: string
  name: string
  when: string
  text: string
  /** Total likes, the reader's own included. */
  likes: number
  liked: boolean
  top: boolean
  canDelete: boolean
  mine: boolean
}

/** "now", "5m", "2h", "3d", then a date (the demo's short style). */
export function shortAge(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 30 * 86_400) return `${Math.floor(seconds / 86_400)}d`
  return formatDate(iso.slice(0, 10))
}

export const toComment = (c: Schemas["CommentView"]): ApiComment => ({
  id: c.id,
  name: c.author.name,
  when: shortAge(c.createdAt),
  text: c.body,
  likes: c.likes,
  liked: c.liked,
  top: c.top,
  canDelete: c.canDelete,
  mine: c.mine,
})

/** A thread is a series ("one-piece") or one episode ("one-piece:3"). */
export const threadPath = (thread: string) => {
  const [slug, n] = thread.split(":")
  return n ? `/series/${slug}/episodes/${n}/comments` : `/series/${slug}/comments`
}

/** The top comments of a thread (the first page; the API's limit). */
export async function fetchThread(thread: string): Promise<ApiComment[]> {
  const page = await api.get<Schemas["CursorPageCommentView"]>(threadPath(thread), { query: { sort: "top", limit: 50 } })
  return page.items.map(toComment)
}

export async function postComment(thread: string, body: string): Promise<ApiComment> {
  return toComment(await api.post<Schemas["CommentView"]>(threadPath(thread), { body }))
}

export const putCommentLike = (id: string, on: boolean) =>
  on
    ? api.put<Schemas["CommentLikeState"]>(`/comments/${id}/like`)
    : api.delete<Schemas["CommentLikeState"]>(`/comments/${id}/like`)

export const deleteComment = (id: string) => api.delete(`/comments/${id}`)

export const reportComment = (id: string, reason: string) => api.post(`/comments/${id}/report`, { reason })
