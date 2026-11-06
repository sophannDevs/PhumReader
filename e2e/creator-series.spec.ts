import { expect, test } from "@playwright/test"
import { SOKHA, seed } from "./helpers"

/** /creator/series in demo mode: the stand-in creator's series, search, filter, no horizontal scroll. */
test.describe("My series (demo)", () => {
  test("lists the series, filters them and never scrolls sideways", async ({ page }, testInfo) => {
    await seed(page, { user: SOKHA })
    await page.goto("/creator/series")
    await expect(page.getByRole("heading", { name: "My series" })).toBeVisible()
    const rows = page.getByRole("list", { name: "My series" }).getByRole("listitem")
    await expect(rows).toHaveCount(4)
    await expect(rows.first().getByRole("button", { name: "Add episode" })).toBeVisible()

    // Search narrows the list; a status with nothing shows the "no match" state.
    const search = page.getByRole("searchbox", { name: "Search your series" })
    await search.fill("zzz-nothing")
    await expect(page.getByText("No series match")).toBeVisible()
    await search.fill("")
    await expect(rows).toHaveCount(4)
    await page.getByRole("tab", { name: "Draft" }).click()
    await expect(page.getByText("No series match")).toBeVisible()
    await page.getByRole("tab", { name: "All" }).click()

    // Create series: the demo has no creator tools yet.
    await page.getByRole("button", { name: "Create series" }).click()
    await expect(page.getByText(/Publishing opens soon|publishing/i).first()).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: testInfo.outputPath(`my-series-${testInfo.project.name}.png`), fullPage: true })
  })

  test("logged out: asks to log in; Khmer page is translated", async ({ page }) => {
    await page.goto("/creator/series")
    await expect(page.getByText("Log in to see your series")).toBeVisible()
    await page.goto("/km/creator/series")
    await expect(page.getByText("ចូលគណនីដើម្បីមើលរឿងរបស់អ្នក")).toBeVisible()
  })
})
