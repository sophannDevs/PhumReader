"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { EpisodeListPopover, type ListEpisode } from "@/components/layout/episode-list-popover"
import { ComicReaderBar, NovelReaderBar } from "@/components/layout/reader-bar"
import { Logo } from "@/components/layout/logo"
import { SiteHeader } from "@/components/layout/site-header"
import { CommentComposer } from "@/components/pr/comment-composer"
import { CommentList, type CommentView } from "@/components/pr/comment-list"
import { EpisodeList, EpisodeRow, type EpisodeState } from "@/components/pr/episode-row"
import { PackCard } from "@/components/pr/pack-card"
import { PaymentMethodCard } from "@/components/pr/payment-method-card"
import { UnlockDialog } from "@/components/pr/unlock-dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { demoData } from "@/data"
import type { Episode } from "@/data/types"

const series = demoData.series.find((s) => s.slug === "glass-compass")!
const samples = demoData.episodesSample["glass-compass"]
const ep = (n: number): Episode => samples.find((e) => e.n === n)!

const rows: [number, EpisodeState][] = [
  [68, "locked"],
  [67, "locked"],
  [66, "unlocked"],
  [65, "free"],
  [64, "read"],
]

const listEpisodes: ListEpisode[] = samples.map((e) => ({ n: e.n, title: e.title, thumb: e.thumb, locked: e.access === "fastpass" }))
const themes = ["light", "sepia", "dark"] as const

const initialComments: CommentView[] = demoData.comments.series.map((c, i) => ({ ...c, id: `c${i}` }))

/** Dev-only preview of the T10 patterns. Deleted in T53. */
export function KitPatterns() {
  const [dialog, setDialog] = useState<null | "logged-out" | "enough" | "not-enough">(null)
  const [loading, setLoading] = useState(false)
  const [pack, setPack] = useState("120")
  const [method, setMethod] = useState("khqr")
  const [comments, setComments] = useState(initialComments)
  const [draft, setDraft] = useState("")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [epNo, setEpNo] = useState(1)
  const last = listEpisodes.length
  const go = (n: number) => setEpNo(Math.min(Math.max(1, n), last))

  const locked = ep(66)
  const dialogProps = {
    logged: { loggedIn: false, balance: 0 },
    enough: { loggedIn: true, balance: 40 },
    notEnough: { loggedIn: true, balance: 2 },
  }
  const current =
    dialog === "logged-out" ? dialogProps.logged : dialog === "enough" ? dialogProps.enough : dialogProps.notEnough

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Logo and header</h2>
        <div className="flex flex-wrap items-center gap-8 rounded-card border bg-card p-5 shadow-xs">
          <Logo size="header" />
          <Logo size="footer" khmer />
          <div className="rounded-card bg-surface p-4">
            <Logo size="auth" tone="light" khmer />
          </div>
        </div>
        <div className="overflow-hidden rounded-card border">
          <SiteHeader className="static" user={null} coins={3} onSearchOpen={() => toast("Search opens in T13")} />
        </div>
        <div className="overflow-hidden rounded-card border">
          <SiteHeader
            className="static"
            user={{ name: "Sokha Chan" }}
            coins={40}
            onLogout={() => toast.success("You're logged out")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Reader bars</h2>
        <p className="type-body text-muted-foreground">
          Episode {epNo} of {last}. Previous / next are disabled at the ends; the progress line follows the episode.
        </p>
        <div className="overflow-hidden rounded-card border">
          <ComicReaderBar
            className="static"
            backHref="/series/glass-compass"
            seriesTitle={series.title}
            itemTitle={`Episode ${epNo}`}
            progress={epNo / last}
            prevDisabled={epNo <= 1}
            nextDisabled={epNo >= last}
            onPrev={() => go(epNo - 1)}
            onNext={() => go(epNo + 1)}
            listSlot={
              <EpisodeListPopover episodes={listEpisodes} current={epNo} coins={3} onSelect={go} />
            }
          />
        </div>
        {themes.map((theme) => (
          <div key={theme} data-reader-theme={theme} className="overflow-hidden rounded-card border border-reader-border bg-reader-page">
            <NovelReaderBar
              className="static"
              backHref="/series/letters-to-tuesday"
              seriesTitle="Letters to Tuesday"
              itemTitle="Flour and Ink"
              progress={0.35}
              onPrev={() => {}}
              onNext={() => {}}
              prevDisabled
              listSlot={
                <EpisodeListPopover
                  tone="themed"
                  kind="chapter"
                  episodes={listEpisodes}
                  current={5}
                  coins={3}
                  onSelect={() => {}}
                />
              }
              trailingSlot={
                <Button variant="ghost" size="sm" className="text-reader-text hover:bg-reader-border/60">
                  Aa
                </Button>
              }
            />
            <p className="px-4 py-6 text-sm text-reader-quiet">{theme} theme</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Episode rows</h2>
        <p className="type-body text-muted-foreground">Locked, locked, unlocked, free + UP, read. Click a locked row.</p>
        <EpisodeList>
          {rows.map(([n, state]) => (
            <EpisodeRow
              key={n}
              series={series}
              episode={ep(n)}
              state={state}
              onLockedClick={() => setDialog("enough")}
            />
          ))}
        </EpisodeList>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Unlock dialog</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setDialog("logged-out")}>
            Logged out
          </Button>
          <Button variant="outline" onClick={() => setDialog("enough")}>
            Enough coins (40)
          </Button>
          <Button variant="outline" onClick={() => setDialog("not-enough")}>
            Not enough (2)
          </Button>
        </div>
        <UnlockDialog
          open={dialog !== null}
          onOpenChange={(o) => !o && setDialog(null)}
          episode={{ n: locked.n, thumb: locked.thumb, freeDate: "Nov 12, 2026" }}
          price={demoData.fastPass.price}
          loading={loading}
          {...current}
          onLogin={() => toast("Go to /login")}
          onGetCoins={() => toast("Go to /coins")}
          onUnlock={() => {
            setLoading(true)
            setTimeout(() => {
              setLoading(false)
              setDialog(null)
              toast.success("Episode 66 unlocked")
            }, 700)
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Packs and payment methods</h2>
        <RadioGroup
          value={pack}
          onValueChange={setPack}
          aria-label="Choose a pack"
          className="grid-cols-2 gap-3 md:grid-cols-5"
        >
          {demoData.coinPacks.map((p, i) => (
            <PackCard key={p.coins} pack={p} firstPurchaseOffer={i < 4} disabled={i === 4} />
          ))}
        </RadioGroup>
        <RadioGroup value={method} onValueChange={setMethod} aria-label="Pay with" className="gap-3">
          {demoData.paymentMethods.map((m) => (
            <PaymentMethodCard key={m.id} method={m} disabled={m.id === "card"} />
          ))}
        </RadioGroup>
        <p className="type-caption text-muted-foreground">
          Selected: {pack} · {method}. Last pack and card are disabled. Arrow keys move between options.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Comments</h2>
        <CommentComposer
          value={draft}
          onChange={setDraft}
          textareaRef={composerRef}
          onSubmit={() => {
            setComments((cs) => [{ id: `n${cs.length}`, name: "Sokha C.", when: "now", text: draft, likes: 0 }, ...cs])
            setDraft("")
          }}
        />
        <CommentList
          comments={comments}
          onToggleLike={(id) => setComments((cs) => cs.map((c) => (c.id === id ? { ...c, liked: !c.liked } : c)))}
          onReply={(name) => {
            setDraft(`@${name} `)
            composerRef.current?.focus()
          }}
        />
      </section>
    </>
  )
}
