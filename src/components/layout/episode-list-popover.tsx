"use client"

import { ListIcon, LockIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useLocalize } from "@/lib/localize"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export type ListEpisode = { n: number; title: string; thumb: string; locked: boolean }

const VISIBLE = 9

/** The 9 episodes around `current`, newest first. */
function nearby(episodes: ListEpisode[], current: number): ListEpisode[] {
  const sorted = [...episodes].sort((a, b) => b.n - a.n)
  const idx = Math.max(0, sorted.findIndex((e) => e.n === current))
  const start = Math.min(Math.max(0, idx - Math.floor(VISIBLE / 2)), Math.max(0, sorted.length - VISIBLE))
  return sorted.slice(start, start + VISIBLE)
}

const tones = {
  dark: {
    trigger: "text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface",
    content: "border-surface-border bg-surface-panel text-surface-foreground",
    quiet: "text-surface-quiet",
    row: "hover:bg-surface-border",
    divider: "border-surface-border",
  },
  themed: {
    trigger: "text-reader-text hover:bg-reader-border/60 hover:text-reader-text focus-visible:ring-offset-reader-page",
    content: "border-reader-border bg-reader-page text-reader-text",
    quiet: "text-reader-quiet",
    row: "hover:bg-reader-border/60",
    divider: "border-reader-border",
  },
} as const

/**
 * "Episodes" / "Chapters" popover for the reader bars. Header "N episodes · N
 * coins", 9 nearby rows newest first, the current one marked "Now", locked rows
 * with a lock. Selecting a row calls `onSelect(n)`; the page decides whether to
 * navigate or to open the UnlockDialog.
 */
export function EpisodeListPopover({
  episodes,
  current,
  coins,
  kind = "episode",
  tone = "dark",
  onSelect,
}: {
  episodes: ListEpisode[]
  current: number
  coins: number
  kind?: "episode" | "chapter"
  tone?: keyof typeof tones
  onSelect: (n: number) => void
}) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const s = tones[tone]
  const rows = nearby(episodes, current)
  // The popover renders in a portal, outside the reader root: carry the theme with it.
  const readerTheme = useAppStore((st) => st.novelSettings.theme)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5", s.trigger)}>
          <ListIcon />
          {t(kind === "chapter" ? "chapters" : "episodes")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        data-reader-theme={tone === "themed" ? readerTheme : undefined}
        className={cn("w-80 gap-0 p-0", s.content)}
      >
        <p className={cn("border-b px-4 py-3 text-sm font-semibold tabular-nums", s.divider)}>
          {t(kind === "chapter" ? "headerChapters" : "headerEpisodes", { count: episodes.length, coins })}
        </p>
        <ul className="flex max-h-[min(24rem,60vh)] flex-col overflow-y-auto p-1.5">
          {rows.map((e) => {
            const isCurrent = e.n === current
            return (
              <li key={e.n}>
                <button
                  type="button"
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => onSelect(e.n)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    s.row,
                    isCurrent && "bg-primary/15"
                  )}
                >
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={e.thumb}
                      alt=""
                      width={80}
                      height={80}
                      sizes="40px"
                      className={cn("size-full object-cover", e.locked && "opacity-50")}
                    />
                    {e.locked ? (
                      <span className="absolute inset-0 flex items-center justify-center text-white">
                        <LockIcon className="size-4" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{loc.title(e.title)}</span>
                  {isCurrent ? <Badge variant="new">{t("now")}</Badge> : null}
                  {e.locked ? <span className="sr-only">{t("locked")}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
