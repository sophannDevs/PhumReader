"use client"

import { ArrowRightIcon, CheckIcon, ClockIcon, MessageSquareIcon, ShieldIcon, SmartphoneIcon, XIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useCallback, useEffect, useState } from "react"
import { type Flow, packTotal } from "@/components/pr/checkout-flow"
import { AutoHeight } from "@animate-ui/react/primitives/effects/auto-height"
import { Effect } from "@animate-ui/react/primitives/effects/effect"
import { Particles, ParticlesEffect } from "@animate-ui/react/primitives/effects/particles"
import type { Checkout } from "@/lib/api/coins"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CoinPack, PaymentMethod } from "@/data"
import { getSeriesBySlug } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { useAppStore, useCoins, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

export { packTotal }

/** Seconds before the success state takes the reader back to the locked episode. */
const AUTO_BACK_SECONDS = 5

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

/** Long labels (Khmer) wrap inside full-width buttons instead of overflowing. */
const wrapButton = "h-auto min-h-11 whitespace-normal py-2.5"

function Row({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 text-[13px] leading-[18px]", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}

/** Black-and-white QR-like graphic (prototype Shop `qr()`, 21×21). A placeholder: it encodes nothing. */
function QrPlaceholder({ label }: { label: string }) {
  const n = 21
  const finder = (x: number, y: number) => {
    for (const [cx, cy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ]) {
      const dx = x - cx
      const dy = y - cy
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return edge || core ? 1 : 0
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0
    }
    return -1
  }
  const cells: React.ReactNode[] = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      const on = f >= 0 ? f === 1 : (x * 7 + y * 13 + x * y) % 5 < 2
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} className="size-[180px] fill-foreground" shapeRendering="crispEdges">
      {cells}
    </svg>
  )
}

/** Dashed placeholder box (prototype `.placeholder`): ABA hand-off and the provider's card form. */
function PlaceholderBox({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#a1a1aa] bg-[#fafafa] p-4 text-center">
      <span className="text-[13px] font-bold tracking-[0.02em] text-[#3f3f46]">{title}</span>
      <span className="text-xs leading-4 text-muted-foreground">{hint}</span>
    </div>
  )
}

/** Card head (prototype `.card-head`): 20 px padding, 16 px on phones. */
const head = "flex flex-col gap-1 px-5 pt-5 max-md:px-4 max-md:pt-4"
const body = "flex flex-col p-5 max-md:p-4"

function SuccessPanel({ flow, onReset }: { flow: Extract<Flow, { step: "success" }>; onReset: () => void }) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  const router = useRouter()
  const shopReturn = useAppStore((s) => s.shopReturn)
  const [backIn, setBackIn] = useState(() => (shopReturn?.episode ? AUTO_BACK_SECONDS : 0))
  const novel = shopReturn?.novel ?? getSeriesBySlug(shopReturn?.page.split("?")[0].split("/")[2] ?? "")?.type === "novel"

  const goBack = useCallback(() => {
    const ret = useAppStore.getState().shopReturn
    if (!ret) return
    // Keep `pendingUnlock`: the series page reopens the unlock dialog for this episode.
    useAppStore.getState().clearShopReturn()
    router.push(ret.page)
  }, [router])

  useEffect(() => {
    if (backIn <= 0) return
    const id = setTimeout(() => {
      if (backIn === 1) {
        setBackIn(0)
        goBack()
      } else setBackIn(backIn - 1)
    }, 1000)
    return () => clearTimeout(id)
  }, [backIn, goBack])

  return (
    <div role="status" className="flex flex-col items-center gap-3 px-5 py-9 text-center">
      {/* The check zooms in, then a small ring of dots bursts out of it (Animate UI Particles). */}
      <Particles animate className="flex size-14 text-primary" aria-hidden>
        <Effect asChild fade zoom={{ initialScale: 0.4 }}>
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-[26px]" strokeWidth={2.5} aria-hidden />
          </span>
        </Effect>
        <ParticlesEffect side="top" align="center" sideOffset={-28} count={10} radius={40} duration={0.8} holdDelay={0.02} delay={0.25} className="size-2 rounded-full bg-primary" />
      </Particles>
      <h2 id="co-title" className="type-h2 tabular-nums">{t("successTitle", { count: flow.added })}</h2>
      <p className="text-[13px] leading-[18px] text-muted-foreground">
        {t.rich("successBody", {
          balance: t("balanceLabel", { count: flow.balance }),
          b: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
        })}
      </p>
      <span className="text-xs leading-4 text-muted-foreground">
        {t("orderLine", { id: flow.orderId, method: loc.method(flow.method, { label: flow.method, desc: "" }).label })}
      </span>
      {shopReturn ? (
        <Button variant="brand" size="lg" className={cn("w-full gap-1.5 px-4", wrapButton)} onClick={goBack}>
          {t(novel ? "backToChapter" : "backToEpisode", { n: shopReturn.episode, title: shopReturn.title })}
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Button>
      ) : null}
      {shopReturn && backIn > 0 ? (
        <p className="text-xs leading-4 text-muted-foreground">
          <span aria-live="off">{t("takingBack", { count: backIn })}</span>
          {" · "}
          <button
            type="button"
            onClick={() => setBackIn(0)}
            className="rounded-sm font-semibold text-brand-ink underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t("stayHere")}
          </button>
        </p>
      ) : null}
      <Button variant="outline" className={cn("w-full", "h-auto min-h-9 whitespace-normal py-2")} onClick={onReset}>
        {t("buyMore")}
      </Button>
    </div>
  )
}

/**
 * The checkout card (prototype Shop `aside.sh-co`): Order summary with trust notes, Pay (countdown, KHQR /
 * ABA / card placeholders), Confirming, Success (+N coins, back to the episode after 5 s with "Stay here") and
 * Failed / expired. Never has real card fields.
 */
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
  className,
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
  className?: string
}) {
  const t = useTranslations("coins")
  const loc = useLocalize()
  const methodName = loc.method(method.id, method).label
  const router = useRouter()
  const user = useUser()
  const balance = useCoins()
  const total = packTotal(pack, offer)

  function proceed() {
    if (!user) {
      // Back here after logging in; the pack and method stay in `checkoutDraft`.
      useAppStore.getState().setReturnTo("/coins")
      router.push("/login")
      return
    }
    onContinue()
  }

  let content: React.ReactNode
  if (flow.step === "confirming") {
    content = (
      <div role="status" className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <span
          aria-hidden
          className="size-7 animate-spin rounded-full border-2 border-brand-ink border-r-transparent motion-reduce:animate-[spin_2s_linear_infinite]"
        />
        <h2 id="co-title" className="type-h3">{t("confirming")}</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">{t("confirmingSub")}</p>
      </div>
    )
  } else if (flow.step === "success") {
    content = <SuccessPanel flow={flow} onReset={onReset} />
  } else if (flow.step === "failed") {
    const expired = flow.reason === "expired"
    content = (
      <div role="alert" className="flex flex-col items-center gap-3 px-5 py-9 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <XIcon className="size-[26px]" strokeWidth={2.5} aria-hidden />
        </span>
        <h2 id="co-title" className="type-h3">{t(expired ? "expiredTitle" : "failTitle")}</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {expired ? t("expiredBody", { minutes: expiryMinutes }) : t("failBody")}
        </p>
        <Button variant="brand" className={cn("w-full", "h-auto min-h-9 whitespace-normal py-2")} onClick={onContinue}>
          {t("tryAgain")}
        </Button>
        <Button variant="ghost" className={cn("w-full", "h-auto min-h-9 whitespace-normal py-2")} onClick={onReset}>
          {t("chooseOther")}
        </Button>
      </div>
    )
  } else if (flow.step === "pay") {
    const kind = method.id
    content = (
      <>
        <div className={head}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="co-title" className="type-h3">
              {t(kind === "khqr" ? "payTitleKhqr" : kind === "aba" ? "payTitleAba" : "payTitleCard")}
            </h2>
            <Badge variant="outline" role="timer" aria-live="off" className="tabular-nums">
              <ClockIcon className="size-3" aria-hidden />
              <span className="sr-only">{t("expiresIn")} </span>
              {mmss(remaining)}
            </Badge>
          </div>
          <p className="text-[13px] leading-[18px] text-muted-foreground tabular-nums">{t("paySub", { coins: total, method: methodName })}</p>
        </div>
        <div className={cn(body, "gap-3.5")}>
          {checkout?.formAction && checkout.formFields ? (
            // PayWay's own page takes the payment (and the card number): PhumiReader never sees it.
            <form action={checkout.formAction} method="post" target="_blank" className="flex flex-col items-center gap-3 rounded-card border px-4 py-6 text-center">
              {Object.entries(checkout.formFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <p className="type-caption font-normal text-muted-foreground">{t("cardRedirectHint")}</p>
              <Button type="submit" variant="brand" size="lg" className={cn("w-full", wrapButton)}>
                {t("payNow")}
              </Button>
            </form>
          ) : kind === "khqr" ? (
            <>
              <div className="flex flex-col items-center gap-2 overflow-hidden rounded-[10px] border bg-white px-4 pb-4">
                <div className="-mx-4 mb-1 self-stretch bg-destructive py-2 text-center text-[13px] font-extrabold tracking-[0.08em] text-destructive-foreground">
                  {t("khqrBadge")}
                </div>
                {checkout?.qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a data: image from PayWay
                  <img src={checkout.qrImage} alt={t("qrAlt")} className="size-52 bg-white p-1" />
                ) : (
                  <>
                    <QrPlaceholder label={t("khqrCode")} />
                    <span className="text-xs leading-4 text-muted-foreground">{t("khqrPlaceholder")}</span>
                  </>
                )}
                <span className="type-h4 tabular-nums">{checkout ? pack.priceUSD : pack.priceKHR}</span>
              </div>
              <ol className="m-0 list-decimal pl-[18px] text-xs leading-5 text-muted-foreground">
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
            <PlaceholderBox title={t("abaPlaceholder")} hint={t("abaHint")} />
          ) : (
            <PlaceholderBox title={t("cardPlaceholder")} hint={t("cardHint")} />
          )}
          {checkout ? (
            <p className="text-center text-[13px] leading-[18px] text-muted-foreground" aria-live="polite">
              {t("waitingPayment")}
            </p>
          ) : (
            <Button variant="brand" size="lg" className={cn("w-full", wrapButton)} onClick={() => onSubmit("success")}>
              {t(kind === "card" ? "payNow" : "paid")}
            </Button>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
            {canSimulate && !checkout ? (
              <Button variant="ghost" size="sm" className="h-auto min-h-8 whitespace-normal text-right" onClick={() => onSubmit("failed")}>
                {t("simulateFail")}
              </Button>
            ) : null}
          </div>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <div className={head}>
          <h2 id="co-title" className="type-h3">
            {t("orderSummary")}
          </h2>
        </div>
        <div className={cn(body, "gap-2.5")}>
          <dl className="m-0 flex flex-col gap-2.5">
            <Row label={t("packLine", { coins: pack.coins })} value={t("balanceLabel", { count: pack.coins })} />
            {pack.bonus > 0 ? <Row label={t("packBonus")} value={<span className="text-brand-ink">+<Num>{pack.bonus}</Num></span>} /> : null}
            {offer ? <Row label={t("firstBonus")} value={<span className="text-brand-ink">+<Num>{pack.coins}</Num></span>} /> : null}
            <div className="h-px bg-border" aria-hidden />
            <div className="flex items-center justify-between gap-4">
              <dt className="type-h4">{t("youGet")}</dt>
              <dd className="type-h4 tabular-nums">{t("balanceLabel", { count: total })}</dd>
            </div>
            <Row
              label={t("total")}
              className="items-center"
              value={
                <span className="flex flex-col items-end font-semibold">
                  <span>{pack.priceUSD}</span>
                  <span className="text-xs leading-4 font-normal text-muted-foreground">{pack.priceKHR}</span>
                </span>
              }
            />
            <Row label={t("payingWith")} value={<span className="text-foreground">{methodName}</span>} />
          </dl>
          <Button variant="brand" size="lg" className={cn("mt-2 w-full", wrapButton)} loading={starting} disabled={starting} onClick={proceed}>
            {t("continuePay")}
          </Button>
          <p className="text-center text-xs leading-4 text-muted-foreground tabular-nums">
            {t("balanceAfter", { count: balance + total })}
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-2 border-t p-0 pt-3">
            {(
              [
                [ShieldIcon, "trustSecure"],
                [ClockIcon, "trustExpire"],
                [MessageSquareIcon, "trustHelp"],
              ] as const
            ).map(([Icon, key]) => (
              <li key={key} className="flex items-start gap-2 text-xs leading-[17px] text-muted-foreground">
                <Icon className="mt-px size-3.5 shrink-0 text-brand-ink" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </>
    )
  }

  return (
    <aside
      aria-labelledby="co-title"
      aria-live="polite"
      className={cn("min-w-0 rounded-card border bg-card shadow-xs lg:sticky lg:top-20", className)}
    >
      {/* The card eases to the height of the next step instead of jumping. */}
      <AutoHeight deps={[flow.step, method.id]}>{content}</AutoHeight>
    </aside>
  )
}
