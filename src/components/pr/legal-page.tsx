"use client"

import { AlertCircleIcon, InfoIcon } from "lucide-react"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { POLICY_IDS } from "@/components/pr/legal-docs"
import { Chip } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { demoData, type PolicyId } from "@/data"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

const navItem =
  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Policies (spec §20, prototype Legal, screens 20-policies-*): side menu (a scrolling row under 1024 px), kind,
 * title, "Last updated", English / ខ្មែរ chips (Khmer: "coming before launch"), the draft-template warning for Terms,
 * Privacy and Refunds, "The short version", "On this page", numbered sections and a contact footer. The policy text
 * (demoData.policies) stays English in both locales until a professional translation exists; the page chrome is
 * translated.
 */
export function LegalPage({ doc }: { doc: PolicyId }) {
  const t = useTranslations("legal")
  const locale = useLocale()
  const policy = demoData.policies[doc]
  const navRef = useRef<HTMLElement>(null)

  // Phones and tablets: bring the current document's tab into view in the scrolling row (the page doesn't move).
  useEffect(() => {
    const nav = navRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2
  }, [doc])

  const english = locale === "en" ? undefined : "en"

  return (
    <div className="container grid items-start gap-5 pt-7 pb-16 lg:grid-cols-[220px_minmax(0,760px)] lg:gap-12">
      <nav
        ref={navRef}
        aria-label={t("nav")}
        className="flex min-w-0 gap-0.5 overflow-x-auto border-b pb-1.5 [scrollbar-width:none] lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0"
      >
        <span className="hidden px-3 pb-1.5 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase lg:block">
          {t("nav")}
        </span>
        {POLICY_IDS.map((id) => {
          const on = id === doc
          return (
            <Link
              key={id}
              href={`/legal/${id}`}
              aria-current={on ? "page" : undefined}
              className={cn(navItem, on && "bg-muted text-foreground hover:bg-muted")}
            >
              {t(`docs.${id}`)}
            </Link>
          )
        })}
        <hr className="my-2.5 hidden border-border lg:block" />
        <Link href="/help" className={cn(navItem, "hidden lg:flex")}>
          <InfoIcon className="size-3.5" aria-hidden />
          {t("helpCenter")}
        </Link>
      </nav>

      <article className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="type-eyebrow text-brand-ink" lang={english}>
            {policy.kind}
          </p>
          <h1 className="type-h1" lang={english}>
            {policy.title}
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">{t("updated")}</p>
          <div role="group" aria-label={t("language")} className="flex flex-wrap gap-1.5">
            <Chip selected onClick={() => {}} className="cursor-default">
              <span lang="en">{t("english")}</span>
            </Chip>
            <Chip selected={false} onClick={() => toast(t("kmSoon"))}>
              <span lang="km" className="font-khmer">
                ខ្មែរ
              </span>
            </Chip>
          </div>
        </header>

        {policy.tpl ? (
          <div role="note" className="flex items-start gap-3 rounded-[10px] border border-warning-border bg-warning-soft px-4 py-3.5 text-warning-ink">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col">
              <span className="text-sm leading-5 font-semibold">{t("draftTitle")}</span>
              <span className="text-[13px] leading-[19px]">{t("draftText")}</span>
            </div>
          </div>
        ) : null}

        <Effect asChild fade slide={{ direction: "up", offset: 8 }}>
          <section aria-labelledby="lg-short" className="rounded-xl border border-brand-soft-border bg-brand-soft px-5 py-[18px]">
            <h2 id="lg-short" className="type-h4">
              {t("short")}
            </h2>
            <ul lang={english} className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-[21px] text-[#27272a]">
              {policy.summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </Effect>

        <nav aria-labelledby="lg-toc">
          <p id="lg-toc" className="text-xs leading-4 font-semibold text-muted-foreground">
            {t("toc")}
          </p>
          <ol lang={english} className="mt-1.5 list-decimal gap-x-6 pl-5 text-sm leading-[26px] md:columns-2">
            {policy.sections.map(([h], i) => (
              <li key={h}>
                <a
                  href={`#lg-${i + 1}`}
                  className="rounded-sm text-brand-ink underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {h}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {policy.sections.map(([h, ps], i) => (
          <section key={h} id={`lg-${i + 1}`} aria-labelledby={`lg-${i + 1}-h`} lang={english} className="flex scroll-mt-20 flex-col gap-2.5">
            <h2 id={`lg-${i + 1}-h`} className="type-h3">
              {i + 1}. {h}
            </h2>
            {ps.map((p) => (
              <p key={p} className="m-0 max-w-[68ch] text-[15px] leading-[25px] text-[#3f3f46]">
                {p}
              </p>
            ))}
          </section>
        ))}

        <Effect asChild fade slide={{ direction: "up", offset: 8 }} inView>
          <footer className="flex items-center justify-between gap-3 rounded-card border bg-card p-5 shadow-xs max-md:flex-col max-md:items-start max-md:p-4">
            <p className="text-[13px] leading-[18px]">{t("footer")}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/help#contact">{t("contact")}</Link>
            </Button>
          </footer>
        </Effect>
      </article>
    </div>
  )
}
