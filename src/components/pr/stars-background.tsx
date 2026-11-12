"use client"

import { useEffect } from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Animate UI "Stars" background (animate-ui.com/docs/backgrounds/stars), written by hand on `motion`: three layers
 * of tiny stars (1, 2 and 3 px) drifting up at different speeds, with a gentle parallax toward the pointer.
 *
 * Decorative only: `aria-hidden`, no pointer events, behind the content (`-z-10`; the parent needs `isolate` so the
 * stars sit above its background and below everything else). The field is one viewport tall and sticks to the top
 * while the page scrolls (`overflow-clip` keeps `sticky` working and stops any horizontal overflow).
 * Stars are drawn as box-shadows without a colour, so they take `currentColor`: set it with a text class.
 * With `prefers-reduced-motion` the stars stay still (no drift, no parallax).
 */

/** Size of one tile of stars; each layer repeats it once below itself so the upward loop has no seam. */
const TILE = 2000

/** Small seeded random numbers, so the server and the browser draw the same stars (no hydration mismatch). */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `x y` offsets (no colour: box-shadow then uses currentColor) spread over one tile. */
function starShadows(count: number, seed: number): string {
  const rand = seeded(seed)
  return Array.from({ length: count }, () => `${Math.floor(rand() * TILE)}px ${Math.floor(rand() * TILE)}px`).join(",")
}

const LAYERS = [
  { size: 1, shadows: starShadows(500, 11), speed: 1 },
  { size: 2, shadows: starShadows(160, 23), speed: 2 },
  { size: 3, shadows: starShadows(70, 37), speed: 4 },
] as const

function StarLayer({ size, shadows, duration, still }: { size: number; shadows: string; duration: number; still: boolean }) {
  const dot = { width: size, height: size, boxShadow: shadows }
  return (
    <motion.div
      data-slot="star-layer"
      className="absolute top-0 left-0 h-[2000px] w-full"
      animate={still ? undefined : { y: [0, -TILE] }}
      transition={still ? undefined : { repeat: Infinity, duration, ease: "linear" }}
    >
      <div className="absolute top-0 left-0 rounded-full" style={dot} />
      <div className="absolute top-[2000px] left-0 rounded-full" style={dot} />
    </motion.div>
  )
}

type Props = {
  className?: string
  /** Seconds for the smallest stars to drift one tile; the bigger layers take 2× and 4× as long. */
  speed?: number
  /** How far the field follows the pointer (fraction of its distance from the centre). */
  factor?: number
}

export function StarsBackground({ className, speed = 80, factor = 0.02 }: Props) {
  const reduced = useReducedMotion() ?? false
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const x = useSpring(offsetX, { stiffness: 50, damping: 20 })
  const y = useSpring(offsetY, { stiffness: 50, damping: 20 })

  useEffect(() => {
    if (reduced) {
      offsetX.set(0)
      offsetY.set(0)
      return
    }
    // Parallax only for a mouse or pen (no touch), straight on the motion values: no React render per move.
    if (!window.matchMedia?.("(pointer: fine)").matches) return
    function onMove(e: PointerEvent) {
      offsetX.set(-(e.clientX - window.innerWidth / 2) * factor)
      offsetY.set(-(e.clientY - window.innerHeight / 2) * factor)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduced, factor, offsetX, offsetY])

  return (
    <div
      aria-hidden
      data-slot="stars-background"
      data-still={reduced || undefined}
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-clip select-none", className)}
    >
      <div className="sticky top-0 h-lvh w-full overflow-hidden">
        <motion.div className="absolute -inset-10" style={reduced ? undefined : { x, y }}>
          {LAYERS.map((l) => (
            <StarLayer key={l.size} size={l.size} shadows={l.shadows} duration={speed * l.speed} still={reduced} />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
