"use client"

import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "@/i18n/translations"
import { Badge } from "@/components/ui/badge"
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getSeries } from "@/data"
import type { Series } from "@/data/types"
import { useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useSearchSeries } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { useLocalize } from "@/lib/localize"

const MAX_RESULTS = 8
const POPULAR_COUNT = 6
/** Real API: ask once typing pauses this long. */
const DEBOUNCE_MS = 250

/** Demo: the demo catalogue, filtered as you type. */
function filterSeries(query: string): Series[] {
  const q = query.trim().toLowerCase()
  if (!q) return getSeries().slice(0, POPULAR_COUNT)
  return getSeries()
    .filter((s) => [s.title, s.creator, s.genre].some((field) => field.toLowerCase().includes(q)))
    .slice(0, MAX_RESULTS)
}

/**
 * ⌘K search dialog: "Popular now" when empty, "Series" results while typing.
 * Demo: the demo catalogue. Real API: GET /search (the most viewed series for an empty query), asked 250 ms after
 * typing stops; the last results stay while the next ones load.
 */
export function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("search")
  const loc = useLocalize()
  const tn = useTranslations("cards")
  const router = useRouter()
  const restoreFocus = useRestoreFocus()
  const [query, setQuery] = useState("")
  // Real API: the text the request uses, a moment after typing stops.
  const [asked, setAsked] = useState("")
  const typed = query.trim()
  useEffect(() => {
    if (DEMO_MODE) return
    const id = setTimeout(() => setAsked(typed), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [typed])
  const search = useSearchSeries(asked, asked ? MAX_RESULTS : POPULAR_COUNT, { enabled: !DEMO_MODE && open, keepPrevious: true })
  const demoResults = useMemo(() => (DEMO_MODE ? filterSeries(query) : []), [query])
  const results = DEMO_MODE ? demoResults : (search.data ?? [])
  // Real API: waiting for the pause or the answer, with nothing to show yet.
  const loading = !DEMO_MODE && results.length === 0 && !search.isError && (asked !== typed || search.isFetching || search.isPending)
  const failed = !DEMO_MODE && search.isError && !loading

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("")
      setAsked("")
    }
    onOpenChange(next)
  }

  function go(series: Series) {
    handleOpenChange(false)
    router.push(seriesHref(series))
  }

  function seeAll() {
    const q = query.trim()
    handleOpenChange(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[16%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]"
        {...restoreFocus}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        <CommandPrimitive
          shouldFilter={false}
          loop
          label={t("title")}
          className="flex w-full flex-col overflow-hidden rounded-dialog bg-popover text-popover-foreground"
        >
          <div className="flex h-12 items-center gap-3 border-b px-4">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t("placeholder")}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
            <kbd className="text-xs font-medium" aria-label={t("escLabel")}>
              {t("esc")}
            </kbd>
          </div>
          {/* Real API: "Searching…" and the failure are announced from here, outside the list of results (a listbox
              may hold options only). The polite region stays mounted so screen readers hear each change. */}
          {DEMO_MODE ? null : (
            <div role="status" aria-live="polite" className={loading ? "px-4 py-8 text-muted-foreground" : undefined}>
              {loading ? t("searching") : null}
            </div>
          )}
          {failed ? (
            <div role="alert" className="px-4 py-8 text-muted-foreground">
              {t("errorTitle")}
            </div>
          ) : null}
          <CommandList className="max-h-[60vh]">
            {loading || failed ? null : <CommandEmpty className="px-4 py-8 text-muted-foreground">{t("empty")}</CommandEmpty>}
            <CommandGroup heading={query.trim() ? t("series") : t("popular")}>
              {results.map((s) => (
                <CommandItem key={s.id} value={s.id} onSelect={() => go(s)} className="gap-3 py-2">
                  <span className="relative h-9 w-7 shrink-0 overflow-hidden rounded-sm bg-muted">
                    <Image src={s.cover} alt="" width={56} height={72} sizes="28px" className="size-full object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{s.title}</span>
                    <span className="type-caption truncate font-normal text-muted-foreground">
                      {s.creator} · {loc.genre(s.genre)}
                    </span>
                  </span>
                  {s.type === "novel" ? <Badge variant="secondary">{tn("novel")}</Badge> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {query.trim() && results.length > 0 ? (
              <CommandGroup>
                <CommandItem value="see-all" onSelect={seeAll} className="gap-3 py-2 text-muted-foreground">
                  <SearchIcon className="size-4" aria-hidden />
                  {t("seeAll", { q: query.trim() })}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
