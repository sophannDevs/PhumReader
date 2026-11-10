import { expect, test } from "@playwright/test"
import { SOKHA, seed, visible } from "./helpers"

const ADMIN = { name: "Dara M.", email: "admin@phumireader.app", roles: ["READER", "CREATOR", "ADMIN"] }
const noSidewaysScroll = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

/** /admin in demo mode (V2.1 AdminShell): admins only; every queue opens; no sideways scroll. */
test.describe("Admin (demo)", () => {
  test("logged out and readers see the admins-only message", async ({ page }) => {
    await page.goto("/admin")
    await expect(visible(page.getByRole("heading", { name: "This area is only for PhumiReader admins" }))).toBeVisible()
    await seed(page, { user: SOKHA })
    await page.goto("/admin")
    await expect(visible(page.getByRole("heading", { name: "This area is only for PhumiReader admins" }))).toBeVisible()
  })

  test("the admin sees the overview and each queue", async ({ page }) => {
    await seed(page, { user: ADMIN })
    for (const [path, heading] of [
      ["/admin", "Today"],
      ["/admin/series", "Series review"],
      ["/admin/reports", "Reports"],
      ["/admin/payments", /Payments/],
    ] as const) {
      await page.goto(path)
      await expect(visible(page.getByRole("heading", { level: 1, name: heading }))).toBeVisible()
      await noSidewaysScroll(page)
    }
  })
})
