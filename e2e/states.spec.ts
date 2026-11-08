import { expect, test } from "@playwright/test"
import { visible } from "./helpers"

test.describe("demo flags", () => {
  test("Home ?demo=empty shows empty sections", async ({ page }) => {
    await page.goto("/?demo=empty")
    await expect(page.locator('[data-slot="empty-state"]:visible').first()).toBeVisible()
    expect(await page.locator('[data-slot="empty-state"]:visible').count()).toBeGreaterThanOrEqual(4)
  })

  test("Home ?demo=error shows the error and Retry recovers", async ({ page }) => {
    await page.goto("/?demo=error")
    const alert = page.locator('[data-slot="error-state"]:visible')
    await expect(alert).toBeVisible()
    // Remove the flag from the URL, then press Retry (done together: the URL change alone also refetches).
    await page.evaluate(() => {
      history.replaceState(null, "", "/")
      document.querySelector<HTMLButtonElement>('[data-slot="error-state"] button')?.click()
    })
    await expect(page.locator('[data-slot="error-state"]:visible')).toHaveCount(0)
    await expect(visible(page.getByRole("heading", { name: /Daily updates|Trending now/ }))).toBeVisible()
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
    const alert = page.locator('[data-slot="error-state"]:visible')
    await expect(alert).toBeVisible()
    await page.evaluate(() => {
      history.replaceState(null, "", "/series/glass-compass")
      document.querySelector<HTMLButtonElement>('[data-slot="error-state"] button')?.click()
    })
    await expect(visible(page.getByRole("heading", { level: 1, name: "Glass Compass" }))).toBeVisible()

    await page.goto("/series/glass-compass?demo=slow")
    await expect(page.locator('[data-slot="skeleton"]:visible').first()).toBeVisible()
    await expect(visible(page.getByRole("heading", { level: 1, name: "Glass Compass" }))).toBeVisible({ timeout: 20_000 })
  })

  test("Locked episode opened by URL redirects to the series page with the dialog", async ({ page }) => {
    await page.goto("/read/glass-compass/66")
    await expect(page).toHaveURL(/\/series\/glass-compass$/, { timeout: 20_000 })
    await expect(visible(page.getByRole("dialog")).getByRole("heading", { name: "Unlock Episode 66" })).toBeVisible()
  })

  test("404 page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist")
    expect(res?.status()).toBe(404)
    await expect(visible(page.getByRole("heading", { level: 1 }))).toBeVisible()
    // An unknown series streams (Next.js sends the shell with 200 before notFound() runs), so check what
    // the visitor and search engines get: the 404 page, marked noindex.
    await page.goto("/series/nope")
    await expect(visible(page.getByRole("heading", { level: 1 }))).toBeVisible()
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0)
  })
})
