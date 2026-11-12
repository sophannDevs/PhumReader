"use client"

import { WalletIcon as CoinsIcon } from "@/components/animate-ui/icons/wallet"
import { GlobeIcon as LanguagesIcon } from "@/components/animate-ui/icons/globe"
import { ArrowRightIcon } from "@/components/animate-ui/icons/arrow-right"
import { BadgeCheckIcon } from "@/components/animate-ui/icons/badge-check"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { LayoutDashboardIcon } from "@/components/animate-ui/icons/layout-dashboard"
import { MessageSquareQuoteIcon } from "@/components/animate-ui/icons/message-square-quote"
import { TimerIcon } from "@/components/animate-ui/icons/timer"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { Eyebrow } from "@/components/pr/v2-primitives"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { fastPassPrice, getSeries } from "@/data"
import { Link } from "@/i18n/navigation"
import { useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Become a creator (spec §26, prototype Join/): hero with Start creating / Creator guidelines, How it works in 4 steps,
 * the earnings calculator (readers × episodes × 5 coins), What you get, Before you start, Questions and a final call
 * to action. Logged out, "Start creating" goes to sign up with `returnTo` = Create series (/creator/new).
 */

const CREATE = "/creator/new"
const ART = [
  { i: 3, cls: "left-[6%] top-10 w-[150px] -rotate-6" },
  { i: 9, cls: "left-[30%] top-0 z-[2] w-[150px]" },
  { i: 15, cls: "left-[54%] top-[50px] w-[150px] rotate-[5deg]" },
  { i: 21, cls: "left-[18%] top-[190px] w-[120px] rotate-3" },
  { i: 30, cls: "left-[62%] top-[200px] w-[120px] -rotate-4" },
]
const TOOLS = [
  { icon: LayoutDashboardIcon, key: "tool1" },
  { icon: TimerIcon, key: "tool2" },
  { icon: LanguagesIcon, key: "tool3" },
  { icon: MessageSquareQuoteIcon, key: "tool4" },
  { icon: CoinsIcon, key: "tool5" },
  { icon: BadgeCheckIcon, key: "tool6" },
] as const
const RULES = [1, 2, 3, 4, 5, 6] as const
const STEPS = [1, 2, 3, 4] as const
const FAQ = [1, 2, 3, 4, 5] as const

const fmt = (n: number) => n.toLocaleString("en-US")

export function JoinPage() {
  const t = useTranslations("join")
  const user = useUser()
  const hydrated = useHydrated()
  const [readers, setReaders] = useState(200)
  const [eps, setEps] = useState(4)
  const price = fastPassPrice()
  const coins = readers * eps * price
  const series = getSeries()
  const loggedOut = hydrated && !user

  const start = (size: "lg", className?: string, arrow = false) => (
    <Button asChild variant="brand" size={size} className={className}>
      <Link
        href={loggedOut ? "/login?mode=signup" : CREATE}
        onClick={() => {
          if (!useAppStore.getState().user) useAppStore.getState().setReturnTo(CREATE)
        }}
      >
        {loggedOut ? t("startSignup") : t("start")}
        {arrow ? <ArrowRightIcon aria-hidden /> : null}
      </Link>
    </Button>
  )

  return (
    <>
      <section className="border-b bg-[#fafafa] bg-[image:radial-gradient(800px_300px_at_80%_0%,#d9f7e6_0%,rgba(217,247,230,0)_70%)]">
        <div className="container grid items-center gap-12 pt-14 pb-14 max-md:pt-7 max-md:pb-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Effect asChild fade slide={{ direction: "up", offset: 12 }}>
            <div className="flex min-w-0 flex-col gap-[18px]">
              <Eyebrow>{t("eyebrow")}</Eyebrow>
              <h1 className="text-[44px] leading-[50px] font-extrabold tracking-[-0.03em] max-md:text-[30px] max-md:leading-9">{t("title")}</h1>
              <p className="max-w-[52ch] text-[17px] leading-[27px] text-[#3f3f46] max-md:text-[15px] max-md:leading-6">{t("lead")}</p>
              <div className="flex flex-wrap gap-2.5">
                {start("lg", undefined, true)}
                <Button asChild variant="outline" size="lg">
                  <Link href="/legal/creator">{t("guidelines")}</Link>
                </Button>
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-x-[18px] gap-y-2 p-0">
                {(["fact1", "fact2", "fact3"] as const).map((k) => (
                  <li key={k} className="flex items-center gap-1.5 text-sm leading-5 text-[#27272a]">
                    <CheckIcon className="size-3.5 shrink-0 text-brand-ink" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </div>
          </Effect>
          <div aria-hidden className="relative h-[360px] max-lg:hidden">
            {ART.map(({ i, cls }) =>
              series[i] ? (
                <Image
                  key={i}
                  src={series[i].cover}
                  alt=""
                  width={300}
                  height={400}
                  className={cn("absolute aspect-[3/4] rounded-[14px] border-[3px] border-white object-cover shadow-[0_18px_40px_rgba(9,9,11,0.2)]", cls)}
                />
              ) : null
            )}
          </div>
        </div>
      </section>

      <div className="container flex flex-col gap-14 pt-12 pb-[72px]">
        <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView>
          <section aria-labelledby="how-title" className="flex flex-col gap-[18px]">
            <h2 id="how-title" className="type-h2">
              {t("howTitle")}
            </h2>
            <ol className="m-0 grid list-none gap-3.5 p-0 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((n) => (
                <li key={n} className="flex flex-col gap-2 rounded-card border bg-card p-[18px] shadow-xs">
                  <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                    <Num>{n}</Num>
                  </span>
                  <span className="type-h4">{t(`step${n}Title`)}</span>
                  <span className="text-[13px] leading-[18px] text-muted-foreground">{t(`step${n}Desc`)}</span>
                </li>
              ))}
            </ol>
          </section>
        </Effect>

        <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView>
          <section
            aria-labelledby="earn-title"
            className="grid items-center gap-8 rounded-[16px] border border-[#c9f1da] bg-brand-soft bg-[image:linear-gradient(135deg,#effcf4,#e3f9ec)] p-8 max-md:p-[18px] md:rounded-hero lg:grid-cols-[minmax(0,1fr)_420px]"
          >
            <div className="flex min-w-0 flex-col gap-3">
              <h2 id="earn-title" className="type-h2">
                {t("earnTitle")}
              </h2>
              <p className="max-w-[52ch] text-[13px] leading-5 text-[#3f3f46]">{t("earnBody1", { price })}</p>
              <p className="max-w-[52ch] text-[13px] leading-5 text-[#3f3f46]">{t("earnBody2")}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
              <h3 className="type-h4">{t("calcTitle")}</h3>
              <Range id="jn-readers" label={t("calcReaders")} min={10} max={2000} step={10} value={readers} onChange={setReaders} valueText={t("readersValue", { count: readers })} />
              <Range id="jn-eps" label={t("calcEpisodes")} min={1} max={12} step={1} value={eps} onChange={setEps} valueText={t("episodesValue", { count: eps })} />
              <div role="status" aria-live="polite" className="flex flex-col gap-0.5 rounded-card border bg-[#fafafa] p-3.5">
                <span className="text-xs leading-4 text-muted-foreground">{t("calcOutLabel")}</span>
                <span className="type-h2 tabular-nums">{t("calcCoins", { coins: fmt(coins) })}</span>
                <span className="text-xs leading-4 text-muted-foreground">{t("calcUsd")}</span>
              </div>
              <span className="text-xs leading-4 text-muted-foreground">{t("calcNote")}</span>
            </div>
          </section>
        </Effect>

        <Effect asChild fade slide={{ direction: "up", offset: 12 }} inView>
          <section aria-labelledby="get-title" className="flex flex-col gap-[18px]">
            <h2 id="get-title" className="type-h2">
              {t("getTitle")}
            </h2>
            <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-start gap-3">
                  <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="type-h4">{t(`${key}Title`)}</span>
                    <span className="text-[13px] leading-[18px] text-muted-foreground">{t(`${key}Desc`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Effect>

        <section aria-labelledby="rules-title" className="flex flex-col gap-4 rounded-[16px] border bg-card p-6 max-md:p-[18px]">
          <div className="flex flex-col gap-2">
            <h2 id="rules-title" className="type-h3">
              {t("rulesTitle")}
            </h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("rulesDesc")}</p>
          </div>
          <ul className="m-0 grid list-none gap-x-6 gap-y-2.5 p-0 md:grid-cols-2">
            {RULES.map((n) => (
              <li key={n} className="flex items-start gap-2 text-sm leading-5 text-[#27272a]">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand-ink" aria-hidden />
                {t(`rule${n}`)}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href="/legal/creator">{t("rulesLink")}</Link>
          </Button>
        </section>

        <section aria-labelledby="faq-title" className="flex flex-col gap-3">
          <h2 id="faq-title" className="type-h2">
            {t("faqTitle")}
          </h2>
          <Accordion type="single" collapsible defaultValue="faq-1" className="rounded-card border bg-card px-4 shadow-xs">
            {FAQ.map((n) => (
              <AccordionItem key={n} value={`faq-${n}`}>
                <AccordionTrigger className="min-h-[54px] items-center py-3 text-[15px] font-medium hover:text-foreground hover:underline hover:underline-offset-4">
                  {t(`q${n}`)}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-[22px] text-[#3f3f46]">{t(`a${n}`)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section aria-labelledby="cta-title" className="flex items-center justify-between gap-5 rounded-[16px] bg-foreground p-8 max-md:flex-col max-md:items-stretch max-md:p-[22px] md:rounded-hero">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id="cta-title" className="type-h2 text-white">
              {t("ctaTitle")}
            </h2>
            <p className="text-[13px] leading-5 text-[#d4d4d8]">{t("ctaDesc")}</p>
          </div>
          {start("lg", "focus-visible:ring-offset-foreground max-md:w-full")}
        </section>
      </div>
    </>
  )
}

function Range({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  valueText,
}: {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  valueText: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueText}
          onChange={(e) => onChange(Number(e.target.value) || min)}
          className="h-6 min-w-0 flex-1 cursor-pointer rounded-full accent-[#00a650] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <strong className="min-w-12 text-right text-sm tabular-nums"><Num>{fmt(value)}</Num></strong>
      </div>
    </div>
  )
}
