import type { Series } from "@/data/types"
import { toSeries } from "@/lib/api/catalog"
import { api, refreshSession, type Schemas } from "@/lib/api/client"

/** The signed-in creator's own series and becoming a creator, from the real API (P4-13). */

export type Visibility = Schemas["CreatorSeries"]["visibility"]

/** One row of "My series": the series card plus what only its creator sees. */
export type MySeries = {
  series: Series
  visibility: Visibility
  subscribers: number
  comments: number
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
