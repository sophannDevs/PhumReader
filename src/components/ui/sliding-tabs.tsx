"use client"

import * as React from "react"
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight"

/**
 * A sliding indicator for tab lists and pill toggles that keep their own markup, ARIA and keyboard handling
 * (Animate UI `Highlight`, the same effect its Tabs use). Wrap the list's children in <SlidingTabs>, and each tab
 * button in <SlidingTab>; the one indicator slides to the tab whose `value` matches.
 *
 * - `pill` styles the indicator (it fills the tab: `inset-0 ...`, or an underline: `inset-x-0 bottom-0 h-0.5 ...`).
 * - The tab's own classes must not paint the selected look any more, only the selected text colour.
 */
export function SlidingTabs({
  value,
  pill,
  children,
}: {
  /** The selected tab's value, or null when none is selected. */
  value: string | null
  pill: string
  children: React.ReactNode
}) {
  return (
    <Highlight
      controlledItems
      click={false}
      value={value}
      className={pill}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
    >
      {children}
    </Highlight>
  )
}

/** One tab's slot. It adds no role (role="none"), so `role="tab"` stays a direct child of the tablist in the a11y tree. */
export function SlidingTab({ value, className, children }: { value: string; className?: string; children: React.ReactElement }) {
  return (
    <HighlightItem as="span" role="none" value={value} className={className}>
      {children}
    </HighlightItem>
  )
}
