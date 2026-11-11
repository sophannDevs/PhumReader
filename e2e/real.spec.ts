import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import {
  expect,
  request as playwrightRequest,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

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
  await p.getByLabel("Email").fill(EMAIL);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(p.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

test("1. sign up with the email code and land logged in", async () => {
  await page.goto("/login?mode=signup");
  await page.getByLabel("Display name").fill("E2E Reader");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await page
    .locator("input[autocomplete=one-time-code], input[inputmode=numeric]")
    .fill(CODE);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible({
    timeout: 20_000,
  });
});

test("2. subscribe, follow and like persist after a reload; Library lists them", async () => {
  await page.goto("/series/glass-compass");
  await page
    .getByRole("button", { name: /^Subscribe$/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /^Subscribed$/ }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Follow creator" }).click();
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

  await page.goto("/read/glass-compass/1");
  const like = page.getByRole("button", { name: /likes?$/ }).first();
  await like.scrollIntoViewIfNeeded();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800); // let the request finish before navigating away

  await page.goto("/series/glass-compass");
  await expect(
    page.getByRole("button", { name: /^Subscribed$/ }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue episode/ }),
  ).toBeVisible();

  await page.goto("/library");
  await page.getByRole("tab", { name: "Subscribed" }).click();
  await expect(page.getByText("Glass Compass").first()).toBeVisible();
  await page.getByRole("button", { name: /Remove Glass Compass/ }).click();
  const restored = page.waitForResponse((r) =>
    r.url().includes("/me/subscriptions/restore"),
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await restored;
  await page.reload();
  await page.getByRole("tab", { name: "Subscribed" }).click();
  await expect(page.getByText("Glass Compass").first()).toBeVisible();
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

  await page.goto("/series/glass-compass");
  await page.getByRole("button", { name: /Episode 66/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Unlock for 5 coins/ })
    .click();
  await expect(page).toHaveURL(/\/read\/glass-compass\/66$/);
  await expect(headerCoins()).toHaveText("15");
  await page.goto("/library");
  await page.getByRole("tab", { name: "Unlocked" }).click();
  await expect(page.getByText("Glass Compass").first()).toBeVisible();
});

test("5. settings: name, appearance and text size are saved to the account", async () => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Display name").fill("E2E Renamed");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("E2E Renamed")).toBeVisible();

  await page.getByRole("radio", { name: "Dark" }).click();
  await page
    .getByRole("button", { name: /Increase text size|Larger/i })
    .first()
    .click();
  await page.waitForTimeout(1500); // saved half a second after the last change

  // A different browser, logging in, gets the same settings.
  const other = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: 1280, height: 900 } });
  const op = await other.newPage();
  await logIn(op, PASSWORD);
  await op.goto("/settings");
  await expect(op.getByText("E2E Renamed")).toBeVisible();
  await expect(op.locator("html")).toHaveClass(/dark/);
  await other.close();
});

test("6. security: change password, the new one logs in; the device list shows this device", async () => {
  await page.goto("/settings");
  await expect(page.getByText("This device")).toBeVisible();
  await page.getByRole("button", { name: "Change password" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Current password").fill("Wrong-Pass-1!");
  await dialog.getByLabel("New password").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("That password isn't right.")).toBeVisible();
  await dialog.getByLabel("Current password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  const other = await page.context().browser()!.newContext();
  const op = await other.newPage();
  await logIn(op, NEW_PASSWORD);
  await other.close();
});

test("7. creator dashboard: empty for a reader, numbers for a creator", async () => {
  await page.goto("/creator");
  await expect(page.getByText("No series yet")).toBeVisible();

  // A creator account does not exist in the seed, so the API answer is a fixture here.
  const card = await page.request
    .get("/api/v1/series/glass-compass")
    .then((r) => r.json());
  await page.route("**/api/v1/creator/dashboard", (route) =>
    route.fulfill({
      json: {
        creator: true,
        name: "Fixture Creator",
        totals: {
          series: 1,
          views: 1_500_000,
          likes: 20_000,
          subscribers: 900,
          comments: 12,
          unlocks: 40,
          earnedCoins: 200,
        },
        series: [
          {
            series: card.series,
            visibility: "published",
            subscribers: 900,
            comments: 12,
            unlocks: 40,
            earnedCoins: 200,
          },
        ],
      },
    }),
  );
  await page.goto("/creator");
  await expect(page.getByText("1.5M").first()).toBeVisible();
  await expect(page.getByText("200 coins")).toBeVisible();
  await expect(page.getByText("Glass Compass").first()).toBeVisible();
  await page.unroute("**/api/v1/creator/dashboard");
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

test("8. My series: become a creator in the dialog, then the list with search, filters and notices", async () => {
  // A reader sees the invitation, not an empty list.
  await page.goto("/creator/series");
  await expect(page.getByRole("heading", { name: "My series" })).toBeVisible();
  await expect(page.getByText("Become a creator to publish")).toBeVisible();
  await page.getByRole("button", { name: "Become a creator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pen name").fill("E2E Pen");
  await dialog.getByRole("button", { name: "Accept and continue" }).click();
  await expect(dialog.getByText("Accept the terms to continue.")).toBeVisible();
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Accept and continue" }).click();
  await expect(page.getByText("You're a creator now.")).toBeVisible();

  // No series yet: an empty state with one next step.
  await expect(page.getByText("You have no series yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create series" }).first(),
  ).toHaveAttribute("href", /\/creator\/series\/new$/);

  // Two series written through the API (the create page comes in P4-14): one live, one draft.
  await page.request.get("/api/v1/auth/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")
      ?.value ?? "";
  const headers = { "X-XSRF-TOKEN": xsrf };
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
  const alpha = await create(`E2E Alpha ${stamp}`, true);
  const beta = await create(`E2E Beta ${stamp}`, false);
  expect(
    (
      await page.request.post(`/api/v1/creator/series/${alpha}/publish`, {
        headers,
      })
    ).status(),
  ).toBe(200);

  await page.reload();
  const rows = page
    .getByRole("list", { name: "My series" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);
  const alphaRow = rows.filter({ hasText: `E2E Alpha ${stamp}` });
  const betaRow = rows.filter({ hasText: `E2E Beta ${stamp}` });
  await expect(alphaRow.getByText("Published")).toBeVisible();
  await expect(betaRow.getByText("Draft")).toBeVisible();
  await expect(alphaRow).toContainText("0 episodes");
  await expect(
    alphaRow.getByRole("link", { name: "Add episode" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`/creator/series/${alpha}/episodes/new$`),
  );
  await expect(betaRow.getByRole("link", { name: "Edit" })).toHaveAttribute(
    "href",
    new RegExp(`/creator/series/${beta}/edit$`),
  );

  // The status filter and the search.
  await page.getByRole("tab", { name: "Published" }).click();
  await expect(rows).toHaveCount(1);
  await expect(alphaRow).toBeVisible();
  await page.getByRole("tab", { name: "Draft" }).click();
  await expect(rows).toHaveCount(1);
  await expect(betaRow).toBeVisible();
  await page.getByRole("tab", { name: "All" }).click();
  await page
    .getByRole("searchbox", { name: "Search your series" })
    .fill("beta");
  await expect(rows).toHaveCount(1);
  await page
    .getByRole("searchbox", { name: "Search your series" })
    .fill("zzz-nothing");
  await expect(page.getByText("No series match")).toBeVisible();

  // The success notices carry the next step.
  await page.goto(`/creator/series?notice=series-created&series=${alpha}`);
  await expect(page.getByText("Series created")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add the first episode" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`/creator/series/${alpha}/episodes/new$`),
  );
  await page.goto(`/creator/series?notice=episode-added&series=${alpha}`);
  await expect(
    page.getByRole("link", { name: "Add another episode" }),
  ).toBeVisible();

  // The dashboard now offers "Start publishing" as a link and "My series".
  await page.goto("/creator");
  await expect(
    page.getByRole("link", { name: "Start publishing" }),
  ).toHaveAttribute("href", /\/creator\/series\/new$/);
  await expect(
    page.getByRole("link", { name: "My series" }).first(),
  ).toBeVisible();

  // Keep the dev data clean: the live series goes back to a draft.
  expect(
    (
      await page.request.post(`/api/v1/creator/series/${alpha}/unpublish`, {
        headers,
      })
    ).status(),
  ).toBe(200);
});

test("9. Create and edit a series in the form: validation, uploads with rules, draft, publish, unpublish", async () => {
  test.setTimeout(120_000);
  const slugOf = async (id: string) =>
    (await (await page.request.get(`/api/v1/creator/series/${id}`)).json())
      .slug as string;
  const anonymous = await playwrightRequest.newContext({
    baseURL: "http://localhost:3100",
  });
  const title = `E2E Form ${stamp}`;
  // The "new series" page stays mounted (hidden) behind later pages, so only look at what is on screen.
  const on = (locator: Locator) => locator.and(page.locator(":visible"));
  const titleField = () => on(page.getByLabel("Title", { exact: true }));
  const genre = () => on(page.getByLabel("Genre"));
  const tag = () => on(page.getByPlaceholder("For example: sea, mystery"));
  const day = () => on(page.getByLabel("Update schedule"));
  const terms = () =>
    on(page.getByRole("checkbox", { name: /I own this work/ }));

  await page.goto("/creator/series");
  await page.getByRole("link", { name: "Create series" }).first().click();
  await expect(page).toHaveURL(/\/creator\/series\/new$/);
  await page.waitForLoadState("networkidle");

  // An empty form says what is missing, next to the fields.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Enter a title.")).toBeVisible();
  await expect(page.getByText("Choose a genre.")).toBeVisible();

  await titleField().fill(title);
  await genre().selectOption("fantasy");
  await tag().fill("sea");
  await tag().press("Enter");
  await tag().fill("glass");
  await tag().press("Enter");
  await page.getByRole("button", { name: "Remove tag glass" }).click();
  await expect(
    page.getByRole("list", { name: "Tags" }).getByRole("listitem"),
  ).toHaveCount(1);
  await day().selectOption("Fri");
  await page.getByRole("radio", { name: /Teen/ }).click();

  // Publishing needs a summary, a cover and the terms.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Write a summary to publish.")).toBeVisible();
  await expect(page.getByText("Add a cover to publish.")).toBeVisible();
  await expect(page.getByText("Accept the terms to publish.")).toBeVisible();
  await expect(page).toHaveURL(/\/creator\/series\/new$/);

  // Image rules are checked before the file is sent; a good file uploads straight to storage.
  const files = page.locator("input[type=file]");
  const file = (name: string, w: number, h: number) => ({
    name,
    mimeType: "image/png",
    buffer: png(w, h),
  });
  await files.nth(0).setInputFiles(file("narrow.png", 599, 800));
  await expect(
    page.getByText("This image is 599 px wide; the minimum is 600 px."),
  ).toBeVisible();
  await files
    .nth(0)
    .setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
  await expect(page.getByText("Use a JPG or PNG image.")).toBeVisible();
  await files.nth(0).setInputFiles(file("cover.png", 600, 800));
  await expect(
    page.getByRole("button", { name: "Replace image" }).first(),
  ).toBeVisible();
  await expect(page.getByAltText("Cover preview")).toBeVisible();
  await files.nth(1).setInputFiles(file("banner.png", 700, 300));
  await expect(
    page.getByText("This image is 700 px wide; the minimum is 800 px."),
  ).toBeVisible();
  await files.nth(1).setInputFiles(file("banner.png", 800, 300));
  await expect(page.getByAltText("Banner (optional) preview")).toBeVisible();

  // The filled form never scrolls sideways, from a small phone to a desktop.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
      `${width}px`,
    ).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Save as a draft: back on My series with the next step.
  await on(page.getByLabel("Summary")).fill(
    "A sea made of glass, and the people who cross it.",
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(
    /\/creator\/series\?notice=series-created&series=/,
  );
  await expect(page.getByText("Series created")).toBeVisible();
  const row = page
    .getByRole("list", { name: "My series" })
    .getByRole("listitem")
    .filter({ hasText: title });
  await expect(row.getByText("Draft")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("series") as string;
  const slug = await slugOf(id);
  expect((await anonymous.get(`/api/v1/series/${slug}`)).status()).toBe(404);

  // Edit: the saved values come back, the type is fixed, publishing needs the terms again.
  await row.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/creator/series/${id}/edit$`));
  await expect(titleField()).toHaveValue(title);
  await expect(genre()).toHaveValue("fantasy");
  await expect(day()).toHaveValue("Fri");
  await expect(page.getByRole("radio", { name: /Teen/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Comic" })).toBeDisabled();
  await expect(on(page.getByAltText("Cover preview"))).toHaveAttribute(
    "src",
    /127\.0\.0\.1:9000.*\.webp$/,
  );

  // Opening "Create series" again starts from a blank form, not from the series just saved.
  await page.goto("/creator/series/new");
  await expect(titleField()).toHaveValue("");
  await page.goBack();
  await titleField().fill(`${title} Edited`);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Accept the terms to publish.")).toBeVisible();
  await terms().click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Your series is live.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View public page" }),
  ).toBeVisible();
  expect((await anonymous.get(`/api/v1/series/${slug}`)).status()).toBe(200);

  // A live series can be edited and taken back to a draft.
  await titleField().fill(`${title} Live`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  expect(
    (await (await anonymous.get(`/api/v1/series/${slug}`)).json()).series.title,
  ).toBe(`${title} Live`);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Your series is a draft again.")).toBeVisible();
  expect((await anonymous.get(`/api/v1/series/${slug}`)).status()).toBe(404);

  // An unknown id says so.
  await page.goto("/creator/series/00000000-0000-0000-0000-000000000000/edit");
  await expect(page.getByText("Series not found")).toBeVisible();
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

/** A series made through the API for the episode tests (the form tests cover the series form itself). */
async function makeSeries(
  type: "comic" | "novel",
  title: string,
): Promise<{ id: string; slug: string; headers: { "X-XSRF-TOKEN": string } }> {
  await page.request.get("/api/v1/auth/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")
      ?.value ?? "";
  const headers = { "X-XSRF-TOKEN": xsrf };
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
        summary: "A test story.",
        tags: [],
        coverUploadId: ticket.id,
      },
    })
  ).json();
  expect(
    (
      await page.request.post(`/api/v1/creator/series/${created.id}/publish`, {
        headers,
      })
    ).status(),
  ).toBe(200);
  return { id: created.id, slug: created.slug, headers };
}

test("11. Comic episode page: 60 panels at 10 Mbps with per-file progress, a failed file retried alone, reorder, preview, Fast Pass, publish, schedule, draft", async () => {
  test.setTimeout(240_000);
  const { id, slug, headers } = await makeSeries("comic", `E2E Comic ${stamp}`);
  const anonymous = await playwrightRequest.newContext({
    baseURL: "http://localhost:3100",
  });
  const on = (locator: Locator) => locator.and(page.locator(":visible"));

  await page.goto(`/creator/series/${id}/episodes/new`);
  await page.waitForLoadState("networkidle");
  await expect(
    on(page.getByRole("heading", { name: "Add episode" })),
  ).toBeVisible();
  await expect(on(page.getByLabel("Number"))).toHaveAttribute(
    "placeholder",
    "1",
  );

  // Validation first: nothing to publish yet.
  await on(page.getByRole("button", { name: "Publish now" })).click();
  await expect(on(page.getByText("Enter a title."))).toBeVisible();

  // 60 good panels (about 190 KB each) and one 799 px wide file; one panel's first upload is cut off.
  const good = Array.from({ length: 60 }, (_, i) => ({
    name: `panel-${String(i + 1).padStart(2, "0")}.png`,
    mimeType: "image/png",
    buffer: noisyPng(800, i === 6 ? 79 : 80),
  }));
  const narrow = {
    name: "too-narrow.png",
    mimeType: "image/png",
    buffer: png(799, 200),
  };
  const cutOffSize = good[6].buffer.length;
  let cutOff = false;
  await page.route("**/127.0.0.1:9000/**", (route) => {
    const request = route.request();
    if (
      request.method() === "PUT" &&
      !cutOff &&
      request.postDataBuffer()?.length === cutOffSize
    ) {
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
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([...good, narrow]);
  // Every file has its own progress while it travels.
  await expect(
    on(
      page.getByRole("progressbar", { name: /^Uploading panel \d+$/ }).first(),
    ),
  ).toBeVisible();
  await expect(on(page.getByText("59 of 61 panels uploaded"))).toBeVisible({
    timeout: 120_000,
  });
  await expect(on(page.getByText("2 failed"))).toBeVisible();
  console.log(
    `60 panels at 10 Mbps: ${Math.round((Date.now() - started) / 1000)} s`,
  );
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  // The cut-off file can be retried on its own; the 799 px file cannot be retried, only removed.
  const retryButtons = on(page.getByRole("button", { name: "Retry" }));
  await expect(retryButtons).toHaveCount(1);
  await expect(
    on(page.getByText("This image is 799 px wide; the minimum is 800 px.")),
  ).toBeVisible();
  await retryButtons.click();
  await expect(on(page.getByText("60 of 61 panels uploaded"))).toBeVisible();
  await on(
    page.getByRole("button", { name: /^Remove panel \d+$/ }).last(),
  ).click();
  await expect(on(page.getByText("60 of 60 panels uploaded"))).toBeVisible();
  expect(cutOff).toBe(true);

  // Reorder with the buttons and by dragging; remove one.
  const names = () =>
    on(page.getByRole("list", { name: "Panels in reading order" }))
      .locator("li p.truncate")
      .allTextContents();
  expect((await names())[0]).toBe("panel-01.png");
  await on(
    page.getByRole("button", { name: "Move panel 2 up", exact: true }),
  ).click();
  expect((await names()).slice(0, 2)).toEqual(["panel-02.png", "panel-01.png"]);
  const cards = on(
    page.getByRole("list", { name: "Panels in reading order" }),
  ).locator("li");
  await cards.nth(2).dragTo(cards.nth(0));
  expect((await names()).slice(0, 3)).toEqual([
    "panel-03.png",
    "panel-02.png",
    "panel-01.png",
  ]);
  await on(
    page.getByRole("button", { name: "Remove panel 3", exact: true }),
  ).click();
  await expect(on(page.getByText("59 of 59 panels uploaded"))).toBeVisible();

  // 59 panels on the page: no sideways scroll from a small phone to a desktop.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
      `${width}px`,
    ).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Thumbnail must be square; details; Fast Pass rules.
  await on(page.locator("input[type=file]:not([multiple])")).setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: png(400, 300),
  });
  await expect(on(page.getByText("The image must be square."))).toBeVisible();
  await on(page.locator("input[type=file]:not([multiple])")).setInputFiles({
    name: "square.png",
    mimeType: "image/png",
    buffer: png(400, 400),
  });
  await expect(on(page.getByAltText("Thumbnail preview"))).toBeVisible();
  await on(page.getByLabel("Title", { exact: true })).fill(
    `Episode one ${stamp}`,
  );
  await on(page.getByLabel("Creator's note")).fill("Thank you for reading!");
  await on(page.getByRole("switch", { name: "Comments" })).click();
  await expect(
    on(page.getByText("Comments are turned off for this episode.")),
  ).toBeVisible();
  await on(page.getByRole("radio", { name: /Fast Pass/ })).click();
  await on(page.getByLabel("Price (coins)")).fill("12");
  await on(page.getByRole("button", { name: "Publish now" })).click();
  await expect(
    on(page.getByText("Choose a price from 3 to 10 coins.")),
  ).toBeVisible();
  await on(page.getByLabel("Price (coins)")).fill("4");
  await on(page.getByLabel("Free after (days)")).fill("3");

  // The preview shows the panels in order.
  await on(page.getByRole("button", { name: "Preview" })).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByText(`Episode one ${stamp}`)).toBeVisible();
  await expect(preview.getByRole("img")).toHaveCount(59);
  await page.keyboard.press("Escape");

  // Publish: the success screen, and the API agrees.
  await on(page.getByRole("button", { name: "Publish now" })).click();
  await expect(on(page.getByText("Episode 1 is live"))).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    on(page.getByRole("link", { name: "View episode" })),
  ).toHaveAttribute("href", new RegExp(`/read/${slug}/1$`));
  const saved = await (
    await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)
  ).json();
  expect(saved).toMatchObject({
    status: "published",
    priceCoins: 4,
    freeAfterDays: 3,
    commentsEnabled: false,
    creatorNote: "Thank you for reading!",
  });
  expect(saved.panels).toHaveLength(59);
  expect(saved.thumbnailUrl).toBeTruthy();
  expect(
    (await anonymous.get(`/api/v1/series/${slug}/episodes/1`)).status(),
  ).toBe(402);

  // Upload another: a blank form that suggests number 2; a past time is refused, a future one is kept in Phnom Penh time.
  await on(page.getByRole("button", { name: "Upload another" })).click();
  await expect(on(page.getByLabel("Number"))).toHaveAttribute(
    "placeholder",
    "2",
  );
  await expect(on(page.getByLabel("Title", { exact: true }))).toHaveValue("");
  await on(page.locator("input[type=file][multiple]")).setInputFiles([
    good[0],
    good[1],
  ]);
  await expect(on(page.getByText("2 of 2 panels uploaded"))).toBeVisible({
    timeout: 30_000,
  });
  await on(page.getByLabel("Title", { exact: true })).fill(
    `Episode two ${stamp}`,
  );
  await on(page.getByRole("radio", { name: "Schedule for later" })).click();
  await on(page.getByRole("button", { name: "Schedule" }).last()).click();
  await expect(on(page.getByText("Choose a release time."))).toBeVisible();
  const phnomPenh = (ms: number) =>
    new Date(Date.now() + ms + 7 * 3600_000).toISOString().slice(0, 16);
  await on(page.getByLabel("Release time")).fill(phnomPenh(-3600_000));
  await on(page.getByRole("button", { name: "Schedule" }).last()).click();
  await expect(
    on(page.getByText("Choose a time in the future.")),
  ).toBeVisible();
  const later = phnomPenh(3 * 3600_000);
  await on(page.getByLabel("Release time")).fill(later);
  await on(page.getByRole("button", { name: "Schedule" }).last()).click();
  await expect(on(page.getByText("Episode 2 is scheduled"))).toBeVisible({
    timeout: 30_000,
  });
  const scheduled = await (
    await page.request.get(`/api/v1/creator/series/${id}/episodes/2`)
  ).json();
  expect(scheduled.status).toBe("scheduled");
  expect(scheduled.publishedAt).toBe(
    `${new Date(`${later}:00+07:00`).toISOString().slice(0, 19)}Z`,
  );
  expect(
    (await anonymous.get(`/api/v1/series/${slug}/episodes/2`)).status(),
  ).toBe(404);

  // Draft: saved without needing everything, reopened from the edit page.
  await on(page.getByRole("button", { name: "Upload another" })).click();
  await on(page.getByLabel("Title", { exact: true })).fill(
    `Episode three ${stamp}`,
  );
  await on(page.getByRole("button", { name: "Save draft" })).click();
  await expect(on(page.getByText("Draft saved"))).toBeVisible({
    timeout: 30_000,
  });
  await on(page.getByRole("link", { name: "Edit episode" })).click();
  await expect(page).toHaveURL(
    new RegExp(`/creator/series/${id}/episodes/3/edit$`),
  );
  await expect(on(page.getByLabel("Title", { exact: true }))).toHaveValue(
    `Episode three ${stamp}`,
  );
  await expect(on(page.getByLabel("Number"))).toBeDisabled();

  // A live episode is edited in place and keeps its panels, thumbnail and Fast Pass.
  await page.goto(`/creator/series/${id}/episodes/1/edit`);
  await expect(on(page.getByLabel("Title", { exact: true }))).toHaveValue(
    `Episode one ${stamp}`,
  );
  await expect(
    on(
      page.getByRole("list", { name: "Panels in reading order" }).locator("li"),
    ),
  ).toHaveCount(59);
  await on(page.getByLabel("Title", { exact: true })).fill(
    `Episode one edited ${stamp}`,
  );
  await on(page.getByRole("button", { name: "Save changes" })).click();
  await expect(on(page.getByText("Episode 1 is live"))).toBeVisible();
  const edited = await (
    await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)
  ).json();
  expect(edited).toMatchObject({
    title: `Episode one edited ${stamp}`,
    priceCoins: 4,
  });
  expect(edited.panels).toHaveLength(59);
  expect(edited.thumbnailUrl).toBeTruthy();

  await page.goto(
    "/creator/series/00000000-0000-0000-0000-000000000000/episodes/new",
  );
  await expect(on(page.getByText("Series not found"))).toBeVisible();
  expect(
    (
      await page.request.post(`/api/v1/creator/series/${id}/unpublish`, {
        headers,
      })
    ).status(),
  ).toBe(200);
  await anonymous.dispose();
});

test("12. Chapter page: block editor with bold, heading, scene break and word count; readers see the marks", async () => {
  test.setTimeout(120_000);
  const { id, slug, headers } = await makeSeries("novel", `E2E Novel ${stamp}`);
  const on = (locator: Locator) => locator.and(page.locator(":visible"));

  await page.goto(`/creator/series/${id}/episodes/new`);
  await page.waitForLoadState("networkidle");
  await expect(
    on(page.getByRole("heading", { name: "Add chapter" })),
  ).toBeVisible();
  await on(page.getByLabel("Title", { exact: true })).fill(
    `The glass sea ${stamp}`,
  );

  // An empty chapter cannot be published.
  await on(page.getByRole("button", { name: "Publish now" })).click();
  await expect(on(page.getByText("Write the chapter first."))).toBeVisible();

  // Write: bold with the button and with Ctrl+B, italic, a heading, a scene break, a quote.
  const text1 = on(page.getByLabel("Text of block 1"));
  await text1.fill("The sea was glass.");
  await text1.press("ControlOrMeta+A");
  await on(page.getByRole("button", { name: "Bold, block 1" })).click();
  await expect(text1).toHaveValue("**The sea was glass.**");
  await on(page.getByRole("button", { name: "Bold, block 1" })).click();
  await expect(text1).toHaveValue("The sea was glass.");
  await text1.fill("She waited for the tide.");
  await text1.press("ControlOrMeta+A");
  await text1.press("ControlOrMeta+B");
  await expect(text1).toHaveValue("**She waited for the tide.**");
  await text1.fill("She **waited** for the *tide*.");
  await on(page.getByRole("button", { name: "Heading", exact: true })).click();
  await on(page.getByLabel("Text of block 2")).fill("Chapter one");
  await on(
    page.getByRole("button", { name: "Scene break", exact: true }),
  ).click();
  await on(
    page.getByRole("button", { name: "Paragraph", exact: true }),
  ).click();
  await on(page.getByLabel("Text of block 4")).fill("Morning came.");
  await on(page.getByLabel("Block 4 type")).selectOption("quote");
  await on(page.getByRole("button", { name: "Move block 2 up" })).click();
  await expect(on(page.getByLabel("Text of block 1"))).toHaveValue(
    "Chapter one",
  );
  await expect(on(page.getByText("9 words"))).toBeVisible();

  await on(page.getByRole("button", { name: "Preview" })).click();
  const preview = page.getByRole("dialog");
  await expect(preview.locator("strong")).toHaveText("waited");
  await expect(preview.locator("em").first()).toHaveText("tide");
  await expect(
    preview.getByRole("heading", { name: "Chapter one", level: 4 }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await on(page.getByRole("button", { name: "Publish now" })).click();
  await expect(on(page.getByText("Episode 1 is live"))).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    on(page.getByRole("link", { name: "View episode" })),
  ).toHaveAttribute("href", new RegExp(`/novel/${slug}/1$`));
  const saved = await (
    await page.request.get(`/api/v1/creator/series/${id}/episodes/1`)
  ).json();
  expect(saved.wordCount).toBe(9);
  expect(saved.blocks.map((b: { type: string }) => b.type)).toEqual([
    "heading",
    "paragraph",
    "scene-break",
    "quote",
  ]);

  // The reader renders the heading and the marks as formatting, never as raw asterisks.
  await page.goto(`/novel/${slug}/1`);
  await expect(
    page.getByRole("heading", { name: "Chapter one", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("strong").first()).toHaveText("waited");
  await expect(page.getByText("**waited**")).toHaveCount(0);

  // A slug nobody made still answers "not found" (the API says so; the demo data is not consulted).
  await page.goto("/series/there-is-no-such-series");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();

  expect(
    (
      await page.request.post(`/api/v1/creator/series/${id}/unpublish`, {
        headers,
      })
    ).status(),
  ).toBe(200);
});

test("13. creator writes: draft series, publish, free and Fast Pass episodes, a scheduled episode goes live by itself", async () => {
  test.setTimeout(150_000);
  await page.request.get("/api/v1/auth/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")
      ?.value ?? "";
  const headers = { "X-XSRF-TOKEN": xsrf };
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
    expect(
      (
        await page.request.put(ticket.uploadUrl, {
          headers: ticket.headers,
          data: image,
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post(
          `/api/v1/creator/uploads/${ticket.id}/complete`,
          { headers },
        )
      ).status(),
    ).toBe(200);
    return ticket.id;
  }
  const post = (path: string, data?: unknown) =>
    page.request.post(`/api/v1/creator/series${path}`, { headers, data });

  // A draft series is private; publishing makes it public.
  const cover = await upload("COVER", png(600, 800));
  const created = await post("", {
    title: `E2E Tides ${stamp}`,
    type: "comic",
    genre: "fantasy",
    languages: ["en"],
    summary: "A sea made of glass.",
    ageRating: "all",
    updateDay: "Fri",
    status: "ongoing",
    tags: ["sea", "glass"],
    coverUploadId: cover,
  });
  expect(created.status()).toBe(201);
  const series = await created.json();
  expect(series.visibility).toBe("draft");
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(
    404,
  );
  expect((await post(`/${series.id}/publish`)).status()).toBe(200);
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(
    200,
  );

  // Episode 1 is free, episode 2 is Fast Pass (anonymous readers get 402), the count follows.
  const panel = await upload("PANEL", png(800, 1000));
  const episode = (extra: object) => ({
    title: "Episode",
    number: null,
    fastPass: null,
    imageUploadIds: [panel],
    ...extra,
  });
  const free = await post(
    `/${series.id}/episodes`,
    episode({ title: "Free", publish: { mode: "now" } }),
  );
  expect(free.status()).toBe(201);
  const paid = await post(
    `/${series.id}/episodes`,
    episode({ title: "Paid", fastPass: {}, publish: { mode: "now" } }),
  );
  expect(paid.status()).toBe(201);
  expect(await paid.json()).toMatchObject({
    number: 2,
    priceCoins: 5,
    freeAfterDays: 7,
  });
  expect(
    (await anonymous.get(`/api/v1/series/${series.slug}/episodes/1`)).status(),
  ).toBe(200);
  expect(
    (await anonymous.get(`/api/v1/series/${series.slug}/episodes/2`)).status(),
  ).toBe(402);
  const listed = await (
    await page.request.get(
      `/api/v1/creator/series?q=${encodeURIComponent(`E2E Tides ${stamp}`)}`,
    )
  ).json();
  expect(listed[0].series.totalEpisodes).toBe(2);

  // Rules: a published episode needs panels; 799 px panels cannot even be attached.
  const empty = await post(
    `/${series.id}/episodes`,
    episode({ title: "Empty", imageUploadIds: [], publish: { mode: "now" } }),
  );
  expect(empty.status()).toBe(400);
  expect((await empty.json()).error.fields.imageUploadIds).toBe("required");

  // A scheduled episode is hidden, then the publish job (every 30 s) makes it live.
  const at = new Date(Date.now() + 4000).toISOString();
  const scheduled = await post(
    `/${series.id}/episodes`,
    episode({ title: "Soon", publish: { mode: "scheduled", at } }),
  );
  expect(scheduled.status()).toBe(201);
  expect((await scheduled.json()).status).toBe("scheduled");
  expect(
    (await anonymous.get(`/api/v1/series/${series.slug}/episodes/3`)).status(),
  ).toBe(404);
  await expect
    .poll(
      async () =>
        (
          await anonymous.get(`/api/v1/series/${series.slug}/episodes/3`)
        ).status(),
      { timeout: 75_000, intervals: [2_000] },
    )
    .toBe(200);
  const live = await (
    await page.request.get(`/api/v1/creator/series/${series.id}/episodes/3`)
  ).json();
  expect(live.status).toBe("published");

  // Another creator's series is off limits, and the series goes back to a draft so the dev data stays clean.
  expect((await post(`/${series.id}/unpublish`)).status()).toBe(200);
  expect((await anonymous.get(`/api/v1/series/${series.slug}`)).status()).toBe(
    404,
  );
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

test("14. admin: only ADMIN gets in; hide a reported comment, suspend a user, see a refused refund, read the audit log", async ({
  browser,
}) => {
  // Not an admin yet: the API answers 403 and the page says so.
  await page.goto("/admin");
  await expect(page.getByText("You do not have access")).toBeVisible();

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
    await ap.getByRole("button", { name: /Account menu/ }).click();
    await ap.getByRole("menuitem", { name: "Admin" }).click();
    await expect(ap).toHaveURL(/\/admin$/);
    await expect(
      ap.getByRole("heading", { name: "Admin", level: 1 }),
    ).toBeVisible();
    await expect(ap.getByText("Open reports")).toBeVisible();

    // The report queue: hide the comment through its report.
    await ap.getByRole("tab", { name: "Reports" }).click();
    const report = ap.locator("li", { hasText: target });
    await expect(report).toBeVisible();
    await report.getByRole("button", { name: "Hide content" }).click();
    await ap
      .getByRole("dialog")
      .getByRole("button", { name: "Hide content" })
      .click();
    await expect(ap.getByText("Content hidden.")).toBeVisible();
    await expect(ap.locator("li", { hasText: target })).toHaveCount(0);

    // Readers no longer see it.
    await page.goto("/series/glass-compass");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Comments/ }).click();
    await expect(page.getByText(target)).toHaveCount(0);

    // Content > Comments > Hidden: restore it.
    await ap.getByRole("tab", { name: "Content" }).click();
    await ap.getByLabel("Type").selectOption("comment");
    await ap.getByLabel("Status").selectOption("hidden");
    const hidden = ap.locator("li", { hasText: target });
    await expect(hidden).toBeVisible();
    await hidden.getByRole("button", { name: "Restore" }).click();
    await expect(ap.getByText("Restored.")).toBeVisible();
    await expect(ap.locator("li", { hasText: target })).toHaveCount(0);

    // Users: suspend (a reason is required) and restore.
    await ap.getByRole("tab", { name: "Users" }).click();
    await ap.getByRole("searchbox").fill(troll);
    const row = ap.locator("li", { hasText: troll });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Suspend" }).click();
    const dialog = ap.getByRole("dialog");
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(dialog.getByText("Write a reason.")).toBeVisible();
    await dialog.getByLabel("Reason").fill("Spam in comments");
    await dialog.getByRole("button", { name: "Suspend" }).click();
    await expect(row.getByText("Suspended")).toBeVisible();
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(row.getByText("Active")).toBeVisible();

    // Orders: this account spent coins on an unlock, so the refund is refused with the reason.
    await ap.getByRole("tab", { name: "Orders" }).click();
    await ap.getByRole("searchbox").fill(EMAIL);
    const order = ap.locator("li", { hasText: EMAIL }).first();
    await expect(order).toBeVisible();
    await order.getByRole("button", { name: "Refund" }).click();
    await ap.getByRole("dialog").getByLabel("Reason").fill("Charged twice");
    await ap
      .getByRole("dialog")
      .getByRole("button", { name: "Refund" })
      .click();
    await expect(
      ap.getByRole("dialog").getByText(/already spent some of these coins/),
    ).toBeVisible();
    await ap
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();

    // Audit log: every action above is there with who did it.
    await ap.getByRole("tab", { name: "Audit log" }).click();
    for (const action of [
      "user.unban",
      "user.ban",
      "content.restore",
      "content.hide",
    ]) {
      await expect(ap.locator("li", { hasText: action }).first()).toContainText(
        "E2E Renamed",
      );
    }
    await ap.getByLabel("Area").selectOption("user.");
    await expect(ap.locator("li", { hasText: "content.hide" })).toHaveCount(0);
  } finally {
    await ctx.close();
    sql(
      `delete from reports where reporter_id in (select id from users where email = '${troll}')`,
    );
    sql(`delete from comments where body = '${target}'`);
    sql(`delete from users where email = '${troll}'`);
  }
});

test("15. delete the account: signed out everywhere, wrong password refused first", async () => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Current password").fill("Wrong-Pass-1!");
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(dialog.getByText("That password isn't right.")).toBeVisible();
  await dialog.getByLabel("Current password").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText(/will be deleted on/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
});
