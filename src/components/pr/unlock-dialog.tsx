"use client"

import { CoinsIcon, InfoIcon, TriangleAlertIcon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { CoinIcon } from "@/components/pr/coin-icon"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRestoreFocus } from "@/lib/use-restore-focus"

export type UnlockState = "logged-out" | "enough" | "not-enough"

/**
 * Fast Pass unlock dialog. The state comes from props: not logged in, enough
 * coins, or not enough coins. "Wait for the free release" always closes it.
 * Presentational: T26 wires it to the store.
 */
export function UnlockDialog({
  open,
  onOpenChange,
  episode,
  kind = "episode",
  loggedIn,
  balance,
  price,
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
  price: number
  loading?: boolean
  onLogin?: () => void
  onUnlock?: () => void
  onGetCoins?: () => void
}) {
  const t = useTranslations("unlock")
  const tc = useTranslations("coins")
  const restoreFocus = useRestoreFocus()
  const state: UnlockState = !loggedIn ? "logged-out" : balance >= price ? "enough" : "not-enough"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...restoreFocus}>
        <DialogHeader className="flex-row items-start gap-4 pr-8">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-control bg-muted">
            <Image src={episode.thumb} alt="" width={128} height={128} className="size-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Badge variant="warn">
              <ZapIcon /> {t("fastPass")}
            </Badge>
            <DialogTitle>{t(kind === "chapter" ? "titleChapter" : "titleEpisode", { n: episode.n })}</DialogTitle>
            <DialogDescription>{t("freeOn", { date: episode.freeDate })}</DialogDescription>
          </div>
        </DialogHeader>

        <dl className="divide-y rounded-card border text-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted-foreground">{t("price")}</dt>
            <dd className="flex items-center gap-2 font-medium tabular-nums">
              <CoinIcon size={20} />
              {tc("balanceLabel", { count: price })}
            </dd>
          </div>
          {loggedIn ? (
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-muted-foreground">{t("balance")}</dt>
              <dd className="font-medium tabular-nums" aria-live="polite">
                {tc("balanceLabel", { count: balance })}
              </dd>
            </div>
          ) : null}
        </dl>

        {state === "logged-out" ? (
          <Alert role="status">
            <InfoIcon />
            <AlertTitle>{t("loginAlert")}</AlertTitle>
          </Alert>
        ) : null}
        {state === "not-enough" ? (
          <Alert variant="warning" role="status">
            <TriangleAlertIcon />
            <AlertTitle className="font-medium">{t("needMore", { count: price - balance })}</AlertTitle>
          </Alert>
        ) : null}

        <DialogFooter className="flex-col gap-1 sm:flex-col">
          {state === "logged-out" ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onLogin}>
              {t("login")}
            </Button>
          ) : null}
          {state === "enough" ? (
            <Button variant="brand" size="lg" className="w-full" loading={loading} onClick={onUnlock}>
              {t("unlockFor", { count: price })}
            </Button>
          ) : null}
          {state === "not-enough" ? (
            <Button variant="brand" size="lg" className="w-full" onClick={onGetCoins}>
              <CoinsIcon /> {t("getCoins")}
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
            {t("wait")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
