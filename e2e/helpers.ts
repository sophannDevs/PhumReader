import type { Locator, Page } from "@playwright/test"

export const DEMO = { email: "reader@phumireader.app", password: "PhumiReader1!", code: "123456" }

type Seed = {
  user?: { name: string; email: string; roles?: string[] } | null
  coins?: number
  returnTo?: string | null
  lang?: "en" | "km"
}

/** Seeds `phumireader.app` (the persisted zustand store) before the app loads. */
export async function seed(page: Page, state: Seed = {}) {
  await page.addInitScript((s) => {
    // Only the first load: a reload in the same test must keep what the app saved since.
    if (sessionStorage.getItem("e2e-seeded")) return
    sessionStorage.setItem("e2e-seeded", "1")
    localStorage.setItem("phumireader.app", JSON.stringify({ state: s, version: 1 }))
  }, state)
}

export const SOKHA = { name: "Sokha Chan", email: DEMO.email }

/**
 * Cache Components keeps the previous route mounted but hidden, so a locator can match
 * two copies; this keeps the visible one.
 */
export const visible = (locator: Locator) => locator.locator("visible=true").first()
