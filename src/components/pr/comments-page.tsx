"use client"

import { BookIcon, ChevronRightIcon, MessageSquareIcon, RotateCcwIcon } from "lucide-react"
import Image from "next/image"
import { notFound, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { ThreadComposer } from "@/components/pr/comment-composer"
import { CommentThread } from "@/components/pr/comment-thread"
import { ErrorState } from "@/components/pr/error-state"
import { BlockedHiddenLine, useBlockedFilter } from "@/components/pr/report-dialog"
import { Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { episodeCommentCount, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useCommentThreads } from "@/lib/comments"
import { useEpisodes, useSeries } from "@/lib/queries"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"

const PAGE = 6

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="container">
      <div className="mx-auto flex max-w-[756px] flex-col gap-[18px] pt-6 pb-16">{children}</div>
    </div>
  )
}

export function CommentsPageSkeleton() {
  return (
    <Frame>
      <div aria-hidden className="flex flex-col gap-[18px]">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-[68px] w-[52px] rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-36 rounded-card" />
        <ThreadsSkeleton />
      </div>
    </Frame>
  )
}

function ThreadsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-3 border-b py-4">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Comments page `/series/[slug]/comments` (`?ep=N` for one episode or chapter). Spec §23, screens 23-comments-*. */
export function CommentsPage({ slug }: { slug: string }) {
  const query = useSeries(slug)
  const params = useSearchParams()
  const epParam = Number.parseInt(params.get("ep") ?? "", 10)
  const ep = Number.isInteger(epParam) && epParam > 0 ? epParam : 0

  if (query.isPending) return <CommentsPageSkeleton />
  if (query.isError) return <ErrorState className="container" onRetry={() => void query.refetch()} />
  if (!query.data) notFound()

  return <CommentsBody series={query.data.series} seriesCount={query.data.stats.comments} ep={ep} />
}

function CommentsBody({ series, seriesCount, ep }: { series: Series; seriesCount: string; ep: number }) {
  const t = useTranslations("comments")
  const novel = series.type === "novel"
  const episodes = useEpisodes(series.slug)
  const episode = ep ? episodes.data?.find((e) => e.n === ep) : undefined
  const count = episode ? episodeCommentCount(episode) : seriesCount
  const scopeLabel = ep ? t(novel ? "chapterN" : "episodeN", { n: ep }) : t(novel ? "allChapters" : "allEpisodes")
  const data = useCommentThreads(series, ep ? `${series.slug}:${ep}` : series.slug)
  const blocked = useAppStore((s) => s.blocked)
  const [sort, setSort] = useState<"top" | "new">("top")
  const [creatorOnly, setCreatorOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const { visible, hidden, reveal } = useBlockedFilter(data.threads, (c) => c.name)
  // Once "Show" is pressed, blocked people's replies show too (useBlockedFilter reports 0 hidden after Show).
  const revealedAll = hidden === 0 && data.threads.some((c) => blocked.includes(c.name))

  const { pinned, rest } = useMemo(() => {
    const list = visible.filter((c) => !creatorOnly || c.creator || c.replies.some((r) => r.creator))
    const others = list.filter((c) => !c.pinned)
    others.sort(sort === "top" ? (a, b) => b.likes - a.likes : (a, b) => a.ago - b.ago)
    return { pinned: list.filter((c) => c.pinned), rest: others }
  }, [visible, creatorOnly, sort])
  const firstWithReplies = useMemo(
    () => [...data.threads].filter((c) => !c.pinned && c.replies.length > 0).sort((a, b) => b.likes - a.likes)[0]?.id,
    [data.threads]
  )
  const shownList = [...pinned, ...rest.slice(0, shown)]

  return (
    <Frame>
      <nav aria-label={t("breadcrumb")}>
        <ol className="flex flex-wrap items-center gap-1.5 text-xs leading-4 text-muted-foreground">
          <li>
            <Link href={seriesHref(series)} className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              {series.title}
            </Link>
          </li>
          <ChevronRightIcon className="size-3" aria-hidden />
          <li aria-current="page" className="text-foreground">
            {scopeLabel}
          </li>
        </ol>
      </nav>

      <header className="flex items-center gap-3.5">
        <Image src={series.cover} alt="" width={104} height={136} sizes="52px" className="h-[68px] w-[52px] shrink-0 rounded-lg object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="type-h2">
            {t("title")} <span className="font-medium text-muted-foreground tabular-nums">{count}</span>
          </h1>
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
            {series.title} · {scopeLabel}
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={ep ? readerHref(series, ep) : seriesHref(series)}>
            <BookIcon className="size-3.5" />
            {ep ? t(novel ? "backToChapter" : "backToEpisode", { n: ep }) : t("backToSeries")}
          </Link>
        </Button>
      </header>

      <ThreadComposer
        onPost={async (text, spoiler) => {
          const ok = await data.post(text, spoiler)
          if (ok) setSort("new")
          return ok
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t("sortLabel")}
          value={sort}
          onChange={setSort}
          options={[
            { value: "top", label: t("sortTop") },
            { value: "new", label: t("sortNewest") },
          ]}
        />
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <Checkbox checked={creatorOnly} onCheckedChange={(v) => setCreatorOnly(v === true)} />
          {t("creatorOnly")}
        </label>
      </div>

      {data.query.isPending ? (
        <ThreadsSkeleton />
      ) : data.query.isError ? (
        <StateBox
          icon={RotateCcwIcon}
          tone="bad"
          title={t("errorTitle")}
          text={t("errorText")}
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void data.query.refetch()}>
              {t("tryAgain")}
            </Button>
          }
        />
      ) : data.threads.length === 0 ? (
        <StateBox icon={MessageSquareIcon} title={t("empty")} text={t("emptyDesc")} />
      ) : (
        <>
          {shownList.length > 0 ? (
            <ul aria-label={t("title")} className="flex flex-col gap-0.5">
              {shownList.map((c) => (
                <CommentThread
                  key={c.id}
                  thread={c}
                  defaultOpen={c.id === firstWithReplies}
                  hideReplyFrom={revealedAll ? undefined : blocked}
                  onLike={(id) => void data.like(id)}
                  onReply={data.reply}
                  onEdit={data.edit}
                  onDelete={(id) => void data.remove(id)}
                  onReportSend={data.reportSend}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-card border bg-card px-5 py-8 text-center shadow-xs">
              <h2 className="type-h4">{t("noMatch")}</h2>
              <p className="text-[13px] leading-[18px] text-muted-foreground">{t("noMatchText")}</p>
            </div>
          )}
          <BlockedHiddenLine count={hidden} onShow={reveal} className="rounded-control bg-muted px-3 py-2.5 text-xs" />
          {rest.length > shown ? (
            <Button variant="outline" className="self-center" onClick={() => setShown((n) => n + PAGE)}>
              {t("showMore")}
            </Button>
          ) : null}
        </>
      )}
    </Frame>
  )
}
