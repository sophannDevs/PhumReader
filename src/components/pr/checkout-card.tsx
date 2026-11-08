"use client"

import { CheckIcon, ClockIcon, SmartphoneIcon, XIcon } from "lucide-react"
import { ArrowRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useLocalize } from "@/lib/localize"
import { type Flow, packTotal } from "@/components/pr/checkout-flow"
import type { Checkout } from "@/lib/api/coins"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CoinPack, PaymentMethod } from "@/data"
import { getSeriesBySlug } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useAppStore, useCoins, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"

export { packTotal }

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 text-sm", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

/** Black-and-white QR-like graphic. A placeholder: it does not encode anything. */
function QrPlaceholder() {
  const size = 25
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" />
      <rect x="1" y="1" width="5" height="5" className="fill-white" />
      <rect x="2" y="2" width="3" height="3" />
    </g>
  )
  const cells: React.ReactNode[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)
      if (!inFinder && (x * 7 + y * 13 + x * y) % 5 < 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR" className="size-40 fill-foreground" shapeRendering="crispEdges">
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
      {cells}
    </svg>
  )
}

/** The checkout card: Review, Pay, Confirming, Success and Failed. Never has real card fields. */
export function CheckoutCard({
  flow,
  remaining,
  pack,
  method,
  offer,
  expiryMinutes,
  onContinue,
  onCancel,
  onSubmit,
  onReset,
  starting = false,
  canSimulate = true,
  checkout = null,
}: {
  flow: Flow
  remaining: number
  pack: CoinPack
  method: PaymentMethod
  offer: boolean
  expiryMinutes: number
  onContinue: () => void
  onCancel: () => void
  onSubmit: (outcome: "success" | "failed") => void
  onReset: () => void
  /** An order is being created. */
  starting?: boolean
  /** Shows the "simulate failure" button (the demo and the dev simulator). */
  canSimulate?: boolean
  /** Real API with ABA PayWay: the real QR code, app link or card form. */
  checkout?: Checkout | null
}) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  const methodName = loc.method(method.id, method).label
  const router = useRouter()
  const user = useUser()
  const balance = useCoins()
  const shopReturn = useAppStore((s) => s.shopReturn)
  const total = packTotal(pack, offer)
  const card = "rounded-card border bg-card p-6 shadow-xs"

  function proceed() {
    if (!user) {
      // Back here after logging in; the pack and method stay in `checkoutDraft`.
      useAppStore.getState().setReturnTo("/coins")
      router.push("/login")
      return
    }
    onContinue()
  }

  if (flow.step === "confirming") {
    return (
      <section aria-live="polite" className={cn(card, "flex min-h-72 flex-col items-center justify-center gap-4 text-center")}>
        <span className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden />
        <p className="type-body text-muted-foreground">{t("confirming")}</p>
      </section>
    )
  }

  if (flow.step === "success") {
    const slug = shopReturn?.page.split("/").pop() ?? ""
    const novel = getSeriesBySlug(slug)?.type === "novel"
    return (
      <section aria-live="polite" className={cn(card, "flex flex-col items-center gap-3 py-8 text-center")}>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-7" strokeWidth={3} />
        </span>
        <h2 className="text-2xl font-bold tracking-tight tabular-nums">{t("successTitle", { count: flow.added })}</h2>
        <p className="type-body text-muted-foreground">
          {t("successBody", { balance: t("balanceLabel", { count: flow.balance }) })}
        </p>
        <p className="type-caption font-normal text-muted-foreground">{t("orderLine", { id: flow.orderId, method: loc.method(flow.method, { label: flow.method, desc: "" }).label })}</p>
        <div className="mt-2 flex w-full flex-col gap-2">
          {shopReturn ? (
            <Button
              variant="brand"
              size="lg"
              onClick={() => {
                // Keep `pendingUnlock` so the unlock dialog reopens on the episode page.
                useAppStore.getState().clearShopReturn()
                router.push(shopReturn.page)
              }}
            >
              {t(novel ? "backToChapter" : "backToEpisode", { n: shopReturn.episode, title: shopReturn.title })}
              <ArrowRightIcon />
            </Button>
          ) : null}
          <Button variant="outline" size="lg" onClick={onReset}>
            {t("buyMore")}
          </Button>
        </div>
      </section>
    )
  }

  if (flow.step === "failed") {
    const expired = flow.reason === "expired"
    return (
      <section role="alert" className={cn(card, "flex flex-col items-center gap-3 py-8 text-center")}>
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <XIcon className="size-7" strokeWidth={3} />
        </span>
        <h2 className="type-h2">{t(expired ? "expiredTitle" : "failTitle")}</h2>
        <p className="type-body text-muted-foreground">{expired ? t("expiredBody", { minutes: expiryMinutes }) : t("failBody")}</p>
        <div className="mt-2 flex w-full flex-col gap-2">
          <Button variant="brand" size="lg" onClick={onContinue}>
            {t("tryAgain")}
          </Button>
          <Button variant="outline" size="lg" onClick={onReset}>
            {t("chooseOther")}
          </Button>
        </div>
      </section>
    )
  }

  if (flow.step === "pay") {
    const kind = method.id
    return (
      <section aria-labelledby="pay-title" className={card}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="pay-title" className="type-h2">
            {t(kind === "khqr" ? "payTitleKhqr" : kind === "aba" ? "payTitleAba" : "payTitleCard")}
          </h2>
          <Badge variant="outline" className="gap-1 tabular-nums" role="timer" aria-live="polite" aria-label={t("expiresIn", { time: mmss(remaining) })}>
            <ClockIcon />
            {mmss(remaining)}
          </Badge>
        </div>
        <p className="type-small mt-1 font-normal text-muted-foreground tabular-nums">
          {t("paySub", { coins: total, method: methodName })}
        </p>

        <div className="mt-4">
          {checkout?.formAction && checkout.formFields ? (
            // PayWay's own page takes the payment (and the card number): PhumReader never sees it.
            <form action={checkout.formAction} method="post" target="_blank" className="flex flex-col items-center gap-3 rounded-card border px-4 py-6 text-center">
              {Object.entries(checkout.formFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <p className="type-caption font-normal text-muted-foreground">{t("cardRedirectHint")}</p>
              <Button type="submit" variant="brand" size="lg" className="w-full">
                {t("payNow")}
              </Button>
            </form>
          ) : kind === "khqr" ? (
            <>
              <div className="overflow-hidden rounded-card border text-center">
                <div className="bg-destructive py-2 text-sm font-bold tracking-wide text-destructive-foreground">{t("khqrBadge")}</div>
                <div className="flex flex-col items-center gap-1.5 px-4 py-4">
                  {checkout?.qrImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a data: image from PayWay
                    <img src={checkout.qrImage} alt={t("qrAlt")} className="size-52 bg-white p-1" />
                  ) : (
                    <>
                      <QrPlaceholder />
                      <p className="type-caption font-normal text-muted-foreground">{t("khqrPlaceholder")}</p>
                    </>
                  )}
                  <p className="text-base font-semibold">{checkout ? pack.priceUSD : pack.priceKHR}</p>
                </div>
              </div>
              <ol className="type-caption mt-3 list-decimal space-y-1 pl-5 font-normal text-muted-foreground">
                <li>{t("khqrStep1")}</li>
                <li>{t("khqrStep2")}</li>
                <li>{t("khqrStep3")}</li>
              </ol>
            </>
          ) : kind === "aba" && checkout?.abaDeeplink ? (
            <div className="flex flex-col items-center gap-3 rounded-card border px-4 py-6 text-center">
              <SmartphoneIcon className="size-8 text-muted-foreground" aria-hidden />
              <Button asChild variant="brand" size="lg" className="w-full">
                <a href={checkout.abaDeeplink}>{t("openAba")}</a>
              </Button>
              <p className="type-caption font-normal text-muted-foreground">{t("abaOpenHint")}</p>
              {checkout.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a data: image from PayWay
                <img src={checkout.qrImage} alt={t("qrAlt")} className="size-40 bg-white p-1" />
              ) : null}
            </div>
          ) : kind === "aba" ? (
            <div className="flex flex-col items-center gap-2 rounded-card border border-dashed px-4 py-8 text-center">
              <SmartphoneIcon className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">{t("abaPlaceholder")}</p>
              <p className="type-caption font-normal text-muted-foreground">{t("abaHint")}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 rounded-card border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-semibold">{t("cardPlaceholder")}</p>
              <p className="type-caption font-normal text-muted-foreground">{t("cardHint")}</p>
            </div>
          )}
        </div>

        {checkout ? (
          <p className="type-small mt-4 text-center font-normal text-muted-foreground" aria-live="polite">
            {t("waitingPayment")}
          </p>
        ) : (
          <Button variant="brand" size="lg" className="mt-4 w-full" onClick={() => onSubmit("success")}>
            {t(kind === "card" ? "payNow" : "paid")}
          </Button>
        )}
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
          {canSimulate && !checkout ? (
            <Button variant="ghost" size="sm" onClick={() => onSubmit("failed")}>
              {t("simulateFail")}
            </Button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="order-title" className={card}>
      <h2 id="order-title" className="type-h2">
        {t("orderSummary")}
      </h2>
      <dl className="mt-5 flex flex-col gap-3">
        <Row label={t("packLine", { coins: pack.coins })} value={t("balanceLabel", { count: pack.coins })} className="text-foreground" />
        {pack.bonus > 0 ? <Row label={t("packBonus")} value={<span className="text-brand-ink">+{pack.bonus}</span>} /> : null}
        {offer ? <Row label={t("firstBonus")} value={<span className="text-brand-ink">+{pack.coins}</span>} /> : null}
        <div className="flex items-center justify-between gap-4 border-t pt-3 text-base font-semibold">
          <dt>{t("youGet")}</dt>
          <dd className="tabular-nums">{t("balanceLabel", { count: total })}</dd>
        </div>
        <Row
          label={t("total")}
          value={
            <span className="flex flex-col items-end">
              <span className="font-semibold">{pack.priceUSD}</span>
              <span className="type-caption font-normal text-muted-foreground">{pack.priceKHR}</span>
            </span>
          }
        />
        <Row label={t("payingWith")} value={methodName} className="[&_dd]:text-foreground" />
      </dl>
      <Button variant="brand" size="lg" className="mt-6 w-full" disabled={starting} onClick={proceed}>
        {t("continuePay")}
      </Button>
      <p className="type-small mt-3 text-center font-normal text-muted-foreground tabular-nums">
        {t("balanceAfter", { count: balance + total })}
      </p>
    </section>
  )
}
