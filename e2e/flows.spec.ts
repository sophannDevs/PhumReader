import { expect, test } from "@playwright/test"
import { DEMO, SOKHA, seed, selectOption, visible } from "./helpers"

/** design/spec.md "Key flows to test end to end" (V2.1). Flows 3 and 4 (admin) are in admin-flows.spec.ts. */
test.describe("key flows (spec V2.1)", () => {
  test("1. Sign up -> setup -> back to the series -> Home shows the chosen genres", async ({ page }) => {
    await page.goto("/series/glass-compass")
    await visible(page.getByRole("link", { name: "Sign up" }).or(page.getByRole("link", { name: "Log in" }))).click()
    await expect(page).toHaveURL(/\/login/)
    if (!/mode=signup/.test(page.url())) await visible(page.getByRole("tab", { name: "Sign up" })).click()

    await visible(page.getByLabel("Display name")).fill("Test Reader")
    await visible(page.getByLabel("Email")).fill(`reader${Date.now()}@example.com`)
    await visible(page.getByLabel("Password", { exact: true })).fill("Phumi-Reader-2026!")
    await visible(page.getByLabel("Confirm password")).fill("Phumi-Reader-2026!")
    await selectOption(visible(page.getByRole("combobox", { name: "Birth year" })), "1995")
    await visible(page.getByRole("checkbox", { name: /Terms/ })).click()
    await visible(page.getByRole("button", { name: "Create account" })).click()

    await expect(visible(page.getByRole("heading", { name: "Verify your email" }))).toBeVisible()
    await visible(page.locator("input[autocomplete=one-time-code], input[inputmode=numeric]")).fill(DEMO.code)
    await visible(page.getByRole("button", { name: "Verify and create account" })).click()

    // First-time setup, then back to the series.
    await expect(page).toHaveURL(/\/welcome/, { timeout: 20_000 })
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await visible(page.getByRole("button", { name: /Fantasy/ })).click()
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await visible(page.getByRole("button", { name: "Not now" })).click()
    await visible(page.getByRole("button", { name: /Start reading/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/, { timeout: 20_000 })

    await page.goto("/")
    await expect(visible(page.getByRole("heading", { name: "Recommended for you" }))).toBeVisible()
    await expect(visible(page.getByText("Because you like Fantasy"))).toBeVisible()
  })

  test("2. Locked episode, not enough coins -> Coins (pack pre-selected) -> pay -> back -> dialog reopens -> unlock", async ({ page }) => {
    await seed(page, { user: SOKHA, coins: 3 })
    await page.goto("/series/glass-compass")
    await visible(page.getByRole("button", { name: /Episode 66/ })).click()
    const dialog = visible(page.getByRole("dialog"))
    await expect(dialog.getByText(/You need 2 more coins/)).toBeVisible()
    await dialog.getByRole("button", { name: /Get coins/ }).click()
    await expect(page).toHaveURL(/\/coins/)

    // The smallest pack that covers the episode is picked and marked.
    await expect(visible(page.getByText("Almost there"))).toBeVisible()
    await expect(visible(page.locator("#pack-10"))).toBeChecked()
    await expect(visible(page.getByText("Covers it"))).toBeVisible()

    await visible(page.getByRole("button", { name: "Continue to payment" })).click()
    await visible(page.getByRole("button", { name: "I've paid (simulate)" })).click()
    await expect(visible(page.getByText(/\+\d+ coins/).first())).toBeVisible()

    // Back to the episode (automatic after 5 s, or the button); the dialog reopens there.
    await visible(page.getByRole("link", { name: /Back to episode 66/i }).or(page.getByRole("button", { name: /Back to episode 66/i }))).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
    const again = visible(page.getByRole("dialog"))
    await expect(again.getByRole("heading", { name: /Unlock episode 66/i })).toBeVisible()
    await again.getByRole("button", { name: /Unlock for 5 coins/ }).click()
    await expect(page).toHaveURL(/\/read\/glass-compass\/66$/)
  })

  test("5. Switch to Khmer anywhere -> every page follows", async ({ page }) => {
    await page.goto("/")
    await visible(page.getByRole("button", { name: /Switch to ខ្មែរ/ })).click()
    await expect(page).toHaveURL(/\/km\/?$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "km")

    await visible(page.getByRole("link", { name: "ចំណាត់ថ្នាក់" })).first().click()
    await expect(page).toHaveURL(/\/km\/rankings$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "km")
    await page.goto("/km/series/glass-compass")
    await expect(visible(page.getByRole("heading", { level: 1, name: "Glass Compass" }))).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("lang", "km")

    // And back to English on the same page.
    await visible(page.getByRole("button", { name: /English/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
  })

  test("6. Receipt -> Get help -> contact form already filled in", async ({ page }) => {
    await seed(page, { user: SOKHA })
    await page.goto("/coins/orders/TW-48213377")
    await expect(visible(page.getByText("TW-48213377").first())).toBeVisible()
    await visible(page.getByRole("link", { name: /Get help with this order/ }).or(page.getByRole("button", { name: /Get help with this order/ }))).click()

    await expect(page).toHaveURL(/\/help#contact$/)
    await expect(visible(page.getByLabel(/Order number/))).toHaveValue("TW-48213377")
    await expect(visible(page.locator("#ct-topic"))).toHaveAttribute("data-value", "payment")
  })
})
