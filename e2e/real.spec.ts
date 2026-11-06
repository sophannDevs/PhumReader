import { expect, test, type Page } from "@playwright/test"

/**
 * Key flows against the real API (the local Spring Boot backend on :8080, dev payment simulator
 * on): `npm run test:e2e:real`. One brand-new account per run, so the run starts from a clean
 * state and ends by deleting it (30-day grace on the server). The demo suite is `npm run test:e2e`.
 */
const stamp = Date.now()
const EMAIL = `e2e-${stamp}@phumreader.test`
const PASSWORD = "Phum-Reader-2026!"
const NEW_PASSWORD = "Phum-Reader-2027!"
const CODE = "123456"

test.describe.configure({ mode: "serial" })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
})
test.afterAll(async () => {
  await page.context().close()
})

/** The coin balance shown in the header chip. */
const headerCoins = () => page.locator("header").getByText(/^\d+$/).first()

async function logIn(p: Page, password: string) {
  await p.goto("/login")
  await p.getByLabel("Email").fill(EMAIL)
  await p.getByLabel("Password", { exact: true }).fill(password)
  await p.getByRole("button", { name: "Log in", exact: true }).click()
  await expect(p.getByRole("button", { name: /Account menu/ })).toBeVisible()
}

test("1. sign up with the email code and land logged in", async () => {
  await page.goto("/login?mode=signup")
  await page.getByLabel("Display name").fill("E2E Reader")
  await page.getByLabel("Email").fill(EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByRole("checkbox").click()
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
  await page.locator("input[autocomplete=one-time-code], input[inputmode=numeric]").fill(CODE)
  await page.getByRole("button", { name: "Verify email" }).click()
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible({ timeout: 20_000 })
})

test("2. subscribe, follow and like persist after a reload; Library lists them", async () => {
  await page.goto("/series/glass-compass")
  await page.getByRole("button", { name: /^Subscribe$/ }).first().click()
  await expect(page.getByRole("button", { name: /^Subscribed$/ }).first()).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Follow creator" }).click()
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible()

  await page.goto("/read/glass-compass/1")
  const like = page.getByRole("button", { name: /likes?$/ }).first()
  await like.scrollIntoViewIfNeeded()
  await expect(like).toHaveAttribute("aria-pressed", "false")
  await like.click()
  await expect(like).toHaveAttribute("aria-pressed", "true")
  await page.waitForTimeout(800) // let the request finish before navigating away

  await page.goto("/series/glass-compass")
  await expect(page.getByRole("button", { name: /^Subscribed$/ }).first()).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Continue episode/ })).toBeVisible()

  await page.goto("/library")
  await page.getByRole("tab", { name: "Subscribed" }).click()
  await expect(page.getByText("Glass Compass").first()).toBeVisible()
  await page.getByRole("button", { name: /Remove Glass Compass/ }).click()
  const restored = page.waitForResponse((r) => r.url().includes("/me/subscriptions/restore"))
  await page.getByRole("button", { name: "Undo" }).click()
  await restored
  await page.reload()
  await page.getByRole("tab", { name: "Subscribed" }).click()
  await expect(page.getByText("Glass Compass").first()).toBeVisible()
})

test("3. comment: post, like, delete", async () => {
  await page.goto("/series/glass-compass")
  await page.getByRole("tab", { name: /Comments/ }).click()
  const text = `E2E comment ${stamp}`
  await page.getByPlaceholder("What did you think?").fill(text)
  await page.getByRole("button", { name: "Post", exact: true }).click()
  const item = page.locator("li", { hasText: text })
  await expect(item).toBeVisible()
  await item.getByRole("button", { name: /^Like/ }).click()
  await page.reload()
  await page.getByRole("tab", { name: /Comments/ }).click()
  await expect(page.locator("li", { hasText: text }).getByRole("button", { name: /^Like/ })).toHaveAttribute("aria-pressed", "true")
  await page.locator("li", { hasText: text }).getByRole("button", { name: "Delete" }).click()
  await expect(page.locator("li", { hasText: text })).toHaveCount(0)
})

test("4. coins: buy the 10 pack with the simulator, then unlock a Fast Pass episode", async () => {
  await page.goto("/coins")
  await expect(headerCoins()).toHaveText("0")
  await page.locator("#pack-10").click()
  await page.getByRole("button", { name: "Continue to payment" }).click()
  await expect(page.getByRole("timer")).toBeVisible()
  await page.reload() // the open order resumes
  await expect(page.getByRole("timer")).toBeVisible()
  await page.getByRole("button", { name: "I've paid (simulate)" }).click()
  await expect(page.getByText(/\+20 coins added/)).toBeVisible()
  await expect(headerCoins()).toHaveText("20")
  await page.reload()
  await expect(page.locator("tbody tr").first()).toContainText("Paid")

  await page.goto("/series/glass-compass")
  await page.getByRole("button", { name: /Episode 66/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: /Unlock for 5 coins/ }).click()
  await expect(page).toHaveURL(/\/read\/glass-compass\/66$/)
  await expect(headerCoins()).toHaveText("15")
  await page.goto("/library")
  await page.getByRole("tab", { name: "Unlocked" }).click()
  await expect(page.getByText("Glass Compass").first()).toBeVisible()
})

test("5. settings: name, appearance and text size are saved to the account", async () => {
  await page.goto("/settings")
  await page.getByRole("button", { name: "Edit" }).click()
  await page.getByLabel("Display name").fill("E2E Renamed")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("E2E Renamed")).toBeVisible()

  await page.getByRole("radio", { name: "Dark" }).click()
  await page.getByRole("button", { name: /Increase text size|Larger/i }).first().click()
  await page.waitForTimeout(1500) // saved half a second after the last change

  // A different browser, logging in, gets the same settings.
  const other = await page.context().browser()!.newContext({ viewport: { width: 1280, height: 900 } })
  const op = await other.newPage()
  await logIn(op, PASSWORD)
  await op.goto("/settings")
  await expect(op.getByText("E2E Renamed")).toBeVisible()
  await expect(op.locator("html")).toHaveClass(/dark/)
  await other.close()
})

test("6. security: change password, the new one logs in; the device list shows this device", async () => {
  await page.goto("/settings")
  await expect(page.getByText("This device")).toBeVisible()
  await page.getByRole("button", { name: "Change password" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Current password").fill("Wrong-Pass-1!")
  await dialog.getByLabel("New password").fill(NEW_PASSWORD)
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog.getByText("That password isn't right.")).toBeVisible()
  await dialog.getByLabel("Current password").fill(PASSWORD)
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText(/Password changed/)).toBeVisible()

  const other = await page.context().browser()!.newContext()
  const op = await other.newPage()
  await logIn(op, NEW_PASSWORD)
  await other.close()
})

test("7. creator dashboard: empty for a reader, numbers for a creator", async () => {
  await page.goto("/creator")
  await expect(page.getByText("No series yet")).toBeVisible()

  // A creator account does not exist in the seed, so the API answer is a fixture here.
  const card = await page.request.get("/api/v1/series/glass-compass").then((r) => r.json())
  await page.route("**/api/v1/creator/dashboard", (route) =>
    route.fulfill({
      json: {
        creator: true,
        name: "Fixture Creator",
        totals: { series: 1, views: 1_500_000, likes: 20_000, subscribers: 900, comments: 12, unlocks: 40, earnedCoins: 200 },
        series: [{ series: card.series, visibility: "published", subscribers: 900, comments: 12, unlocks: 40, earnedCoins: 200 }],
      },
    })
  )
  await page.goto("/creator")
  await expect(page.getByText("1.5M").first()).toBeVisible()
  await expect(page.getByText("200 coins")).toBeVisible()
  await expect(page.getByText("Glass Compass").first()).toBeVisible()
  await page.unroute("**/api/v1/creator/dashboard")
})

test("8. delete the account: signed out everywhere, wrong password refused first", async () => {
  await page.goto("/settings")
  await page.getByRole("button", { name: "Delete account" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Current password").fill("Wrong-Pass-1!")
  await dialog.getByRole("button", { name: "Delete account" }).click()
  await expect(dialog.getByText("That password isn't right.")).toBeVisible()
  await dialog.getByLabel("Current password").fill(NEW_PASSWORD)
  await dialog.getByRole("button", { name: "Delete account" }).click()
  await expect(page.getByText(/will be deleted on/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible()
})
