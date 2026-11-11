import { expect, test } from "@playwright/test"
import { SOKHA, seed, visible } from "./helpers"

/** ?demo= flags and special states (V2.1 screens). */
test.describe("demo flags and states", () => {
  test("Home ?demo=empty shows the empty boxes", async ({ page }) => {
    await page.goto("/?demo=empty")
    await expect(visible(page.getByText("No updates yet"))).toBeVisible()
  })

  test("Home ?demo=error shows Try again, which recovers", async ({ page }) => {
    await page.goto("/?demo=error")
    await expect(visible(page.getByText("Couldn’t load today’s updates"))).toBeVisible()
    // Remove the flag from the URL, then press Try again. Under a busy dev server the first press can land before
    // the box reacts, so press again until it recovers.
    await page.evaluate(() => history.replaceState(null, "", "/"))
    await expect(async () => {
      const retry = page.getByRole("alert").filter({ hasText: "Couldn’t load today’s updates" }).getByRole("button", { name: "Try again" })
      if (await retry.count()) await retry.first().click({ timeout: 2_000 })
      await expect(page.getByText("Couldn’t load today’s updates")).toHaveCount(0, { timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await expect(visible(page.getByRole("heading", { name: "Daily updates" }))).toBeVisible()
  })

  test("Home ?demo=slow keeps skeletons for a while", async ({ page }) => {
    await page.goto("/?demo=slow")
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, { timeout: 15_000 })
  })

  test("Series ?demo=empty / error / slow", async ({ page }) => {
    await page.goto("/series/glass-compass?demo=empty")
    await expect(visible(page.getByText("No episodes yet"))).toBeVisible()
    await page.goto("/series/glass-compass?demo=error")
    await expect(visible(page.getByRole("alert")).first()).toBeVisible()
    await page.goto("/series/glass-compass?demo=slow")
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    await expect(visible(page.getByRole("heading", { level: 1, name: "Glass Compass" }))).toBeVisible({ timeout: 20_000 })
  })

  test("A locked episode opened by URL shows the Fast Pass lock screen", async ({ page }) => {
    await seed(page, { user: SOKHA, coins: 3 })
    await page.goto("/read/glass-compass/66")
    await expect(visible(page.getByRole("heading", { name: "Episode 66 is in Fast Pass" }))).toBeVisible({ timeout: 20_000 })
    await expect(visible(page.getByRole("button", { name: /you need 2 more/ }).or(page.getByRole("link", { name: /you need 2 more/ })))).toBeVisible()
  })

  test("404 page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist")
    expect(res?.status()).toBe(404)
    await expect(visible(page.getByRole("heading", { name: "We can’t find that page" }))).toBeVisible()
    // An unknown series streams (Next.js sends the shell with 200 before notFound() runs), so check what
    // the visitor and search engines get: the 404 page, marked noindex.
    await page.goto("/series/nope")
    await expect(visible(page.getByRole("heading", { level: 1 }))).toBeVisible()
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0)
  })
})
