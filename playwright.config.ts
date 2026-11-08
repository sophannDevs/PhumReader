import { defineConfig, devices } from "@playwright/test"

// Runs against the dev server (`npm run dev`). The fake API waits 0.3-0.8 s per call, so
// expectations get 15 s and no test sleeps longer than that.
export default defineConfig({
  testDir: "./e2e",
  // The real-API flows have their own config (npm run test:e2e:real).
  testIgnore: "**/real.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: process.env.CI ? true : false,
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // CI tests the production build: the service worker and real 404 status codes only exist there.
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    // The suite tests the demo until Stage 1 Step 5 part 5 adds runs against the real API.
    env: { NEXT_PUBLIC_DEMO: "1" },
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: process.env.CI ? 300_000 : 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } } },
  ],
})
