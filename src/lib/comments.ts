"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { CommentView } from "@/components/pr/comment-list"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { commentsKeys } from "@/lib/api/keys"
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
  // Comments the reader posted in this thread (real API), per thread. The list the API sends is
  // the top 50 by likes, so a new comment (no likes yet) may not be in it, and the list can be
  // loaded again after the post (the key changes when the account is read): keep the reader's own.
  const [mineByThread, setMineByThread] = useState<Record<string, real.ApiComment[]>>({})
  const scope = `${kind}:${slug}`
  const key = commentsKeys.threadAccount(email ?? "", slug)
  const realQuery = useQuery({ queryKey: key, queryFn: () => real.fetchThread(slug), enabled: !DEMO_MODE })

  const mine = mineByThread[slug]
  const realList = useMemo<real.ApiComment[]>(() => {
    const server = realQuery.data ?? []
    const seen = new Set(server.map((c) => c.id))
    return [...(mine ?? []).filter((c) => !seen.has(c.id)), ...server]
  }, [realQuery.data, mine])

  const comments = useMemo<CommentView[]>(() => {
    if (!DEMO_MODE) {
      // The API's total includes the reader's own like; the list adds it, so take it off here.
      return realList.map((c) => ({ ...c, likes: c.likes - (c.liked ? 1 : 0) }))
    }
    const base = (demoQuery.data ?? []).map((c, i) => ({ ...c, id: `d${i}` }))
    return [...posted, ...base].map((c) => ({ ...c, liked: !!likes[likeKey.comment(scope, c.id)] }))
  }, [realList, demoQuery.data, posted, likes, scope])

  const query = DEMO_MODE ? demoQuery : realQuery

  const setList = (update: (list: real.ApiComment[]) => real.ApiComment[]) => {
    qc.setQueryData<real.ApiComment[]>(key, (list) => (list ? update(list) : list))
    setMineByThread((all) => (all[slug] ? { ...all, [slug]: update(all[slug]) } : all))
  }

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
      setMineByThread((all) => ({ ...all, [slug]: [created, ...(all[slug] ?? [])] }))
      qc.setQueryData<real.ApiComment[]>(key, (list) => (list && !list.some((c) => c.id === created.id) ? [created, ...list] : list))
      return true
    } catch (error) {
      failed(error)
      return false
    }
  }

  async function toggleLike(id: string) {
    if (DEMO_MODE) return useAppStore.getState().toggleLike(likeKey.comment(scope, id))
    if (!email) return askToLogin()
    const now = realList.find((c) => c.id === id)
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
    const beforeMine = mineByThread
    setList((list) => list.filter((c) => c.id !== id))
    try {
      await real.deleteComment(id)
      toast.success(tt("commentDeleted"))
    } catch (error) {
      qc.setQueryData(key, before)
      setMineByThread(beforeMine)
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
