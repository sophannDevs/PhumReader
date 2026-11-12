"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import "./globals.css"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import { useEffect, useState, useSyncExternalStore } from "react"
import { ErrorArt } from "@/components/pr/error-art"
import { reportError } from "@/lib/error-report"
import en from "@/messages/en/errors.json"
import km from "@/messages/km/errors.json"

const noSubscribe = () => () => {}
const pathLocale = () => (/^\/km(\/|$)/.test(window.location.pathname) ? "km" : "en")

/**
 * Last resort: replaces the root layout (so no fonts, providers or site chrome), shown when the layout itself fails.
 * The 500 page in its simplest form: illustration, "Error 500", English / ខ្មែរ toggle (local), Try again, Go to Home.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error)
  }, [error])
  const fromPath = useSyncExternalStore(noSubscribe, pathLocale, () => "en" as const)
  const [picked, setPicked] = useState<"en" | "km" | null>(null)
  const lang = picked ?? fromPath
  const t = lang === "km" ? km : en
  const home = lang === "km" ? "/km" : "/"
  const button =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-[22px] text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4"

  return (
    <html lang={lang}>
      <body className="min-h-svh bg-[#fafafa] font-sans text-foreground antialiased">
        <main className="flex min-h-svh items-center bg-[image:radial-gradient(1200px_400px_at_20%_0%,#effcf4_0%,rgba(239,252,244,0)_70%)]">
          <div className="container">
            <div className="mx-auto grid max-w-[976px] grid-cols-[minmax(0,1fr)] items-center gap-5 py-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-9 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14">
              <div className="flex h-[150px] w-full items-center justify-center rounded-[18px] border bg-white shadow-md md:h-[220px] md:w-60 md:rounded-3xl lg:h-[280px] lg:w-80">
                <ErrorArt kind="server" className="h-auto w-[150px] max-w-full md:w-[240px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-[22px] items-center rounded-badge bg-up px-2 text-xs font-semibold text-up-foreground">
                    {t.codes.server}
                  </span>
                  <div role="group" aria-label={t.language} className="inline-flex gap-0.5 rounded-full bg-muted p-[3px]">
                    {(["en", "km"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        lang={l}
                        aria-pressed={l === lang}
                        onClick={() => setPicked(l)}
                        className={
                          "h-7 rounded-full px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                          (l === lang ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]" : "text-muted-foreground")
                        }
                      >
                        {l === "en" ? "English" : "ខ្មែរ"}
                      </button>
                    ))}
                  </div>
                </div>
                <h1 className="m-0 text-[28px] leading-[34px] font-extrabold tracking-[-0.03em] md:text-[40px] md:leading-[46px]">
                  {t.server.title}
                </h1>
                <p className="m-0 max-w-[52ch] text-[15px] leading-6 text-muted-foreground md:text-base md:leading-[26px]">{t.server.body}</p>
                <div className="flex flex-wrap gap-2 pt-1 max-md:[&>*]:flex-auto">
                  <AnimateIcon asChild animateOnHover><button type="button" onClick={reset} className={`${button} bg-primary font-semibold text-primary-foreground hover:bg-primary-hover`}>
                    <RefreshCwIcon aria-hidden />
                    {t.retry}
                  </button></AnimateIcon>
                  {/* A full page load: the app's own navigation may be what failed. */}
                  <AnimateIcon asChild animateOnHover><a href={home} className={`${button} border bg-background shadow-xs hover:bg-accent`}>
                    <HomeIcon aria-hidden />
                    {t.home}
                  </a></AnimateIcon>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
