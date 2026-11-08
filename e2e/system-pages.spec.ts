import { expect, test, type Page } from "@playwright/test"

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

/** Terms, Privacy, Help, Offline and the 404 page (P4-17): reachable from the footer, no sideways scroll. */
test.describe("System and legal pages", () => {
  test("the footer links open Help, Terms, Privacy and Contact", async ({ page }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")
    await footer.getByRole("link", { name: "Help center" }).click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.getByRole("heading", { name: "Help center", level: 1 })).toBeVisible()
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Terms" }).click()
    await expect(page).toHaveURL(/\/terms$/)
    await expect(page.getByRole("heading", { name: "Terms of use", level: 1 })).toBeVisible()
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Privacy" }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible()
    await noSidewaysScroll(page)

    await footer.getByRole("link", { name: "Contact" }).click()
    await expect(page).toHaveURL(/\/help#contact$/)
    await expect(page.getByRole("heading", { name: "Contact us" })).toBeVisible()
  })

  test("the table of contents jumps to a section; the Help questions open", async ({ page }) => {
    await page.goto("/terms")
    await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Coins and Fast Pass" }).click()
    await expect(page).toHaveURL(/#terms-3$/)
    await expect(page.getByRole("heading", { name: "3. Coins and Fast Pass" })).toBeInViewport()

    await page.goto("/help")
    await page.getByRole("button", { name: "What is Fast Pass?" }).click()
    await expect(page.getByText(/becomes free for everyone/)).toBeVisible()
  })

  test("Khmer pages exist", async ({ page }) => {
    await page.goto("/km/terms")
    await expect(page.locator("html")).toHaveAttribute("lang", "km")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("លក្ខខណ្ឌប្រើប្រាស់")
  })

  test("an unknown URL shows the 404 page with search and Home", async ({ page }) => {
    const res = await page.goto("/no/such/page")
    expect(res?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
    await noSidewaysScroll(page)
    await page.getByRole("searchbox", { name: "Search series, creators…" }).fill("glass")
    await page.getByRole("search").getByRole("button", { name: "Search" }).click()
    await expect(page).toHaveURL(/\/search\?q=glass$/)

    await page.goto("/no/such/page")
    await page.getByRole("link", { name: "Back to Home" }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  // The service worker is registered by the production build only; this suite runs on `next start`.
  test("with the network gone the installed app shows the offline page", async ({ page, context }) => {
    await page.goto("/")
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // the worker now controls the page
    await context.setOffline(true)
    await page.goto("/series/glass-compass").catch(() => {})
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible()
    await context.setOffline(false)
  })

  test("the offline page", async ({ page }) => {
    await page.goto("/offline")
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
    await noSidewaysScroll(page)
  })
})
