import { AnimateIcon } from "@animate-ui/react/icons"
import { PlayIcon } from "@/components/animate-ui/icons/play"
import { useTranslations } from "@/i18n/translations"
import { LanguageToggleLink } from "@/components/layout/language-switch"
import { Logo } from "@/components/layout/logo"
import { Link } from "@/i18n/navigation"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

type FooterLink = { key: string; href: string }

/** Spec §0 "Footer": Read / Create / Help columns. */
const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "read",
    links: [
      { key: "originals", href: "/" },
      { key: "rankings", href: "/rankings" },
      { key: "genres", href: "/genres" },
      { key: "novels", href: "/genres?format=novel" },
    ],
  },
  {
    title: "create",
    links: [
      { key: "becomeCreator", href: "/creators/join" },
      { key: "creatorDashboard", href: "/creator" },
      { key: "creatorGuidelines", href: "/legal/creator" },
      { key: "earnings", href: "/creator/earnings" },
    ],
  },
  {
    title: "help",
    links: [
      { key: "helpCenter", href: "/help" },
      { key: "community", href: "/legal/community" },
      { key: "terms", href: "/legal/terms" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "refunds", href: "/legal/refund" },
      { key: "contact", href: "/help#contact" },
    ],
  },
]

const socials = [
  { key: "facebook", glyph: "f" },
  { key: "telegram", glyph: "t" },
  { key: "youtube", glyph: null },
] as const

const linkClass =
  "rounded-sm text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export function SiteFooter() {
  const t = useTranslations("footer")
  const tn = useTranslations("nav")
  const label = (key: string) => (["rankings", "genres", "novels"].includes(key) ? tn(key) : t(key))

  return (
    <footer className="border-t bg-subtle">
      <Effect asChild fade slide={{ direction: "up", offset: 10 }} inView>
        <div className="container">
          <div className="grid grid-cols-2 gap-6 pt-8 pb-5 md:grid-cols-[1.6fr_repeat(3,1fr)] md:gap-8 md:pt-12 md:pb-8">
            <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
              <Logo size="footer" />
              <p className="max-w-[36ch] text-[13px] leading-[18px] text-muted-foreground">{t("description")}</p>
              <ul aria-label={t("social")} className="flex gap-1.5">
                {socials.map((s) => (
                  <li key={s.key}>
                    <AnimateIcon asChild animateOnHover><Link
                      href={`/coming-soon?topic=${s.key}`}
                      aria-label={t(s.key)}
                      className="flex size-8 items-center justify-center rounded-control border bg-background text-[13px] font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {s.glyph ?? <PlayIcon className="size-3 fill-current" aria-hidden />}
                    </Link></AnimateIcon>
                  </li>
                ))}
              </ul>
            </div>
            {columns.map((col) => (
              <nav key={col.title} aria-label={t(col.title)} className="flex flex-col gap-2.5">
                <h2 className="text-[13px] font-semibold">{t(col.title)}</h2>
                <ul className="flex flex-col gap-3 leading-[18px]">
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
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 pb-7 text-xs text-muted-foreground">
            <p>{t("copyright")}</p>
            <LanguageToggleLink />
          </div>
        </div>
      </Effect>
    </footer>
  )
}
