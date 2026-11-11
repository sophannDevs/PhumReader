import { defineConfig, devices } from "@playwright/test"

// Key flows against the real API: the local backend must run on :8080 (`cd backend && ./gradlew bootRun`).
// The app is built and started in real mode (no NEXT_PUBLIC_DEMO) on :3100.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "real.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: process.env.CI ? true : false,
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [{ name: "real", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
})
