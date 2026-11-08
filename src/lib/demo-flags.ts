/**
 * URL flags for demo simulations: ?demo=empty, ?demo=error, ?demo=slow.
 */

export type DemoFlag = "empty" | "error" | "slow"

export function getDemoFlag(): DemoFlag | null {
  if (typeof window === "undefined") return null
  const flag = new URLSearchParams(window.location.search).get("demo")
  return flag === "empty" || flag === "error" || flag === "slow" ? flag : null
}

