import { expect, test } from "@playwright/test"
import { visible } from "./helpers"

/** Page behaviour kept from V1, on the V2.1 screens: readers, novel settings, ⌘K search. */
test.describe("readers and search", () => {
  test("Home -> series -> start reading -> next episode", async ({ page }) => {
    await page.goto("/")
    await visible(page.getByRole("link", { name: /Series details/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
    await visible(page.getByRole("link", { name: /Read episode 1|Continue|Start/ })).first().click()
    await expect(page).toHaveURL(/\/read\/glass-compass\/\d+$/)
    const url = page.url()
    await visible(page.getByRole("link", { name: "Next episode" }).or(page.getByRole("button", { name: "Next episode" }))).first().click()
    await expect(page).not.toHaveURL(url)
    await expect(page).toHaveURL(/\/read\/glass-compass\/\d+$/)
  })

  test("Novel: theme and font survive a reload", async ({ page }) => {
    await page.goto("/novel/ink-witch/1")
    await visible(page.getByRole("button", { name: /Reading settings|Aa/ })).click()
    const panel = visible(page.getByRole("dialog"))
    await panel.getByRole("radio", { name: "Sepia" }).click()
    await panel.getByRole("radio", { name: "Serif" }).click()
    await page.keyboard.press("Escape")

    const root = () => visible(page.locator("[data-reader-theme]"))
    await expect(root()).toHaveAttribute("data-reader-theme", "sepia")
    await page.reload()
    await expect(root()).toHaveAttribute("data-reader-theme", "sepia")
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("phumireader.app")!).state.novelSettings)
    expect(saved).toMatchObject({ theme: "sepia", font: "serif" })
  })

  test('⌘K -> "gl" -> Glass Compass -> Series; See all results -> /search', async ({ page, isMobile }) => {
    await page.goto("/")
    const input = visible(page.getByPlaceholder(/Search series/))
    // The shortcut only works once the app has hydrated, so press it (or the header icon) until the palette opens.
    await expect(async () => {
      if (isMobile) await visible(page.getByRole("button", { name: "Search" })).click()
      else await page.keyboard.press("Control+K")
      await expect(input).toBeVisible({ timeout: 1500 })
    }).toPass()
    await input.fill("gl")
    await visible(page.getByRole("option", { name: /Glass Compass/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)

    await page.goto("/search?q=glass")
    await expect(visible(page.getByRole("link", { name: /Glass Compass/ })).first()).toBeVisible()
  })
})
