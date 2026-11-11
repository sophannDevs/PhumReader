"use client"

import { CircleAlertIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useReport } from "@/components/pr/report-dialog"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { useAskToLogin } from "@/lib/me"
import { useLocalize } from "@/lib/localize"
import { useUser } from "@/lib/store"

/** The API's age ratings as the number readers know (V21-02); "all" is "All ages". */
const AGE_NUMBER: Record<string, number> = { teen: 13, teen16: 16, mature: 18 }

/**
 * About tab (prototype Series `tabAbout`): synopsis + "New episodes every Sunday." (or "Monday and Thursday"), the
 * details card (both genres, every update day, "On break", the age as 13+ / 16+ / 18+), tags, and
 * "Something wrong with this series? Report it" (app-wide Report dialog, series reasons; log in first).
 */
export function SeriesAbout({ series, synopsis, secondGenre }: { series: Series; synopsis: string; secondGenre?: string | null }) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport } = useReport()
  const novel = series.type === "novel"
  const onBreak = series.status === "hiatus"
  const age = AGE_NUMBER[series.ageRating]

  const details: [string, string][] = [
    [t("genre"), [series.genre, secondGenre].flatMap((g) => (g ? [loc.genre(g)] : [])).join(", ")],
    [t("format"), t(novel ? "novel" : "verticalComic")],
    [t("schedule"), series.schedule ? loc.schedule(series) : t("noSchedule")],
    [t("status"), t(series.status === "completed" ? "completed" : onBreak ? "onBreak" : "ongoing")],
    [t("language"), series.language.map((l) => t(l === "km" ? "khmer" : "english")).join(", ")],
    [t("ageRating"), series.ageRating === "all" ? t("allAges") : age ? t("agePlus", { age }) : series.ageRating],
  ]
  const tag = (s: string) => `#${s.toLowerCase().replace(/\s+/g, "")}`
  const tags = [
    tag(loc.genre(series.genre)),
    ...(secondGenre ? [tag(loc.genre(secondGenre))] : []),
    tag(t(novel ? "novel" : "comic")),
    ...series.language.map((l) => tag(t(l === "km" ? "khmer" : "english"))),
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-[26px]">
        {synopsis}
        {/* A series on a break has its schedule paused: no "New episodes every …". */}
        {series.updateDays.length > 0 && !onBreak
          ?` ${t(novel ? "aboutNewChapters" : "aboutNew", { day: loc.days(series.updateDays, "full") })}`
          : null}
      </p>

      <dl className="divide-y rounded-card border bg-card text-sm shadow-xs">
        {details.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3 md:grid-cols-[140px_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <ul aria-label={t("tags")} className="flex flex-wrap gap-1.5">
        {tags.map((x) => (
          <li key={x}>
            <Badge variant="outline">{x}</Badge>
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap items-center gap-1.5 pt-2 text-xs leading-4 text-muted-foreground">
        <CircleAlertIcon className="size-3.5" aria-hidden />
        {t("somethingWrong")}
        <button
          type="button"
          className="rounded-sm font-medium text-brand-ink underline underline-offset-4 outline-none hover:text-brand-ink/80 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => (user ? openReport({
                  kind: "series",
                  target: series.title,
                  onSend: DEMO_MODE ? undefined : (reason, details) => real.reportSeries(series.slug, reason, details),
                }) : askToLogin())}
        >
          {t("reportIt")}
        </button>
      </p>
    </div>
  )
}
