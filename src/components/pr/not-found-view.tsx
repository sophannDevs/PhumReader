"use client"

import { ChevronRightIcon, HomeIcon, SearchIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { ErrorCards, ErrorHelp, ErrorHero, errorActions, errorLinkButton } from "@/components/pr/error-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSeries, type Series } from "@/data"
import { Link, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useLocalize } from "@/lib/localize"
import { parseCount } from "@/lib/format"
import { useRankings } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"

const noSubscribe = () => () => {}

/** "phumireader.app/series/glas-compas": the address that was asked for (client only). */
function useTriedAddress(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return `${window.location.host}${decodeURI(window.location.pathname)}`
      } catch {
        return `${window.location.host}${window.location.pathname}`
      }
    },
    () => ""
  )
}

/** Edit distance (Levenshtein), for "Did you mean". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/** First path segments of the site's own routes: never a series name. */
const ROUTE_WORDS = new Set([
  "series", "read", "novel", "genres", "search", "rankings", "library", "coins", "orders", "settings", "help", "legal",
  "creator", "creators", "notifications", "welcome", "login", "comments", "admin", "upload", "new", "earnings",
])

/** The path segments that could be a mistyped series slug ("glas-compas" in /series/glas-compas/3). */
function pathWords(address: string): string[] {
  return address
    .split("/")
    .slice(1)
    .map((s) => slugify(s))
    .filter((s) => s.length >= 3 && !/^\d+$/.test(s) && !ROUTE_WORDS.has(s))
}

/** The series whose slug or title is closest to a path segment, when it is close enough. */
function closestSeries(words: string[], pool: Series[]): Series | undefined {
  let best: Series | undefined
  let bestScore = Infinity
  for (const word of words) {
    const limit = Math.max(2, Math.floor(word.length * 0.35))
    for (const s of pool) {
      const d = Math.min(distance(word, s.slug), distance(word, slugify(s.title)))
      if (d <= limit && d < bestScore) {
        best = s
        bestScore = d
      }
    }
  }
  return best
}

/**
 * 404 (spec §9, screens 09-error-404-*): the address they tried, "Did you mean" (the closest series to the address),
 * search, Go to Home, Help center · Report a broken link, and "Popular right now" (comics and novels by views).
 */
export function NotFoundView() {
  const t = useTranslations("notFound")
  const te = useTranslations("errors")
  const loc = useLocalize()
  const router = useRouter()
  const address = useTriedAddress()
  const [q, setQ] = useState("")
  const comics = useRankings("comics")
  const novels = useRankings("novels")

  const popular = useMemo(() => {
    const all = [...(comics.data ?? []), ...(novels.data ?? [])].map((r) => r.series)
    return all.sort((a, b) => parseCount(b.views) - parseCount(a.views))
  }, [comics.data, novels.data])

  const words = useMemo(() => pathWords(address), [address])
  const suggest = useMemo(() => {
    if (!words.length) return undefined
    return closestSeries(words, DEMO_MODE ? getSeries() : popular)
  }, [words, popular])

  const cards = popular.filter((s) => s.id !== suggest?.id).slice(0, 6)
  const loading = comics.isPending || novels.isPending

  function search(e: React.FormEvent) {
    e.preventDefault()
    // An empty search looks for the words of the address they tried (the prototype's behaviour).
    const query = q.trim() || words.at(-1)?.replace(/-/g, " ") || ""
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
  }

  return (
    <ErrorHero
      kind="notFound"
      title={t("title")}
      body={t("body")}
      below={<ErrorCards title={te("popular")} series={cards} loading={loading} />}
    >
      {address ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs leading-4 text-muted-foreground">{t("youAsked")}</span>
          <code className="rounded-md bg-muted px-2 py-[3px] font-mono text-xs break-all text-foreground">{address}</code>
        </div>
      ) : null}

      {suggest ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] leading-[18px]">{t("didYouMean")}</span>
          <Link
            href={seriesHref(suggest)}
            className="flex max-w-[420px] items-center gap-3 rounded-card border bg-background py-2 pr-3 pl-2 transition-colors outline-none hover:border-primary hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image src={suggest.cover} alt="" width={80} height={104} sizes="40px" className="h-[52px] w-10 shrink-0 rounded-md object-cover" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] leading-[18px] font-semibold">{suggest.title}</span>
              <span className="truncate text-xs leading-4 text-muted-foreground">
                {suggest.creator} · {loc.genre(suggest.genre)}
              </span>
            </span>
            <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      ) : null}

      <form role="search" onSubmit={search} className="relative flex gap-2">
        <label htmlFor="er-q" className="sr-only">
          {t("searchLabel")}
        </label>
        <SearchIcon className="pointer-events-none absolute top-[13px] left-3 size-[18px] text-muted-foreground" aria-hidden />
        <Input
          id="er-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPh")}
          className="h-11 flex-auto pl-10 text-[15px] placeholder:text-[#a1a1aa]"
        />
        <Button type="submit" variant="brand" className="h-11 max-md:px-3.5">
          {t("search")}
        </Button>
      </form>

      <div className={errorActions}>
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <HomeIcon />
            {te("home")}
          </Link>
        </Button>
      </div>

      <ErrorHelp
        extra={
          <>
            {" · "}
            <button type="button" className={errorLinkButton} onClick={() => toast.success(t("reported"))}>
              {t("report")}
            </button>
          </>
        }
      />
    </ErrorHero>
  )
}
