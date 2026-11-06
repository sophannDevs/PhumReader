import type { Series } from "@/data/types"
import { toSeries } from "@/lib/api/catalog"
import { api, type Schemas } from "@/lib/api/client"
import type { CreatorData } from "@/lib/demo-api"
import { formatCount } from "@/lib/format"

/**
 * The account's settings and security, and the creator dashboard, from the real API
 * (Stage 1 Step 5 part 5).
 */

export type Settings = Schemas["Settings"]
export type SettingsChange = Schemas["SettingsChange"]
type Me = Schemas["MeResponse"]

export const fetchSettings = () => api.get<Settings>("/me/settings")

/** Only the fields sent change; the answer has all of them. */
export const patchSettings = (change: SettingsChange) => api.patch<Settings>("/me/settings", change)

export const patchProfile = (displayName: string) => api.patch<Me>("/me/profile", { displayName })

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<void>("/auth/change-password", { currentPassword, newPassword })

/** Emails a 6-digit code to the new address. */
export const changeEmail = (newEmail: string, password: string) =>
  api.post<Schemas["EmailChangeResponse"]>("/auth/change-email", { newEmail: newEmail.trim(), password })

export const confirmEmail = (code: string) => api.post<Me>("/auth/change-email/confirm", { code })

export type Device = Schemas["Device"]

export async function fetchDevices(): Promise<Device[]> {
  return (await api.get<Schemas["DeviceList"]>("/auth/devices")).items
}

export const signOutDevice = (id: string) => api.delete<void>(`/auth/devices/${id}`)

export const signOutEverywhere = () => api.post<void>("/auth/logout-all")

/** The account is erased after the grace period; resolves with that date (ISO). */
export async function deleteAccount(password: string): Promise<string> {
  return (await api.post<Schemas["DeletionResponse"]>("/auth/delete-account", { password })).deleteAfter
}

// ---------------------------------------------------------------- creator dashboard

export type RealCreatorData = Required<CreatorData>

export async function fetchCreator(): Promise<RealCreatorData> {
  const d = await api.get<Schemas["CreatorDashboard"]>("/creator/dashboard")
  const series: Series[] = d.series.map((s) => toSeries(s.series))
  return {
    isCreator: d.creator,
    name: d.name ?? "",
    series,
    totals: { views: formatCount(d.totals.views), likes: formatCount(d.totals.likes) },
    earnedCoins: d.totals.earnedCoins,
  }
}
