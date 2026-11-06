"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/creator"
import { useAccountEmail } from "@/lib/me"

/** Query keys of the creator pages; "creator" is also the dashboard's prefix, so one invalidation refreshes both. */
export const creatorKeys = {
  all: ["creator"] as const,
  series: (email: string, filter: real.MySeriesFilter) => ["creator", "series", email, filter.q, filter.visibility] as const,
}

/** My series with the text and visibility filters (real API; creators only). */
export function useMySeries(filter: real.MySeriesFilter, enabled: boolean) {
  const email = useAccountEmail()
  return useQuery({
    queryKey: creatorKeys.series(email ?? "", filter),
    queryFn: () => real.fetchMySeries(filter),
    enabled: !DEMO_MODE && !!email && enabled,
    placeholderData: (previous) => previous,
  })
}

/** Accept the Creator terms; refreshes everything the creator pages show. */
export function useBecomeCreator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: real.becomeCreator,
    onSuccess: () => qc.invalidateQueries({ queryKey: creatorKeys.all }),
  })
}

/** One of the creator's series as the edit form needs it (403 for another creator's, 404 when unknown). */
export function useSeriesEdit(id: string) {
  const email = useAccountEmail()
  return useQuery({
    queryKey: ["creator", "series-edit", email ?? "", id] as const,
    queryFn: () => real.fetchSeriesEdit(id),
    enabled: !DEMO_MODE && !!email,
    retry: false,
  })
}
