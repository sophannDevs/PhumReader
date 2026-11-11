import { expect, test, type Page } from "@playwright/test"
import { ADMIN, CREATOR, SOKHA, png, seed, visible } from "./helpers"

/**
 * design/spec.md key flows 3 and 4. In the demo one browser plays every part, so the test switches the signed-in
 * account by editing the persisted store (as a log out / log in would) and reloading.
 */

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

  test("4. Create series -> Admin requests changes -> creator fixes and resubmits -> Admin approves -> upload episode 1", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const title = "Lanterns Over Kampot"
    await seed(page, { user: CREATOR })

    // Create series: four steps, then "in review".
    await page.goto("/creator/new")
    await visible(page.getByRole("textbox", { name: /^Title/ })).fill(title)
    await visible(page.locator("select#cs-genre")).selectOption("Fantasy")
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await visible(page.getByRole("textbox", { name: /^Summary/ })).fill(
      "A ferry girl on the Kampot river finds a lantern that shows the way to people who are lost, and must decide who to help."
    )
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await visible(page.getByRole("button", { name: /Choose a cover image/ })).click()
    await expect(visible(page.getByText("Demo: a sample cover was added"))).toBeVisible()
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await visible(page.getByRole("group", { name: /Update days/ }).getByRole("button", { name: "Sat" })).click()
    await visible(page.getByRole("checkbox", { name: /original work/ })).click()
    await visible(page.getByRole("button", { name: "Submit for review" })).click()
    await expect(visible(page.getByRole("heading", { name: `${title} is in review` }))).toBeVisible()
    const uploadHref = await visible(page.getByRole("link", { name: "Upload episode 1" })).getAttribute("href")
    const workId = new URL(uploadHref!, "http://x").searchParams.get("series")!

    // The admin requests changes.
    await signInAs(page, ADMIN)
    await page.goto(`/admin/series?id=${workId}`)
    await expect(visible(page.getByRole("heading", { level: 2, name: title }))).toBeVisible()
    await visible(page.getByRole("button", { name: "Request changes" })).click()
    await visible(page.getByRole("checkbox", { name: "Remove contact details or links from the summary" })).click()
    await visible(page.getByRole("button", { name: "Send to creator" })).click()
    await expect(visible(page.getByText("Sent to the creator"))).toBeVisible()

    // The creator sees the change, marks it fixed and resubmits.
    await signInAs(page, CREATOR)
    await page.goto(`/creator/series/${workId}`)
    await expect(visible(page.getByText("Changes requested"))).toBeVisible()
    await visible(page.getByRole("button", { name: "Mark fixed" })).click()
    await visible(page.getByRole("button", { name: "Resubmit for review" })).click()
    await expect(visible(page.getByText(/^Resubmitted\. /))).toBeVisible()

    // The admin approves (every check ticked).
    await signInAs(page, ADMIN)
    await page.goto(`/admin/series?id=${workId}`)
    await expect(visible(page.getByRole("heading", { level: 2, name: title }))).toBeVisible()
    const checklist = visible(page.getByRole("group", { name: "Checklist" }))
    for (const box of await checklist.getByRole("checkbox").all()) await box.check()
    await visible(page.getByRole("button", { name: "Approve" })).click()
    await expect(visible(page.getByText("Approved. The creator was notified."))).toBeVisible()

    // Upload episode 1 to the now published series.
    await signInAs(page, CREATOR)
    await page.goto(`/creator/series/${workId}`)
    await expect(visible(page.getByText("Published")).first()).toBeVisible()
    await page.goto(uploadHref!)
    await visible(page.getByRole("textbox", { name: /^Episode title/ })).fill("The First Light")
    await page.locator('input[type="file"]').first().setInputFiles([
      { name: "ep01_01.png", mimeType: "image/png", buffer: png(800, 1200) },
      { name: "ep01_02.png", mimeType: "image/png", buffer: png(800, 1200) },
    ])
    // The checklist item reads "(done)" once both uploads have finished.
    await expect(visible(page.locator("li", { hasText: "Images ready (2/2) (done)" }))).toBeVisible({ timeout: 20_000 })
    await visible(page.getByRole("button", { name: /^Schedule for / })).click()
    await expect(visible(page.getByRole("heading", { name: /Episode 1 is scheduled/ }))).toBeVisible()
  })
})

