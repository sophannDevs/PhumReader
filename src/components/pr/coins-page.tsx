"use client"

import { GiftIcon, ZapIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { CheckoutCard } from "@/components/pr/checkout-card"
import { type Flow, packTotal, useCheckout } from "@/components/pr/checkout-flow"
import { CoinIcon } from "@/components/pr/coin-icon"
import { CoinsFaq } from "@/components/pr/coins-faq"
import { ErrorState } from "@/components/pr/error-state"
import { PackCard } from "@/components/pr/pack-card"
import { StepsBar } from "@/components/pr/patterns"
import { PaymentMethodCard } from "@/components/pr/payment-method-card"
import { PurchaseHistory } from "@/components/pr/purchase-history"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { type CoinPack, fastPassPrice, getSeriesBySlug } from "@/data"
import type { PaymentMethodId } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useAccountEmail } from "@/lib/me"
import { useCoinsPage } from "@/lib/queries"
import { isDemoOrder, useAppStore, useCoins } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useWallet } from "@/lib/wallet"

/** The first-purchase offer lasts until a payment made in this browser succeeds (Assumption 9). */
export function useFirstPurchaseOffer() {
  const demoOffer = useAppStore((s) => !s.purchases.some((p) => p.status === "Paid" && p.orderId && !isDemoOrder(p.orderId)))
  const email = useAccountEmail()
  const wallet = useWallet().data
  if (DEMO_MODE) return demoOffer
  // The API knows: once per account. Logged out, or before the wallet loads, the offer is shown.
  return !email || (wallet?.firstPurchaseBonus ?? true)
}

/**
 * Coming from a locked episode (`shopReturn`): what it is, how many coins are missing, and the smallest pack that
 * covers them (pre-selected once, badged "Covers it").
 */
function useShopReturn(packs: CoinPack[], offer: boolean) {
  const shopReturn = useAppStore((s) => s.shopReturn)
  const coins = useCoins()
  if (!shopReturn) return null
  const novel = getSeriesBySlug(shopReturn.page.split("?")[0].split("/")[2] ?? "")?.type === "novel"
  const need = Math.max(0, fastPassPrice() - coins)
  const covering = need > 0 ? packs.find((p) => packTotal(p, offer) >= need) : undefined
  return { ...shopReturn, novel, need, covering }
}
type ShopReturn = NonNullable<ReturnType<typeof useShopReturn>>

/** Prototype `.card.bal`: coin, "Your balance", N coins, "≈ N Fast Pass episodes". */
function BalanceCard({ price }: { price: number }) {
  const t = useTranslations("coins")
  const coins = useCoins()
  return (
    <div className="flex items-center gap-3 rounded-card border bg-card px-5 py-3.5 shadow-xs max-md:w-full">
      <CoinIcon size={32} className="size-9 text-[15px]" />
      <div className="flex flex-col">
        <span className="text-xs leading-4 text-muted-foreground">{t("yourBalance")}</span>
        <span className="type-h2 tabular-nums" aria-live="polite">
          {t("balanceLabel", { count: coins })}
        </span>
        <span className="text-xs leading-4 text-muted-foreground tabular-nums">
          {t("balanceEq", { count: price > 0 ? Math.floor(coins / price) : 0 })}
        </span>
      </div>
    </div>
  )
}

/** "Almost there · You need N more coins to unlock episode N of …" + Go back (prototype `.alert.ret-alert`). */
function ShopReturnAlert({ ret, picked }: { ret: ShopReturn; picked: boolean }) {
  const t = useTranslations("coins")
  const router = useRouter()
  const label = t(ret.novel ? "retChapter" : "retEpisode", { n: ret.episode, title: ret.title })

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[10px] border border-warning-border bg-warning-soft px-4 py-3.5"
    >
      <ZapIcon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-5 font-semibold">{ret.need > 0 ? t("almostThere") : t("getCoinsFor", { label })}</span>
        <span className="text-[13px] leading-[19px]">
          {ret.need > 0 ? <strong className="font-semibold">{t("needLine", { count: ret.need, label })} </strong> : null}
          {picked ? t("pickedSub") : t("backSub")}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="-my-1 shrink-0"
        onClick={() => {
          const { clearShopReturn, clearPendingUnlock } = useAppStore.getState()
          clearShopReturn()
          clearPendingUnlock()
          router.push(ret.page)
        }}
      >
        {t("goBack")}
      </Button>
    </div>
  )
}

function FirstPurchaseAlert() {
  const t = useTranslations("coins")
  return (
    <div role="status" className="flex items-start gap-3 rounded-[10px] border border-brand-soft-border bg-brand-soft px-4 py-3.5">
      <GiftIcon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm leading-5 font-semibold">{t("firstTitle")}</span>
        <span className="text-[13px] leading-[19px]">{t("firstBody")}</span>
      </div>
    </div>
  )
}

/** 1 Choose pack · 2 Pay · 3 Done. */
function CheckoutSteps({ flow }: { flow: Flow }) {
  const t = useTranslations("coins")
  const current = flow.step === "review" ? 0 : flow.step === "success" ? 2 : 1
  return (
    <StepsBar
      label={t("stepsLabel")}
      current={current}
      steps={[{ label: t("stepPack") }, { label: t("stepPay") }, { label: t("stepDone") }]}
    />
  )
}

/** Two columns from 1024 px (prototype `.sh-grid`: content + 380 px). */
const grid = "grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8"

export function CoinsSkeleton() {
  return (
    <>
      <CheckoutSteps flow={{ step: "review" }} />
      <div className={grid} aria-hidden>
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-[26px] w-40" />
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-[10px] md:h-[168px]" />
            ))}
          </div>
          <Skeleton className="mt-2.5 h-[26px] w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[66px] rounded-[10px]" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-card" />
      </div>
    </>
  )
}

type CoinsData = NonNullable<ReturnType<typeof useCoinsPage>["data"]>

/** Steps, pickers (locked while paying), the checkout card, purchase history and the FAQ. */
function CoinsBody({ data, offer, ret }: { data: CoinsData; offer: boolean; ret: ShopReturn | null }) {
  const t = useTranslations("coins")
  const tp = useTranslations("packs")
  const draft = useAppStore((s) => s.checkoutDraft)
  const setDraft = useAppStore((s) => s.setCheckoutDraft)
  const pack = data.packs.find((p) => p.coins === draft.pack) ?? data.packs[0]
  const method = data.methods.find((m) => m.id === draft.method) ?? data.methods[0]
  const checkout = useCheckout({
    pack,
    method,
    offer,
    expiryMinutes: data.khqrExpiryMinutes,
    packId: data.packIds?.[pack.coins],
    simulator: DEMO_MODE || data.simulator,
  })
  const storePurchases = useAppStore((s) => s.purchases)
  const price = data.fastPassPrice || fastPassPrice()
  const unit = ret?.novel ? "chapter" : "episode"
  const covering = ret?.covering?.coins

  // From a locked episode: pre-select the smallest pack that covers it, once per visit.
  const picked = useRef(false)
  useEffect(() => {
    if (picked.current || covering === undefined || checkout.flow.step !== "review") return
    picked.current = true
    setDraft({ pack: covering })
  }, [covering, checkout.flow.step, setDraft])

  // Picking again after a result starts a new order summary (prototype: `pick` sets step 'review').
  const pick = (patch: Partial<{ pack: number; method: PaymentMethodId }>) => {
    setDraft(patch)
    if (checkout.flow.step === "success" || checkout.flow.step === "failed") checkout.reset()
  }

  return (
    <>
      <CheckoutSteps flow={checkout.flow} />
      <div className={grid}>
        <section aria-labelledby="packs-title" className="flex min-w-0 flex-col gap-3.5">
          <h2 id="packs-title" className="type-h3">
            {t("step1")}
          </h2>
          <RadioGroup
            value={String(pack.coins)}
            onValueChange={(v) => pick({ pack: Number(v) })}
            aria-label={tp("group")}
            disabled={checkout.busy}
            className="grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-5"
          >
            {data.packs.map((p) => (
              <PackCard
                key={p.coins}
                pack={p}
                firstPurchaseOffer={offer}
                price={price}
                unit={unit}
                covers={p.coins === covering}
                disabled={checkout.busy}
                className={cn(checkout.busy && "has-[:disabled]:opacity-60")}
              />
            ))}
          </RadioGroup>

          <h2 id="methods-title" className="type-h3 pt-2.5">
            {t("step2")}
          </h2>
          <RadioGroup
            value={method.id}
            onValueChange={(v) => pick({ method: v as PaymentMethodId })}
            aria-label={tp("method.group")}
            disabled={checkout.busy}
            className="gap-2"
          >
            {data.methods.map((m) => (
              <PaymentMethodCard
                key={m.id}
                method={m}
                disabled={checkout.busy}
                className={cn(checkout.busy && "has-[:disabled]:opacity-60")}
              />
            ))}
          </RadioGroup>
        </section>

        <CheckoutCard
          flow={checkout.flow}
          remaining={checkout.remaining}
          pack={pack}
          method={method}
          offer={offer}
          expiryMinutes={data.khqrExpiryMinutes}
          onContinue={checkout.start}
          onCancel={checkout.cancel}
          onSubmit={(outcome) => void checkout.submit(outcome)}
          onReset={checkout.reset}
          starting={checkout.starting}
          canSimulate={DEMO_MODE || !!data.simulator}
        />
      </div>

      <div className={grid}>
        <PurchaseHistory methods={data.methods} purchases={DEMO_MODE ? storePurchases : data.history} />
        <CoinsFaq items={data.faq} />
      </div>
    </>
  )
}

/** Coins (spec §6, prototype Shop): balance, return / first-purchase alerts, then the loaded body (or skeleton / error). */
export function CoinsPage() {
  const t = useTranslations("coins")
  const query = useCoinsPage()
  const offer = useFirstPurchaseOffer()
  const ret = useShopReturn(query.data?.packs ?? [], offer)
  const draftPack = useAppStore((s) => s.checkoutDraft.pack)
  const price = query.data?.fastPassPrice || fastPassPrice()

  return (
    <div className="container flex flex-col gap-7 pt-8 pb-[72px] max-md:gap-6 max-md:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1">{t("title")}</h1>
          <p className="type-lead text-[15px]">{t("subtitle")}</p>
        </div>
        <BalanceCard price={price} />
      </div>

      {ret ? <ShopReturnAlert ret={ret} picked={!!ret.covering && ret.covering.coins === draftPack} /> : null}
      {offer ? <FirstPurchaseAlert /> : null}

      {query.isPending ? (
        <CoinsSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} className="rounded-card border" />
      ) : (
        <CoinsBody data={query.data} offer={offer} ret={ret} />
      )}
      <p className="text-xs leading-4 text-muted-foreground">{t("prototype")}</p>
    </div>
  )
}
