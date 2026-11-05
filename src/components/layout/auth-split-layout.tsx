import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { AuthBackLink } from "@/components/auth/auth-back-link"
import { SkipLink } from "@/components/layout/skip-link"
import { LanguageSwitch } from "@/components/layout/language-switch"
import { Logo } from "@/components/layout/logo"
import { demoData } from "@/data"
import type { Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"

const COLLAGE_COVERS = demoData.series.slice(0, 16)

/** "Chan Sreyleak, creator of Lantern Alley" -> name + series (series is italic). */
function splitByline(by: string) {
  const [name, series] = by.split(", creator of ")
  return { name, series }
}

/**
 * Login / sign-up shell. Desktop: left 46% dark panel (rotated cover collage,
 * white logo, creator quote) and a right column with "Back to PhumReader", the
 * EN / ខ្មែរ switch and the centred 380 px form. Phone: logo + language switch,
 * then the form only.
 */
export function AuthSplitLayout({
  children,
  backHref = "/",
  className,
}: {
  children: React.ReactNode
  /** Where "Back to PhumReader" goes: `returnTo` or `/` (T19 / T35 pass it). */
  backHref?: string
  className?: string
}) {
  const locale = useLocale() as Locale
  const t = useTranslations("auth")
  const byline = splitByline(demoData.authQuote.by)

  return (
    <div className={cn("grid min-h-svh md:grid-cols-[46fr_54fr]", className)}>
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface p-10 text-surface-foreground md:flex">
        {/* Decorative collage: empty alt, hidden from assistive tech. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -inset-[18%] grid -rotate-[8deg] grid-cols-4 gap-4 opacity-55">
            {COLLAGE_COVERS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "aspect-[3/4] overflow-hidden rounded-2xl bg-surface-panel",
                  i % 2 === 1 && "translate-y-14"
                )}
              >
                <Image src={s.cover} alt="" width={240} height={320} sizes="(min-width: 1024px) 15vw, 0px" className="size-full object-cover" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/20 to-surface" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
        </div>

        <div className="relative">
          <Logo size="header" tone="light" />
        </div>

        <figure className="relative flex flex-col gap-3">
          <blockquote className="max-w-md text-2xl leading-8 font-medium tracking-tight text-balance">
            “{t("quote")}”
          </blockquote>
          <figcaption className="type-small font-normal text-surface-quiet">
            — {byline.name}
            {byline.series ? (
              <>
                , creator of <i>{byline.series}</i>
              </>
            ) : null}
          </figcaption>
        </figure>
      </aside>

      <main id="main" tabIndex={-1} className="flex min-w-0 flex-col px-4 py-4 outline-none md:px-10 md:py-6">
        <SkipLink />
        <div className="flex items-center justify-between">
          <Logo size="header" className="md:hidden" />
          <AuthBackLink fallbackHref={backHref} label={t("back")} lang={locale} />
          <LanguageSwitch variant="segmented" />
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col pt-10 pb-10 md:pt-20">
          {children}
          <p lang={locale} className="type-small mt-5 text-center font-normal text-muted-foreground">
            {t("legal")}
          </p>
        </div>
      </main>
    </div>
  )
}
