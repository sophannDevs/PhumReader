"use client"

import { CircleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useReport } from "@/components/pr/report-dialog"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data"
import { useAskToLogin } from "@/lib/me"
import { useLocalize } from "@/lib/localize"
import { useUser } from "@/lib/store"

/**
 * About tab (prototype Series `tabAbout`): synopsis + "New episodes every Sunday.", the details card, tags, and
 * "Something wrong with this series? Report it" (app-wide Report dialog, series reasons; log in first).
 */
export function SeriesAbout({ series, synopsis }: { series: Series; synopsis: string }) {
  const t = useTranslations("series")
  const th = useTranslations("home")
  const loc = useLocalize()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const { openReport } = useReport()
  const novel = series.type === "novel"

  const details: [string, string][] = [
    [t("genre"), loc.genre(series.genre)],
    [t("format"), t(novel ? "novel" : "verticalComic")],
    [t("schedule"), series.schedule ? loc.schedule(series.schedule) : t("noSchedule")],
    [t("status"), t(series.status === "completed" ? "completed" : "ongoing")],
    [t("language"), series.language.map((l) => t(l === "km" ? "khmer" : "english")).join(", ")],
    [t("ageRating"), series.ageRating === "all" ? t("allAges") : series.ageRating],
  ]
  const tag = (s: string) => `#${s.toLowerCase().replace(/\s+/g, "")}`
  const tags = [
    tag(loc.genre(series.genre)),
    tag(t(novel ? "novel" : "comic")),
    ...series.language.map((l) => tag(t(l === "km" ? "khmer" : "english"))),
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-[26px]">
        {synopsis}
        {series.updateDay ? ` ${t(novel ? "aboutNewChapters" : "aboutNew", { day: th(`dayFull.${series.updateDay}`) })}` : null}
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
          onClick={() => (user ? openReport({ kind: "series", target: series.title }) : askToLogin())}
        >
          {t("reportIt")}
        </button>
      </p>
    </div>
  )
}
