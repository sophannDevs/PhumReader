"use client"

import { WalletIcon as CoinsIcon } from "@/components/animate-ui/icons/wallet"
import { CircleAlertIcon } from "@/components/animate-ui/icons/circle-alert"
import { InfoIcon } from "@/components/animate-ui/icons/info"
import { ZapIcon } from "@/components/animate-ui/icons/zap"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { CoinIcon } from "@/components/pr/coin-icon"
import { daysUntilFree } from "@/components/pr/episode-row"
import { OptionCard } from "@/components/pr/patterns"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { useLocalize } from "@/lib/localize"

export type UnlockState = "logged-out" | "enough" | "not-enough"
export type UnlockMode = "one" | "all"

/**
 * The Fast Pass episodes still locked, when there are 2 or more ("All 3 Fast Pass episodes"). `cost`: what they cost
 * together (real API: each at its own price); without it, `count` × the dialog's `price`.
 */
export type UnlockBundle = { count: number; first: number; last: number; lastDate: string; cost?: number }

/**
 * Fast Pass unlock dialog (spec §2, screens 02-series-unlock-dialog-*): this episode or, with a `bundle`, every
 * locked Fast Pass episode (OptionCard choice). Shows the price, the balance and what is left "after unlocking".
 * Logged out → Log in to unlock; short of coins → "You need N more coins" → Get coins. "Wait for the free release"
 * closes it. Presentational: `useSeriesUnlock` (series-unlock.tsx) owns the state and the hand-offs.
 */
export function UnlockDialog({
  open,
  onOpenChange,
  episode,
  kind = "episode",
  loggedIn,
  balance,
  price,
  bundle,
  mode = "one",
  onModeChange,
  loading = false,
  onLogin,
  onUnlock,
  onGetCoins,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  episode: { n: number; thumb: string; freeDate: string }
  /** "chapter" for web novels */
  kind?: "episode" | "chapter"
  loggedIn: boolean
  balance: number
  /** Coins for this episode */
  price: number
  bundle?: UnlockBundle | null
  mode?: UnlockMode
  onModeChange?: (mode: UnlockMode) => void
  loading?: boolean
  onLogin?: () => void
  onUnlock?: () => void
  onGetCoins?: () => void
}) {
  const t = useTranslations("unlock")
  const loc = useLocalize()
  const restoreFocus = useRestoreFocus()
  const all = mode === "all" && !!bundle
  const count = all ? bundle.count : 1
  const bundleCost = bundle ? (bundle.cost ?? bundle.count * price) : 0
  const cost = all ? bundleCost : price
  const state: UnlockState = !loggedIn ? "logged-out" : balance >= cost ? "enough" : "not-enough"
  const chapter = kind === "chapter"
  const freeDate = all ? bundle.lastDate : episode.freeDate
  const inDays = t("inDays", { days: daysUntilFree({ date: freeDate }) })

  const coinCost = (n: number) => (
    <span className="flex items-center gap-[5px] text-[13px] font-semibold tabular-nums">
      <CoinIcon size={16} />
      {n}
    </span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...restoreFocus} className="max-h-[calc(100dvh-32px)] overflow-y-auto">
        <div className="flex items-start gap-3.5 pr-8">
          <Image src={episode.thumb} alt="" width={128} height={128} sizes="64px" className="size-16 shrink-0 rounded-lg bg-muted object-cover" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Badge variant="warn">
              <ZapIcon className="size-3" aria-hidden />
              {t("fastPass")}
            </Badge>
            <DialogTitle className="type-h3">
              {all
                ? t(chapter ? "titleAllChapters" : "titleAllEpisodes", { count })
                : t(chapter ? "titleChapter" : "titleEpisode", { n: episode.n })}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">
              {all
                ? t("freeBy", { date: loc.date(freeDate), in: inDays })
                : t("freeOn", { date: loc.date(freeDate), in: inDays })}
            </DialogDescription>
          </div>
        </div>

        {bundle ? (
          <div role="radiogroup" aria-label={t("whatToUnlock")} className="flex flex-col gap-2">
            <OptionCard
              selected={!all}
              onSelect={() => onModeChange?.("one")}
              className="items-center gap-3"
              title={<span className="text-[13px] font-semibold">{t(chapter ? "justChapter" : "justEpisode", { n: episode.n })}</span>}
              description={t("freeIn", { days: daysUntilFree({ date: episode.freeDate }) })}
              aside={coinCost(price)}
            />
            <OptionCard
              selected={all}
              onSelect={() => onModeChange?.("all")}
              className="items-center gap-3"
              title={<span className="text-[13px] font-semibold">{t(chapter ? "allChapters" : "allEpisodes", { count: bundle.count })}</span>}
              description={t(chapter ? "rangeChapters" : "rangeEpisodes", { first: bundle.first, last: bundle.last })}
              aside={coinCost(bundleCost)}
            />
          </div>
        ) : null}

        <dl className="divide-y rounded-card border text-[13px]">
          <div className="flex items-center justify-between px-3.5 py-3">
            <dt className="text-muted-foreground">{t("price")}</dt>
            <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
              <CoinIcon size={16} className="size-[18px] text-[10px]" />
              {t("coins", { count: cost })}
            </dd>
          </div>
          {loggedIn ? (
            <div className="flex items-center justify-between px-3.5 py-3">
              <dt className="text-muted-foreground">{t("balance")}</dt>
              <dd className="font-semibold tabular-nums" aria-live="polite">
                {t("coins", { count: balance })}
              </dd>
            </div>
          ) : null}
          {state === "enough" ? (
            <div className="flex items-center justify-between px-3.5 py-3">
              <dt className="text-muted-foreground">{t("after")}</dt>
              <dd className="font-semibold tabular-nums">{t("coins", { count: balance - cost })}</dd>
            </div>
          ) : null}
        </dl>

        {state === "logged-out" ? (
          <Alert role="status">
            <InfoIcon className="text-muted-foreground" />
            <AlertTitle className="text-[13px] leading-[19px] font-normal">{t(chapter ? "loginAlertChapters" : "loginAlert")}</AlertTitle>
          </Alert>
        ) : null}
        {state === "not-enough" ? (
          <Alert variant="warning" role="status">
            <CircleAlertIcon />
            <AlertTitle className="text-[13px] leading-[19px] font-normal">{t("needMore", { count: cost - balance })}</AlertTitle>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-4">
          {state === "logged-out" ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onLogin}>
              {t("login")}
            </Button>
          ) : null}
          {state === "enough" ? (
            <Button variant="brand" size="lg" className="w-full" loading={loading} onClick={onUnlock}>
              {all ? t(chapter ? "unlockAllChaptersFor" : "unlockAllFor", { count, cost }) : t("unlockFor", { count: cost })}
            </Button>
          ) : null}
          {state === "not-enough" ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onGetCoins}>
              <CoinsIcon /> {t("getCoins")}
            </Button>
          ) : null}
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            {t("wait")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
