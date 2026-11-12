"use client"

import { SearchIcon } from "@/components/animate-ui/icons/search"
import { XIcon } from "@/components/animate-ui/icons/x"
import { useTranslations } from "@/i18n/translations"
import { useMemo, useState } from "react"
import { HelpContact } from "@/components/pr/help-contact"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { demoData, type HelpArticle, type HelpTopic } from "@/data"
import { Link } from "@/i18n/navigation"
import { useHelpVotes } from "@/lib/help"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/** Topic cards in the prototype's order, with its glyphs (text presentation, so they don't turn into emoji). */
const TOPICS: { id: HelpTopic; glyph: string }[] = [
  { id: "account", glyph: "@" },
  { id: "coins", glyph: "C" },
  { id: "reading", glyph: "▶︎" },
  { id: "creators", glyph: "✎︎" },
  { id: "safety", glyph: "!" },
  { id: "tech", glyph: "⚙︎" },
]

/** The prototype's page names in `helpArticles[].link` → our routes (Legal and Settings by the link's label). */
function articleHref(a: HelpArticle): string | null {
  switch (a.link) {
    case "Shop":
      return "/coins"
    case "Legal":
      return /refund/i.test(a.linkLabel) ? "/legal/refund" : "/legal/community"
    case "Auth":
      return "/login"
    case "Settings":
      if (/reading/i.test(a.linkLabel)) return "/settings#set-reading"
      if (/blocked/i.test(a.linkLabel)) return "/settings#set-privacy"
      return "/settings"
    case "Notifications":
      return "/notifications#ns"
    case "CreateSeries":
      return "/creator/new"
    case "Upload":
      return "/creator/upload"
    case "Earnings":
      return "/creator/earnings"
    default:
      return null
  }
}

type Article = { i: number; topic: HelpTopic; q: string; a: string; link: string; href: string | null; hay: string }

/** Every word must appear (a trailing "s" may be dropped: "refunds" finds "refund"). */
function matches(hay: string, words: string[]) {
  return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, "")))
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * Help center (spec §19, prototype Help, screens 19-help-*): search with popular searches, 6 topic cards that filter,
 * the 17 `helpArticles` (localized from the `help` messages) with their links and "Was this helpful?", and the contact
 * form with other ways to reach us. Static content: no loading or error states.
 */
export function HelpPage() {
  const t = useTranslations("help")
  const [q, setQ] = useState("")
  const [topic, setTopic] = useState<HelpTopic | "all">("all")
  const [open, setOpen] = useState("")
  const { votes, vote: castVote } = useHelpVotes()

  const articles: Article[] = useMemo(
    () =>
      demoData.helpArticles.map((a, i) => {
        const has = t.has(`articles.${i}.q`)
        const q = has ? t(`articles.${i}.q`) : a.q
        const ans = has ? t(`articles.${i}.a`) : a.a
        const link = a.linkLabel && t.has(`articles.${i}.link`) ? t(`articles.${i}.link`) : a.linkLabel
        return { i, topic: a.topic, q, a: ans, link, href: articleHref(a), hay: `${q} ${ans} ${a.q} ${a.a}`.toLowerCase() }
      }),
    [t]
  )

  const query = q.trim()
  const filter = (text: string, by: HelpTopic | "all") => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    return articles.filter((a) => (by === "all" || a.topic === by) && matches(a.hay, words))
  }
  const list = filter(query, topic)
  const filtered = topic !== "all" || !!query

  function pickPopular(text: string) {
    setQ(text)
    setTopic("all")
    setOpen(String(filter(text, "all")[0]?.i ?? ""))
  }

  return (
    <>
      <section className="border-b bg-[#fafafa] bg-[image:radial-gradient(900px_300px_at_50%_-10%,#d9f7e6_0%,rgba(217,247,230,0)_70%)]">
        <Effect asChild fade slide={{ direction: "up", offset: 10 }}>
          <div className="container flex flex-col items-center gap-3.5 pt-8 pb-8 text-center md:pt-10 md:pb-9">
            <h1 className="type-h1">{t("title")}</h1>
            <form role="search" className="relative w-full max-w-[620px]" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="hp-q" className="sr-only">
                {t("searchLabel")}
              </label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="hp-q"
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setOpen("")
                }}
                placeholder={t("searchPh")}
                className="h-12 rounded-xl px-11 text-base shadow-md placeholder:text-[#a1a1aa] md:h-[52px] [&::-webkit-search-cancel-button]:hidden"
              />
              {q ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setQ("")}
                  aria-label={t("clear")}
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <XIcon className="size-3.5" />
                </Button>
              ) : null}
            </form>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-xs leading-4 text-muted-foreground">{t("popularLabel")}</span>
              {(t.raw("popular") as string[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pickPopular(p)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border bg-background px-3 text-xs font-medium whitespace-nowrap transition-colors hover:bg-accent",
                    focusRing
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Effect>
      </section>

      <div className="container flex flex-col gap-7 pt-7 pb-16">
        <div role="group" aria-label={t("topicsLabel")} className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
          {TOPICS.map(({ id, glyph }, ti) => {
            const on = topic === id
            const n = articles.filter((a) => a.topic === id).length
            return (
              <Effect key={id} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(ti, 10) * 40} inView>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTopic(on ? "all" : id)
                    setOpen("")
                  }}
                  className={cn(
                    "flex min-w-0 items-center gap-2.5 rounded-xl border bg-background p-3 text-left transition-colors hover:border-[#a1a1aa]",
                    on && "border-primary bg-selected shadow-[0_0_0_1px_var(--primary)] hover:border-primary",
                    focusRing
                  )}
                >
                  <span aria-hidden className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-muted text-base">
                    {glyph}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] leading-[18px] font-semibold">{t(`topics.${id}`)}</span>
                    <span className="text-xs leading-4 text-muted-foreground">{t("topicCount", { count: n })}</span>
                  </span>
                </button>
              </Effect>
            )
          })}
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="faq-title" className="flex min-w-0 flex-col gap-3">
            <div className="flex min-h-8 items-center justify-between gap-3">
              <h2 id="faq-title" className="type-h3">
                {topic !== "all" ? t(`topics.${topic}`) : query ? t("results") : t("common")}
              </h2>
              {filtered ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTopic("all")
                    setQ("")
                  }}
                >
                  {t("showAll")}
                </Button>
              ) : null}
            </div>
            <p role="status" aria-live="polite" className="text-[13px] leading-[18px] text-muted-foreground">
              {query ? t("countFor", { count: list.length, q: query }) : t("count", { count: list.length })}
            </p>

            {list.length ? (
              <Accordion
                type="single"
                collapsible
                value={open}
                onValueChange={setOpen}
                className="rounded-card border bg-card px-4 shadow-xs"
              >
                {list.map((a) => {
                  const vote = votes[a.i]
                  return (
                    <AccordionItem key={a.i} value={String(a.i)}>
                      <AccordionTrigger className="min-h-14 items-center gap-3 py-3 font-medium hover:text-foreground">
                        <span className="flex flex-col gap-0.5">
                          <span>{a.q}</span>
                          <span className="text-xs leading-4 font-normal text-muted-foreground">{t(`topics.${a.topic}`)}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="flex flex-col gap-2.5 text-sm leading-[22px] text-[#3f3f46]">
                          <div>{a.a}</div>
                          {a.href && a.link ? (
                            <Link href={a.href} className="self-start rounded-sm text-[13px] leading-[18px] font-semibold text-brand-ink underline-offset-3 hover:text-brand-ink">
                              {a.link}
                            </Link>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-xs leading-4 text-muted-foreground">
                            <span>{t("helpful")}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-pressed={vote === "y"}
                              className="aria-pressed:bg-accent"
                              onClick={() => castVote(a.i, "y")}
                            >
                              {t("yes")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-pressed={vote === "n"}
                              className="aria-pressed:bg-accent"
                              onClick={() => castVote(a.i, "n")}
                            >
                              {t("no")}
                            </Button>
                            <span role="status">{vote === "y" ? t("thanks") : vote === "n" ? t("sorry") : ""}</span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-card border bg-card px-5 py-8 text-center shadow-xs">
                <SearchIcon className="size-6 text-muted-foreground" aria-hidden />
                <h3 className="type-h4">{t("noneTitle", { q: query })}</h3>
                <p className="text-[13px] leading-[18px] text-muted-foreground">{t("noneText")}</p>
              </div>
            )}
          </section>

          <HelpContact />
        </div>
      </div>
    </>
  )
}
