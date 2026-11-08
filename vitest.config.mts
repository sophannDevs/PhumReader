import path from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Component and unit tests (P6-02): Vitest + Testing Library in jsdom, MSW for the API.
 * They run in "real API" mode (NEXT_PUBLIC_DEMO unset), so the code under test calls `/api/v1/...`
 * and MSW answers. Browser flows stay in e2e/ (Playwright).
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // The app uses the automatic JSX runtime (tsconfig "jsx": "react-jsx").
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost:3000/" } },
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.tsx"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    // Env the code reads at import time.
    env: { NEXT_PUBLIC_DEMO: "" },
  },
})
