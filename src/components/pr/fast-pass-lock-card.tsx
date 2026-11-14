"use client"

import { CoinsIcon } from "@/components/animate-ui/icons/coins"
import { ChevronLeftIcon } from "@/components/animate-ui/icons/chevron-left"
import { ZapIcon } from "@/components/animate-ui/icons/zap"
import { useTranslations } from "@/i18n/translations"
import { daysUntilFree } from "@/components/pr/episode-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocalize } from "@/lib/localize"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * The Fast Pass card of a locked episode or chapter inside the readers (spec §3 / §4 "Locked", prototype
 * `.vw-lock-card` and `.nr-lock`): "Fast Pass", what it costs and when it is free, then one main action
 * (Log in to unlock / Unlock for N coins / Get coins · you need N more), "Unlock all N" when more than one
 * is locked, and back to the previous one. Presentational: the reader wires the actions (useSeriesUnlock).
 */
export function FastPassLockCard({
  kind,
  title,
  n,
  freeDate,
  price,
  coins,
  loggedIn,
  bundle,
  onLogin,
  onUnlock,
  onGetCoins,
  onUnlockAll,
  onBack,
  canGoBack,
  className,
}: {
  /** "episode": the comic card (h1, "… is in Fast Pass"); "chapter": the novel card under the teaser */
  kind: "episode" | "chapter"
  /** The episode title ("Episode 66"), already localized */
  title: string
  n: number
  /** Free release date ("Nov 12, 2026") */
  freeDate: string
  price: number
  coins: number
  loggedIn: boolean
  /** Fast Pass episodes still locked, when there are 2 or more; `cost` defaults to `count` × `price` */
  bundle: { count: number; cost?: number } | null
  onLogin: () => void
  onUnlock: () => void
  onGetCoins: () => void
  onUnlockAll: () => void
  onBack: () => void
  canGoBack: boolean
  className?: string
}) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const comic = kind === "episode"
  const need = Math.max(0, price - coins)
  const when = t("lockIn", { days: daysUntilFree({ date: freeDate }) })
  const Heading = comic ? "h1" : "h2"

  return (
    <Effect asChild fade zoom={{ initialScale: 0.97 }}>
      <div
        className={cn(
          "relative flex w-full flex-col items-center text-center",
          comic
            ? "max-w-[520px] gap-3.5 rounded-[14px] border bg-card/92 p-6 text-card-foreground max-md:p-[18px]"
            : "gap-3 rounded-card border bg-card p-6 text-reader-text",
          className
        )}
      >
        <Badge variant="warn">
          <ZapIcon className="size-3" aria-hidden />
          {t("fastPass")}
        </Badge>
        <Heading id="lock-title" className={comic ? "type-h2" : "type-h3"}>
          {comic ? t("lockTitle", { title }) : t("lockTitleChapter", { n })}
        </Heading>
        <p className={cn("text-[13px] leading-[18px]", comic ? "text-muted-foreground" : "text-reader-quiet")}>
          {t(comic ? "lockText" : "lockTextChapter", { price, date: loc.date(freeDate), in: when, coins })}
        </p>
        <div className={cn("flex w-full flex-col gap-2", comic ? "max-w-[360px]" : "max-w-[340px]")}>
          {!loggedIn ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onLogin}>
              {t("loginToUnlock")}
            </Button>
          ) : need === 0 ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onUnlock}>
              {t("unlockFor", { count: price })}
            </Button>
          ) : (
            <Button animateIcon variant="brand" size="lg" className="h-auto min-h-11 w-full py-2 whitespace-normal" onClick={onGetCoins}>
              <CoinsIcon aria-hidden />
              {t("getCoinsNeed", { count: need })}
            </Button>
          )}
          {bundle ? (
            <Button
              variant="outline"
              className={cn(
                "h-auto min-h-9 w-full py-2 whitespace-normal",
                comic ? "rounded-full border-input bg-secondary text-foreground shadow-none hover:bg-input" : "text-reader-text"
              )}
              onClick={onUnlockAll}
            >
              {t(comic ? "unlockAllEpisodes" : "unlockAllChapters", { count: bundle.count, cost: bundle.cost ?? bundle.count * price })}
            </Button>
          ) : null}
          <Button animateIcon variant="ghost" className={cn("w-full", !comic && "text-reader-text")} disabled={!canGoBack} onClick={onBack}>
            <ChevronLeftIcon aria-hidden />
            {comic ? t("backToEpisode", { n: n - 1 }) : t("prevChapter")}
          </Button>
        </div>
      </div>
    </Effect>
  )
}
