"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "@/i18n/translations"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { CommentView } from "@/components/pr/comment-list"
import type { ReplyView, ThreadView } from "@/components/pr/comment-thread"
import type { Series } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { errorCode } from "@/lib/api/errors"
import { catalogKeys, commentsKeys } from "@/lib/api/keys"
import { fetchCommentThreads } from "@/lib/demo-api"
import { useAccountEmail, useAskToLogin, useFailed } from "@/lib/me"
import { useComments, useDemoFlag } from "@/lib/queries"
import { likeKey, useAppStore, useUser } from "@/lib/store"

/**
 * One comment thread (a series, or one episode as "slug:n") for both modes. The demo keeps the
 * thread static, new comments in component state and likes in the store; the real API holds all
 * three, and the reader's comments can be deleted and other people's reported (`reportSend` goes with
 * the app-wide Report dialog, which also keeps the report locally).
 */
export function useCommentThread(kind: "series" | "episode", slug: string, justNow: string) {
  const tt = useTranslations("toasts")
  const tc = useTranslations("comments")
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
      setPosted((p) => [{ id: `p${p.length}`, name: user.name, when: justNow, text: text.trim(), likes: 0, mine: true }, ...p])
      return true
    }
    try {
      const created = await real.postComment(slug, text.trim())
      setMineByThread((all) => ({ ...all, [slug]: [created, ...(all[slug] ?? [])] }))
      qc.setQueryData<real.ApiComment[]>(key, (list) => (list && !list.some((c) => c.id === created.id) ? [created, ...list] : list))
      return true
    } catch (error) {
      if (!commentsClosed(error, slug, qc, tc("closed"))) failed(error)
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

  /** The Report dialog sends the reason to the API too (real mode). */
  const reportSend = (id: string, reason: string, details: string) => real.reportComment(id, reason, details)

  // Delete exists in the real API only (the demo's posted comments are not deletable here).
  return { comments, query, post, toggleLike, remove: DEMO_MODE ? undefined : remove, reportSend: DEMO_MODE ? undefined : reportSend }
}

/**
 * 403 `comments_disabled` (V21-02): the creator turned comments off (the episode's or the series' switch) after the
 * page loaded. Says so, and loads the series and the open episode again so the comment box goes away. False for any
 * other error.
 */
function commentsClosed(error: unknown, thread: string, qc: ReturnType<typeof useQueryClient>, message: string): boolean {
  if (errorCode(error) !== "comments_disabled") return false
  toast.error(message)
  const slug = thread.split(":")[0]
  void qc.invalidateQueries({ queryKey: catalogKeys.series(slug).slice(0, 2) })
  void qc.invalidateQueries({ queryKey: catalogKeys.episode(slug, 0).slice(0, 2) })
  return true
}

// ---------------------------------------------------------------- V2.1 Comments page threads

/** "now", "5m", "2h", "3d" or a date (real API `when`) -> hours ago, for sorting by Newest. */
function hoursAgo(when: string): number {
  const m = /^(\d+)([mhd])$/.exec(when)
  if (when === "now") return 0
  if (!m) return 24 * 365
  const n = Number(m[1])
  return m[2] === "m" ? n / 60 : m[2] === "h" ? n : n * 24
}

/**
 * Threads for the Comments page (spec §23) in both modes. `thread` is the series slug, or "slug:n" for one episode.
 * - Demo: demo-data `commentThreads` (the creator's comments take the series' creator name), likes in the store,
 *   the reader's comments, replies and edits in component state (prototype behaviour).
 * - Real API: the API's comments (top 50; post, like, delete, report). The API has no replies, pins, spoiler flags
 *   or edits yet, so the reader's replies, spoiler marks and edits stay on this page for this visit.
 */
export function useCommentThreads(series: Pick<Series, "creator"> | undefined, thread: string) {
  const t = useTranslations("comments")
  const tt = useTranslations("toasts")
  const user = useUser()
  const email = useAccountEmail()
  const qc = useQueryClient()
  const askToLogin = useAskToLogin()
  const failed = useFailed()
  const flag = useDemoFlag()
  const likes = useAppStore((s) => s.likes)
  const scope = `threads:${thread}`
  const demoQuery = useQuery({
    queryKey: commentsKeys.threadsDemo(thread, flag),
    queryFn: () => fetchCommentThreads(thread),
    enabled: DEMO_MODE,
  })
  const realKey = ["thread", email ?? "", thread] as const
  const realQuery = useQuery({ queryKey: realKey, queryFn: () => real.fetchThread(thread), enabled: !DEMO_MODE })
  const [mine, setMine] = useState<ThreadView[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [deleted, setDeleted] = useState<string[]>([])
  const [spoilers, setSpoilers] = useState<string[]>([])
  const [myReplies, setMyReplies] = useState<Record<string, ReplyView[]>>({})
  const justNow = t("justNow")

  const threads = useMemo<ThreadView[]>(() => {
    const liked = (id: string) => !!likes[likeKey.comment(scope, id)]
    let base: ThreadView[]
    if (DEMO_MODE) {
      base = (demoQuery.data ?? []).map((c) => ({
        id: c.id,
        name: c.creator && series ? series.creator : c.name,
        creator: c.creator,
        pinned: c.pinned,
        when: c.when,
        ago: c.ago,
        likes: c.likes,
        liked: liked(c.id),
        text: c.text,
        spoiler: c.spoiler,
        replies: c.replies.map((r, i) => {
          const id = `${c.id}r${i}`
          return { id, name: r.creator && series ? series.creator : r.name, creator: r.creator, when: r.when, likes: r.likes, liked: liked(id), text: r.text }
        }),
      }))
    } else {
      base = (realQuery.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        mine: c.mine,
        authorId: c.authorId,
        when: c.when,
        ago: hoursAgo(c.when),
        likes: c.likes - (c.liked ? 1 : 0),
        liked: c.liked,
        text: c.text,
        canDelete: c.canDelete,
        replies: [],
      }))
    }
    const seen = new Set(base.map((c) => c.id))
    return [...mine.filter((c) => !seen.has(c.id)), ...base]
      .filter((c) => !deleted.includes(c.id))
      .map((c) => ({
        ...c,
        // Demo likes live in the store; real ones come with the API's comment.
        liked: DEMO_MODE ? liked(c.id) : c.liked,
        text: edits[c.id] ?? c.text,
        edited: c.edited || edits[c.id] !== undefined,
        spoiler: c.spoiler || spoilers.includes(c.id),
        canEdit: !!c.mine,
        canDelete: !!c.mine || c.canDelete,
        replies: [...c.replies, ...(myReplies[c.id] ?? [])].map((r) => (r.mine ? { ...r, liked: liked(r.id) } : r)),
      }))
  }, [demoQuery.data, realQuery.data, series, mine, edits, deleted, spoilers, myReplies, likes, scope])

  const query = DEMO_MODE ? demoQuery : realQuery

  /** Resolves true when the comment was accepted (the composer clears). */
  async function post(text: string, spoiler: boolean): Promise<boolean> {
    if (!user) {
      askToLogin()
      return false
    }
    const body = text.trim()
    if (DEMO_MODE) {
      const id = `m${Date.now()}`
      setMine((m) => [{ id, name: user.name, mine: true, when: justNow, ago: 0, likes: 0, liked: false, text: body, spoiler, replies: [] }, ...m])
      toast.success(t("posted"))
      return true
    }
    try {
      const created = await real.postComment(thread, body)
      setMine((m) => [
        { id: created.id, name: created.name, mine: true, when: created.when, ago: 0, likes: 0, liked: false, text: created.text, canDelete: created.canDelete, replies: [] },
        ...m,
      ])
      if (spoiler) setSpoilers((s) => [...s, created.id])
      toast.success(t("posted"))
      return true
    } catch (error) {
      if (!commentsClosed(error, thread, qc, t("closed"))) failed(error)
      return false
    }
  }

  async function like(id: string) {
    const top = threads.find((c) => c.id === id)
    // Demo comments, and replies (local in both modes), toggle in the store.
    if (DEMO_MODE || !top) return useAppStore.getState().toggleLike(likeKey.comment(scope, id))
    if (!email) return askToLogin()
    const next = !top.liked
    // `likes` here is without the reader's own like; the API's total includes it.
    const apply = (liked: boolean, total: number) => {
      qc.setQueryData<real.ApiComment[]>(realKey, (list) => list?.map((c) => (c.id === id ? { ...c, liked, likes: total } : c)))
      setMine((m) => m.map((c) => (c.id === id ? { ...c, liked, likes: total - (liked ? 1 : 0) } : c)))
    }
    apply(next, top.likes + (next ? 1 : 0))
    try {
      const state = await real.putCommentLike(id, next)
      apply(state.liked, state.likes)
    } catch (error) {
      apply(top.liked, top.likes + (top.liked ? 1 : 0))
      failed(error)
    }
  }

  function reply(threadId: string, text: string): boolean {
    if (!user) {
      askToLogin()
      return false
    }
    const r: ReplyView = { id: `${threadId}m${Date.now()}`, name: user.name, mine: true, when: justNow, likes: 0, liked: false, text }
    setMyReplies((all) => ({ ...all, [threadId]: [...(all[threadId] ?? []), r] }))
    toast.success(t("replyPosted"))
    return true
  }

  function edit(id: string, text: string) {
    setEdits((e) => ({ ...e, [id]: text }))
    toast.success(t("updated"))
  }

  async function remove(id: string) {
    if (DEMO_MODE) {
      setDeleted((d) => [...d, id])
      setMine((m) => m.filter((c) => c.id !== id))
      toast.success(tt("commentDeleted"))
      return
    }
    setDeleted((d) => [...d, id])
    try {
      await real.deleteComment(id)
      setMine((m) => m.filter((c) => c.id !== id))
      toast.success(tt("commentDeleted"))
    } catch (error) {
      setDeleted((d) => d.filter((x) => x !== id))
      failed(error)
    }
  }

  const reportSend = async (id: string, reason: string, details: string) => {
    // Replies are local (no API id): only top-level API comments are sent.
    if (!threads.some((c) => c.id === id)) return
    return real.reportComment(id, reason, details)
  }

  return { threads, query, post, like, reply, edit, remove, reportSend: DEMO_MODE ? undefined : reportSend }
}
