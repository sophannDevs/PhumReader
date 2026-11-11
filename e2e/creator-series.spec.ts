import { expect, test, type Page } from "@playwright/test"
import { CREATOR, SOKHA, png, seed, visible } from "./helpers"

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

/** The V2.1 creator tools in demo mode (spec §14–16, §21): access, the old V1 addresses, errors and tabs. */
test.describe("Creator tools (demo)", () => {
  test("logged out asks to log in, in English and Khmer", async ({ page }) => {
    await page.goto("/creator/new")
    await expect(visible(page.getByText("Log in to open Creator studio"))).toBeVisible()
    await page.goto("/km/creator/new")
    await expect(visible(page.getByText("ចូលគណនីដើម្បីបើកស្ទូឌីយោអ្នកនិពន្ធ"))).toBeVisible()
  })

  test("a reader without the creator role is invited to become one", async ({ page }) => {
    await seed(page, { user: { ...SOKHA, roles: ["READER"] } })
    await page.goto("/creator/upload")
    await expect(visible(page.getByRole("heading", { name: "Become a creator to publish" }))).toBeVisible()
  })

  test("the V1 addresses open the V2.1 pages", async ({ page }) => {
    await seed(page, { user: CREATOR })
    for (const [from, to] of [
      ["/creator/series", /\/creator$/],
      ["/creator/series/new", /\/creator\/new$/],
      ["/creator/series/C1/edit", /\/creator\/series\/C1\?tab=details$/],
      ["/creator/series/C1/episodes/new", /\/creator\/upload\?series=C1$/],
    ] as const) {
      await page.goto(from)
      await expect(page).toHaveURL(to)
    }
  })

  test("Create series: Continue lists what to fix; nothing scrolls sideways", async ({ page }) => {
    await seed(page, { user: CREATOR })
    await page.goto("/creator/new")
    await visible(page.getByRole("button", { name: "Continue" })).click()
    await expect(visible(page.getByText("Fix 2 things to continue"))).toBeVisible()
    await expect(visible(page.getByText("Enter a title (2–60 characters).")).first()).toBeVisible()
    await expect(visible(page.getByText("Choose a main genre.")).first()).toBeVisible()
    await expect(visible(page.getByRole("textbox", { name: /^Title/ }))).toHaveAttribute("aria-invalid", "true")
    await noSidewaysScroll(page)
  })

  test("Upload episode: a too-narrow image gets an error and blocks publishing", async ({ page }) => {
    await seed(page, { user: CREATOR })
    await page.goto("/creator/upload?series=C1")
    await expect(visible(page.getByText("River Lantern · Episode 25"))).toBeVisible()
    await page.locator('input[type="file"]').first().setInputFiles([
      { name: "small.png", mimeType: "image/png", buffer: png(500, 800) },
      { name: "ok.png", mimeType: "image/png", buffer: png(800, 1200) },
    ])
    await expect(visible(page.getByText("Too narrow: 500 px. Use 690–1600 px."))).toBeVisible()
    await expect(visible(page.locator("li", { hasText: "Images ready (1/2) (not yet)" }))).toBeVisible({ timeout: 20_000 })
    await visible(page.getByRole("button", { name: /^Schedule for / })).click()
    await expect(visible(page.getByText(/^Fix \d things? before publishing$/))).toBeVisible()
    await noSidewaysScroll(page)
  })

  test("Manage series: tabs, hiding an episode and the empty filter", async ({ page }) => {
    await seed(page, { user: CREATOR })
    await page.goto("/creator/series/C1")
    await expect(visible(page.getByRole("heading", { level: 1, name: "River Lantern" }))).toBeVisible()
    await expect(visible(page.getByRole("tab", { name: /Episodes/ }))).toHaveAttribute("aria-selected", "true")

    // Hide a published episode, then show it again.
    await visible(page.getByRole("button", { name: "Hide episode 21" })).click()
    const dialog = visible(page.getByRole("alertdialog"))
    await dialog.getByRole("button", { name: "Hide episode" }).click()
    await expect(visible(page.getByText("Episode 21 hidden"))).toBeVisible()
    await visible(page.getByRole("button", { name: "Show episode 21" })).click()
    await expect(visible(page.getByText("Episode 21 is visible again"))).toBeVisible()

    // Tabs keep their place in the address.
    await visible(page.getByRole("tab", { name: "Series details" })).click()
    await expect(page).toHaveURL(/\?tab=details$/)
    await visible(page.getByRole("tab", { name: "Fast Pass" })).click()
    await expect(page).toHaveURL(/\?tab=fast-pass$/)
    await noSidewaysScroll(page)

    // A series with nothing scheduled shows the empty state for that filter.
    await page.goto("/creator/series/C2")
    await visible(page.getByRole("button", { name: /^Scheduled/ })).click()
    await expect(visible(page.getByText("Nothing scheduled"))).toBeVisible()
  })
})
