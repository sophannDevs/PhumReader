"use client"

import { type QueryClient, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { DEMO_MODE } from "@/lib/api/config"
import { ApiError, api, type Schemas } from "@/lib/api/client"
import * as coins from "@/lib/api/coins"
import { useAccountEmail } from "@/lib/me"
import { useAppStore } from "@/lib/store"

/**
 * The reader's coin balance on the real API. The balance lives in the API; the store's `coins`
 * only mirrors it for the header, the unlock dialog and the Coins page (so those need no change).
 * The demo keeps its own balance in the store.
 */

export const walletKey = (email: string) => ["wallet", email] as const

export function useWallet() {
  const email = useAccountEmail()
  return useQuery({ queryKey: walletKey(email ?? ""), queryFn: coins.fetchWallet, enabled: !DEMO_MODE && !!email })
}

/** Mounted once: copies the API's balance into the store whenever it is read or changes. */
export function useWalletSync() {
  const balance = useWallet().data?.balance
  useEffect(() => {
    if (balance !== undefined) useAppStore.setState({ coins: balance })
  }, [balance])
}

/** One of the reader's coin orders, as the API keeps it (the Receipt page, real API only). */
export type OrderView = Schemas["OrderView"]

export const orderKey = (email: string, number: string) => ["order", email, number] as const

/** Real API: the order `number` of the signed-in reader (`GET /coins/orders/{number}`); 404 when it isn't theirs. */
export function useOrder(number: string) {
  const email = useAccountEmail()
  return useQuery({
    queryKey: orderKey(email ?? "", number),
    queryFn: () => api.get<OrderView>(`/coins/orders/${encodeURIComponent(number)}`),
    enabled: !DEMO_MODE && !!email,
    // An unknown order stays unknown: no retries on 404.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })
}

/** A call returned the new balance: show it now, and read the wallet again (first-purchase bonus). */
export function applyBalance(qc: QueryClient, email: string, balance: number, firstPurchaseBonus?: boolean) {
  useAppStore.setState({ coins: balance })
  qc.setQueryData<coins.Wallet>(walletKey(email), (w) => ({
    firstPurchaseBonus: firstPurchaseBonus ?? w?.firstPurchaseBonus ?? true,
    balance,
  }))
  void qc.invalidateQueries({ queryKey: walletKey(email) })
}
