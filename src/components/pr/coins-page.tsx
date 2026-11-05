"use client"

import { GiftIcon, ZapIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CoinIcon } from "@/components/pr/coin-icon"
import { ErrorState } from "@/components/pr/error-state"
import { PackCard } from "@/components/pr/pack-card"
import { PaymentMethodCard } from "@/components/pr/payment-method-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { getSeriesBySlug } from "@/data"
import type { PaymentMethodId } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useCoinsPage } from "@/lib/queries"
import { useAppStore, useCoins } from "@/lib/store"

/** The first-purchase offer lasts until a payment made in this browser succeeds (Assumption 9). */
export function useFirstPurchaseOffer() {
  return useAppStore((s) => !s.purchases.some((p) => p.status === "Paid" && p.orderId))
}

function BalanceCard() {
  const t = useTranslations("coins")
  const coins = useCoins()
  return (
    <div className="flex items-center gap-3 rounded-card border bg-card px-5 py-4 shadow-xs">
      <CoinIcon size={32} />
      <div className="flex flex-col">
        <span className="type-caption font-normal text-muted-foreground">{t("yourBalance")}</span>
        <span className="text-2xl leading-8 font-bold tracking-tight tabular-nums" aria-live="polite">
          {t("balanceLabel", { count: coins })}
        </span>
      </div>
    </div>
  )
}

/** "Get coins for episode N of <title>" + Go back, shown when the reader came from a locked episode. */
function ShopReturnAlert() {
  const t = useTranslations("coins")
  const router = useRouter()
  const shopReturn = useAppStore((s) => s.shopReturn)
  if (!shopReturn) return null
  const slug = shopReturn.page.split("/").pop() ?? ""
  const novel = getSeriesBySlug(slug)?.type === "novel"

  return (
    <Alert role="status" className="items-center sm:grid-cols-[auto_1fr_auto]">
      <ZapIcon />
      <AlertTitle>
        {t(novel ? "shopTitleChapter" : "shopTitleEpisode", { n: shopReturn.episode, title: shopReturn.title })}
      </AlertTitle>
      <AlertDescription>{t("shopBody")}</AlertDescription>
      <Button
        variant="outline"
        size="sm"
        className="max-sm:col-start-2 max-sm:mt-2 max-sm:w-fit sm:col-start-3 sm:row-span-2 sm:row-start-1"
        onClick={() => {
          const { clearShopReturn, clearPendingUnlock } = useAppStore.getState()
          clearShopReturn()
          clearPendingUnlock()
          router.push(shopReturn.page)
        }}
      >
        {t("goBack")}
      </Button>
    </Alert>
  )
}

function FirstPurchaseAlert() {
  const t = useTranslations("coins")
  return (
    <Alert variant="brand" role="status">
      <GiftIcon />
      <AlertTitle>{t("firstTitle")}</AlertTitle>
      <AlertDescription>{t("firstBody")}</AlertDescription>
    </Alert>
  )
}

function CoinsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-card" />
        ))}
      </div>
    </div>
  )
}

/** Coins page: balance, alerts, pack + payment method pickers (selection kept in `checkoutDraft`). */
export function CoinsPage() {
  const t = useTranslations("coins")
  const query = useCoinsPage()
  const offer = useFirstPurchaseOffer()
  const draft = useAppStore((s) => s.checkoutDraft)
  const setDraft = useAppStore.getState().setCheckoutDraft

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="type-h1">{t("title")}</h1>
          <p className="type-lead">{t("subtitle")}</p>
        </div>
        <BalanceCard />
      </div>

      <ShopReturnAlert />
      {offer ? <FirstPurchaseAlert /> : null}

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-8">
          {query.isPending ? (
            <CoinsSkeleton />
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : (
            <>
              <section aria-labelledby="packs-title" className="flex flex-col gap-3">
                <h2 id="packs-title" className="type-h3">
                  {t("step1")}
                </h2>
                <RadioGroup
                  value={String(draft.pack)}
                  onValueChange={(v) => setDraft({ pack: Number(v) })}
                  aria-labelledby="packs-title"
                  className="grid-cols-2 gap-3 md:grid-cols-5"
                >
                  {query.data.packs.map((p) => (
                    <PackCard key={p.coins} pack={p} firstPurchaseOffer={offer} />
                  ))}
                </RadioGroup>
              </section>

              <section aria-labelledby="methods-title" className="flex flex-col gap-3">
                <h2 id="methods-title" className="type-h3">
                  {t("step2")}
                </h2>
                <RadioGroup
                  value={draft.method}
                  onValueChange={(v) => setDraft({ method: v as PaymentMethodId })}
                  aria-labelledby="methods-title"
                  className="gap-3"
                >
                  {query.data.methods.map((m) => (
                    <PaymentMethodCard key={m.id} method={m} />
                  ))}
                </RadioGroup>
              </section>
            </>
          )}
        </div>
        {/* T37: order summary (right column), then purchase history and the FAQ */}
      </div>
    </div>
  )
}
