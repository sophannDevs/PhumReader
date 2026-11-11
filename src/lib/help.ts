"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "@/i18n/translations"
import { DEMO_MODE } from "@/lib/api/config"
import * as help from "@/lib/api/help"
import { meKeys } from "@/lib/api/keys"
import { useAccountEmail } from "@/lib/me"

export type Vote = "y" | "n"

/**
 * "Was this helpful?" answers by article number. Real mode, signed in (V21-07): kept on the account (GET and PUT
 * `/me/help-votes`), so they are there after a reload and on another device; a failed save goes back and says so.
 * Demo, or signed out: for this page visit only.
 */
export function useHelpVotes() {
  const tt = useTranslations("toasts")
  const qc = useQueryClient()
  const email = useAccountEmail()
  const [local, setLocal] = useState<Record<number, Vote>>({})
  const onAccount = !DEMO_MODE && !!email
  const key = meKeys.helpVotes(email ?? "")
  const saved = useQuery({ queryKey: key, queryFn: help.fetchVotes, enabled: onAccount, staleTime: Infinity })
  const save = useMutation({ mutationFn: (v: { article: number; helpful: boolean }) => help.putVote(v.article, v.helpful) })

  const votes: Record<number, Vote> = onAccount
    ? Object.fromEntries(Object.entries(saved.data ?? {}).map(([a, helpful]) => [a, helpful ? "y" : "n"]))
    : local

  function vote(article: number, value: Vote) {
    if (!onAccount) {
      setLocal((v) => ({ ...v, [article]: value }))
      return
    }
    const before = qc.getQueryData<Record<number, boolean>>(key) ?? {}
    qc.setQueryData<Record<number, boolean>>(key, { ...before, [article]: value === "y" })
    save.mutate(
      { article, helpful: value === "y" },
      {
        onError: () => {
          qc.setQueryData<Record<number, boolean>>(key, before)
          toast.error(tt("actionFailed"))
        },
      }
    )
  }

  return { votes, vote }
}
