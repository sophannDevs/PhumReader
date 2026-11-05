import { PlayIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { LanguageSwitch } from "@/components/layout/language-switch"
import { Logo } from "@/components/layout/logo"
import { Link } from "@/i18n/navigation"

type FooterLink = { key: string; href: string }

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "read",
    links: [
      { key: "originals", href: "/" },
      { key: "rankings", href: "/#rank" },
      { key: "genres", href: "/#genres" },
      { key: "novels", href: "/#novels" },
    ],
  },
  {
    title: "create",
    links: [
      { key: "creatorDashboard", href: "/creator" },
      { key: "creatorGuidelines", href: "/creator#guidelines" },
      { key: "earnings", href: "/creator#earnings" },
    ],
  },
  {
    title: "help",
    links: [
      { key: "helpCenter", href: "/coming-soon?topic=help-center" },
      { key: "terms", href: "/coming-soon?topic=terms" },
      { key: "privacy", href: "/coming-soon?topic=privacy" },
      { key: "contact", href: "/coming-soon?topic=contact" },
    ],
  },
]

const socials = [
  { key: "facebook", glyph: "f" },
  { key: "twitter", glyph: "t" },
  { key: "youtube", glyph: null },
] as const

const linkClass =
  "rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"

export function SiteFooter() {
  const t = useTranslations("footer")
  const tn = useTranslations("nav")

  const label = (key: string) => (["rankings", "genres", "novels"].includes(key) ? tn(key) : t(key))

  return (
    <footer className="mt-14 border-t bg-muted/50">
      <div className="container py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex max-w-xs flex-col gap-4">
            <Logo size="footer" khmer />
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <ul aria-label={t("social")} className="flex gap-2">
              {socials.map((s) => (
                <li key={s.key}>
                  <Link
                    href={`/coming-soon?topic=${s.key}`}
                    aria-label={t(s.key)}
                    className="flex size-8 items-center justify-center rounded-control border bg-background text-sm font-medium text-muted-foreground shadow-xs transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
                  >
                    {s.glyph ?? <PlayIcon className="size-3.5 fill-current" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-3 md:grid-cols-3">
            {columns.map((col) => (
              <nav key={col.title} aria-label={t(col.title)} className="flex flex-col gap-3 last:max-md:col-span-2">
                <h2 className="text-sm font-semibold">{t(col.title)}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.key}>
                      <Link href={l.href} className={linkClass}>
                        {label(l.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">{t("copyright")}</p>
          <LanguageSwitch variant="inline" />
        </div>
      </div>
    </footer>
  )
}
