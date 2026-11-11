"use client"

import * as React from "react"
import { MotionConfig, animate, motion, useReducedMotion, type HTMLMotionProps } from "motion/react"
import { Num } from "@/i18n/num"
import { Link } from "@/i18n/navigation"

/** Wrap the app once so every motion component follows the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** Lifts its content slightly on hover (cards, covers). Does nothing under reduced motion. */
export function HoverLift({
  lift = 4,
  ...props
}: HTMLMotionProps<"div"> & { lift?: number }) {
  return (
    <motion.div
      whileHover={{ y: -lift }}
      transition={{ type: "spring", stiffness: 350, damping: 24 }}
      {...props}
    />
  )
}

/** Fades and slides up when scrolled into view. `index` staggers siblings (capped at 8 steps). */
export function Reveal({
  index = 0,
  ...props
}: HTMLMotionProps<"div"> & { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: "easeOut" }}
      {...props}
    />
  )
}

/** Springs in from small (success checkmarks, badges). */
export function PopIn(props: HTMLMotionProps<"span">) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      {...props}
    />
  )
}

/** Counts from the old value to the new one when `value` changes (coin balance). Digits follow the locale. */
export function AnimatedNumber({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = React.useState(value)
  const shownRef = React.useRef(value)

  React.useEffect(() => {
    if (reduce || shownRef.current === value) return
    const controls = animate(shownRef.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        shownRef.current = Math.round(v)
        setShown(shownRef.current)
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return <Num>{reduce ? value : shown}</Num>
}

/** A locale-aware Link that can animate (list items that fade in on scroll). */
export const MotionLink = motion.create(Link)
