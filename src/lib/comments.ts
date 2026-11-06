"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { CommentView } from "@/components/pr/comment-list"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { useAccountEmail, useAskToLogin, useFailed } from "@/lib/me"
import { useComments } from "@/lib/queries"
import { likeKey, useAppStore, useUser } from "@/lib/store"

/**
 * One comment thread (a series, or one episode as "slug:n") for both modes. The demo keeps the
 * thread static, new comments in component state and likes in the store; the real API holds all
 * three, and the reader's comments can be deleted and other people's reported.
 */
export function useCommentThread(kind: "series" | "episode", slug: string, justNow: string) {
  const tt = useTranslations("toasts")
  const user = useUser()
  const email = useAccountEmail()
  const qc = useQueryClient()
  const askToLogin = useAskToLogin()
  const failed = useFailed()
  const demoQuery = useComments(kind, slug)
  const likes = useAppStore((s) => s.likes)
  const [posted, setPosted] = useState<CommentView[]>([])
  const scope = `${kind}:${slug}`
  const key = ["thread", email ?? "", slug] as const
  const realQuery = useQuery({ queryKey: key, queryFn: () => real.fetchThread(slug), enabled: !DEMO_MODE })

  const comments = useMemo<CommentView[]>(() => {
    if (!DEMO_MODE) {
      // The API's total includes the reader's own like; the list adds it, so take it off here.
      return (realQuery.data ?? []).map((c) => ({ ...c, likes: c.likes - (c.liked ? 1 : 0) }))
    }
    const base = (demoQuery.data ?? []).map((c, i) => ({ ...c, id: `d${i}` }))
    return [...posted, ...base].map((c) => ({ ...c, liked: !!likes[likeKey.comment(scope, c.id)] }))
  }, [realQuery.data, demoQuery.data, posted, likes, scope])

  const query = DEMO_MODE ? demoQuery : realQuery

  const setList = (update: (list: real.ApiComment[]) => real.ApiComment[]) =>
    qc.setQueryData<real.ApiComment[]>(key, (list) => (list ? update(list) : list))

  /** Resolves true when the comment was accepted (the composer clears). */
  async function post(text: string): Promise<boolean> {
    if (!user) {
      toast.success(tt("loginToComment"))
      return false
    }
    if (DEMO_MODE) {
      setPosted((p) => [{ id: `p${p.length}`, name: user.name, when: justNow, text: text.trim(), likes: 0 }, ...p])
      return true
    }
    try {
      const created = await real.postComment(slug, text.trim())
      setList((list) => [created, ...list])
      return true
    } catch (error) {
      failed(error)
      return false
    }
  }

  async function toggleLike(id: string) {
    if (DEMO_MODE) return useAppStore.getState().toggleLike(likeKey.comment(scope, id))
    if (!email) return askToLogin()
    const now = realQuery.data?.find((c) => c.id === id)
    if (!now) return
    const next = !now.liked
    const apply = (liked: boolean, total: number) =>
      setList((list) => list.map((c) => (c.id === id ? { ...c, liked, likes: total } : c)))
    apply(next, now.likes + (next ? 1 : -1))
    try {
      const state = await real.putCommentLike(id, next)
      apply(state.liked, state.likes)
    } catch (error) {
      apply(now.liked, now.likes)
      failed(error)
    }
  }

  async function remove(id: string) {
    const before = realQuery.data
    setList((list) => list.filter((c) => c.id !== id))
    try {
      await real.deleteComment(id)
      toast.success(tt("commentDeleted"))
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    }
  }

  async function report(id: string) {
    if (!email) return askToLogin()
    try {
      await real.reportComment(id, "inappropriate")
      toast.success(tt("commentReported"))
    } catch (error) {
      failed(error)
    }
  }

  // Delete and report exist in the real API only.
  return { comments, query, post, toggleLike, remove: DEMO_MODE ? undefined : remove, report: DEMO_MODE ? undefined : report }
}
