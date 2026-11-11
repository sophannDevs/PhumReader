"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"
import { useTranslations } from "@/i18n/translations"
import { DEMO_MODE } from "@/lib/api/config"
import { meKeys } from "@/lib/api/keys"
import * as real from "@/lib/api/me"
import { useAccountEmail } from "@/lib/me"
import { useAppStore, type ReportStatus, type StoredReport } from "@/lib/store"

/**
 * Block and report outcomes (V21-04). Demo: the store keeps everything. Real API: the account keeps the blocked
 * accounts and the reader's reports, so `ModerationSync` copies them into the store when someone signs in (a new
 * device gets them too) and `blockUser` / `unblockUser` save a change to the API (the store changes first and goes
 * back if the call fails).
 */

const STATUS: Record<real.MyReport["status"], ReportStatus> = {
  in_review: "In review",
  removed: "Removed",
  no_violation: "No violation found",
}

/** Blocks `name` now; real mode also saves it (needs the account id), and goes back with a toast if that fails. */
export async function blockUser(name: string, userId?: string, failedText?: string): Promise<boolean> {
  const store = useAppStore.getState()
  store.block(name, userId)
  if (DEMO_MODE || !userId) return true
  try {
    await real.blockAccount(userId)
    return true
  } catch {
    useAppStore.getState().unblock(name)
    toast.error(failedText ?? "")
    return false
  }
}

export async function unblockUser(name: string, failedText?: string): Promise<boolean> {
  const userId = useAppStore.getState().blockedIds[name]
  useAppStore.getState().unblock(name)
  if (DEMO_MODE || !userId) return true
  try {
    await real.unblockAccount(userId)
    return true
  } catch {
    useAppStore.getState().block(name, userId)
    toast.error(failedText ?? "")
    return false
  }
}

/** Real API only. Signed in: loads GET /me/blocks and GET /me/reports into the store; signed out: clears them. */
export function ModerationSync() {
  const email = useAccountEmail()
  const t = useTranslations("comments")
  const td = useTranslations("data")
  const enabled = !DEMO_MODE && !!email
  const blocks = useQuery({ queryKey: meKeys.blocks(email ?? ""), queryFn: real.fetchBlocks, enabled })
  const reports = useQuery({ queryKey: meKeys.reports(email ?? ""), queryFn: real.fetchMyReports, enabled })

  useEffect(() => {
    if (DEMO_MODE || email) return
    useAppStore.setState({ blocked: [], blockedIds: {}, reports: [] })
  }, [email])

  useEffect(() => {
    if (!blocks.data) return
    useAppStore.setState({
      blocked: blocks.data.map((b) => b.name),
      blockedIds: Object.fromEntries(blocks.data.map((b) => [b.name, b.userId])),
    })
  }, [blocks.data])

  useEffect(() => {
    if (!reports.data) return
    const target = (r: real.MyReport) =>
      r.targetType === "comment"
        ? t("commentBy", { name: r.accusedName ?? "" })
        : r.targetType === "episode" && r.episodeNumber
          ? `${r.seriesTitle ?? ""} · ${td("episode", { n: r.episodeNumber })}`
          : (r.seriesTitle ?? "")
    const list: StoredReport[] = reports.data.map((r) => ({
      id: `R-${r.caseNumber}`,
      kind: r.targetType === "comment" ? "comment" : "series",
      target: target(r),
      who: r.accusedName ?? "",
      reason: r.reason,
      details: "",
      at: Date.parse(r.createdAt),
      status: STATUS[r.status],
    }))
    useAppStore.setState({ reports: list })
  }, [reports.data, t, td])

  return null
}
