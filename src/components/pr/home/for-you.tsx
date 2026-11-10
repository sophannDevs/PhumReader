"use client"

import { SettingsIcon, SparklesIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { SeriesCard } from "@/components/pr/series-card"
import { Chip, Eyebrow, phoneSwipeRow, SectionHead } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { parseCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import type { Genre, Series } from "@/data"
import { useAppStore, useHydrated } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * "What do you like to read?" (spec §1): until the reader picks genres (`prefs` is null) or while editing, a card with
 * genre chips; afterwards "Recommended for you" (or "Popular right now" after Skip): 6 series by likes.
 */
export function ForYouSection({ genres, all }: { genres: Genre[]; all: Series[] }) {
  const t = useTranslations("home")
  const loc = useLocalize()
  const hydrated = useHydrated()
  const prefs = useAppStore((s) => s.prefs)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Genre[]>([])

  if (!hydrated) return null
  const showPicker = prefs === null || editing

  if (showPicker) {
    const save = () => {
      if (draft.length === 0) return
      useAppStore.getState().setPrefs(draft)
      setEditing(false)
      toast.success(t("prefsSaved", { count: draft.length }))
    }
    return (
      <section aria-labelledby="fy-h">
        <div className="flex flex-col gap-4 rounded-card border bg-[linear-gradient(120deg,#f0fdf5_0%,#ffffff_70%)] p-6 shadow-xs max-md:p-[18px]">
          <div className="flex flex-col gap-1">
            <Eyebrow>{t("personalise")}</Eyebrow>
            <h2 id="fy-h" className="type-h3">
              {t("pickTitle")}
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("pickText")}</p>
          </div>
          <div role="group" aria-label={t("genresLabel")} className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = draft.includes(g)
              return (
                <Chip key={g} selected={on} check onClick={() => setDraft(on ? draft.filter((x) => x !== g) : [...draft, g])}>
                  {loc.genre(g)}
                </Chip>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" onClick={save} disabled={draft.length === 0}>
              {t("showPicks", { count: draft.length })}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (prefs === null) useAppStore.getState().setPrefs([])
                setEditing(false)
              }}
            >
              {t("skipPicks")}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  const picked = prefs ?? []
  const source = picked.length ? all.filter((s) => picked.includes(s.genre)) : all
  const list = [...source].sort((a, b) => parseCount(b.likes) - parseCount(a.likes)).slice(0, 6)
  const names = picked.map((g) => loc.genre(g))
  const why =
    names.length === 0
      ? t("popularWhy")
      : names.length === 1
        ? t("because1", { a: names[0] })
        : names.length === 2
          ? t("because2", { a: names[0], b: names[1] })
          : t("becauseMore", { a: names[0], b: names[1], count: names.length - 2 })

  return (
    <section aria-labelledby="fy-h" className="flex flex-col gap-3.5">
      <SectionHead
        id="fy-h"
        icon={SparklesIcon}
        title={picked.length ? t("recommended") : t("popularNow")}
        subtitle={why}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft([...picked])
              setEditing(true)
            }}
          >
            <SettingsIcon className="size-3.5" />
            {t("editGenres")}
          </Button>
        }
      />
      <div className={cn("grid grid-cols-4 gap-5 min-[1100px]:grid-cols-6", phoneSwipeRow, "max-md:auto-cols-[38%]")}>
        {list.map((s) => (
          <SeriesCard key={s.id} series={s} badges="novel" hook={loc.hook(s)} />
        ))}
      </div>
    </section>
  )
}
