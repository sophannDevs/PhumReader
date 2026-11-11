import type { Series } from "@/data/types"
import { toSeries } from "@/lib/api/catalog"
import { api, refreshSession, type Schemas } from "@/lib/api/client"

/** The signed-in creator's own series and becoming a creator, from the real API (P4-13). */

/** draft → review (submitted) → published (approved) or changes (the admin asked for changes) or draft (rejected); hidden by an admin. */
export type Visibility = Schemas["CreatorSeries"]["visibility"]
/** The latest submission for review (V21-01): when, the admin's decision and note, and the requested changes. */
export type SeriesReview = Schemas["SeriesReview"]
/** A requested change: contact, cover, title, age or images (the website translates the key). */
export type ReviewItemKey = Schemas["RequestedChange"]["item"]

/** One row of "My series": the series card plus what only its creator sees. */
export type MySeries = {
  series: Series
  visibility: Visibility
  subscribers: number
  comments: number
  /** null when the series was never submitted for review */
  review: SeriesReview | null
}

export type MySeriesFilter = { q: string; visibility: "" | Visibility }

export async function fetchMySeries({ q, visibility }: MySeriesFilter): Promise<MySeries[]> {
  const list = await api.get<Schemas["CreatorSeries"][]>("/creator/series", {
    query: { q: q.trim(), visibility },
  })
  return list.map((s) => ({
    series: toSeries(s.series),
    visibility: s.visibility,
    subscribers: s.subscribers,
    comments: s.comments,
    review: s.review ?? null,
  }))
}

/**
 * Accepts the Creator terms. The CREATOR role only reaches the access token with the next refresh,
 * so refresh now: creator-only calls would answer 403 until then.
 */
export async function becomeCreator(penName: string): Promise<string> {
  const res = await api.post<Schemas["BecomeCreatorResponse"]>("/creator", { penName: penName.trim(), acceptTerms: true })
  await refreshSession()
  return res.penName
}

// ---------------------------------------------------------------- one series (create and edit)

export type SeriesEdit = Schemas["SeriesEdit"]
export type SeriesInput = Schemas["SeriesInput"]

export const fetchSeriesEdit = (id: string) => api.get<SeriesEdit>(`/creator/series/${id}`)
export const createSeries = (input: SeriesInput) => api.post<SeriesEdit>("/creator/series", input)
export const updateSeries = (id: string, input: SeriesInput) => api.put<SeriesEdit>(`/creator/series/${id}`, input)
/**
 * Submit for review (a draft) or Resubmit (changes requested, every item marked fixed): the series waits in the admins'
 * queue and goes live when one approves it (V21-01). 400 `required` (summary / coverUploadId), 409 `changes_not_fixed`,
 * `already_in_review`, `already_published`; 403 `hidden_by_admin`.
 */
export const submitSeries = (id: string) => api.post<SeriesEdit>(`/creator/series/${id}/submit`)
/** Mark a requested change fixed (Manage series); saved, so every device shows it. */
export const markReviewItemFixed = (id: string, item: ReviewItemKey) => api.put<SeriesEdit>(`/creator/series/${id}/review/items/${item}`)
/** Undo Mark fixed. */
export const unmarkReviewItemFixed = (id: string, item: ReviewItemKey) => api.delete<SeriesEdit>(`/creator/series/${id}/review/items/${item}`)
/**
 * Puts a series live again that an admin approved before and that was taken off (unpublish). A series that never went
 * live answers 409 `review_required`: it goes through {@link submitSeries}.
 */
export const publishSeries = (id: string) => api.post<SeriesEdit>(`/creator/series/${id}/publish`)
export const unpublishSeries = (id: string) => api.post<SeriesEdit>(`/creator/series/${id}/unpublish`)

// ---------------------------------------------------------------- episodes

export type EpisodeEdit = Schemas["EpisodeEdit"]
export type EpisodeInput = Schemas["EpisodeInput"]
export type MyEpisode = Schemas["CreatorEpisode"]

export const fetchMyEpisodes = (seriesId: string) => api.get<MyEpisode[]>(`/creator/series/${seriesId}/episodes`)
export const fetchEpisodeEdit = (seriesId: string, n: number) => api.get<EpisodeEdit>(`/creator/series/${seriesId}/episodes/${n}`)
export const createEpisode = (seriesId: string, input: EpisodeInput) => api.post<EpisodeEdit>(`/creator/series/${seriesId}/episodes`, input)
export const updateEpisode = (seriesId: string, n: number, input: EpisodeInput) =>
  api.put<EpisodeEdit>(`/creator/series/${seriesId}/episodes/${n}`, input)
/** A draft or scheduled episode only (409 episode_published for a live one). */
export const deleteEpisode = (seriesId: string, n: number) => api.delete<void>(`/creator/series/${seriesId}/episodes/${n}`)
