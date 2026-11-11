import { expect, test, type Page } from "@playwright/test"
import { visible } from "./helpers"

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

/** Help, policies, the error pages and the V1 addresses that moved (V2.1). */
test.describe("System and legal pages", () => {
  test("the footer links open Help, the policies and Contact", async ({ page }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")

    await footer.getByRole("link", { name: "Help center" }).click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(visible(page.getByRole("heading", { name: "How can we help?", level: 1 }))).toBeVisible()
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Terms" }).click()
    await expect(page).toHaveURL(/\/legal\/terms$/)
    await expect(visible(page.getByRole("heading", { name: "Terms of service", level: 1 }))).toBeVisible()
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Coins and refunds" }).click()
    await expect(page).toHaveURL(/\/legal\/refund$/)
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Contact us" }).click()
    await expect(page).toHaveURL(/\/help#contact$/)
    await expect(visible(page.getByRole("heading", { name: "Contact us" }))).toBeVisible()
  })

  test("V1 addresses redirect to their V2.1 pages", async ({ page }) => {
    await page.goto("/terms")
    await expect(page).toHaveURL(/\/legal\/terms$/)
    await page.goto("/privacy")
    await expect(page).toHaveURL(/\/legal\/privacy$/)
    await page.goto("/signup?ref=x")
    await expect(page).toHaveURL(/\/login\?mode=signup&ref=x$/)
    await expect(visible(page.getByRole("heading", { name: "Create your account" }))).toBeVisible()
    await page.goto("/forgot")
    await expect(page).toHaveURL(/\/login\?mode=forgot/)
    await page.goto("/genres/slice-of-life")
    await expect(page).toHaveURL(/\/genres\?g=Slice(\+|%20)of(\+|%20)life$/)
    await page.goto("/creator/series")
    await expect(page).toHaveURL(/\/creator$/)
  })

  test("a policy keeps its English text on the Khmer page", async ({ page }) => {
    await page.goto("/km/legal/terms")
    await expect(page.locator("html")).toHaveAttribute("lang", "km")
    await expect(visible(page.getByRole("heading", { level: 1 }))).toHaveText("Terms of service")
  })

  test("an unknown URL shows the 404 page with search", async ({ page }) => {
    const res = await page.goto("/no/such/page")
    expect(res?.status()).toBe(404)
    await expect(visible(page.getByRole("heading", { name: "We can’t find that page" }))).toBeVisible()
    await noSidewaysScroll(page)
    await visible(page.getByRole("searchbox")).fill("glass")
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/search\?q=glass$/)
  })

  // The service worker is registered by the production build only; CI runs this suite on `next start`.
  test("with the network gone the installed app shows the offline page", async ({ page, context }) => {
    test.skip(!process.env.CI, "needs the production build's service worker")
    await page.goto("/")
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // the worker now controls the page
    await context.setOffline(true)
    await page.goto("/series/glass-compass").catch(() => {})
    await expect(visible(page.getByRole("heading", { name: "You’re offline" }))).toBeVisible()
    await context.setOffline(false)
  })

  test("the offline and maintenance pages", async ({ page }) => {
    await page.goto("/offline")
    await expect(visible(page.getByRole("heading", { name: "You’re offline" }))).toBeVisible()
    await expect(visible(page.getByRole("button", { name: "Try again" }))).toBeVisible()
    await noSidewaysScroll(page)
    await page.goto("/maintenance")
    await expect(visible(page.getByRole("heading", { level: 1 }))).toBeVisible()
    await noSidewaysScroll(page)
  })

  test("offline banner appears when network drops and announces reconnection", async ({ page, context }) => {
    await page.goto("/")
    await context.setOffline(true)
    await expect(page.getByRole("status").filter({ hasText: "You are currently offline" })).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByRole("status").filter({ hasText: "Back online" })).toBeVisible()
  })
})
