import { api, type Schemas } from "@/lib/api/client"
import { ApiError } from "@/lib/api/client"

/** A creator's public profile and the earnings page (V21-05). */

export type CreatorProfile = Schemas["CreatorProfile"]
export type CreatorEarnings = Schemas["CreatorEarnings"]
export type PayoutMethod = "aba" | "bank"

/** null when there is no creator with that handle (404). */
export async function fetchCreatorProfile(handle: string): Promise<CreatorProfile | null> {
  try {
    return await api.get<CreatorProfile>(`/creators/${encodeURIComponent(handle)}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Name up to 60, location up to 60, bio up to 200; blank location and bio clear them. */
export const updateCreatorProfile = (body: { name: string; location: string; bio: string }) =>
  api.patch<CreatorProfile>("/creator/profile", body)

export const fetchEarnings = () => api.get<CreatorEarnings>("/creator/earnings")

export const setPayoutMethod = (method: PayoutMethod) => api.put<void>("/creator/payout-method", { method })
export const removePayoutMethod = () => api.delete<void>("/creator/payout-method")
