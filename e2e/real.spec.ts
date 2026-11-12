import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
} from "@playwright/test";
import { selectOption, visible } from "./helpers";

/**
 * Key flows against the real API (the local Spring Boot backend on :8080, dev payment simulator
 * on): `npm run test:e2e:real`. One brand-new account per run, so the run starts from a clean
 * state and ends by deleting it (30-day grace on the server). The demo suite is `npm run test:e2e`.
 */
const stamp = Date.now();
const EMAIL = `e2e-${stamp}@phumireader.test`;
const PASSWORD = "Phum-Reader-2026!";
const NEW_PASSWORD = "Phum-Reader-2027!";
const CODE = "123456";

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

/** The coin balance shown in the header chip. */
const headerCoins = () => page.locator("header").getByText(/^\d+$/).first();

async function logIn(p: Page, password: string) {
  await p.goto("/login");
  await visible(p.getByLabel("Email")).fill(EMAIL);
  await visible(p.getByLabel("Password", { exact: true })).fill(password);
  await visible(p.getByRole("button", { name: "Log in", exact: true })).click();
  await expect(
    visible(p.getByRole("button", { name: /Account menu/ })),
  ).toBeVisible({ timeout: 20_000 });
}

test("1. sign up with the email code, skip the first-time setup and land logged in", async () => {
  await page.goto("/login?mode=signup");
  await visible(page.getByLabel("Display name")).fill("E2E Reader");
  await visible(page.getByLabel("Email")).fill(EMAIL);
  await visible(page.getByLabel("Password", { exact: true })).fill(PASSWORD);
  await visible(page.getByLabel("Confirm password")).fill(PASSWORD);
  await selectOption(visible(page.getByRole("combobox", { name: "Birth year" })), "1995");
  await visible(page.getByRole("checkbox", { name: /Terms/ })).click();
  await visible(page.getByRole("button", { name: "Create account" })).click();
  await expect(
    visible(page.getByRole("heading", { name: "Verify your email" })),
  ).toBeVisible();
  await visible(
    page.locator("input[autocomplete=one-time-code], input[inputmode=numeric]"),
  ).fill(CODE);
  await visible(
    page.getByRole("button", { name: "Verify and create account" }),
  ).click();
  // V2.1: a new account goes through the first-time setup (/welcome) first.
  await expect(page).toHaveURL(/\/welcome/, { timeout: 20_000 });
  await visible(page.getByRole("button", { name: "Skip for now" })).click();
  await expect(
    visible(page.getByRole("button", { name: /Account menu/ })),
  ).toBeVisible({ timeout: 20_000 });
});

test("2. subscribe, follow and like persist after a reload; Library lists them", async () => {
  await page.goto("/series/glass-compass");
  await page.waitForLoadState("networkidle");
  await visible(page.getByRole("button", { name: "+ Subscribe" })).click();
  await expect(
    visible(page.getByRole("button", { name: "✓ Subscribed" })),
  ).toHaveAttribute("aria-pressed", "true");
  await visible(page.getByRole("button", { name: "Follow creator" })).click();
  await expect(
    visible(page.getByRole("button", { name: "Following" })),
  ).toBeVisible();

  await page.goto("/read/glass-compass/1");
  const like = visible(page.getByRole("button", { name: /^Like, .*likes$/ }));
  await like.scrollIntoViewIfNeeded();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800); // let the request finish before navigating away

  await page.goto("/series/glass-compass");
  await expect(
    visible(page.getByRole("button", { name: "✓ Subscribed" })),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    visible(page.getByRole("button", { name: "Following" })),
  ).toBeVisible();
  await expect(
    visible(page.getByRole("link", { name: /Continue episode/ })),
  ).toBeVisible();

  // V2.1 Library: Edit, select the series, Unsubscribe; the toast's Undo subscribes again.
  await page.goto("/library");
  await visible(page.getByRole("tab", { name: /Subscribed/ })).click();
  await expect(visible(page.getByText("Glass Compass"))).toBeVisible();
  await visible(page.getByRole("button", { name: "Edit" })).click();
  await visible(page.getByRole("checkbox", { name: "Select Glass Compass" })).click();
  await visible(page.getByRole("button", { name: "Unsubscribe (1)" })).click();
  const restored = page.waitForResponse((r) =>
    r.url().includes("/me/subscriptions/restore"),
  );
  await visible(page.getByRole("button", { name: "Undo" })).click();
  await restored;
  await page.reload();
  await visible(page.getByRole("tab", { name: /Subscribed/ })).click();
  await expect(visible(page.getByText("Glass Compass"))).toBeVisible();
});

test("3. comment: post, like, delete", async () => {
  await page.goto("/series/glass-compass");
  // A freshly started server hydrates slowly: wait, or the click on "Post" can land before the page is interactive.
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /Comments/ }).click();
  const text = `E2E comment ${stamp}`;
  await page.getByPlaceholder("What did you think?").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const item = page.locator("li", { hasText: text });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: /^Like/ }).click();
  await page.reload();
  await page.getByRole("tab", { name: /Comments/ }).click();
  await expect(
    page
      .locator("li", { hasText: text })
      .getByRole("button", { name: /^Like/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator("li", { hasText: text })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.locator("li", { hasText: text })).toHaveCount(0);
});

test("4. coins: buy the 10 pack with the simulator, then unlock a Fast Pass episode", async () => {
  await page.goto("/coins");
  await expect(headerCoins()).toHaveText("0");
  await page.locator("#pack-10").click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.reload(); // the open order resumes
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "I've paid (simulate)" }).click();
  await expect(page.getByText(/\+20 coins added/)).toBeVisible();
  await expect(headerCoins()).toHaveText("20");
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText("Paid");

  // The seed's Fast Pass episodes have fixed free dates (glass-compass 66/67/68 turn free on Nov 12/19/26, 2026), so
  // pick whichever one is still locked: the list is newest first, so the last locked row is the next to turn free.
  // From 2026-11-26 none is locked any more: make the seed dates relative to today then (see CHECKLIST Assumptions).
  await page.goto("/series/glass-compass");
  const locked = page.getByRole("button", { name: /^Fast Pass, Episode \d+/ }).last();
  const lockedName = (await locked.getAttribute("aria-label")) ?? (await locked.innerText());
  const lockedN = /Episode (\d+)/.exec(lockedName)?.[1];
  expect(lockedN).toBeTruthy();
  await locked.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Unlock for 5 coins/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/read/glass-compass/${lockedN}$`));
  await expect(headerCoins()).toHaveText("15");
  await page.goto("/library");
  await page.getByRole("tab", { name: "Unlocked" }).click();
  await expect(page.getByText("Glass Compass").first()).toBeVisible();
});

test("5. settings: name, appearance, text size, region and privacy are saved to the account", async () => {
  // V2.1 Settings: edit in place, then "Save changes" in the unsaved-changes bar.
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await visible(page.getByLabel("Display name")).fill("E2E Renamed");
  await visible(page.getByRole("radio", { name: "Dark" })).click();
  await visible(page.getByRole("radio", { name: "Large" })).click();
  // V21-08: region and privacy are saved too. Reading mode, quality, data saver and the reader background stay at
  // their defaults: later tests read comics with this account and expect them.
  await selectOption(visible(page.getByRole("combobox", { name: "Region" })), "TH");
  await visible(page.getByRole("switch", { name: "Show my library on my profile" })).setChecked(true);
  await visible(page.getByRole("button", { name: "Save changes" })).click();
  await expect(visible(page.getByText("Settings saved"))).toBeVisible();
  // The theme applies to the whole site: "Dark" puts `.dark` on <html>.
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(1500); // synced to the account half a second after the change

  // A different browser, logging in, gets the same settings.
  const other = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: 1280, height: 900 } });
  const op = await other.newPage();
  await logIn(op, PASSWORD);
  await op.goto("/settings");
  await expect(visible(op.getByLabel("Display name"))).toHaveValue("E2E Renamed");
  await expect(visible(op.getByRole("radio", { name: "Dark" }))).toBeChecked();
  await expect(visible(op.getByRole("radio", { name: "Large" }))).toBeChecked();
  await expect(visible(op.getByRole("combobox", { name: "Region" }))).toHaveAttribute("data-value", "TH");
  await expect(visible(op.getByRole("switch", { name: "Show my library on my profile" }))).toBeChecked();
  await other.close();
});

test("6. security: change password, the new one logs in; the device list shows this device", async () => {
  await page.goto("/settings");
  await expect(visible(page.getByText("This device"))).toBeVisible();
  // V2.1: the form opens in place under Account (not a dialog).
  await visible(page.getByRole("button", { name: "Change password" })).click();
  await visible(page.getByLabel("Current password")).fill("Wrong-Pass-1!");
  await visible(page.getByLabel("New password", { exact: true })).fill(NEW_PASSWORD);
  await visible(page.getByLabel("Confirm new password")).fill(NEW_PASSWORD);
  await visible(page.getByRole("button", { name: "Update password" })).click();
  await expect(visible(page.getByText("That password isn't right."))).toBeVisible();
  await visible(page.getByLabel("Current password")).fill(PASSWORD);
  await visible(page.getByRole("button", { name: "Update password" })).click();
  await expect(visible(page.getByText(/Password changed/))).toBeVisible();

  const other = await page.context().browser()!.newContext();
  const op = await other.newPage();
  await logIn(op, NEW_PASSWORD);
  await other.close();
});

test("7. creator dashboard: a reader is invited to become a creator", async () => {
  await page.goto("/creator");
  await expect(
    visible(page.getByRole("heading", { name: "Become a creator to publish" })),
  ).toBeVisible();
  await expect(
    visible(page.getByRole("link", { name: "How it works" })),
  ).toHaveAttribute("href", /\/creators\/join$/);
});

/** A solid-colour RGB PNG of the given size (no image library needed). */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.alloc(1 + width * 3, 0);
  for (let x = 0; x < width; x++) row.set([0, 220, 100], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A PNG of random pixels: it does not compress, so it weighs about width x height x 3 bytes (for upload timing). */
function noisyPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, () =>
    Buffer.concat([Buffer.from([0]), randomBytes(width * 3)]),
  );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * True when the backend stores uploads in S3 storage (R2, or RustFS / MinIO locally). Without it (no storage
 * settings in backend/.env) uploads stay in the API's memory and the presigned address is `memory:…`, which a
 * browser cannot PUT to: the upload flows below then need the home PC (`npm run services:docker:up`).
 */
const hasStorage = (uploadUrl: string) => /^https?:/.test(uploadUrl);

/** The CSRF header for direct API calls from the test (cookie-to-header, like the website). */
async function apiHeaders() {
  await page.request.get("/api/v1/auth/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")
      ?.value ?? "";
  return { "X-XSRF-TOKEN": xsrf };
}

test("8. become a creator in the dialog; the dashboard lists the series with their state", async () => {
  await page.goto("/creator");
  await visible(page.getByRole("button", { name: "Become a creator" })).click();
  const dialog = visible(page.getByRole("dialog"));
  await dialog.getByLabel("Pen name").fill("E2E Pen");
  await dialog.getByRole("button", { name: "Accept and continue" }).click();
  await expect(dialog.getByText("Accept the terms to continue.")).toBeVisible();
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Accept and continue" }).click();
  await expect(visible(page.getByText("You’re a creator now"))).toBeVisible();
  await expect(
    visible(page.getByRole("heading", { level: 1, name: /^Welcome to Creator studio/ })),
  ).toBeVisible();
  // No series yet: the three-step empty state.
  await expect(
    visible(page.getByRole("heading", { name: "Publish your first story in 3 steps" })),
  ).toBeVisible();
  await expect(
    visible(page.getByRole("link", { name: "Create your first series" })),
  ).toHaveAttribute("href", /\/creator\/new$/);

  // Two drafts written through the API, one with a cover (an upload, so only with S3 storage). Going live
  // needs an admin's review since V21-01: that path is key flow 4 (test 15).
  const headers = await apiHeaders();
  const ticket = await (
    await page.request.post("/api/v1/creator/uploads", {
      headers,
      data: {
        kind: "COVER",
        contentType: "image/png",
        size: png(600, 800).length,
      },
    })
  ).json();
  const live = hasStorage(ticket.uploadUrl);
  if (live) {
    await page.request.put(ticket.uploadUrl, {
      headers: ticket.headers,
      data: png(600, 800),
    });
    expect(
      (
        await page.request.post(`/api/v1/creator/uploads/${ticket.id}/complete`, {
          headers,
        })
      ).status(),
    ).toBe(200);
  }
  const create = async (title: string, cover: boolean) =>
    (
      await (
        await page.request.post("/api/v1/creator/series", {
          headers,
          data: {
            title,
            type: "comic",
            genre: "fantasy",
            languages: ["en"],
            summary: "A test story.",
            tags: [],
            coverUploadId: cover ? ticket.id : null,
          },
        })
      ).json()
    ).id as string;
  const alpha = await create(`E2E Alpha ${stamp}`, live);
  const beta = await create(`E2E Beta ${stamp}`, false);

  // The dashboard lists both, with their state, and opens each one's Manage page.
  await page.reload();
  await expect(visible(page.getByText(`E2E Alpha ${stamp}`))).toBeVisible();
  await expect(visible(page.getByText(`E2E Beta ${stamp}`))).toBeVisible();
  await expect(
    visible(page.locator(`a[href$="/creator/series/${alpha}"]`)),
  ).toBeVisible();
  await expect(
    visible(page.locator(`a[href$="/creator/series/${beta}"]`)),
  ).toBeVisible();

});

test("9. Create series wizard: step checks, cover rules with a real upload, draft, submit for review", async () => {
  test.setTimeout(180_000);
  const title = `E2E Wizard ${stamp}`;
  const field = (id: string) => visible(page.locator(`#${id}`));
  const next = () => visible(page.getByRole("button", { name: "Continue" }));
  const anonymous = await playwrightRequest.newContext({
    baseURL: "http://localhost:3100",
  });

  // Basics: Continue lists what is missing, next to the fields.
  await page.goto("/creator/new");
  await next().click();
  await expect(visible(page.getByText("Fix 2 things to continue"))).toBeVisible();
  await expect(field("cs-title")).toHaveAttribute("aria-invalid", "true");
  await field("cs-title").fill(title);
  await selectOption(field("cs-genre"), { label: "Fantasy" });
  await next().click();

  // Story: a short summary is refused; tags are added and removed.
  await next().click();
  await expect(
    visible(page.getByText("Write a summary of at least 50 characters.")).first(),
  ).toBeVisible();
  await field("cs-sum").fill(
    "A sea made of glass, and the people who dare to cross it before the tide turns.",
  );
  await field("cs-tag").fill("sea");
  await field("cs-tag").press("Enter");
  await field("cs-tag").fill("glass");
  await field("cs-tag").press("Enter");
  await visible(page.getByRole("button", { name: "Remove tag glass" })).click();
  await expect(page.getByRole("button", { name: "Remove tag glass" })).toHaveCount(0);
  await next().click();

  // Cover: image rules are checked, then a good file uploads straight to storage.
  const file = () => visible(page.locator("input[type=file]"));
  await next().click();
  await expect(visible(page.getByText("Add a cover image.")).first()).toBeVisible();
  await file().setInputFiles({ name: "narrow.png", mimeType: "image/png", buffer: png(599, 800) });
  await expect(
    visible(page.getByText("This image is 599 px wide; the minimum is 600 px.")),
  ).toBeVisible();
  await file().setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(visible(page.getByText("Use a JPG or PNG image."))).toBeVisible();
  await file().setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png(600, 800) });
  await expect(visible(page.getByAltText("Cover preview"))).toHaveAttribute(
    "src",
    /127\.0\.0\.1:9000/,
    { timeout: 30_000 },
  );
  await next().click();

  // Publishing: two things are missing; the filled wizard never scrolls sideways.
  await expect(visible(page.getByRole("heading", { level: 2, name: "Publishing" }))).toBeVisible();
  await visible(page.getByRole("button", { name: "Submit for review" })).click();
  await expect(visible(page.getByText(/^Fix \d things? to continue$/))).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `${width}px`,
    ).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Save draft: it is private, and reopening it brings the values and the stored cover back.
  const created = page.waitForResponse(
    (r) => /\/api\/v1\/creator\/series(\/|$)/.test(r.url()) && ["POST", "PUT"].includes(r.request().method()) && r.ok(),
  );
  await visible(page.getByRole("button", { name: "Save draft" })).click();
  await created;
  const id = sql(`select id from series where title = '${title}'`);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const draft = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
  expect(draft).toMatchObject({ visibility: "draft", genre: "fantasy" });
  expect(draft.tags).toEqual(["sea"]);
  expect((await anonymous.get(`/api/v1/series/${draft.slug}`)).status()).toBe(404);
  await page.goto(`/creator/new?draft=${id}`);
  const publishing = visible(page.getByRole("heading", { level: 2, name: "Publishing" }));
  const step = visible(page.getByRole("button", { name: "Continue" }));
  await expect(publishing.or(step)).toBeVisible();
  await visible(page.getByRole("button", { name: /^Basics/ })).click();
  await expect(field("cs-title")).toHaveValue(title);
  await expect(field("cs-genre")).toHaveAttribute("data-value", /fantasy|Fantasy/);

  // Submit for review: update day and the original-work promise are required; then it waits for an admin.
  for (let n = 0; n < 3 && !(await publishing.isVisible()); n++) await step.click();
  await expect(publishing).toBeVisible();
  await visible(page.getByRole("group", { name: /Update days/ }).getByRole("button", { name: "Fri" })).click();
  const original = visible(page.getByRole("checkbox", { name: /original work/ }));
  if (!(await original.isChecked())) await original.click();
  await visible(page.getByRole("button", { name: "Submit for review" })).click();
  await expect(visible(page.getByRole("heading", { name: `${title} is in review` }))).toBeVisible();
  expect((await (await page.request.get(`/api/v1/creator/series/${id}`)).json()).visibility).toBe("review");
  expect((await anonymous.get(`/api/v1/series/${draft.slug}`)).status()).toBe(404);

  // Keep the dev catalog clean: back to a draft, then deleted.
  sql(`delete from series_reviews where series_id = '${id}'`);
  sql(`update series set visibility = 'DRAFT' where id = '${id}'`);
  const headers = await apiHeaders();
  expect((await page.request.delete(`/api/v1/creator/series/${id}`, { headers })).status()).toBe(204);
  await anonymous.dispose();
});

test("10. creator image upload: presigned upload to storage, WebP variants, 799 px refused", async () => {
  // The signed-in browser's cookies; writes need the CSRF header.
  await page.request.get("/api/v1/auth/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")
      ?.value ?? "";
  const headers = { "X-XSRF-TOKEN": xsrf };
  const startUpload = (size: number) =>
    page.request.post("/api/v1/creator/uploads", {
      headers,
      data: { kind: "PANEL", contentType: "image/png", size },
    });

  // The account became a creator in the previous test; a signed-in reader without the terms would get 403 here.

  async function upload(image: Buffer) {
    const ticketRes = await startUpload(image.length);
    expect(ticketRes.status()).toBe(201);
    const ticket = await ticketRes.json();
    // The browser's part: PUT the file straight to object storage.
    const put = await page.request.put(ticket.uploadUrl, {
      headers: ticket.headers,
      data: image,
    });
    expect(put.ok()).toBe(true);
    return {
      id: ticket.id as string,
      complete: () =>
        page.request.post(`/api/v1/creator/uploads/${ticket.id}/complete`, {
          headers,
        }),
    };
  }

  // 800 px wide: accepted, with a 320 and an 800 px WebP in storage.
  const good = await upload(png(800, 1000));
  const done = await good.complete();
  expect(done.status()).toBe(200);
  const view = await done.json();
  expect(view.status).toBe("READY");
  expect(view.variants.map((v: { width: number }) => v.width)).toEqual([
    320, 800,
  ]);
  const webp = await page.request.get(view.url);
  expect(webp.status()).toBe(200);
  expect(webp.headers()["content-type"]).toContain("image/webp");
  const bytes = await webp.body();
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");

  // 799 px wide: refused with a clear reason.
  const small = await upload(png(799, 1000));
  const refused = await small.complete();
  expect(refused.status()).toBe(422);
  const error = (await refused.json()).error;
  expect(error.code).toBe("image_too_small");
  expect(error.message).toBe(
    "The image is 799 px wide; the minimum is 800 px.",
  );

  // The file is checked, not the claim: a text file sent as a PNG is refused too.
  const fake = await upload(Buffer.from("this is not a png"));
  expect((await fake.complete()).status()).toBe(422);
});

/**
 * A live series made through the API for the episode tests (the wizard tests cover the series form itself). A new
 * series goes live when an admin approves it; this sets what "Approve" sets, without making this account an admin
 * (test 14 checks that the account is not one yet).
 */
async function makeSeries(
  type: "comic" | "novel",
  title: string,
): Promise<{ id: string; slug: string; headers: { "X-XSRF-TOKEN": string } }> {
  const headers = await apiHeaders();
  const image = png(600, 800);
  const ticket = await (
    await page.request.post("/api/v1/creator/uploads", {
      headers,
      data: { kind: "COVER", contentType: "image/png", size: image.length },
    })
  ).json();
  await page.request.put(ticket.uploadUrl, {
    headers: ticket.headers,
    data: image,
  });
  await page.request.post(`/api/v1/creator/uploads/${ticket.id}/complete`, {
    headers,
  });
  const created = await (
    await page.request.post("/api/v1/creator/series", {
      headers,
      data: {
        title,
        type,
        genre: "fantasy",
        languages: ["en"],
        summary: "A test story about a sea made of glass and the people who cross it.",
        tags: [],
        ageRating: "all",
        status: "ongoing",
        updateDays: ["Fri"],
        coverUploadId: ticket.id,
      },
    })
  ).json();
  // A new series cannot be published directly: it goes through review.
  const direct = await page.request.post(`/api/v1/creator/series/${created.id}/publish`, { headers });
  expect(direct.status()).toBe(409);
  expect((await direct.json()).error.code).toBe("review_required");
  sql(
    `update series set visibility = 'PUBLISHED', launched_at = coalesce(launched_at, now()) where id = '${created.id}'`,
  );
  return { id: created.id, slug: created.slug, headers };
}

test("11. Comic episode page: 60 images at 10 Mbps with per-file progress, a failed file retried alone, reorder, Fast Pass, publish, schedule, draft", async () => {
  test.setTimeout(300_000);
  const title = `E2E Comic ${stamp}`;
  const { id, slug } = await makeSeries("comic", title);
  const anonymous = await playwrightRequest.newContext({
    baseURL: "http://localhost:3100",
  });
  const epTitle = visible(page.locator("#up-title"));
  const list = () => visible(page.getByRole("list", { name: "Images in reading order" }));
  const ready = (done: number, total: number, ok = "done") =>
    visible(page.locator("li", { hasText: `Images ready (${done}/${total}) (${ok})` }));

  await page.goto(`/creator/upload?series=${id}`);
  await expect(visible(page.getByRole("heading", { level: 1, name: "Upload episode" }))).toBeVisible();
  await expect(visible(page.getByText(`${title} · Episode 1`))).toBeVisible();

  // Validation first: nothing to publish yet. (A series with update days offers the next slot by default.)
  await visible(page.getByRole("radio", { name: /^Publish now/ })).click();
  await visible(page.getByRole("button", { name: "Publish episode" })).click();
  await expect(visible(page.getByText("Fix 2 things before publishing"))).toBeVisible();
  await expect(visible(page.getByText("Add at least one image.")).first()).toBeVisible();

  // 60 good images (about 190 KB each) and one 500 px wide file; one image's first upload is cut off.
  const good = Array.from({ length: 60 }, (_, i) => ({
    name: `panel-${String(i + 1).padStart(2, "0")}.png`,
    mimeType: "image/png",
    buffer: noisyPng(800, i === 6 ? 79 : 80),
  }));
  const narrow = { name: "too-narrow.png", mimeType: "image/png", buffer: png(500, 200) };
  const cutOffSize = good[6].buffer.length;
  let cutOff = false;
  await page.route("**/127.0.0.1:9000/**", (route) => {
    const request = route.request();
    if (request.method() === "PUT" && !cutOff && request.postDataBuffer()?.length === cutOffSize) {
      cutOff = true;
      return route.abort("failed");
    }
    return route.continue();
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20,
    downloadThroughput: (10 * 1024 * 1024) / 8,
    uploadThroughput: (10 * 1024 * 1024) / 8,
  });
  const started = Date.now();
  await visible(page.locator("input[type=file][multiple]")).setInputFiles([...good, narrow]);

  // Every file has its own progress while it travels; at the end 59 of 61 are ready.
  await expect(
    visible(page.getByRole("progressbar", { name: /^Uploading panel-\d+\.png$/ }).first()),
  ).toBeVisible();
  await expect(ready(59, 61, "not yet")).toBeVisible({ timeout: 150_000 });
  console.log(`60 images at 10 Mbps: ${Math.round((Date.now() - started) / 1000)} s`);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  expect(cutOff).toBe(true);

  // The cut-off file can be tried again on its own; the narrow one only says why and can be removed.
  await expect(visible(page.getByText("Too narrow: 500 px. Use 690–1600 px."))).toBeVisible();
  await expect(visible(page.getByText("The upload was interrupted. Try again."))).toBeVisible();
  await expect(page.getByRole("button", { name: /^Try .* again$/ })).toHaveCount(1);
  await visible(page.getByRole("button", { name: "Try panel-07.png again" })).click();
  await expect(ready(60, 61, "not yet")).toBeVisible({ timeout: 30_000 });
  await visible(page.getByRole("button", { name: "Remove too-narrow.png" })).click();
  await expect(ready(60, 60)).toBeVisible();

  // Reorder with the buttons; remove one.
  const names = () => list().locator("li span.font-medium").allTextContents();
  expect((await names())[0]).toBe("panel-01.png");
  await visible(page.getByRole("button", { name: "Move panel-02.png up" })).click();
  expect((await names()).slice(0, 2)).toEqual(["panel-02.png", "panel-01.png"]);
  await visible(page.getByRole("button", { name: "Move panel-03.png up" })).click();
  await visible(page.getByRole("button", { name: "Move panel-03.png up" })).click();
  expect((await names()).slice(0, 3)).toEqual(["panel-03.png", "panel-02.png", "panel-01.png"]);
  await visible(page.getByRole("button", { name: "Remove panel-03.png" })).click();
  await expect(ready(59, 59)).toBeVisible();

  // 59 images on the page: no sideways scroll from a small phone to a desktop.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `${width}px`,
    ).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Details, Fast Pass and comments.
  await epTitle.fill(`Episode one ${stamp}`);
  await visible(page.locator("#up-note")).fill("Thank you for reading!");
  await visible(page.getByRole("switch", { name: "Fast Pass" })).setChecked(true);
  await expect(visible(page.getByText(/Readers pay 5 coins to read early/))).toBeVisible();
  await visible(page.getByRole("switch", { name: "Allow comments" })).setChecked(false);
  await expect(ready(59, 59)).toBeVisible();

  // Publish: the success screen, and the API agrees.
  await visible(page.getByRole("button", { name: "Publish episode" })).click();
  await expect(visible(page.getByRole("heading", { name: "Episode 1 is live" }))).toBeVisible({ timeout: 60_000 });
  const saved = await (await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)).json();
  expect(saved).toMatchObject({
    status: "published",
    priceCoins: 5,
    freeAfterDays: 21, // Fri only, 3 episodes ahead: free after ceil(3 × 7 ÷ 1) days
    commentsEnabled: false,
    creatorNote: "Thank you for reading!",
  });
  expect(saved.panels).toHaveLength(59);
  expect((await anonymous.get(`/api/v1/series/${slug}/episodes/1`)).status()).toBe(402);

  // Next episode: a blank form that numbers itself; a scheduled episode stays hidden.
  await visible(page.getByRole("button", { name: "Upload episode 2" })).click();
  await expect(visible(page.getByText(`${title} · Episode 2`))).toBeVisible();
  await expect(epTitle).toHaveValue("");
  await visible(page.locator("input[type=file][multiple]")).setInputFiles([good[0], good[1]]);
  await expect(ready(2, 2)).toBeVisible({ timeout: 30_000 });
  await epTitle.fill(`Episode two ${stamp}`);
  await visible(page.getByRole("radio", { name: /^Schedule/ })).click();
  await visible(page.getByRole("button", { name: /^Schedule for / })).click();
  await expect(visible(page.getByRole("heading", { name: "Episode 2 is scheduled" }))).toBeVisible({ timeout: 60_000 });
  const scheduled = await (await page.request.get(`/api/v1/creator/series/${id}/episodes/2`)).json();
  expect(scheduled.status).toBe("scheduled");
  expect(Date.parse(scheduled.publishedAt)).toBeGreaterThan(Date.now());
  expect((await anonymous.get(`/api/v1/series/${slug}/episodes/2`)).status()).toBe(404);

  // Draft: saved without images, reopened from its address.
  await visible(page.getByRole("button", { name: "Upload episode 3" })).click();
  await epTitle.fill(`Episode three ${stamp}`);
  await visible(page.getByRole("button", { name: "Save draft" })).click();
  await expect(visible(page.getByText("Draft saved just now"))).toBeVisible({ timeout: 30_000 });
  await page.goto(`/creator/upload?series=${id}&ep=3`);
  await expect(visible(page.getByRole("heading", { level: 1, name: "Edit episode 3" }))).toBeVisible();
  await expect(epTitle).toHaveValue(`Episode three ${stamp}`);

  // A live episode is edited in place and keeps its images and Fast Pass.
  await page.goto(`/creator/upload?series=${id}&ep=1`);
  await expect(epTitle).toHaveValue(`Episode one ${stamp}`);
  await expect(list().locator("li")).toHaveCount(59);
  await epTitle.fill(`Episode one edited ${stamp}`);
  await visible(page.getByRole("button", { name: "Save changes" })).click();
  await expect(visible(page.getByRole("heading", { name: "Episode 1 is saved" }))).toBeVisible({ timeout: 30_000 });
  const edited = await (await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)).json();
  expect(edited).toMatchObject({ title: `Episode one edited ${stamp}`, priceCoins: 5 });
  expect(edited.panels).toHaveLength(59);

  // An unknown series id does not break the page: it opens with one of the creator's own series selected.
  // The series goes back to a draft so the dev data stays clean.
  await page.goto("/creator/upload?series=00000000-0000-0000-0000-000000000000");
  await expect(visible(page.getByRole("heading", { level: 1, name: "Upload episode" }))).toBeVisible();
  await expect(visible(page.getByRole("combobox", { name: "Series" }))).not.toHaveAttribute("data-value", "00000000-0000-0000-0000-000000000000");
  expect(
    (await page.request.post(`/api/v1/creator/series/${id}/unpublish`, { headers: await apiHeaders() })).status(),
  ).toBe(200);
  await anonymous.dispose();
});

test("12. Chapter page: a novel chapter from plain text (heading, scene break, quote), the word minimum, readers see it", async () => {
  test.setTimeout(150_000);
  const { id, slug } = await makeSeries("novel", `E2E Novel ${stamp}`);
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 7}`).join(" ");
  const chapterTitle = visible(page.locator("#up-title"));
  const text = visible(page.locator("#up-text"));

  await page.goto(`/creator/upload?series=${id}`);
  await expect(visible(page.getByRole("heading", { level: 1, name: "Upload chapter" }))).toBeVisible();

  // An empty chapter cannot be published; a short one is told how many words it has.
  await visible(page.getByRole("radio", { name: /^Publish now/ })).click();
  await visible(page.getByRole("button", { name: "Publish chapter" })).click();
  await expect(visible(page.getByText("Fix 2 things before publishing"))).toBeVisible();
  await expect(visible(page.getByText("Chapters need at least 300 words (now 0).")).first()).toBeVisible();
  await chapterTitle.fill(`The glass sea ${stamp}`);
  await text.fill(words(20));
  await expect(visible(page.getByText(/^20 words · about 1 min read$/))).toBeVisible();
  await visible(page.getByRole("button", { name: "Publish chapter" })).click();
  await expect(visible(page.getByText("Chapters need at least 300 words (now 20).")).first()).toBeVisible();

  // Enough words: a heading, paragraphs, a scene break and a quote.
  await text.fill(`# Chapter one\n\nThe sea was glass. ${words(310)}\n\n* * *\n\n> Morning came.\n\nShe waited for the tide.`);
  await expect(visible(page.getByText("Looks good"))).toBeVisible();
  await visible(page.getByRole("button", { name: "Publish chapter" })).click();
  await expect(visible(page.getByRole("heading", { name: "Chapter 1 is live" }))).toBeVisible({ timeout: 30_000 });
  const saved = await (await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)).json();
  expect(saved.status).toBe("published");
  expect(saved.wordCount).toBeGreaterThan(300);
  expect(saved.blocks.map((b: { type: string }) => b.type)).toEqual([
    "heading",
    "paragraph",
    "scene-break",
    "quote",
    "paragraph",
  ]);

  // Readers get the chapter with its heading and quote.
  await page.goto(`/novel/${slug}/1`);
  await expect(visible(page.getByText("Chapter one").first())).toBeVisible();
  await expect(visible(page.getByText("Morning came."))).toBeVisible();

  // Editing it brings the text back as written, and saving keeps it live.
  await page.goto(`/creator/upload?series=${id}&ep=1`);
  await expect(text).toHaveValue(/^# Chapter one\n\nThe sea was glass\./);
  await expect(text).toHaveValue(/\n\n\* \* \*\n\n> Morning came\.\n\n/);
  await chapterTitle.fill(`The glass sea edited ${stamp}`);
  await visible(page.getByRole("button", { name: "Save changes" })).click();
  await expect(visible(page.getByRole("heading", { name: "Chapter 1 is saved" }))).toBeVisible({ timeout: 30_000 });

  // A slug nobody made still answers "not found".
  await page.goto("/series/there-is-no-such-series");
  await expect(visible(page.getByRole("heading", { name: "We can’t find that page" }))).toBeVisible();
  expect(
    (await page.request.post(`/api/v1/creator/series/${id}/unpublish`, { headers: await apiHeaders() })).status(),
  ).toBe(200);
});

test("13. creator writes through the API: review is required, free and Fast Pass episodes, a scheduled episode goes live by itself", async () => {
  test.setTimeout(180_000);
  const headers = await apiHeaders();
  const anonymous = await playwrightRequest.newContext({
    baseURL: "http://localhost:3100",
  });

  async function upload(kind: string, image: Buffer): Promise<string> {
    const ticket = await (
      await page.request.post("/api/v1/creator/uploads", {
        headers,
        data: { kind, contentType: "image/png", size: image.length },
      })
    ).json();
    expect((await page.request.put(ticket.uploadUrl, { headers: ticket.headers, data: image })).ok()).toBe(true);
    expect(
      (await page.request.post(`/api/v1/creator/uploads/${ticket.id}/complete`, { headers })).status(),
    ).toBe(200);
    return ticket.id;
  }
  const post = (path: string, data?: unknown) =>
    page.request.post(`/api/v1/creator/series${path}`, { headers, data });

  // A new series is private, cannot skip the review, and waits for an admin once submitted.
  const cover = await upload("COVER", png(600, 800));
  const created = await post("", {
    title: `E2E Tides ${stamp}`,
    type: "comic",
    genre: "fantasy",
    languages: ["en"],
    summary: "A sea made of glass, and the people who dare to cross it.",
    ageRating: "all",
    updateDays: ["Fri"],
    status: "ongoing",
    tags: ["sea", "glass"],
    coverUploadId: cover,
  });
  expect(created.status()).toBe(201);
  const series = await created.json();
  expect(series.visibility).toBe("draft");
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(404);
  const direct = await post(`/${series.id}/publish`);
  expect(direct.status()).toBe(409);
  expect((await direct.json()).error.code).toBe("review_required");
  const submitted = await post(`/${series.id}/submit`);
  expect(submitted.status()).toBe(200);
  expect((await submitted.json()).visibility).toBe("review");
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(404);

  // The admin's approval (test 15 does it in the admin screens): the series goes live.
  sql(
    `update series_reviews set decided_at = now(), decision = 'APPROVED', decided_by = (select id from users where email = '${EMAIL}') where series_id = '${series.id}' and decided_at is null`,
  );
  sql(
    `update series set visibility = 'PUBLISHED', launched_at = coalesce(launched_at, now()) where id = '${series.id}'`,
  );
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(200);

  // Episode 1 is free, episode 2 is Fast Pass (anonymous readers get 402), the count follows.
  const panel = await upload("PANEL", png(800, 1000));
  const episode = (extra: object) => ({
    title: "Episode",
    number: null,
    fastPass: null,
    imageUploadIds: [panel],
    ...extra,
  });
  const free = await post(`/${series.id}/episodes`, episode({ title: "Free", publish: { mode: "now" } }));
  expect(free.status()).toBe(201);
  const paid = await post(`/${series.id}/episodes`, episode({ title: "Paid", fastPass: {}, publish: { mode: "now" } }));
  expect(paid.status()).toBe(201);
  expect(await paid.json()).toMatchObject({ number: 2, priceCoins: 5, freeAfterDays: 7 });
  expect((await anonymous.get(`/api/v1/series/${series.slug}/episodes/1`)).status()).toBe(200);
  expect((await anonymous.get(`/api/v1/series/${series.slug}/episodes/2`)).status()).toBe(402);
  const listed = await (
    await page.request.get(`/api/v1/creator/series?q=${encodeURIComponent(`E2E Tides ${stamp}`)}`)
  ).json();
  expect(listed[0].series.totalEpisodes).toBe(2);

  // Rules: a published episode needs images.
  const empty = await post(`/${series.id}/episodes`, episode({ title: "Empty", imageUploadIds: [], publish: { mode: "now" } }));
  expect(empty.status()).toBe(400);
  expect((await empty.json()).error.fields.imageUploadIds).toBe("required");

  // A scheduled episode is hidden, then the publish job (every 30 s) makes it live.
  const at = new Date(Date.now() + 4000).toISOString();
  const scheduled = await post(`/${series.id}/episodes`, episode({ title: "Soon", publish: { mode: "scheduled", at } }));
  expect(scheduled.status()).toBe(201);
  expect((await scheduled.json()).status).toBe("scheduled");
  expect((await anonymous.get(`/api/v1/series/${series.slug}/episodes/3`)).status()).toBe(404);
  await expect
    .poll(async () => (await anonymous.get(`/api/v1/series/${series.slug}/episodes/3`)).status(), {
      timeout: 75_000,
      intervals: [2_000],
    })
    .toBe(200);
  const live = await (await page.request.get(`/api/v1/creator/series/${series.id}/episodes/3`)).json();
  expect(live.status).toBe("published");

  // The series goes back to a draft so the dev data stays clean.
  expect((await post(`/${series.id}/unpublish`)).status()).toBe(200);
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(404);
  await anonymous.dispose();
});

/** Runs SQL on the dev database with psql (settings from backend/.env); only for set-up the API cannot do, like granting ADMIN. */
function sql(statement: string): string {
  const env = Object.fromEntries(
    readFileSync("backend/.env", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const url = new URL(String(env.DB_URL).replace("jdbc:", ""));
  return execFileSync(
    "psql",
    [
      "-h",
      url.hostname,
      "-p",
      url.port || "5432",
      "-U",
      env.DB_USER,
      "-d",
      url.pathname.slice(1),
      "-tA",
      "-c",
      statement,
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: env.DB_PASSWORD,
        PGSSLMODE: "require",
      },
    },
  )
    .toString()
    .trim();
}

test("14. admin: only ADMIN gets in; remove a reported comment, suspend a user, see a refused refund, read the audit log", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  // Not an admin yet: the page says so.
  await page.goto("/admin");
  await expect(
    visible(page.getByRole("heading", { name: "This area is only for PhumiReader admins" })),
  ).toBeVisible();

  const troll = `e2e-troll-${stamp}@phumireader.test`;
  const target = `E2E admin target ${stamp}`;
  sql(
    `insert into user_roles (user_id, role) select id, 'ADMIN' from users where email = '${EMAIL}'`,
  );
  sql(
    `insert into users (email, email_verified_at, display_name) values ('${troll}', now(), 'E2E Troll ${stamp}')`,
  );
  sql(
    `insert into comments (series_id, author_id, body) select s.id, u.id, '${target}' from series s, users u where s.slug = 'glass-compass' and u.email = '${EMAIL}'`,
  );
  sql(
    `insert into reports (reporter_id, target_type, target_id, reason) select r.id, 'COMMENT', c.id, 'spam' from users r, comments c where r.email = '${troll}' and c.body = '${target}'`,
  );

  // A new sign-in carries the ADMIN role.
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const ap = await ctx.newPage();
  try {
    await logIn(ap, NEW_PASSWORD);
    await visible(ap.getByRole("button", { name: /Account menu/ })).click();
    await ap.getByRole("menuitem", { name: "Admin" }).click();
    await expect(ap).toHaveURL(/\/admin$/);
    await expect(visible(ap.getByRole("heading", { level: 1, name: "Today" }))).toBeVisible();

    // V2.1 Reports: open the report, pick "Remove content", confirm; it leaves the open queue.
    await visible(ap.getByRole("link", { name: /^Open reports/ })).click();
    await expect(ap).toHaveURL(/\/admin\/reports/);
    const queue = visible(ap.getByRole("list", { name: "Open reports" }));
    await queue.getByRole("button", { name: new RegExp(target) }).click();
    const detail = visible(ap.getByRole("region", { name: "Spam or scam" }));
    await expect(detail.getByText(target)).toBeVisible();
    await detail.getByRole("radio", { name: /^Remove content/ }).click();
    // The decision is sent after the 6-second Undo window; wait for it before leaving the page.
    const settled = ap.waitForResponse((r) => r.url().includes("/settle") && r.ok(), { timeout: 20_000 });
    await detail.getByRole("button", { name: "Confirm" }).click();
    await expect(queue.getByRole("button", { name: new RegExp(target) })).toHaveCount(0);
    await settled;

    // Readers no longer see it.
    await page.goto("/series/glass-compass");
    await page.waitForLoadState("networkidle");
    await visible(page.getByRole("tab", { name: /Comments/ })).click();
    await expect(page.getByText(target)).toHaveCount(0);

    // Content (V1 screen): comments, hidden; restore it.
    await ap.goto("/admin/content");
    await selectOption(visible(ap.getByLabel("Type")), "comment");
    await selectOption(visible(ap.getByLabel("Status")), "hidden");
    const hidden = visible(ap.locator("li", { hasText: target }));
    await expect(hidden).toBeVisible();
    await hidden.getByRole("button", { name: "Restore" }).click();
    await expect(visible(ap.getByText("Restored."))).toBeVisible();
    await expect(ap.locator("li", { hasText: target })).toHaveCount(0);

    // Users (V1 screen): suspend (a reason is required) and restore.
    await ap.goto("/admin/users");
    await visible(ap.getByRole("searchbox")).fill(troll);
    const row = visible(ap.locator("li", { hasText: troll }));
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Suspend" }).click();
    const dialog = visible(ap.getByRole("dialog"));
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(dialog.getByText("Write a reason.")).toBeVisible();
    await dialog.getByLabel("Reason").fill("Spam in comments");
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(row.getByText("Suspended")).toBeVisible();
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(row.getByText("Active")).toBeVisible();

    // All orders (V1 screen): this account spent coins on an unlock, so the refund is refused with the reason.
    await ap.goto("/admin/orders");
    await visible(ap.getByRole("searchbox")).fill(EMAIL);
    const order = visible(ap.locator("li", { hasText: EMAIL }));
    await expect(order).toBeVisible();
    await order.getByRole("button", { name: "Refund" }).click();
    const refund = visible(ap.getByRole("dialog"));
    await refund.getByLabel("Reason").fill("Charged twice");
    await refund.getByRole("button", { name: "Refund" }).click();
    await expect(refund.getByText(/already spent some of these coins/)).toBeVisible();
    await refund.getByRole("button", { name: "Cancel" }).click();

    // Audit log (V1 screen): the actions above, each with who did it.
    await ap.goto("/admin/audit");
    for (const action of ["user.unban", "user.ban", "content.restore"]) {
      await expect(visible(ap.locator("li", { hasText: action }))).toContainText(/E2E (Reader|Renamed)/);
    }
    await selectOption(visible(ap.getByLabel("Area")), "user.");
    await expect(ap.locator("li", { hasText: "content.restore" })).toHaveCount(0);
  } finally {
    await ctx.close();
    sql(
      `delete from reports where reporter_id in (select id from users where email = '${troll}')`,
    );
    sql(`delete from comments where body = '${target}'`);
    sql(`delete from users where email = '${troll}'`);
  }
});

test("15. key flow 4: create series -> admin requests changes -> creator fixes and resubmits -> admin approves -> upload episode 1", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const title = `E2E Lanterns ${stamp}`;
  const headers = await apiHeaders();

  // The draft: basics and a summary with a Telegram link (the "contact" flag), then a cover. With S3 storage
  // the cover is a real upload; without it (memory: upload addresses) the draft gets a cover address directly.
  const id = (
    await (
      await page.request.post("/api/v1/creator/series", {
        headers,
        data: {
          title,
          type: "comic",
          genre: "fantasy",
          languages: ["en"],
          summary:
            "A ferry girl on the Kampot river finds a lantern that shows the way home. Updates on t.me/lanterns_kh",
          tags: [],
          ageRating: "all",
          status: "ongoing",
        },
      })
    ).json()
  ).id as string;
  const ticket = await (
    await page.request.post("/api/v1/creator/uploads", {
      headers,
      data: { kind: "COVER", contentType: "image/png", size: png(600, 800).length },
    })
  ).json();
  const storage = hasStorage(ticket.uploadUrl);
  if (storage) {
    await page.request.put(ticket.uploadUrl, { headers: ticket.headers, data: png(600, 800) });
    await page.request.post(`/api/v1/creator/uploads/${ticket.id}/complete`, { headers });
    const current = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
    await page.request.put(`/api/v1/creator/series/${id}`, {
      headers,
      data: { ...current, languages: current.languages, coverUploadId: ticket.id },
    });
  } else {
    sql(`update series set cover_url = '/covers/02eac6b05156d01f88c4919f72b5bbfc.svg' where id = '${id}'`);
  }

  // Create series (V2.1 wizard): continue the draft, then Submit for review.
  await page.goto(`/creator/new?draft=${id}`);
  // A continued draft opens at its first unfinished step (here: Publishing).
  const publishing = visible(page.getByRole("heading", { level: 2, name: "Publishing" }));
  const next = visible(page.getByRole("button", { name: "Continue" }));
  await expect(publishing.or(next)).toBeVisible();
  for (let step = 0; step < 3 && !(await publishing.isVisible()); step++) await next.click();
  const submit = visible(page.getByRole("button", { name: "Submit for review" }));
  await visible(page.getByRole("group", { name: /Update days/ }).getByRole("button", { name: "Sat" })).click();
  const original = visible(page.getByRole("checkbox", { name: /original work/ }));
  if (!(await original.isChecked())) await original.click();
  await submit.click();
  await expect(visible(page.getByRole("heading", { name: `${title} is in review` }))).toBeVisible();

  // An admin (this account gets the role, as in test 14) requests changes; the contact flag pre-ticks its reason.
  sql(
    `insert into user_roles (user_id, role) select id, 'ADMIN' from users where email = '${EMAIL}' on conflict do nothing`,
  );
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await ctx.newPage();
  try {
    await logIn(ap, NEW_PASSWORD);
    await ap.goto(`/admin/series?id=${id}`);
    await expect(visible(ap.getByRole("heading", { level: 2, name: title }))).toBeVisible();
    await expect(visible(ap.getByText(/Summary may contain a social handle/))).toBeVisible();
    await visible(ap.getByRole("button", { name: "Request changes" })).click();
    await expect(
      visible(ap.getByRole("checkbox", { name: "Remove contact details or links from the summary" })),
    ).toBeChecked();
    const changesSent = ap.waitForResponse(
      (r) => r.url().includes(`/admin/series/${id}/request-changes`) && r.status() === 204,
      { timeout: 20_000 },
    );
    await visible(ap.getByRole("button", { name: "Send to creator" })).click();
    await expect(visible(ap.getByText("Sent to the creator"))).toBeVisible();
    await changesSent; // after the 6-second Undo window

    // The creator sees the change in Manage series, marks it fixed and resubmits.
    await page.goto(`/creator/series/${id}`);
    await expect(visible(page.getByText("Changes needed before this series can go live"))).toBeVisible();
    await visible(page.getByRole("button", { name: "Mark fixed" })).click();
    await visible(page.getByRole("button", { name: "Resubmit for review" })).click();
    await expect(visible(page.getByText(/^Resubmitted\. /))).toBeVisible();
    const afterResubmit = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
    expect(afterResubmit.visibility).toBe("review");

    // The admin approves (every check ticked); the series goes live.
    await ap.goto(`/admin/series?id=${id}`);
    await expect(visible(ap.getByRole("heading", { level: 2, name: title }))).toBeVisible();
    const checklist = visible(ap.getByRole("group", { name: "Checklist" }));
    for (const box of await checklist.getByRole("checkbox").all()) await box.check();
    const approved = ap.waitForResponse(
      (r) => r.url().includes(`/admin/series/${id}/approve`) && r.status() === 204,
      { timeout: 20_000 },
    );
    await visible(ap.getByRole("button", { name: "Approve" })).click();
    await expect(visible(ap.getByText("Approved. The creator was notified."))).toBeVisible();
    await approved;
  } finally {
    await ctx.close();
  }
  const live = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
  expect(live.visibility).toBe("published");
  await page.goto(`/series/${live.slug}`);
  await expect(visible(page.getByRole("heading", { level: 1, name: title }))).toBeVisible();

  // Upload episode 1: panels are uploads, so only with S3 storage.
  if (storage) {
    await page.goto(`/creator/upload?series=${id}`);
    await visible(page.getByRole("textbox", { name: /^Episode title/ })).fill("The First Light");
    await page.locator('input[type="file"]').first().setInputFiles([
      { name: "ep01_01.png", mimeType: "image/png", buffer: png(800, 1200) },
      { name: "ep01_02.png", mimeType: "image/png", buffer: png(800, 1200) },
    ]);
    await expect(visible(page.locator("li", { hasText: "Images ready (2/2) (done)" }))).toBeVisible({ timeout: 30_000 });
    await visible(page.getByRole("button", { name: /^Schedule for / })).click();
    await expect(visible(page.getByRole("heading", { name: /Episode 1 is scheduled/ }))).toBeVisible();
  }

  // Keep the dev catalog clean: the series goes back to a draft (it went live once, so no new review is needed).
  expect((await page.request.post(`/api/v1/creator/series/${id}/unpublish`, { headers })).status()).toBe(200);
});

test("16. V2.1 series fields survive a reload: Create series, Manage series (details, Fast Pass, comments), delete a draft", async () => {
  test.setTimeout(240_000);
  const title = `E2E Fields ${stamp}`;
  const field = (id: string) => visible(page.locator(`#${id}`));

  // Create series: basics with a second genre, 16+ and both languages; Save draft.
  await page.goto("/creator/new");
  await field("cs-title").fill(title);
  await selectOption(field("cs-genre"), { label: "Fantasy" });
  await selectOption(field("cs-genre2"), { label: "Romance" });
  await visible(page.getByRole("radio", { name: "16+" }).or(page.getByRole("button", { name: "16+" }))).click();
  await selectOption(field("cs-lang"), "both");
  await visible(page.getByRole("button", { name: "Continue" })).click();
  await field("cs-sum").fill(
    "Two lighthouse keepers on Koh Rong trade letters through the tide, one in Khmer and one in English.",
  );
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/creator/series") && r.request().method() === "POST",
  );
  await visible(page.getByRole("button", { name: "Save draft" })).click();
  const id = (await (await created).json()).id as string;

  // Publishing step: a cover is needed to get there (an upload; without S3 storage a stored address), then
  // two update days, 8 PM and Fast Pass on; Save draft again.
  sql(`update series set cover_url = '/covers/07d70e33d965c6d11510ca21795511fa.svg' where id = '${id}'`);
  await page.goto(`/creator/new?draft=${id}`);
  const publishing = visible(page.getByRole("heading", { level: 2, name: "Publishing" }));
  const next = visible(page.getByRole("button", { name: "Continue" }));
  await expect(publishing.or(next)).toBeVisible();
  for (let step = 0; step < 3 && !(await publishing.isVisible()); step++) await next.click();
  const days = visible(page.getByRole("group", { name: /Update days/ }));
  for (const d of ["Mon", "Thu"]) {
    const day = days.getByRole("button", { name: d });
    if ((await day.getAttribute("aria-pressed")) !== "true") await day.click();
  }
  await selectOption(visible(page.getByRole("combobox", { name: "Release time" })), { label: "8:00 PM" });
  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/v1/creator/series/${id}`) && r.request().method() === "PUT",
  );
  await visible(page.getByRole("button", { name: "Save draft" })).click();
  await saved;

  // Reload: every field is still there.
  const afterCreate = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
  expect(afterCreate).toMatchObject({
    secondGenre: "romance",
    ageRating: "teen16",
    languages: expect.arrayContaining(["en", "km"]),
    updateDays: ["Mon", "Thu"],
    releaseHour: 20,
  });
  await page.goto(`/creator/new?draft=${id}`);
  await expect(publishing).toBeVisible();
  await expect(days.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
  await expect(days.getByRole("button", { name: "Thu" })).toHaveAttribute("aria-pressed", "true");
  await expect(visible(page.getByRole("combobox", { name: "Release time" }))).toHaveAttribute("data-value", "20");
  await visible(page.getByRole("button", { name: /^Basics/ })).click();
  await expect(field("cs-genre2")).toHaveAttribute("data-value", /romance|Romance/);
  await expect(field("cs-lang")).toHaveAttribute("data-value", "both");

  // Manage series, details: On break with a message.
  await page.goto(`/creator/series/${id}?tab=details`);
  await visible(page.getByRole("radiogroup", { name: "Status" }).getByRole("radio", { name: "On break" })).click();
  await visible(page.getByLabel("Message to readers")).fill("Back after the Water Festival.");
  await visible(page.getByRole("button", { name: "Save changes" })).click();
  await expect.poll(async () => (await (await page.request.get(`/api/v1/creator/series/${id}`)).json()).breakMessage).toBe(
    "Back after the Water Festival.",
  );
  await page.reload();
  await expect(visible(page.getByLabel("Message to readers"))).toHaveValue("Back after the Water Festival.");

  // Fast Pass tab: 2 episodes ahead; Settings: comments off. Both still there after a reload.
  await page.goto(`/creator/series/${id}?tab=fast-pass`);
  // Mon + Thu with 3 ahead: free after ceil(3 × 7 ÷ 2) = 11 days.
  await expect(visible(page.getByText(/free for everyone 11 days after release/))).toBeVisible();
  await selectOption(visible(page.getByRole("combobox", { name: "How many episodes ahead" })), "2");
  await visible(page.getByRole("button", { name: "Save Fast Pass settings" })).click();
  await expect.poll(async () => (await (await page.request.get(`/api/v1/creator/series/${id}`)).json()).fastPass.ahead).toBe(2);
  await page.reload();
  await expect(visible(page.getByRole("combobox", { name: "How many episodes ahead" }))).toHaveAttribute("data-value", "2");
  await page.goto(`/creator/series/${id}?tab=settings`);
  const comments = visible(page.getByRole("switch", { name: /comment/i }));
  await expect(comments).toBeChecked();
  await comments.click();
  await expect.poll(async () => (await (await page.request.get(`/api/v1/creator/series/${id}`)).json()).commentsEnabled).toBe(false);
  await page.reload();
  await expect(visible(page.getByRole("switch", { name: /comment/i }))).not.toBeChecked();
  const kept = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
  expect(kept).toMatchObject({ secondGenre: "romance", ageRating: "teen16", updateDays: ["Mon", "Thu"], releaseHour: 20 });

  // Delete series (Settings): a series with no published episode goes for good.
  await visible(page.getByRole("button", { name: "Delete series" })).click();
  const confirm = visible(page.getByRole("alertdialog"));
  await expect(confirm.getByRole("heading", { name: `Delete ${title}?` })).toBeVisible();
  await confirm.getByRole("button", { name: "Delete series" }).click();
  await expect(page).toHaveURL(/\/creator$/);
  expect((await page.request.get(`/api/v1/creator/series/${id}`)).status()).toBe(404);
});

test("17. readers see the V2.1 fields; hide and show a chapter; delete is blocked once one was published", async () => {
  test.setTimeout(240_000);
  const title = `E2E Break ${stamp}`;
  let headers = await apiHeaders();
  const input = {
    title,
    type: "novel",
    genre: "fantasy",
    secondGenre: "romance",
    languages: ["en"],
    summary: "A ferry captain keeps a logbook of every passenger who never reached the other side.",
    tags: [],
    ageRating: "teen16",
    status: "hiatus",
    updateDays: ["Mon", "Thu"],
    releaseHour: 20,
    fastPass: { on: false, ahead: 3 },
    commentsEnabled: false,
    breakMessage: "Back after the Water Festival.",
  };
  const id = (await (await page.request.post("/api/v1/creator/series", { headers, data: input })).json()).id as string;
  sql(`update series set cover_url = '/covers/07d70e33d965c6d11510ca21795511fa.svg' where id = '${id}'`);
  expect(
    (
      await page.request.post(`/api/v1/creator/series/${id}/episodes`, {
        headers,
        data: {
          title: "The first crossing",
          blocks: [{ type: "paragraph", text: "The river was quiet the night the logbook began." }],
          publish: { mode: "now" },
          fastPass: null,
        },
      })
    ).status(),
  ).toBe(201);

  // Review: submit, then approve as an admin (this account gets the role, as in tests 14 and 15).
  expect((await page.request.post(`/api/v1/creator/series/${id}/submit`, { headers })).status()).toBe(200);
  sql(
    `insert into user_roles (user_id, role) select id, 'ADMIN' from users where email = '${EMAIL}' on conflict do nothing`,
  );
  expect((await page.request.post("/api/v1/auth/refresh", { headers })).status()).toBe(200);
  headers = await apiHeaders();
  expect((await page.request.post(`/api/v1/admin/series/${id}/approve`, { headers })).status()).toBe(204);
  const slug = (await (await page.request.get(`/api/v1/creator/series/${id}`)).json()).slug as string;

  // The series page: On break with the message, 16+, the second genre, comments off.
  await page.goto(`/series/${slug}`);
  await expect(visible(page.getByRole("heading", { level: 1, name: title }))).toBeVisible();
  await expect(visible(page.getByText("On break: Back after the Water Festival."))).toBeVisible();
  await expect(visible(page.getByText("Romance"))).toBeVisible();
  await expect(visible(page.getByText(/Every Mon and Thu/))).toBeVisible();
  await visible(page.getByRole("tab", { name: "About" })).click();
  await expect(visible(page.getByText("16+"))).toBeVisible();
  await visible(page.getByRole("tab", { name: /Comments/ })).click();
  await expect(visible(page.getByText("The creator turned off comments here."))).toBeVisible();

  // Back from the break: every update day shows.
  const current = await (await page.request.get(`/api/v1/creator/series/${id}`)).json();
  expect(
    (await page.request.put(`/api/v1/creator/series/${id}`, { headers, data: { ...input, status: "ongoing", breakMessage: null, coverUploadId: null, bannerUploadId: null, tags: current.tags } })).status(),
  ).toBe(200);
  await page.goto(`/series/${slug}`);
  await expect(visible(page.getByText(/Every Mon and Thu/))).toBeVisible();

  // Manage series: hide chapter 1 (readers lose it), then show it again.
  await page.goto(`/novel/${slug}/1`);
  await expect(visible(page.getByText("The river was quiet the night the logbook began."))).toBeVisible();
  await page.goto(`/creator/series/${id}`);
  await visible(page.getByRole("button", { name: /^Hide chapter 1/ })).click();
  const hideDialog = page.getByRole("alertdialog").locator("visible=true");
  if (await hideDialog.count()) await hideDialog.first().getByRole("button", { name: /^Hide/ }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/v1/creator/series/${id}/episodes`)).json())[0].hiddenAt).not.toBeNull();
  expect((await page.request.get(`/api/v1/series/${slug}/episodes/1`)).status()).toBe(404);
  await page.reload();
  await visible(page.getByRole("button", { name: /^Show chapter 1/ })).click();
  await expect.poll(async () => (await (await page.request.get(`/api/v1/creator/series/${id}/episodes`)).json())[0].hiddenAt).toBeNull();
  expect((await page.request.get(`/api/v1/series/${slug}/episodes/1`)).status()).toBe(200);

  // A chapter was published: Delete stays blocked, and the API refuses it too.
  await page.goto(`/creator/series/${id}?tab=settings`);
  await expect(visible(page.getByRole("button", { name: "Delete series" }))).toBeDisabled();
  const refused = await page.request.delete(`/api/v1/creator/series/${id}`, { headers });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error.code).toBe("has_published_episodes");

  // Keep the dev catalog clean.
  expect((await page.request.post(`/api/v1/creator/series/${id}/unpublish`, { headers })).status()).toBe(200);
});

test("18. notifications: the bell and the page match in two browsers; read, remove with Undo, mark all read", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  // This account has the welcome item (test 1) and the paid coin order (test 4).
  const count = async (p: Page) =>
    (await (await p.request.get("/api/v1/me/notifications/unread-count")).json()).count as number;
  const bell = (p: Page) => visible(p.locator("header").getByRole("link", { name: /^Notifications/ }));
  const row = (p: Page, text: string) => visible(p.locator("li", { hasText: text }));

  await page.goto("/notifications");
  await expect(row(page, "Welcome to PhumiReader")).toBeVisible();
  await expect(row(page, "Payment received · +20 coins")).toBeVisible();
  const n = await count(page);
  expect(n).toBeGreaterThanOrEqual(2);
  await expect(bell(page)).toHaveAccessibleName(`Notifications, ${n} unread`);

  // A second browser on the same account sees the same count and items.
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await other.newPage();
  try {
    await logIn(op, NEW_PASSWORD);
    await op.goto("/notifications");
    await expect(bell(op)).toHaveAccessibleName(`Notifications, ${n} unread`);
    await expect(visible(op.getByText(`${n} unread`))).toBeVisible();
    await expect(row(op, "Welcome to PhumiReader")).toBeVisible();

    // Read in the first browser: the bell drops there at once and in the second after a reload.
    await row(page, "Welcome to PhumiReader").getByRole("button", { name: "Mark as read" }).click();
    await expect(bell(page)).toHaveAccessibleName(`Notifications, ${n - 1} unread`);
    await expect.poll(() => count(page)).toBe(n - 1);
    await op.reload();
    await expect(bell(op)).toHaveAccessibleName(`Notifications, ${n - 1} unread`);

    // Remove with Undo brings it back; removed for good, the second browser no longer lists it.
    await row(page, "Welcome to PhumiReader").getByRole("button", { name: "Remove notification" }).click();
    await expect(visible(page.getByText("Notification removed"))).toBeVisible();
    await visible(page.getByRole("button", { name: "Undo" })).click();
    await expect(row(page, "Welcome to PhumiReader")).toBeVisible();
    await row(page, "Welcome to PhumiReader").getByRole("button", { name: "Remove notification" }).click();
    await expect
      .poll(async () =>
        ((await (await page.request.get("/api/v1/me/notifications")).json()).items as { type: string }[]).some(
          (i) => i.type === "welcome",
        ),
      )
      .toBe(false);
    await op.reload();
    await expect(row(op, "Payment received · +20 coins")).toBeVisible();
    await expect(op.locator("li", { hasText: "Welcome to PhumiReader" }).locator("visible=true")).toHaveCount(0);

    // Mark all read: both browsers end at zero.
    await visible(page.getByRole("button", { name: "Mark all as read" })).click();
    await expect.poll(() => count(page)).toBe(0);
    await expect(bell(page)).toHaveAccessibleName("Notifications");
    await op.reload();
    await expect(bell(op)).toHaveAccessibleName("Notifications");
    await expect(visible(op.getByText("You’re all caught up"))).toBeVisible();
  } finally {
    await other.close();
  }
});

test("19. key flow 3: report a comment -> admin removes it -> the reporter sees Removed in Settings; the block follows the account to a new device", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const other = `e2e-flow3-${stamp}@phumireader.test`;
  const otherName = `E2E Flow3 ${stamp}`;
  const target = `E2E reported comment ${stamp}`;
  sql(
    `insert into users (email, email_verified_at, display_name) values ('${other}', now(), '${otherName}')`,
  );
  sql(
    `insert into comments (series_id, author_id, body) select s.id, u.id, '${target}' from series s, users u where s.slug = 'glass-compass' and u.email = '${other}'`,
  );
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const deviceCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    // The reader reports it (the reason is a key, the case number comes from the API) and also blocks the author.
    await page.goto("/series/glass-compass");
    await page.waitForLoadState("networkidle");
    await visible(page.getByRole("tab", { name: /Comments/ })).click();
    await visible(page.locator("li", { hasText: target }))
      .getByRole("button", { name: `Report comment by ${otherName}` })
      .click();
    const dialog = visible(page.getByRole("dialog"));
    await dialog.getByRole("radio", { name: /^Spam or scam/ }).click();
    await dialog.getByRole("button", { name: "Send report" }).click();
    const caseLine = dialog.getByText(/^Case R-\d+$/);
    await expect(caseLine).toBeVisible();
    const caseId = ((await caseLine.textContent()) ?? "").replace("Case ", "");
    await dialog.getByText(`Also block ${otherName}`).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(visible(page.getByText(`${otherName} is blocked`))).toBeVisible();
    await expect(page.getByText(target)).toHaveCount(0);
    await expect(visible(page.getByText(/comment from people you blocked hidden/))).toBeVisible();

    // The admin removes the content from the report queue.
    const ap = await adminCtx.newPage();
    await logIn(ap, NEW_PASSWORD);
    await ap.goto("/admin/reports");
    const queue = visible(ap.getByRole("list", { name: "Open reports" }));
    await queue.getByRole("button", { name: new RegExp(target) }).click();
    const detail = visible(ap.getByRole("region", { name: "Spam or scam" }));
    await detail.getByRole("radio", { name: /^Remove content/ }).click();
    // The decision is sent after the 6-second Undo window; wait for it before leaving the page.
    const settled = ap.waitForResponse((r) => r.url().includes("/settle") && r.ok(), { timeout: 20_000 });
    await detail.getByRole("button", { name: "Confirm" }).click();
    await expect(queue.getByRole("button", { name: new RegExp(target) })).toHaveCount(0);
    await settled;

    // The decision is saved after the Undo window; the API then lists the case as removed for the reporter.
    await expect
      .poll(
        async () =>
          (
            (await (await page.request.get("/api/v1/me/reports")).json()) as { caseNumber: number; status: string }[]
          ).find((r) => `R-${r.caseNumber}` === caseId)?.status,
        { timeout: 30_000 },
      )
      .toBe("removed");

    // Settings > Privacy and safety shows the case as Removed and the blocked author.
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(visible(page.locator("li", { hasText: caseId }))).toContainText("Removed");
    await expect(visible(page.getByRole("button", { name: `Unblock ${otherName}` }))).toBeVisible();

    // A new device (a second sign-in) has the block and the case without doing anything.
    const dp = await deviceCtx.newPage();
    await logIn(dp, NEW_PASSWORD);
    await dp.goto("/settings");
    await expect(visible(dp.getByRole("button", { name: `Unblock ${otherName}` }))).toBeVisible();
    await expect(visible(dp.locator("li", { hasText: caseId }))).toContainText("Removed");

    // Unblock there; the first browser sees it after a reload.
    await visible(dp.getByRole("button", { name: `Unblock ${otherName}` })).click();
    await expect(dp.getByRole("button", { name: `Unblock ${otherName}` })).toHaveCount(0);
    // The button changes at once; wait until the account has saved it before the other browser reloads.
    await expect
      .poll(async () => ((await (await page.request.get("/api/v1/me/blocks")).json()) as unknown[]).length)
      .toBe(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: `Unblock ${otherName}` })).toHaveCount(0);
  } finally {
    await adminCtx.close();
    await deviceCtx.close();
    sql(`delete from reports where target_type = 'COMMENT' and target_id in (select id from comments where body = '${target}')`);
    sql(`delete from comments where body = '${target}'`);
    sql(`delete from users where email = '${other}'`);
  }
});

test("20. creator earnings and public profile show API data: payout method, Edit profile, a guest sees the profile", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // The pen name "E2E Pen" (test 8) gives the handle "e2e-pen"; the dashboard says which one this account has.
  const handle = ((await (await page.request.get("/api/v1/creator/dashboard")).json()) as { handle: string }).handle;
  expect(handle).toMatch(/^e2e-pen/);

  // Earnings: no unlocks yet, no payout method; choosing one is saved with the account (no bank fields).
  await page.goto("/creator/earnings");
  await expect(visible(page.getByText("Add a payout method to get paid"))).toBeVisible();
  await visible(page.getByRole("button", { name: "Add payout method" })).click();
  const dialog = visible(page.getByRole("dialog"));
  await expect(dialog.getByText("[PAYOUT PROVIDER FORM]")).toBeVisible();
  await dialog.getByRole("button", { name: "Save payout method" }).click();
  await expect(visible(page.getByText("Payout method saved"))).toBeVisible();
  await expect
    .poll(async () => ((await (await page.request.get("/api/v1/creator/earnings")).json()) as { payoutMethod: string | null }).payoutMethod)
    .toBe("aba");
  await page.reload();
  await expect(page.getByText("Add a payout method to get paid")).toHaveCount(0);

  // Profile: the owner edits the bio and location; the handle stays.
  await page.goto(`/creators/${handle}?view=owner`);
  await expect(visible(page.getByRole("heading", { level: 1, name: "E2E Pen" }))).toBeVisible();
  await visible(page.getByRole("button", { name: "Edit profile" })).click();
  await visible(page.getByLabel("Location")).fill("Battambang");
  await visible(page.getByLabel("Bio")).fill(`Stories from the river ${stamp}`);
  await visible(page.getByRole("button", { name: "Save profile" })).click();
  await expect(visible(page.getByText("Profile saved"))).toBeVisible();

  // A guest in another browser sees the same profile, without the owner's tools.
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await guest.newPage();
  try {
    await gp.goto(`/creators/${handle}`);
    await expect(visible(gp.getByRole("heading", { level: 1, name: "E2E Pen" }))).toBeVisible();
    await expect(visible(gp.getByText(`Stories from the river ${stamp}`))).toBeVisible();
    await expect(gp.getByRole("button", { name: "Edit profile" })).toHaveCount(0);
    await gp.goto("/creators/no-such-creator-here");
    await expect(visible(gp.getByText(/Page not found|Error 404/))).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("21. refund request: asked on the receipt, shown in /admin/payments, approving takes the coins back once", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  // Buy the 10 pack again (the simulator), so there is a paid order whose coins are all unused.
  await page.goto("/coins");
  await expect(headerCoins()).toHaveText(/^\d+$/);
  const before = Number(await headerCoins().textContent());
  await page.locator("#pack-10").click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "I've paid (simulate)" }).click();
  await expect(page.getByText(/coins added/).first()).toBeVisible();
  const number = sql(
    `select o.order_number from payment_orders o join users u on u.id = o.user_id where u.email = '${EMAIL}' order by o.created_at desc limit 1`,
  ).trim();
  const total = Number(
    sql(`select coins + bonus_coins + first_bonus_coins from payment_orders where order_number = '${number}'`).trim(),
  );
  expect(total).toBeGreaterThan(0);

  // The reader asks on the receipt; the request shows there as waiting.
  const reason = `E2E refund ${stamp}`;
  await page.goto(`/coins/orders/${number}`);
  await visible(page.getByRole("button", { name: "Ask for a refund" })).click();
  const dialog = visible(page.getByRole("dialog"));
  await dialog.getByLabel("Why do you want a refund?").fill(reason);
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(visible(page.getByText(/Refund requested on/))).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask for a refund" })).toHaveCount(0);

  // The admin sees it with what can be refunded, and approves it.
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const ap = await adminCtx.newPage();
    await logIn(ap, NEW_PASSWORD);
    await ap.goto("/admin/payments");
    const row = visible(ap.locator("li", { hasText: number }).filter({ hasText: reason }));
    await expect(row).toBeVisible();
    // The same pack was paid twice within an hour (test 4 and this one): flagged as a double charge.
    await expect(row).toContainText("Double charge");
    await row.getByRole("button", { name: "Refund duplicate" }).click();

    // Sent after the Undo window: the order is refunded, and the coins left the wallet through one REFUND row.
    await expect
      .poll(async () => ((await (await page.request.get(`/api/v1/coins/orders/${number}`)).json()) as { status: string }).status, {
        timeout: 30_000,
      })
      .toBe("refunded");
    expect(
      sql(
        `select count(*) || ':' || coalesce(sum(amount), 0) from coin_ledger l join payment_orders o on o.id = l.order_id where o.order_number = '${number}' and l.reason = 'REFUND'`,
      ).trim(),
    ).toBe(`1:-${total}`);
    await page.goto("/coins");
    await expect(headerCoins()).toHaveText(String(before));
    await page.goto(`/coins/orders/${number}`);
    await expect(visible(page.getByText("Refunded").first())).toBeVisible();

    // Nothing left to decide, and a second approval is refused.
    await ap.reload();
    await expect(ap.locator("li", { hasText: reason })).toHaveCount(0);
  } finally {
    await adminCtx.close();
  }
});

test("22. smaller V2.1 fields: birth year, Home picks, Help ticket and votes stay on the account and follow it to a new device", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // Birth year from the sign-up form (test 1).
  expect(((await (await page.request.get("/api/v1/me")).json()) as { birthYear: number }).birthYear).toBe(1995);

  // Home: the picker shows until a genre is chosen; the pick is saved with the account.
  await page.goto("/");
  await visible(page.getByRole("button", { name: "Romance", exact: true })).click();
  await visible(page.getByRole("button", { name: /^Show/ })).click();
  await expect(visible(page.getByText("Recommended for you"))).toBeVisible();
  await expect
    .poll(async () => ((await (await page.request.get("/api/v1/me/settings")).json()) as { preferences: { genres: string[] | null } }).preferences.genres)
    .toEqual(["Romance"]);

  // Help: the Contact us form creates a ticket; "Was this helpful?" is saved.
  await page.goto("/help");
  await selectOption(visible(page.getByRole("combobox", { name: "Topic *" })), "other");
  await visible(page.getByLabel("Message *")).fill(`Where do I find my reading history? ${stamp}`);
  await visible(page.getByRole("button", { name: "Send message" })).click();
  await expect(visible(page.getByText(/^T-\d{5}$/).or(page.locator("strong", { hasText: /^T-\d{5}$/ })).first())).toBeVisible();
  await visible(page.locator('[data-slot="accordion-trigger"]').first()).click();
  await visible(page.getByRole("button", { name: "Yes", exact: true }).first()).click();
  await expect
    .poll(async () => ((await (await page.request.get("/api/v1/me/help-votes")).json()) as { article: number; helpful: boolean }[]).length)
    .toBe(1);

  // A new device signs in: no picker on Home, and the vote is still marked.
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await other.newPage();
  try {
    await logIn(op, NEW_PASSWORD);
    await op.goto("/");
    await expect(visible(op.getByText("Recommended for you"))).toBeVisible();
    await expect(op.getByRole("button", { name: "Romance", exact: true })).toHaveCount(0);
    await op.goto("/help");
    await visible(op.locator('[data-slot="accordion-trigger"]').first()).click();
    await expect(visible(op.getByRole("button", { name: "Yes", exact: true }).first())).toHaveAttribute("aria-pressed", "true");
  } finally {
    await other.close();
  }
});

test("23. delete the account: signed out everywhere, wrong password refused first", async () => {
  await page.goto("/settings");
  await visible(page.getByRole("button", { name: "Delete account" })).click();
  // V2.1: type DELETE first; the button stays disabled until then.
  const dialog = visible(page.getByRole("alertdialog"));
  await expect(dialog.getByRole("button", { name: "Delete account" })).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByLabel("Current password").fill("Wrong-Pass-1!");
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(dialog.getByText("That password isn't right.")).toBeVisible();
  await dialog.getByLabel("Current password").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(visible(page.getByText(/will be deleted on/))).toBeVisible();
  await expect(visible(page.getByRole("link", { name: "Log in" }))).toBeVisible();
});
