"use client"

import { useState } from "react"
import { toast } from "sonner"
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react"
import { ContinueCard } from "@/components/pr/continue-card"
import { NovelCard } from "@/components/pr/novel-card"
import { RankRow } from "@/components/pr/rank-row"
import { SeriesCard } from "@/components/pr/series-card"
import { demoData } from "@/data"
import type { Series } from "@/data/types"
import { CoinChip } from "@/components/pr/coin-chip"
import { CoinIcon } from "@/components/pr/coin-icon"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { SkeletonCard, SkeletonRow, SkeletonText } from "@/components/pr/skeletons"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem, radioCardClassName } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/sonner"
import { Toggle } from "@/components/ui/toggle"

const byTitle = (title: string): Series => {
  const found = demoData.series.find((s) => s.title === title)
  if (!found) throw new Error(`Unknown series: ${title}`)
  return found
}
const bySlug = (slug: string): Series => {
  const found = demoData.series.find((s) => s.slug === slug)
  if (!found) throw new Error(`Unknown series: ${slug}`)
  return found
}

const cardSeries = ["Paper Tigers", "The Quiet Kingdom", "Little Thunder", "Wolves of Wren Street", "Lantern Alley", "Hollow Signal"].map(byTitle)
const novelSeries = demoData.series.filter((s) => s.type === "novel").slice(0, 6)
const rankSeries = ["Paper Tigers", "Neon Monsoon", "Tiny Dragon Café", "The Orchard Pact", "Summer Index", "Ember & Co.", "Captain Nobody", "Salt & Thunder"].map(byTitle)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

/** Dev-only preview of the T07 component styles. Deleted in T53. */
export function KitComponents() {
  const [otp, setOtp] = useState("123")
  const [otpBad, setOtpBad] = useState("123456")
  const [method, setMethod] = useState("khqr")
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <>
      <Toaster />

      <Section title="Forms">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kit-email">Email</Label>
              <Input id="kit-email" placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kit-email-err">Email (error)</Label>
              <Input
                id="kit-email-err"
                defaultValue="reader@"
                aria-invalid
                aria-describedby="kit-email-err-msg"
              />
              <p id="kit-email-err-msg" className="text-[13px] text-destructive">
                Enter a valid email, like you@example.com.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kit-disabled">Disabled</Label>
              <Input id="kit-disabled" disabled defaultValue="reader@toonwave.app" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kit-note">Creator&apos;s note</Label>
              <Textarea id="kit-note" placeholder="Optional message shown after the episode" />
              <p className="type-caption text-muted-foreground">Up to 300 characters</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Checkbox id="kit-keep" defaultChecked />
              <Label htmlFor="kit-keep">Keep me logged in</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="kit-terms" aria-invalid />
              <Label htmlFor="kit-terms">Terms (error)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="kit-dis" disabled />
              <Label htmlFor="kit-dis">Disabled</Label>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kit-alerts">New-episode alerts</Label>
              <Switch id="kit-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kit-off">Fast Pass reminders</Label>
              <Switch id="kit-off" />
            </div>
            <Tabs defaultValue="comics">
              <TabsList>
                <TabsTrigger value="comics">Comics</TabsTrigger>
                <TabsTrigger value="novels">Web novels</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs defaultValue="episodes">
              <TabsList variant="line">
                <TabsTrigger value="episodes">
                  Episodes <TabsCount>68</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="comments">
                  Comments <TabsCount>2.4K</TabsCount>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="episodes" className="pt-3 text-muted-foreground">
                Episodes tab content
              </TabsContent>
              <TabsContent value="about" className="pt-3 text-muted-foreground">
                About tab content
              </TabsContent>
              <TabsContent value="comments" className="pt-3 text-muted-foreground">
                Comments tab content
              </TabsContent>
            </Tabs>
            <div className="flex gap-2">
              <Toggle defaultPressed>Chip · on</Toggle>
              <Toggle>Chip</Toggle>
              <Toggle disabled>Disabled</Toggle>
            </div>
            <div className="flex flex-col gap-2">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label="Verification code">
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div data-invalid="true">
                <InputOTP maxLength={6} value={otpBad} onChange={setOtpBad} aria-invalid aria-label="Verification code (error)">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-[13px] text-destructive">That code isn&apos;t right. Check the email and try again.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <RadioGroup value={method} onValueChange={setMethod} aria-label="Pay with">
              <label className={radioCardClassName}>
                <RadioGroupItem value="khqr" className="mt-0.5" />
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">KHQR</span>
                  <span className="type-caption font-normal text-muted-foreground">Scan with any Bakong-member bank app</span>
                </span>
                <Badge variant="brand">Recommended</Badge>
              </label>
              <label className={radioCardClassName}>
                <RadioGroupItem value="aba" className="mt-0.5" />
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">ABA Pay</span>
                  <span className="type-caption font-normal text-muted-foreground">Confirm in the ABA Mobile app</span>
                </span>
              </label>
              <label className={radioCardClassName}>
                <RadioGroupItem value="card" disabled className="mt-0.5" />
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">Credit or debit card (disabled)</span>
                  <span className="type-caption font-normal text-muted-foreground">Visa, Mastercard</span>
                </span>
              </label>
            </RadioGroup>
            <p className="type-caption text-muted-foreground">
              RadioGroup rendered as selectable cards. Arrow keys move between options.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Toast · Progress · Skeleton · Avatar">
        <div className="flex flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success("Episode 49 unlocked")}>
              Show toast
            </Button>
            <Button variant="outline" onClick={() => toast.error("Payment cancelled")}>
              Show error toast
            </Button>
          </div>
          <Progress value={40} aria-label="Reading progress" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-control" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar variant="brand">
              <AvatarFallback>SC</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>SC</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </Section>

      <Section title="Small patterns">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-4 rounded-card border bg-card p-5 shadow-xs">
            <CoinIcon size={14} />
            <CoinIcon size={16} />
            <CoinIcon size={20} />
            <CoinIcon size={32} />
            <CoinChip count={3} />
            <CoinChip count={1250} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-card border bg-card shadow-xs">
              <EmptyState
                title="No purchases yet"
                description="Your coin purchases will show up here."
                action={<Button variant="outline">Back to Home</Button>}
              />
            </div>
            <div className="rounded-card border bg-card shadow-xs">
              <ErrorState onRetry={() => toast.success("Retry clicked")} />
            </div>
          </div>
          <div className="grid gap-5 rounded-card border bg-card p-5 shadow-xs md:grid-cols-[160px_1fr_1fr]">
            <SkeletonCard />
            <div className="flex flex-col gap-4">
              <SkeletonRow />
              <SkeletonRow thumb="h-16 w-12" />
            </div>
            <SkeletonText />
          </div>
        </div>
      </Section>

      <Section title="Series cards">
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 lg:grid-cols-6">
          {cardSeries.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
          <SeriesCard series={novelSeries[0]} />
        </div>
      </Section>

      <Section title="Novel cards">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {novelSeries.map((s) => (
            <NovelCard key={s.id} series={s} />
          ))}
        </div>
      </Section>

      <Section title="Continue cards">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {demoData.continueReading.map((c) => (
            <ContinueCard key={c.series} series={bySlug(c.series)} episode={c.episode} progress={c.progress} />
          ))}
        </div>
      </Section>

      <Section title="Rank rows">
        <div className="max-w-xl rounded-card border bg-card p-3 shadow-xs">
          {rankSeries.map((s, i) => (
            <RankRow key={s.id} rank={i + 1} series={s} movement={demoData.rankingMovement[i]} />
          ))}
        </div>
      </Section>

      <Section title="Overlays, Table, Accordion">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unlock Episode 49</DialogTitle>
                <DialogDescription>Free for everyone on Nov 12, 2026.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="brand" size="lg" className="w-full">
                  Unlock for 5 coins
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                Sokha Chan
                <span className="block text-xs font-normal text-muted-foreground">3 coins</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon /> My library
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SettingsIcon /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOutIcon /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>Popover content: episode list, chapters, reading settings.</PopoverContent>
          </Popover>

          <Button variant="outline" onClick={() => setCmdOpen(true)}>
            Open command (⌘K)
          </Button>
          <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen} title="Search" description="Search series">
            <Command>
              <CommandInput placeholder="Search series, creators…" />
              <CommandList>
                <CommandEmpty>No results. Try a title, creator or genre.</CommandEmpty>
                <CommandGroup heading="Popular now">
                  <CommandItem>Glass Compass</CommandItem>
                  <CommandItem>Paper Tigers</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </CommandDialog>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-card border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Oct 2, 2026</TableCell>
                  <TableCell>33 coin pack</TableCell>
                  <TableCell className="text-right tabular-nums">+33</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sep 14, 2026</TableCell>
                  <TableCell>120 coin pack</TableCell>
                  <TableCell className="text-right tabular-nums">+120</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <Accordion type="single" collapsible defaultValue="a" className="rounded-card border bg-card px-5 shadow-xs">
            <AccordionItem value="a">
              <AccordionTrigger>Do coins expire?</AccordionTrigger>
              <AccordionContent>No. Coins stay in your balance until you use them.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>How does Fast Pass work?</AccordionTrigger>
              <AccordionContent>Read up to three episodes early with coins.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>
    </>
  )
}
