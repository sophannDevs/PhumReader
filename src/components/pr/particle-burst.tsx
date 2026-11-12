"use client"

/**
 * Small ring of dots that bursts out of a toggle when it switches ON (like, subscribe, follow, bookmark, "Add"),
 * or out of a success check badge when it appears (Animate UI Particles).
 *
 * Toggles: `const [burst, arm] = useBurstOnPress(on)`, call `arm()` in the button's onClick before the toggle,
 * and wrap the icon (or the label) in `<ParticleBurst burst={burst}>`. A burst only plays when the reader's own
 * press turns the toggle on: the first render, state that loads later, switching off and a logged-out press that
 * only opens the log-in prompt stay quiet. Success badges: `<SuccessBurst>{badge}</SuccessBurst>` plays once.
 *
 * The dots are aria-hidden and pointer-events-none; only the effect remounts (`key`), so the button keeps focus.
 */

import { Particles, ParticlesEffect } from "@animate-ui/react/primitives/effects/particles"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Tone = "primary" | "destructive"
type Variant = "press" | "success"

const TONE: Record<Tone, string> = { primary: "bg-primary", destructive: "bg-destructive" }

const VARIANT = {
  press: { count: 8, radius: 20, spread: 360, duration: 0.6, holdDelay: 0.02, delay: 0, dot: "size-1" },
  success: { count: 10, radius: 40, spread: 360, duration: 0.8, holdDelay: 0.02, delay: 0.25, dot: "size-2" },
} as const

/** How long a press stays "armed" while the toggle waits for its new state (store or query update). */
const ARM_MS = 1500

/** Counts bursts for a toggle: grows by one each time the reader's own press switches `on` from false to true. */
export function useBurstOnPress(on: boolean): [burst: number, arm: () => void] {
  const [burst, setBurst] = useState(0)
  const armed = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const arm = useCallback(() => {
    clearTimeout(timer.current)
    // Only a press that switches the toggle ON may burst.
    armed.current = !on
    if (armed.current) timer.current = setTimeout(() => { armed.current = false }, ARM_MS)
  }, [on])

  useEffect(() => {
    if (on && armed.current) {
      armed.current = false
      clearTimeout(timer.current)
      setBurst((b) => b + 1)
    }
  }, [on])

  useEffect(() => () => clearTimeout(timer.current), [])

  return [burst, arm]
}

export function ParticleBurst({
  burst,
  tone = "primary",
  variant = "press",
  radius,
  className,
  children,
}: {
  /** Each new value (> 0) plays the burst once. */
  burst: number
  tone?: Tone
  variant?: Variant
  /** Overrides the variant's radius in px (press bursts stay ≤ 20 so they never cause horizontal scrolling). */
  radius?: number
  className?: string
  children: ReactNode
}) {
  const v = VARIANT[variant]
  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      {/* 0×0 anchor at the child's centre: the effect sits at the anchor's "top centre", which is that same point. */}
      <Particles asChild animate={burst > 0} style={{ position: "absolute", top: "50%", left: "50%" }}>
        <span aria-hidden className="pointer-events-none size-0">
          <ParticlesEffect
            key={burst}
            aria-hidden
            data-particle=""
            count={v.count}
            radius={radius ?? v.radius}
            spread={v.spread}
            duration={v.duration}
            holdDelay={v.holdDelay}
            delay={v.delay}
            className={cn("pointer-events-none rounded-full", v.dot, TONE[tone])}
          />
        </span>
      </Particles>
    </span>
  )
}

/** Plays a success burst once, when the badge mounts. */
export function SuccessBurst({
  tone = "primary",
  radius,
  className,
  children,
}: {
  tone?: Tone
  radius?: number
  className?: string
  children: ReactNode
}) {
  return (
    <ParticleBurst burst={1} tone={tone} variant="success" radius={radius} className={className}>
      {children}
    </ParticleBurst>
  )
}
