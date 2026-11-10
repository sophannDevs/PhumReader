import { expect, test, type Page } from "@playwright/test"
import { SOKHA, seed, visible } from "./helpers"

/**
 * design/spec.md key flows 3 and 4. In the demo one browser plays every part, so the test switches the signed-in
 * account by editing the persisted store (as a log out / log in would) and reloading.
 */
const ADMIN = { name: "Dara M.", email: "admin@phumireader.app", roles: ["READER", "CREATOR", "ADMIN"] }
const CREATOR = { name: "Dara Vann", email: "creator@phumireader.app", roles: ["READER", "CREATOR"] }

async function signInAs(page: Page, user: { name: string; email: string; roles?: string[] }) {
  await page.evaluate((u) => {
    const saved = JSON.parse(localStorage.getItem("phumireader.app") ?? '{"state":{},"version":2}')
    saved.state.user = u
    localStorage.setItem("phumireader.app", JSON.stringify(saved))
  }, user)
}

test.describe("key flows with the admin (spec V2.1)", () => {
  test("3. Comment -> Report -> Admin removes it -> the reporter sees Removed in Settings", async ({ page }) => {
    await seed(page, { user: { ...SOKHA, roles: ["READER"] } })
    await page.goto("/series/glass-compass/comments")
    // Report someone else's comment.
    await visible(page.getByRole("button", { name: /^Report/ })).first().click()
    const dialog = visible(page.getByRole("dialog"))
    await dialog.getByRole("radio", { name: /Spam or scam/ }).click()
    await dialog.getByRole("button", { name: "Send report" }).click()
    await expect(dialog.getByText(/Case R-\d+/)).toBeVisible()
    const caseId = (await dialog.getByText(/Case R-\d+/).innerText()).match(/R-\d+/)![0]
    await dialog.getByRole("button", { name: "Done" }).click()

    // The admin removes it.
    await signInAs(page, ADMIN)
    await page.goto("/admin/reports")
    await visible(page.getByText("from your demo account")).click()
    await expect(visible(page.getByText(caseId))).toBeVisible()
    await visible(page.getByRole("radio", { name: /Remove content/ })).click()
    await visible(page.getByRole("button", { name: /^Confirm/ })).click()

    // Back as the reporter: Settings shows the outcome.
    await signInAs(page, { ...SOKHA, roles: ["READER"] })
    await page.goto("/settings")
    const row = visible(page.locator("li").filter({ hasText: caseId }))
    await expect(row.getByText("Removed")).toBeVisible()
  })
})

export { CREATOR }
