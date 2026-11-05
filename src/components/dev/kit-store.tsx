"use client"

import { Button } from "@/components/ui/button"
import { useAppStore, useCoins, useHydrated, useIsRead, useIsUnlocked, useUser } from "@/lib/store"

/** Dev-only probe for the zustand store. Deleted in T53. */
export function KitStore() {
  const hydrated = useHydrated()
  const user = useUser()
  const coins = useCoins()
  const unlocked = useIsUnlocked("S10", 66)
  const read = useIsRead("S10", 2)
  const { login, logout, addCoins, spendCoins, unlockEpisode, markRead, toggleSubscription, resetDemo } = useAppStore.getState()
  const state = useAppStore()
  const snapshot = {
    user: state.user,
    coins: state.coins,
    subscriptions: state.subscriptions,
    unlocked: state.unlocked,
    lastRead: state.lastRead,
    purchases: state.purchases.length,
    novelSettings: state.novelSettings,
    checkoutDraft: state.checkoutDraft,
    lang: state.lang,
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">Store</h2>
      <p className="type-body text-muted-foreground">
        hydrated: <b data-slot="hydrated">{String(hydrated)}</b> · user: <b data-slot="user">{user?.name ?? "none"}</b> ·
        coins: <b data-slot="coins">{coins}</b> · S10/66 unlocked: <b data-slot="unlocked">{String(unlocked)}</b> · S10/2
        read: <b data-slot="read">{String(read)}</b>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => login({ name: "Sokha Chan", email: "sokha@example.com" })}>
          Log in as Sokha
        </Button>
        <Button variant="outline" size="sm" onClick={logout}>
          Log out
        </Button>
        <Button variant="outline" size="sm" onClick={() => addCoins(37)}>
          Add 37 coins
        </Button>
        <Button variant="outline" size="sm" onClick={() => spendCoins(5)}>
          Spend 5
        </Button>
        <Button variant="outline" size="sm" onClick={() => unlockEpisode("S10", 66)}>
          Unlock S10/66
        </Button>
        <Button variant="outline" size="sm" onClick={() => markRead("S10", 3)}>
          Mark S10/3 read
        </Button>
        <Button variant="outline" size="sm" onClick={() => toggleSubscription("S10")}>
          Toggle subscribe S10
        </Button>
        <Button variant="destructive" size="sm" onClick={resetDemo}>
          Reset demo
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-card border bg-muted p-3 text-xs" data-slot="snapshot">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </section>
  )
}
