"use client"

import { AlertCircleIcon, ClockIcon, HeartIcon, RefreshCwIcon, SearchIcon, TrendingUpIcon, XIcon } from "lucide-react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { Fragment, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { LineTabs, SubscribeButton, likesOf, replaceQuery, useCatalog } from "@/components/pr/browse-kit"
import { NativeSelect } from "@/components/pr/settings-ui"
import { SeriesCard } from "@/components/pr/series-card"
import { phoneSwipeRow, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { genres, type Genre, type Series, type Weekday } from "@/data"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { initials } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useAskToLogin } from "@/lib/me"
import { useSearchSeries } from "@/lib/queries"
import { creatorHref, seriesHref } from "@/lib/routes"
import { useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

/** Search terms people use (prototype `trending`): demo content, so English in both languages. */
const TRENDING = ["Glass Compass", "romance", "Mina Sok", "tiny dragon", "fantasy", "Letters to Tuesday", "sci-fi", "Sunday Sword"]
const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const PAGE = 6
/** The demo searches everything; the API returns at most 20. */
const LIMIT = DEMO_MODE ? 100 : 20

type Tab = "all" | "comic" | "novel" | "creator"
type Sort = "relevance" | "popular" | "episodes" | "az"

/** Best match: the title starts with the query, then contains it, then the creator, then the genre. */
function score(s: Series, k: string): number {
  const t = s.title.toLowerCase()
  if (t.startsWith(k)) return 4
  if (t.includes(k)) return 3
  if (s.creator.toLowerCase().includes(k)) return 2
  if (s.genre.toLowerCase().includes(k)) return 1
  return 0
}

/** Edit distance, for "Search “…” instead". */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** The text with every case-insensitive match of `k` in a yellow <mark>. */
function Highlight({ text, k }: { text: string; k: string }) {
  if (!k) return <>{text}</>
  const low = text.toLowerCase()
  const out: React.ReactNode[] = []
  let i = 0
  let j: number
  while ((j = low.indexOf(k, i)) >= 0) {
    if (j > i) out.push(<Fragment key={`t${i}`}>{text.slice(i, j)}</Fragment>)
    out.push(
      <mark key={`m${j}`} className="rounded-[2px] bg-[#fef08a] px-px text-inherit">
        {text.slice(j, j + k.length)}
      </mark>
    )
    i = j + k.length
  }
  if (i < text.length) out.push(<Fragment key={`t${i}`}>{text.slice(i)}</Fragment>)
  return <>{out}</>
}

/**
 * Search (spec §7, prototype Search) on /search?q=: a big search field; before typing, recent searches (stored),
 * trending searches and genres; then results with All / Comics / Web novels / Creators tabs (with counts), genre,
 * day and sort filters, highlighted matches, Subscribe / Follow, "Show more" (6 at a time), and loading, error and
 * no-results states (with "Search “…” instead" and popular series). Typing searches after 300 ms and keeps ?q= in
 * the URL; Enter, a recent or trending search, and arriving with ?q= also save it to recent searches.
 */
export function SearchPage() {
  const t = useTranslations("search")
  const urlQ = useSearchParams().get("q") ?? ""
  const hydrated = useHydrated()
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef({ typing: 0, more: 0 })

  // The committed search is the URL's ?q= (this page writes it with replaceQuery; ⌘K "See all results" and
  // back / forward change it from outside).
  const query = urlQ.trim()
  const [draft, setDraft] = useState(urlQ)
  /** The last ?q= this page wrote, to tell its own URL changes from outside ones. */
  const [written, setWritten] = useState<string | null>(null)
  const [seenUrl, setSeenUrl] = useState(urlQ)
  /** The last search that arrived from outside (n counts arrivals, so the same text saves again). */
  const [arrival, setArrival] = useState({ q: query, n: 0 })
  const [tab, setTab] = useState<Tab>("all")
  const [genre, setGenre] = useState<Genre | "all">("all")
  const [day, setDay] = useState<Weekday | "all">("all")
  const [sort, setSort] = useState<Sort>("relevance")
  const [shown, setShown] = useState(PAGE)
  const [moreBusy, setMoreBusy] = useState(false)

  if (urlQ !== seenUrl) {
    setSeenUrl(urlQ)
    setTab("all")
    setShown(PAGE)
    if (query !== written) {
      setDraft(urlQ)
      setArrival((a) => ({ q: query, n: a.n + 1 }))
    }
  }

  // A search that arrives in the URL counts as a search that ran: save it once the stored state is loaded.
  useEffect(() => {
    if (hydrated && arrival.q) useAppStore.getState().addRecentSearch(arrival.q)
  }, [hydrated, arrival])

  useEffect(() => {
    const box = timers.current
    return () => {
      window.clearTimeout(box.typing)
      window.clearTimeout(box.more)
    }
  }, [])

  /** Runs a search; `save` adds it to recent searches (Enter, chips), typing does not. */
  function run(raw: string, save: boolean) {
    window.clearTimeout(timers.current.typing)
    const q = raw.trim()
    if (save && q) useAppStore.getState().addRecentSearch(q)
    setDraft(raw)
    setTab("all")
    setShown(PAGE)
    setWritten(q)
    replaceQuery({ q: q || null })
  }

  function onDraft(value: string) {
    setDraft(value)
    window.clearTimeout(timers.current.typing)
    timers.current.typing = window.setTimeout(() => run(value, false), 300)
  }

  function more() {
    setMoreBusy(true)
    timers.current.more = window.setTimeout(() => {
      setMoreBusy(false)
      setShown((n) => n + PAGE)
    }, 450)
  }

  return (
    <div className="container flex flex-col gap-6 pt-7 pb-[72px]">
      <h1 className="sr-only">{t("pageTitle")}</h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          run(draft, true)
        }}
        className="flex h-14 items-center gap-2 rounded-[14px] border border-input bg-background pr-2 pl-4 shadow-xs transition-[border-color,box-shadow] focus-within:border-[#a1a1aa] focus-within:ring-[3px] focus-within:ring-[rgba(0,166,80,0.22)] max-md:h-[50px] max-md:pr-1.5 max-md:pl-3"
      >
        <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <label htmlFor={inputId} className="sr-only">
          {t("fieldLabel")}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder={t("fieldPlaceholder")}
          aria-describedby={hintId}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground max-md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {draft ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("clear")}
            onClick={() => {
              run("", false)
              inputRef.current?.focus()
            }}
          >
            <XIcon />
          </Button>
        ) : null}
        <Button type="submit" variant="brand" className="max-md:px-3">
          {t("submit")}
        </Button>
      </form>
      <p id={hintId} className="sr-only">
        {t("hint")}
      </p>

      {query ? (
        <Results
          query={query}
          tab={tab}
          onTab={(v) => {
            setTab(v)
            setShown(PAGE)
          }}
          filters={{ genre, day, sort }}
          onGenre={(v) => {
            setGenre(v)
            setShown(PAGE)
          }}
          onDay={(v) => {
            setDay(v)
            setShown(PAGE)
          }}
          onSort={setSort}
          onResetFilters={() => {
            setGenre("all")
            setDay("all")
            setShown(PAGE)
          }}
          shown={shown}
          moreBusy={moreBusy}
          onMore={more}
          onSearch={(q) => run(q, true)}
        />
      ) : (
        <Landing onSearch={(q) => run(q, true)} />
      )}
    </div>
  )
}

/** Before typing: recent searches (stored), trending searches and genres. */
function Landing({ onSearch }: { onSearch: (q: string) => void }) {
  const t = useTranslations("search")
  const loc = useLocalize()
  const hydrated = useHydrated()
  const recent = useAppStore((s) => s.recentSearches)
  const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

  return (
    <div className="grid grid-cols-2 items-start gap-x-12 gap-y-8 max-md:grid-cols-[minmax(0,1fr)] max-md:gap-6">
      {hydrated && recent.length > 0 ? (
        <section aria-labelledby="rc-h" className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="rc-h" className="type-h4">
              {t("recentTitle")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                useAppStore.getState().clearRecentSearches()
                toast.success(t("recentCleared"))
              }}
            >
              {t("clearAll")}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <li key={q} className="inline-flex h-8 max-w-full items-center overflow-hidden rounded-full border bg-background">
                <button
                  type="button"
                  onClick={() => onSearch(q)}
                  className={cn("inline-flex h-full min-w-0 items-center gap-1.5 pr-1.5 pl-3 text-[13px] font-medium hover:bg-accent", focusRing)}
                >
                  <ClockIcon className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{q}</span>
                </button>
                <button
                  type="button"
                  aria-label={t("recentRemove", { q })}
                  onClick={() => useAppStore.getState().removeRecentSearch(q)}
                  className={cn("inline-flex h-full w-7 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent", focusRing)}
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tr-h" className="flex min-w-0 flex-col gap-2.5">
        <h2 id="tr-h" className="type-h4 flex items-center gap-1.5">
          <TrendingUpIcon className="size-4" aria-hidden />
          {t("trendingTitle")}
        </h2>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-0.5 max-md:grid-cols-[minmax(0,1fr)]">
          {TRENDING.map((q, i) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onSearch(q)}
                className={cn("flex h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-accent", focusRing)}
              >
                <span className="w-[18px] font-bold text-brand-ink tabular-nums"><Num>{i + 1}</Num></span>
                {q}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="bg-h" className="col-span-full flex min-w-0 flex-col gap-2.5">
        <h2 id="bg-h" className="type-h4">
          {t("genresTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {genres().map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onSearch(g)}
              className="inline-flex h-8 items-center rounded-full border bg-background px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {loc.genre(g)}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

type Filters = { genre: Genre | "all"; day: Weekday | "all"; sort: Sort }

function Results({
  query,
  tab,
  onTab,
  filters,
  onGenre,
  onDay,
  onSort,
  onResetFilters,
  shown,
  moreBusy,
  onMore,
  onSearch,
}: {
  query: string
  tab: Tab
  onTab: (tab: Tab) => void
  filters: Filters
  onGenre: (v: Genre | "all") => void
  onDay: (v: Weekday | "all") => void
  onSort: (v: Sort) => void
  onResetFilters: () => void
  shown: number
  moreBusy: boolean
  onMore: () => void
  onSearch: (q: string) => void
}) {
  const t = useTranslations("search")
  const td = useTranslations("data")
  const loc = useLocalize()
  const search = useSearchSeries(query, LIMIT)
  const k = query.toLowerCase()
  const { genre, day, sort } = filters
  const net = search.isPending ? "loading" : search.isError ? "error" : "ready"
  const found = search.data ?? []

  const filtered = found.filter((s) => (genre === "all" || s.genre === genre) && (day === "all" || s.updateDay === day))
  const byTab = (list: Series[], tb: Tab) =>
    tb === "comic" ? list.filter((s) => s.type !== "novel") : tb === "novel" ? list.filter((s) => s.type === "novel") : list
  const sorted = [...byTab(filtered, tab)].sort((a, b) => {
    if (sort === "popular") return likesOf(b) - likesOf(a)
    if (sort === "az") return a.title.localeCompare(b.title)
    if (sort === "episodes") return b.freeEpisodes - a.freeEpisodes
    return score(b, k) - score(a, k) || likesOf(b) - likesOf(a)
  })
  // Creators come from the results (both modes): names that match the query, with their series.
  const creators = [...new Set(found.map((s) => s.creator))]
    .filter((c) => c.toLowerCase().includes(k))
    .map((name) => ({ name, series: found.filter((s) => s.creator === name) }))

  const counts: Record<Tab, number> = {
    all: filtered.length + creators.length,
    comic: byTab(filtered, "comic").length,
    novel: byTab(filtered, "novel").length,
    creator: creators.length,
  }
  const hasFilters = genre !== "all" || day !== "all"
  const none =
    net === "ready" && (tab === "creator" ? creators.length === 0 : sorted.length === 0 && !(tab === "all" && creators.length > 0))
  const showCreators = net === "ready" && creators.length > 0 && (tab === "all" || tab === "creator")
  const showSeries = net === "ready" && tab !== "creator" && sorted.length > 0
  const ready = net === "ready"

  return (
    <div className="flex flex-col gap-4">
      <p className="min-h-[18px] text-[13px] leading-[18px]" aria-live="polite">
        {net === "error" ? null : (
          <>
            <strong className="font-semibold">{ready ? t(`resultLine.${tab}`, { count: counts[tab] }) : t("searching")}</strong>{" "}
            <span className="text-muted-foreground">{t("forQuery", { q: query })}</span>
          </>
        )}
      </p>

      <LineTabs
        idBase="sr"
        label={t("tabsLabel")}
        value={tab}
        onChange={onTab}
        items={(["all", "comic", "novel", "creator"] as const).map((v) => ({
          value: v,
          label: t(`tabs.${v}`),
          count: ready ? counts[v] : undefined,
        }))}
      />

      <div role="tabpanel" id="sr-panel" aria-labelledby={`sr-tab-${tab}`} className="flex flex-col gap-4">
        {tab !== "creator" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 max-md:grid max-md:grid-cols-2 max-md:gap-2">
            <div className="flex flex-wrap items-center gap-2 max-md:contents">
              <NativeSelect
                aria-label={t("genreLabel")}
                value={genre}
                onChange={(e) => onGenre(e.target.value as Genre | "all")}
                wrapperClassName="md:w-auto md:min-w-[150px]"
              >
                <option value="all">{t("allGenres")}</option>
                {genres().map((g) => (
                  <option key={g} value={g}>
                    {loc.genre(g)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label={t("dayLabel")}
                value={day}
                onChange={(e) => onDay(e.target.value as Weekday | "all")}
                wrapperClassName="md:w-auto md:min-w-[150px]"
              >
                <option value="all">{t("anyDay")}</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t("updatesOn", { day: td(`dayFull.${d}`) })}
                  </option>
                ))}
              </NativeSelect>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={onResetFilters} className="max-md:h-9 max-md:justify-start">
                  <XIcon className="size-3.5" aria-hidden />
                  {t("clearFilters")}
                </Button>
              ) : null}
            </div>
            <label className="flex min-w-0 items-center gap-2">
              <span className="text-[13px] leading-[18px] whitespace-nowrap text-muted-foreground max-md:sr-only">{t("sortLabel")}</span>
              <NativeSelect value={sort} onChange={(e) => onSort(e.target.value as Sort)} wrapperClassName="md:w-auto md:min-w-[150px]">
                {(["relevance", "popular", "episodes", "az"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`sort.${v}`)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
        ) : null}

        {net === "loading" ? (
          <div role="status" aria-label={t("loadingLabel")} className="flex flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b py-3.5 last:border-b-0">
                <Skeleton className="h-24 w-[72px] shrink-0" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-[11px] w-3/5" />
                  <Skeleton className="h-[11px] w-[30%]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {net === "error" ? (
          <StateBox
            icon={AlertCircleIcon}
            tone="bad"
            title={t("errorTitle")}
            text={t("errorText")}
            action={
              <Button variant="outline" size="sm" onClick={() => void search.refetch()}>
                <RefreshCwIcon className="size-3.5" aria-hidden />
                {t("tryAgain")}
              </Button>
            }
          />
        ) : null}

        {none ? <NoResults query={query} tab={tab} hasFilters={hasFilters} onClear={onResetFilters} onSearch={onSearch} /> : null}

        {showCreators ? (
          <section aria-labelledby={tab === "all" ? "cr-h" : undefined} aria-label={tab === "all" ? undefined : t("creatorsTitle")} className="flex flex-col gap-2.5">
            {tab === "all" ? (
              <h2 id="cr-h" className="type-h4">
                {t("creatorsTitle")}
              </h2>
            ) : null}
            <ul className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-[minmax(0,1fr)]">
              {(tab === "all" ? creators.slice(0, 3) : creators).map((c) => (
                <CreatorItem key={c.name} name={c.name} series={c.series} k={k} />
              ))}
            </ul>
          </section>
        ) : null}

        {showSeries ? (
          <section aria-labelledby={tab === "all" ? "se-h" : undefined} aria-label={tab === "all" ? undefined : t(`tabs.${tab}`)} className="flex flex-col gap-1">
            {tab === "all" ? (
              <h2 id="se-h" className="type-h4 pb-1.5">
                {t("seriesTitle")}
              </h2>
            ) : null}
            <ul className="flex flex-col">
              {sorted.slice(0, shown).map((s) => (
                <ResultRow key={s.id} series={s} k={k} />
              ))}
            </ul>
            {sorted.length > shown ? (
              <div className="flex flex-col items-center gap-2 pt-3">
                <span className="text-xs leading-4 text-muted-foreground">{t("showing", { shown: Math.min(shown, sorted.length), total: sorted.length })}</span>
                <Button variant="outline" loading={moreBusy} onClick={onMore}>
                  {t("showMore")}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ResultRow({ series: s, k }: { series: Series; k: string }) {
  const t = useTranslations("search")
  const tc = useTranslations("cards")
  const loc = useLocalize()
  const novel = s.type === "novel"
  return (
    <li className="group flex items-center gap-4 border-b py-3.5 last:border-b-0 max-md:items-start max-md:gap-3 max-md:py-3">
      <Link
        href={seriesHref(s)}
        tabIndex={-1}
        aria-hidden
        className="h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-muted max-md:h-20 max-md:w-[60px]"
      >
        <Image src={s.cover} alt="" width={144} height={192} sizes="72px" className="cover-zoom size-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-1.5">
          {novel ? <Badge variant="secondary">{t("webNovel")}</Badge> : null}
          {s.badges.up ? <Badge variant="up">{tc("up")}</Badge> : null}
          <Badge variant="outline">{loc.genre(s.genre)}</Badge>
        </div>
        <Link
          href={seriesHref(s)}
          className="block truncate rounded-sm text-base leading-[22px] font-semibold underline-offset-[3px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:line-clamp-2 max-md:text-[15px] max-md:whitespace-normal"
        >
          <Highlight text={s.title} k={k} />
        </Link>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{loc.hook(s)}</span>
        <span className="flex flex-wrap gap-x-2.5 text-xs leading-4 text-muted-foreground">
          <span>{s.creator}</span>
          <span>{novel ? t("chapters", { count: s.freeEpisodes }) : t("episodes", { count: s.freeEpisodes })}</span>
          <span className="inline-flex items-center gap-[3px]">
            <HeartIcon className="size-3" aria-hidden />
            <span className="sr-only">{t("likes", { count: s.likes })}</span>
            <span aria-hidden><Num>{s.likes}</Num></span>
          </span>
          {s.schedule ? <span>{loc.schedule(s.schedule)}</span> : null}
        </span>
      </div>
      <SubscribeButton
        series={s}
        labels={[t("subscribe"), t("subscribed")]}
        title={s.title}
        className="max-md:px-2.5"
      />
    </li>
  )
}

/** Creator result: initials, name (links to the profile), "N series · titles", Follow (stored follows). */
function CreatorItem({ name, series, k }: { name: string; series: Series[]; k: string }) {
  const t = useTranslations("search")
  const tt = useTranslations("toasts")
  const hydrated = useHydrated()
  const user = useUser()
  const askToLogin = useAskToLogin()
  const stored = useAppStore((s) => s.follows.includes(name))
  const on = hydrated && stored

  function follow() {
    if (!user) return askToLogin()
    useAppStore.getState().toggleFollow(name)
    toast.success(tt(on ? "unfollowed" : "followed", { name }))
  }

  return (
    <li className="flex items-center gap-3 rounded-card border bg-card p-3 shadow-xs">
      <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initials(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={creatorHref(name)}
          className="type-h4 block truncate rounded-sm underline-offset-[3px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Highlight text={name} k={k} />
        </Link>
        <span className="truncate text-xs leading-4 text-muted-foreground">
          {t("creatorMeta", {
            count: series.length,
            titles: series
              .slice(0, 2)
              .map((s) => s.title)
              .join(", "),
          })}
        </span>
      </div>
      <Button variant="outline" size="sm" aria-pressed={on} onClick={follow}>
        {on ? t("following") : t("follow")}
      </Button>
    </li>
  )
}

/** No results: the message, "Search “…” instead" (closest title) or Clear filters, then six popular series. */
function NoResults({
  query,
  tab,
  hasFilters,
  onClear,
  onSearch,
}: {
  query: string
  tab: Tab
  hasFilters: boolean
  onClear: () => void
  onSearch: (q: string) => void
}) {
  const t = useTranslations("search")
  const catalog = useCatalog()
  const k = query.toLowerCase()
  const pool = catalog.series

  let suggest: string | null = null
  if (!hasFilters && pool.length > 0) {
    let best = ""
    let bd = Infinity
    for (const s of pool) {
      const d = distance(k, s.title.toLowerCase())
      if (d < bd) {
        bd = d
        best = s.title
      }
    }
    if (best && bd > 0 && bd <= Math.max(2, Math.floor(k.length / 3))) suggest = best
  }
  const popular = [...pool].sort((a, b) => likesOf(b) - likesOf(a)).slice(0, 6)

  return (
    <>
      <StateBox
        icon={SearchIcon}
        role="status"
        title={hasFilters ? t(`noneFilters.${tab}`) : t(`noneQuery.${tab}`, { q: query })}
        text={hasFilters ? t("noneFiltersText") : t("noneQueryText")}
        action={
          suggest || hasFilters ? (
            <div className="flex flex-wrap justify-center gap-2">
              {suggest ? (
                <Button variant="outline" size="sm" onClick={() => onSearch(suggest)}>
                  {t("suggest", { title: suggest })}
                </Button>
              ) : null}
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={onClear}>
                  {t("clearFilters")}
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {popular.length > 0 ? (
        <section aria-labelledby="pp-h" className="flex flex-col gap-3 pt-2">
          <h2 id="pp-h" className="type-h4">
            {t("popularTitle")}
          </h2>
          <div className={cn("grid grid-cols-6 gap-4 max-lg:grid-cols-4", phoneSwipeRow, "max-md:auto-cols-[38%]")}>
            {popular.map((s) => (
              <SeriesCard key={s.id} series={s} footer={null} badges="none" />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

/** Route-level loading (loading.tsx): the search field and four result rows. */
export function SearchSkeleton() {
  return (
    <div className="container flex flex-col gap-6 pt-7 pb-[72px]" aria-busy="true" aria-hidden>
      <Skeleton className="h-14 w-full rounded-[14px] max-md:h-[50px]" />
      <div className="flex flex-col">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b py-3.5 last:border-b-0">
            <Skeleton className="h-24 w-[72px] shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-[11px] w-3/5" />
              <Skeleton className="h-[11px] w-[30%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
