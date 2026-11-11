"use client"

/* Developer reference page (/dev/foundations): English only, not part of the reader-facing UI (Assumption V2-19). */

import { AlertCircleIcon, BellIcon, BookOpenIcon, CheckIcon, InfoIcon, LockIcon, Share2Icon, ZapIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { LogoMark } from "@/components/layout/logo"
import { CoinIcon } from "@/components/pr/coin-icon"
import { OptionCard, StatCard, StepsBar, UndoBar } from "@/components/pr/patterns"
import { Chip, Segmented } from "@/components/pr/v2-primitives"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { demoData } from "@/data"
import { cn } from "@/lib/utils"

const colors = [
  ["--primary", "#00DC64", "Primary actions, progress"],
  ["--primary-foreground", "#04210F", "Text on primary"],
  ["--brand-ink", "#047A3A", "Green text and links"],
  ["--brand-soft", "#E8FBF0", "Info / brand alerts"],
  ["--foreground", "#09090B", "Text, default button"],
  ["--muted-foreground", "#71717A", "Secondary text"],
  ["--background", "#FFFFFF", "Page, cards, popovers"],
  ["--muted", "#F4F4F5", "Tabs track, skeletons"],
  ["--border", "#E4E4E7", "Borders, inputs, separators"],
  ["--ring", "#00A650", "Focus ring"],
  ["--destructive", "#DC2626", "Errors, delete"],
  ["--warning", "#B45309", "Fast Pass, cautions"],
] as const

const type = [
  ["Display", "Inter 48/52 · 700", "text-[48px] leading-[52px] font-bold tracking-[-0.03em]", "Glass Compass"],
  ["H1", "Inter 36/42 · 700", "type-h1", "Daily updates"],
  ["H2", "Inter 24/30 · 600", "type-h2", "Trending now"],
  ["H3", "Inter 18/26 · 600", "type-h3", "Order summary"],
  ["Body", "Inter 14/20 · 400", "type-body", "New episodes every Thursday. Read the first 48 free."],
  ["Lead", "Inter 16/26 · 400", "type-lead", "Unlock Fast Pass episodes before they’re free."],
  ["Caption", "Inter 12/16 · 500", "type-caption text-muted-foreground", "Nov 5, 2026 · 52.1K likes"],
] as const

const componentMap = [
  ["Button", "Button"],
  ["Chip (filters)", "Toggle / Badge"],
  ["Tabs", "Tabs"],
  ["Modal", "Dialog"],
  ["Dropdown (avatar menu)", "DropdownMenu"],
  ["Header search", "Command (⌘K)"],
  ["Episode list panel", "Sheet / Popover"],
  ["Input, Textarea", "Input, Textarea + Form (react-hook-form + zod)"],
  ["Switch, Checkbox, Radio", "Switch, Checkbox, RadioGroup"],
  ["Verification code", "InputOTP"],
  ["Alert", "Alert"],
  ["Toast", "Sonner"],
  ["ProgressBar", "Progress"],
  ["Accordion (FAQ)", "Accordion"],
  ["Table (history)", "Table"],
  ["Avatar", "Avatar"],
] as const

function Section({ title, desc, children, className }: { title: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="type-h2">{title}</h2>
        {desc ? <p className="text-[13px] text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  )
}

const card = "rounded-card border bg-card shadow-xs"

export function FoundationsBoard() {
  const [checked, setChecked] = useState(true)
  const [alerts, setAlerts] = useState(true)
  const [tab, setTab] = useState("comics")
  const [method, setMethod] = useState("khqr")
  const [reason, setReason] = useState("spoiler")
  const demo = demoData.series.find((s) => s.slug === "glass-compass") ?? demoData.series[0]

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-4 pt-14 pb-20 md:px-8">
      <header className="flex flex-col gap-3.5 border-b pb-8">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="type-eyebrow">PhumiReader V2 · Design concept</span>
        </div>
        <h1 className="text-[44px] leading-[50px] font-bold tracking-[-0.025em] max-md:text-[28px] max-md:leading-8">
          Foundations: shadcn/ui + PhumiReader green
        </h1>
        <p className="type-lead max-w-[70ch]">
          Built for Next.js + Tailwind + shadcn/ui. Neutral zinc surfaces, thin borders and 10 px corners; PhumiReader green is
          reserved for primary actions, progress and highlights. Every pattern below maps to a shadcn component.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Next.js", "Tailwind CSS", "shadcn/ui (Radix)", "lucide-react icons", "Inter + Kantumruy Pro"].map((b) => (
            <Badge key={b} variant="outline">
              {b}
            </Badge>
          ))}
        </div>
      </header>

      <Section title="Color tokens" desc="CSS variables in globals.css, same names as shadcn’s theme.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {colors.map(([name, hex, use]) => (
            <div key={name} className="flex items-start gap-3 rounded-[10px] border p-3">
              <span className="size-11 shrink-0 rounded-control shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: hex }} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{name}</span>
                <code className="text-xs text-muted-foreground">{hex}</code>
                <span className="text-xs text-muted-foreground">{use}</span>
              </span>
            </div>
          ))}
        </div>
        <Alert variant="brand">
          <InfoIcon />
          <AlertTitle>Green on dark text</AlertTitle>
          <AlertDescription>
            #00DC64 is too light for white text, so primary buttons use dark green text (#04210F, 12:1). Green text on white uses
            --brand-ink #047A3A (5.6:1).
          </AlertDescription>
        </Alert>
      </Section>

      <Section title="Typography" desc="Inter for Latin, Kantumruy Pro for Khmer (falls back automatically). The novel reader can switch to Noto Serif.">
        <div className={card}>
          {type.map(([name, spec, cls, sample]) => (
            <div key={name} className="flex items-baseline gap-6 border-b px-5 py-4 last:border-0 max-md:flex-col max-md:gap-1">
              <span className="w-40 shrink-0 text-xs text-muted-foreground">
                {name}
                <br />
                {spec}
              </span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
          <div className="flex items-baseline gap-6 px-5 py-4 max-md:flex-col max-md:gap-1">
            <span className="w-40 shrink-0 text-xs text-muted-foreground">
              Khmer · body
              <br />
              Kantumruy Pro 16/26
            </span>
            <span lang="km" className="font-khmer text-base leading-[26px]">
              រឿងកំប្លែង និងប្រលោមលោកពីកម្ពុជា ជាភាសាខ្មែរ និងអង់គ្លេស។
            </span>
          </div>
        </div>
      </Section>

      <Section title="Button" desc="Variants: default, brand, secondary, outline, ghost, link, destructive. Sizes: sm 32, default 36, lg 44, icon.">
        <div className={cn(card, "flex flex-col gap-4 p-5")}>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="brand">
              <BookOpenIcon />
              Read episode 1
            </Button>
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="brand" size="sm">
              Small
            </Button>
            <Button variant="brand">Default</Button>
            <Button variant="brand" size="lg">
              Large
            </Button>
            <Button variant="outline" size="icon" aria-label="Share">
              <Share2Icon />
            </Button>
            <Button variant="brand" disabled>
              Disabled
            </Button>
            <Button variant="brand" loading>
              Loading
            </Button>
            <Chip selected onClick={() => {}}>
              Chip · on
            </Chip>
            <Chip selected={false} onClick={() => {}}>
              Chip
            </Chip>
          </div>
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Badge" desc="Status on covers and episode rows.">
          <div className={cn(card, "flex flex-wrap gap-2 p-5")}>
            <Badge variant="up">UP</Badge>
            <Badge variant="new">NEW</Badge>
            <Badge variant="warn">
              <ZapIcon className="size-3" />
              Fast Pass · 5 coins
            </Badge>
            <Badge variant="brand">Unlocked</Badge>
            <Badge variant="secondary">
              <CheckIcon className="size-3" />
              Read
            </Badge>
            <Badge variant="outline">Fantasy</Badge>
            <Badge>Best value</Badge>
            <Badge variant="dark">Novel</Badge>
          </div>
        </Section>
        <Section title="Alert · Toast · Progress" desc="Alert, Sonner, Progress, Skeleton.">
          <div className={cn(card, "flex flex-col gap-3 p-5")}>
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Email or password is incorrect</AlertTitle>
              <AlertDescription>Check them and try again.</AlertDescription>
            </Alert>
            <div className="flex items-center gap-2.5 self-start rounded-[10px] border bg-background px-4 py-3 text-sm font-medium shadow-md">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckIcon className="size-3" />
              </span>
              Episode 49 unlocked
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-[62%] rounded-full bg-primary" />
            </div>
            <div className="flex gap-2.5">
              <Skeleton className="h-16 w-12" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-[70%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Forms" desc="Input, Label, Textarea, Checkbox, Switch, RadioGroup, Tabs. Errors show under the field in red with aria-invalid.">
        <div className="grid items-start gap-4 md:grid-cols-3">
          <div className={cn(card, "flex flex-col gap-3.5 p-5")}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fd-a">Email</Label>
              <Input id="fd-a" placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fd-b">Email (error)</Label>
              <Input id="fd-b" defaultValue="reader@" aria-invalid />
              <span className="text-[13px] font-medium text-destructive">Enter a valid email, like you@example.com.</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fd-c">Creator’s note</Label>
              <Textarea id="fd-c" placeholder="Optional message shown after the episode" />
              <span className="text-[13px] text-muted-foreground">Up to 300 characters</span>
            </div>
          </div>
          <div className={cn(card, "flex flex-col gap-4 p-5")}>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              Keep me logged in
            </label>
            <div className="flex items-center justify-between text-[13px]">
              <span>New-episode alerts</span>
              <Switch checked={alerts} onCheckedChange={setAlerts} aria-label="New-episode alerts" />
            </div>
            <Segmented
              label="Type"
              value={tab}
              onChange={setTab}
              options={[
                { value: "comics", label: "Comics" },
                { value: "novels", label: "Web novels" },
                { value: "all", label: "All" },
              ]}
            />
            <div className="flex gap-1 border-b">
              {["Episodes", "About", "Comments"].map((l, i) => (
                <span key={l} className={cn("-mb-px border-b-2 px-3 pb-3 text-sm font-medium", i === 0 ? "border-foreground" : "border-transparent text-muted-foreground")}>
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-2.5">
            <OptionCard
              selected={method === "khqr"}
              onSelect={() => setMethod("khqr")}
              title="KHQR"
              description="Scan with any Bakong-member bank app"
              aside={<Badge variant="brand">Recommended</Badge>}
            />
            <OptionCard selected={method === "aba"} onSelect={() => setMethod("aba")} title="ABA Pay" description="Confirm in the ABA Mobile app" />
            <p className="text-xs text-muted-foreground">RadioGroup rendered as selectable cards (coin packs, payment methods).</p>
          </div>
        </div>
      </Section>

      <Section title="Brand and language" desc="PhumiReader in English, ភូមិReader in Khmer. “Reader” stays Latin and green in both.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className={cn(card, "flex flex-col gap-3.5 p-5")}>
            <span className="text-xs text-muted-foreground">Logo</span>
            {["Phumi", "ភូមិ"].map((first) => (
              <span key={first} className="inline-flex items-center gap-2">
                <LogoMark />
                <span className={cn("text-[17px] font-bold", first === "ភូមិ" ? "font-khmer" : "tracking-[-0.03em]")}>
                  <span lang={first === "ភូមិ" ? "km" : undefined}>{first}</span>
                  <span className="text-brand-ink">Reader</span>
                </span>
              </span>
            ))}
          </div>
          <div className={cn(card, "flex flex-col gap-3.5 p-5")}>
            <span className="text-xs text-muted-foreground">Header actions (right side)</span>
            <div className="flex items-center gap-2">
              <span lang="km" className="inline-flex h-8 min-w-11 items-center justify-center rounded-full border px-2.5 font-khmer text-[13px] font-semibold">
                ខ្មែរ
              </span>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1.5 text-[13px] font-semibold">
                <CoinIcon size={20} />
                12
              </span>
              <span className="relative inline-flex size-9 items-center justify-center rounded-full">
                <BellIcon className="size-[18px]" />
                <span className="absolute top-0.5 right-0 h-4 min-w-4 rounded-full bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-background">
                  3
                </span>
              </span>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">SC</span>
            </div>
            <span className="text-xs text-muted-foreground">The language button shows the other language. The bell counts unread alerts.</span>
          </div>
          <div className={cn(card, "flex flex-col gap-2.5 p-5")}>
            <span className="text-xs text-muted-foreground">Khmer type (Kantumruy Pro, 1.45–1.6 line height, no letter-spacing)</span>
            <span lang="km" className="font-khmer text-2xl leading-[1.45] font-semibold">
              តើអ្នកចូលចិត្តអានអ្វី?
            </span>
            <span lang="km" className="font-khmer text-[13px] leading-[1.6]">
              ដោះសោភាគ Fast Pass មុនពេលវាឥតគិតថ្លៃ។ មួយភាគក្លាយជាឥតគិតថ្លៃរៀងរាល់សប្តាហ៍។
            </span>
          </div>
        </div>
      </Section>

      <Section title="Status badges" desc="One meaning per colour across reader, creator and admin screens.">
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand">Published</Badge>
          <Badge variant="brand">Paid</Badge>
          <Badge variant="warn">
            <ZapIcon className="size-3" />
            Fast Pass
          </Badge>
          <Badge variant="warn">In review</Badge>
          <Badge>Scheduled</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="outline">Hidden</Badge>
          <Badge variant="up">Changes requested</Badge>
          <Badge variant="up">Failed</Badge>
          <Badge variant="up">UP</Badge>
          <Badge variant="new">New</Badge>
          <Badge variant="brand">Creator</Badge>
        </div>
      </Section>

      <Section title="Patterns" desc="Shared V2.1 patterns (src/components/pr/patterns.tsx, report-dialog.tsx, v2-primitives.tsx).">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className={cn(card, "flex flex-col gap-3 p-5")}>
            <span className="text-xs text-muted-foreground">Steps bar · Coins, Create series, setup</span>
            <StepsBar label="Checkout progress" current={1} steps={[{ label: "Choose a pack" }, { label: "Pay" }, { label: "Done" }]} />
          </div>
          <div role="radiogroup" aria-label="Reason" className={cn(card, "flex flex-col gap-2.5 p-5")}>
            <span className="text-xs text-muted-foreground">Radio option · report reasons, unlock choice, payout method</span>
            <OptionCard selected={reason === "spoiler"} onSelect={() => setReason("spoiler")} title="Spoilers without warning" description="Reveals later episodes" />
            <OptionCard selected={reason === "other"} onSelect={() => setReason("other")} title="Something else" description="Tell us what’s wrong" />
          </div>
          <div className={cn(card, "flex flex-col gap-3 p-5")}>
            <span className="text-xs text-muted-foreground">Stat card · dashboard, earnings, admin</span>
            <StatCard label="Views (14 days)" value="182K" change="+12% vs last 14 days" tone="up" />
          </div>
          <div className={cn(card, "flex flex-col gap-3 p-5")}>
            <span className="text-xs text-muted-foreground">Undo bar · library, notifications, admin</span>
            <UndoBar text="2 series removed from your library" onUndo={() => {}} />
          </div>
          <div className={cn(card, "flex flex-col gap-3 p-5")}>
            <span className="text-xs text-muted-foreground">SeriesCard</span>
            <div className="flex w-[150px] flex-col gap-2.5">
              <span className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-muted">
                <Image src={demo.cover} alt="" fill sizes="150px" className="object-cover" />
                <Badge variant="up" className="absolute top-2 left-2">
                  UP
                </Badge>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{demo.title}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {demo.creator} · {demo.genre}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-[14px] border border-[#27272a] bg-[#18181b] p-5 text-[#fafafa]">
            <Badge variant="warn">
              <ZapIcon className="size-3" />
              Fast Pass
            </Badge>
            <span className="text-center text-[15px] font-semibold">Episode 66 is in Fast Pass</span>
            <span className="text-center text-xs text-[#a1a1aa]">Read now for 5 coins, or free on Nov 12 (in 7 days).</span>
            <Button variant="brand" size="sm">
              <LockIcon className="size-3.5" />
              Unlock for 5 coins
            </Button>
          </div>
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Layout & spacing">
          <div className={cn(card, "flex flex-col gap-2.5 p-5 text-[13px]")}>
            {[
              ["Desktop container", "1280 max · 32 px gutters · 6-col card grid"],
              ["Phone", "16 px gutters · 3-col grid · bottom tab bar"],
              ["Spacing scale", "4 · 8 · 12 · 16 · 20 · 24 · 32 · 56"],
              ["Radius", "--radius 10 · inputs/buttons 8 · cards 12 · hero 20"],
              ["Touch targets", "36 px min desktop · 44 px primary actions"],
              ["Readers", "Comic 800 px strip · novel 720 px column"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b pb-2.5 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="V1 → V2 component map">
          <div className={cn(card, "overflow-hidden text-[13px]")}>
            <div className="grid min-h-[38px] grid-cols-[1fr_1.3fr] items-center gap-3 border-b bg-[#fafafa] px-3.5 font-medium text-muted-foreground">
              <span>V1 (HeroUI)</span>
              <span>V2 (shadcn/ui)</span>
            </div>
            {componentMap.map(([a, b]) => (
              <div key={a} className="grid min-h-[38px] grid-cols-[1fr_1.3fr] items-center gap-3 border-b px-3.5 last:border-0">
                <span>{a}</span>
                <code className="font-mono">{b}</code>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  )
}
