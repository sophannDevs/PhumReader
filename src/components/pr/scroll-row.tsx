"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Children, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Horizontal row of cards with < > buttons. Buttons only show when there is
 * more to scroll and are disabled-hidden at each end. Touch swipe still works.
 */
export function ScrollRow({
  children,
  itemClassName,
  className,
}: {
  children: React.ReactNode
  /** Width of each item, e.g. "w-[140px] md:w-[180px]". */
  itemClassName?: string
  className?: string
}) {
  const t = useTranslations("home")
  const ref = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [update, children])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" })
  }

  const arrow = "absolute top-[38%] z-10 hidden -translate-y-1/2 rounded-full shadow-md sm:inline-flex"

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role="list"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-1 md:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div role="listitem" className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </div>
        ))}
      </div>
      {canPrev ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("scrollPrev")}
          onClick={() => scrollBy(-1)}
          className={cn(arrow, "left-0 -translate-x-1/2")}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
      ) : null}
      {canNext ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("scrollNext")}
          onClick={() => scrollBy(1)}
          className={cn(arrow, "right-0 translate-x-1/2")}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
