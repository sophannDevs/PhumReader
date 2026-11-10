import { expect, test } from "@playwright/test"
import { DEMO, SOKHA, seed, visible } from "./helpers"

test.describe("key flows (spec §7)", () => {
  test("1. Home -> series card -> Series -> Read episode 1 -> Next", async ({ page }) => {
    await page.goto("/")
    await visible(page.getByRole("link", { name: /Glass Compass/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
    await visible(page.getByRole("link", { name: /Read episode 1|Continue episode/ })).click()
    await expect(page).toHaveURL(/\/read\/glass-compass\/\d+$/)
    const url = page.url()
    await visible(page.getByRole("button", { name: "Next episode" })).click()
    await expect(page).not.toHaveURL(url)
    await expect(page).toHaveURL(/\/read\/glass-compass\/\d+$/)
  })

  test("2. Locked episode logged out -> Log in -> dialog reopens -> Unlock -> reader", async ({ page }) => {
    await seed(page, { coins: 10 })
    await page.goto("/series/glass-compass")
    await visible(page.getByRole("button", { name: /Episode 66/ })).click()
    await visible(page.getByRole("button", { name: "Log in to unlock" })).click()
    await expect(page).toHaveURL(/\/login/)

    await visible(page.getByLabel("Email")).fill(DEMO.email)
    await visible(page.getByLabel("Password", { exact: true })).fill(DEMO.password)
    await visible(page.getByRole("button", { name: "Log in", exact: true })).click()

    await expect(page).toHaveURL(/\/series\/glass-compass$/, { timeout: 20_000 })
    const dialog = visible(page.getByRole("dialog"))
    await expect(dialog.getByRole("heading", { name: "Unlock Episode 66" })).toBeVisible()
    await dialog.getByRole("button", { name: /Unlock for 5 coins/ }).click()
    await expect(page).toHaveURL(/\/read\/glass-compass\/66$/)
  })

  test("3. Locked episode with 3 coins -> Get coins -> KHQR 120 pack -> Back to episode -> Unlock", async ({ page }) => {
    await seed(page, { user: SOKHA, coins: 3 })
    await page.goto("/series/glass-compass")
    await visible(page.getByRole("button", { name: /Episode 66/ })).click()
    await visible(page.getByRole("dialog")).getByRole("button", { name: "Get coins" }).click()
    await expect(page).toHaveURL(/\/coins/)

    await visible(page.locator("#pack-120")).click()
    await visible(page.getByRole("button", { name: "Continue to payment" })).click()
    await visible(page.getByRole("button", { name: "I've paid (simulate)" })).click()
    await expect(visible(page.getByText(/\+\d+ coins added/))).toBeVisible()

    await visible(page.getByRole("link", { name: /Back to episode 66/i }).or(page.getByRole("button", { name: /Back to episode 66/i }))).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
    const dialog = visible(page.getByRole("dialog"))
    await expect(dialog.getByRole("heading", { name: "Unlock Episode 66" })).toBeVisible()
    await dialog.getByRole("button", { name: /Unlock for 5 coins/ }).click()
    await expect(page).toHaveURL(/\/read\/glass-compass\/66$/)
  })

  test("4. Sign up -> code 123456 -> back to the page you came from, logged in", async ({ page }) => {
    await seed(page, { returnTo: "/genres" })
    await page.goto("/login?mode=signup")
    await visible(page.getByLabel("Display name")).fill("Test Reader")
    await visible(page.getByLabel("Email")).fill(`reader${Date.now()}@example.com`)
    await visible(page.getByLabel("Password", { exact: true })).fill("Phum-Reader-2026!")
    await visible(page.getByRole("checkbox")).click()
    await visible(page.getByRole("button", { name: "Create account" })).click()

    await expect(visible(page.getByRole("heading", { name: "Check your email" }))).toBeVisible()
    await visible(page.locator("input[autocomplete=one-time-code], input[inputmode=numeric]")).fill(DEMO.code)
    await visible(page.getByRole("button", { name: "Verify email" })).click()

    await expect(page).toHaveURL(/\/genres$/, { timeout: 20_000 })
    await expect(visible(page.getByRole("button", { name: /Account menu/ }))).toBeVisible()
  })

  test("4b. /signup, /forgot and /verify open on their own view, and the address follows the view", async ({ page }) => {
    await page.goto("/signup")
    await expect(visible(page.getByRole("heading", { name: "Create your account" }))).toBeVisible()
    await page.goto("/forgot")
    await expect(visible(page.getByRole("heading", { name: "Reset your password" }))).toBeVisible()
    await page.goto("/verify?email=reader@example.com")
    await expect(visible(page.getByRole("heading", { name: "Check your email" }))).toBeVisible()
    // /verify without an email falls back to Log in.
    await page.goto("/verify")
    await expect(visible(page.getByRole("heading", { name: "Welcome back" }))).toBeVisible()
    // Switching views moves the address.
    await page.goto("/login")
    await visible(page.getByRole("tab", { name: "Sign up" })).click()
    await expect(page).toHaveURL(/\/signup$/)
  })

  test("5. Novel: size / Sepia / Serif survive a reload", async ({ page }) => {
    await page.goto("/novel/ink-witch/1")
    await visible(page.getByRole("button", { name: "Reading settings" })).click()
    const panel = visible(page.getByRole("dialog"))
    await panel.getByRole("tab", { name: "Sepia" }).click()
    await panel.getByRole("tab", { name: "Serif" }).click()
    await page.keyboard.press("Escape")

    const root = () => visible(page.locator("[data-reader-theme]"))
    await expect(root()).toHaveAttribute("data-reader-theme", "sepia")
    await page.reload()
    await expect(root()).toHaveAttribute("data-reader-theme", "sepia")
    await expect(visible(page.locator(".font-novel"))).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("phumireader.app")!).state.novelSettings)
    expect(saved).toMatchObject({ theme: "sepia", font: "serif" })
  })

  test('6. ⌘K -> "gl" -> Glass Compass -> Series', async ({ page, isMobile }) => {
    await page.goto("/")
    if (isMobile) await visible(page.getByRole("button", { name: "Search" })).click()
    // The shortcut only works once the app has hydrated, so press it until the palette opens.
    const input = visible(page.getByPlaceholder(/Search series/))
    if (!isMobile) {
      await expect(async () => {
        await page.keyboard.press("Control+K")
        await expect(input).toBeVisible({ timeout: 1500 })
      }).toPass()
    }
    await input.fill("gl")
    await visible(page.getByRole("option", { name: /Glass Compass/ })).click()
    await expect(page).toHaveURL(/\/series\/glass-compass$/)
  })
})
