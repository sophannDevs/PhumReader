import { BellIcon, BookmarkIcon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { AuthCardTop } from "@/components/auth/auth-card-top"
import { demoData } from "@/data"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/** The three covers at the bottom of the mint panel (prototype: Glass Compass, Letters to Tuesday, Tiny Dragon Café). */
const ART = ["Glass Compass", "Letters to Tuesday", "Tiny Dragon Café"].flatMap((title) =>
  demoData.series.filter((s) => s.title === title)
)

const PERKS = [
  { icon: BookmarkIcon, key: "perk1" },
  { icon: BellIcon, key: "perk2" },
  { icon: ZapIcon, key: "perk3" },
] as const

/**
 * V2.1 Log in / Sign up shell (design/prototype-src/Auth): a grey band under the site header with the mint
 * brand panel (desktop and tablet) and the 460 px card (420 px under 1024 px). Phones show the card only.
 * The card starts with the context line and the English / ខ្មែរ toggle; `children` is the current step.
 */
export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth")

  return (
    <div className="flex-1 bg-[#fafafa] pt-10 pb-16 max-md:pt-4 max-md:pb-8">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-[minmax(0,1fr)_460px] items-stretch gap-7 px-8 max-lg:grid-cols-[minmax(0,1fr)_420px] max-lg:px-6 max-md:grid-cols-1 max-md:px-4">
        <Effect asChild fade slide={{ direction: "up", offset: 12 }}>
          <section
            aria-labelledby="auth-panel-title"
            className="flex min-h-[560px] flex-col justify-between gap-8 overflow-hidden rounded-[20px] border border-[#c9f1da] bg-[linear-gradient(160deg,#e8fbf0_0%,#d9f7e6_100%)] p-10 max-md:hidden"
          >
            <div className="flex flex-col gap-3.5">
              <span className="type-eyebrow">{t("panelEyebrow")}</span>
              <h2 id="auth-panel-title" className="m-0 max-w-[15ch] text-4xl leading-[44px] font-extrabold tracking-[-0.03em]">
                {t("panelTitle")}
              </h2>
              <p className="max-w-[44ch] text-[15px] leading-6 text-[#3f3f46]">{t("panelSub")}</p>
              <ul className="mt-1.5 flex flex-col gap-2.5">
                {PERKS.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-center gap-2.5 text-sm leading-5 text-[#27272a]">
                    <span
                      aria-hidden
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-ink shadow-xs"
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden className="flex items-end gap-3.5">
              {ART.map((s, i) => (
                <Image
                  key={s.id}
                  src={s.cover}
                  alt=""
                  width={120}
                  height={160}
                  sizes="120px"
                  className={
                    "aspect-[3/4] w-[120px] rounded-xl object-cover shadow-[0_10px_24px_rgba(4,33,15,0.16)] max-lg:w-24" +
                    (i === 1 ? " mb-7" : i === 2 ? " rotate-3" : "")
                  }
                />
              ))}
            </div>
          </section>
        </Effect>

        <Effect asChild fade slide={{ direction: "up", offset: 12 }} delay={80}>
          <section
            aria-labelledby="auth-title"
            className="flex min-w-0 flex-col gap-[18px] rounded-[20px] border bg-background p-7 shadow-md max-md:rounded-2xl max-md:px-4 max-md:py-5 max-md:shadow-xs"
          >
            <AuthCardTop />
            {children}
          </section>
        </Effect>
      </div>
    </div>
  )
}
