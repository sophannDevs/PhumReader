"use client"

import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import Image from "next/image"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getSeries } from "@/data"
import type { Series } from "@/data/types"
import { useRouter } from "@/i18n/navigation"
import { seriesHref } from "@/lib/routes"
import { useRestoreFocus } from "@/lib/use-restore-focus"

const MAX_RESULTS = 8
const POPULAR_COUNT = 6

function filterSeries(query: string): Series[] {
  const q = query.trim().toLowerCase()
  if (!q) return getSeries().slice(0, POPULAR_COUNT)
  return getSeries()
    .filter((s) => [s.title, s.creator, s.genre].some((field) => field.toLowerCase().includes(q)))
    .slice(0, MAX_RESULTS)
}

/** ⌘K search dialog: "Popular now" when empty, "Series" results while typing. */
export function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("search")
  const tn = useTranslations("cards")
  const router = useRouter()
  const restoreFocus = useRestoreFocus()
  const [query, setQuery] = useState("")
  const results = useMemo(() => filterSeries(query), [query])

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  function go(series: Series) {
    handleOpenChange(false)
    router.push(seriesHref(series))
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
          <CommandList className="max-h-[60vh]">
            <CommandEmpty className="px-4 py-8 text-muted-foreground">{t("empty")}</CommandEmpty>
            <CommandGroup heading={query.trim() ? t("series") : t("popular")}>
              {results.map((s) => (
                <CommandItem key={s.id} value={s.id} onSelect={() => go(s)} className="gap-3 py-2">
                  <span className="relative h-9 w-7 shrink-0 overflow-hidden rounded-sm bg-muted">
                    <Image src={s.cover} alt="" width={56} height={72} className="size-full object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{s.title}</span>
                    <span className="type-caption truncate font-normal text-muted-foreground">
                      {s.creator} · {s.genre}
                    </span>
                  </span>
                  {s.type === "novel" ? <Badge variant="secondary">{tn("novel")}</Badge> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
