import { expect, test } from "@playwright/test"
import { seed, SOKHA, visible } from "./helpers"

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

  test("Novel chapter end: comments", async ({ page }) => {
    await seed(page, { user: SOKHA })
    await page.goto("/novel/ink-witch/1")
    const end = visible(page.getByRole("region", { name: "End of chapter 1" }))
    await end.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(end.getByRole("heading", { name: /^Comments/ })).toBeVisible()
    const seeAll = end.getByRole("link", { name: "See all" })
    await expect(seeAll).toHaveAttribute("href", /\/series\/ink-witch\/comments\?ep=1$/)

    const list = end.getByRole("list", { name: "Comments" })
    await expect(list.getByRole("listitem").first()).toBeVisible()
    await end.getByRole("textbox", { name: "Add a comment" }).fill("E2E novel comment")
    await end.getByRole("button", { name: "Post" }).click()
    const first = list.locator(":scope > li").first()
    await expect(first).toContainText("E2E novel comment")

    const like = list.locator(":scope > li").nth(1).locator("button[aria-pressed]").first()
    await expect(like).toHaveAttribute("aria-pressed", "false")
    await like.click()
    await expect(like).toHaveAttribute("aria-pressed", "true")

    await seeAll.click()
    await expect(page).toHaveURL(/\/series\/ink-witch\/comments\?ep=1$/)
    await expect(visible(page.getByText("Chapter 1", { exact: true }))).toBeVisible()
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

/** Settings > Reading > Theme applies to the whole site (not only the novel reader). */
test.describe("site theme", () => {
  test("Settings: Dark + Save makes the whole site dark, and it stays dark after a reload", async ({ page }) => {
    await seed(page, { user: SOKHA })
    await page.goto("/settings")
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    await visible(page.getByRole("radio", { name: "Dark" })).click()
    // Applies on save, not on click.
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    await visible(page.getByRole("button", { name: "Save changes" })).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.goto("/")
    await expect(page.locator("html")).toHaveClass(/dark/)
  })

  test("System follows a dark device", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).not.toHaveClass(/dark/)
  })

  test("Novel reader keeps its own sepia theme on a dark site", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/novel/ink-witch/1")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await visible(page.getByRole("button", { name: /Reading settings|Aa/ })).click()
    const panel = visible(page.getByRole("dialog"))
    await panel.getByRole("radio", { name: "Sepia" }).click()
    await page.keyboard.press("Escape")
    const root = visible(page.locator("[data-reader-theme]"))
    await expect(root).toHaveAttribute("data-reader-theme", "sepia")
    await expect(root).toHaveCSS("color-scheme", "light")
  })
})
