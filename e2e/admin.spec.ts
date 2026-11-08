import { expect, test } from "@playwright/test"
import { SOKHA, seed } from "./helpers"

/** /admin in demo mode: asks for a login, then explains that the admin area needs the real API; no sideways scroll. */
test.describe("Admin (demo)", () => {
  test("asks for a login, then says the demo has no admin area", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "Log in to open the admin area" })).toBeVisible()
    await seed(page, { user: SOKHA })
    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "The admin area needs the real API" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
