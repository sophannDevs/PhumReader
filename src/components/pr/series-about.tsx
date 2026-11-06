import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { Series } from "@/data"
import { useLocalize } from "@/lib/localize"

/** About tab: synopsis, "New episodes every <day>.", details list and tag badges. */
export function SeriesAbout({ series, synopsis }: { series: Series; synopsis: string }) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const th = useTranslations("home")

  const details: [string, string][] = [
    [t("genre"), loc.genre(series.genre)],
    [t("format"), t(series.type === "novel" ? "novel" : "comic")],
    [t("schedule"), loc.schedule(series.schedule)],
    [t("status"), t(series.status === "completed" ? "completed" : "ongoing")],
    [t("language"), series.language.map((l) => t(l === "km" ? "khmer" : "english")).join(", ")],
    [t("ageRating"), series.ageRating === "all" ? t("allAges") : series.ageRating],
  ]
  const tags = [loc.genre(series.genre), t(series.type === "novel" ? "novel" : "comic"), ...series.language.map((l) => t(l === "km" ? "khmer" : "english"))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-base leading-7">{synopsis}</p>
        {series.updateDay ? (
          <p className="type-body text-muted-foreground">{t("aboutNew", { day: th(`dayFull.${series.updateDay}`) })}</p>
        ) : null}
      </div>

      <section aria-labelledby="details-title" className="flex flex-col gap-3">
        <h2 id="details-title" className="type-h3">
          {t("detailsTitle")}
        </h2>
        <dl className="divide-y rounded-card border bg-card text-sm shadow-xs">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="tags-title" className="flex flex-col gap-3">
        <h2 id="tags-title" className="type-h3">
          {t("tags")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
