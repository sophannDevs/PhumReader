"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { ListIcon } from "@/components/animate-ui/icons/list"
import { LockIcon } from "@/components/animate-ui/icons/lock"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { novelVars } from "@/components/pr/reader-theme"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { NovelSettings } from "@/lib/store"
import { useLocalize } from "@/lib/localize"
import { cn } from "@/lib/utils"

/** `price`: this episode's Fast Pass price (real API); without it the popover's `price`. */
export type ListEpisode = { n: number; title: string; date: string; thumb: string; locked: boolean; price?: number }

const VISIBLE = 9

/** The 9 episodes around `current` (oldest first). */
function nearby(episodes: ListEpisode[], current: number): ListEpisode[] {
  const sorted = [...episodes].sort((a, b) => a.n - b.n)
  const idx = Math.max(0, sorted.findIndex((e) => e.n === current))
  const start = Math.min(Math.max(0, idx - Math.floor(VISIBLE / 2)), Math.max(0, sorted.length - VISIBLE))
  return sorted.slice(start, start + VISIBLE)
}

/**
 * "Episodes" / "Chapters" popover of the reader bars (prototype `.vw-list` / Novel `.nr-pop`).
 * - comic: always dark; "68 episodes" and "3 coins" on top, then the 9 episodes around this one, newest first, with
 *   a 40 px thumbnail, the date, a lock on locked ones and "Now" on this one.
 * - novel (`readerTheme`): in the reader theme; "116 chapters", the 9 chapters around this one, oldest first, with
 *   the date and "🔒 5" (its price) on locked ones.
 * Picking a row closes it and calls `onSelect(n)` (the reader navigates or opens the UnlockDialog).
 */
export function EpisodeListPopover({
  episodes,
  current,
  coins,
  price,
  readerTheme,
  triggerClassName,
  onSelect,
}: {
  episodes: ListEpisode[]
  current: number
  coins: number
  /** Fast Pass price for rows without their own (the novel list shows it on locked chapters) */
  price: number
  /** Set in the novel reader: chapters, coloured with its theme */
  readerTheme?: NovelSettings["theme"]
  triggerClassName?: string
  onSelect: (n: number) => void
}) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const [open, setOpen] = useState(false)
  const novel = !!readerTheme
  const near = nearby(episodes, current)
  const rows = novel ? near : near.reverse()
  const pick = (n: number) => {
    setOpen(false)
    onSelect(n)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AnimateIcon asChild animateOnHover><PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={triggerClassName}>
          <ListIcon className="size-3.5" aria-hidden />
          <span className="max-md:sr-only">{t(novel ? "chapters" : "episodes")}</span>
        </Button>
      </PopoverTrigger></AnimateIcon>
      <PopoverContent
        align="end"
        sideOffset={8}
        data-reader-theme={readerTheme}
        style={readerTheme ? novelVars(readerTheme) : undefined}
        className={cn(
          "gap-0 overflow-y-auto p-1",
          novel
            ? "max-h-[380px] w-[300px] border-border bg-card text-reader-text"
            : "max-h-[420px] w-80 rounded-[10px] border-surface-border bg-surface-panel text-surface-foreground shadow-[0_16px_48px_rgba(0,0,0,0.5)] max-md:w-[290px]"
        )}
      >
        {novel ? (
          <p className="px-2 py-1.5 text-xs font-semibold text-reader-quiet tabular-nums">
            {t("listChapters", { count: episodes.length })}
          </p>
        ) : (
          <p className="flex justify-between px-2.5 py-2 text-xs text-surface-quiet tabular-nums">
            <span>{t("listEpisodes", { count: episodes.length })}</span>
            <span>{t("listCoins", { count: coins })}</span>
          </p>
        )}
        <ul className="flex flex-col">
          {rows.map((e) => {
            const isCurrent = e.n === current
            return (
              <li key={e.n}>
                <AnimateIcon asChild animateOnHover><button
                  type="button"
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => pick(e.n)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    novel ? "p-2 hover:bg-accent" : "px-2 py-1.5 hover:bg-surface-border",
                    isCurrent && (novel ? "bg-accent" : "bg-surface-border")
                  )}
                >
                  {novel ? null : (
                    <Image
                      src={e.thumb}
                      alt=""
                      width={80}
                      height={80}
                      sizes="40px"
                      className="size-10 shrink-0 rounded-md bg-surface-border object-cover"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-[18px]">{loc.title(e.title)}</span>
                    <span className={cn("text-xs leading-4", novel ? "text-reader-quiet" : "text-surface-quiet")}>{loc.date(e.date)}</span>
                  </span>
                  {e.locked ? (
                    novel ? (
                      <Badge variant="warn" className="tabular-nums">
                        <LockIcon aria-hidden />
                        {e.price ?? price}
                        <span className="sr-only">{t("locked")}</span>
                      </Badge>
                    ) : (
                      <span className="text-coin">
                        <LockIcon className="size-3.5" aria-hidden />
                        <span className="sr-only">{t("locked")}</span>
                      </span>
                    )
                  ) : null}
                  {isCurrent && !novel ? <Badge variant="new">{t("now")}</Badge> : null}
                </button></AnimateIcon>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
