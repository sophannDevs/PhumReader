import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import boundaries (P1-06). The API side is enforced by ArchitectureTest.java.
// Pages in src/app are leaves: nothing else may import them. Other apps in the repo are not importable.
const noApp = {
  group: ["@/app", "@/app/*", "**/app/[[]locale[]]/**"],
  message:
    "src/app holds pages only; shared code belongs in src/components, src/lib or src/data.",
};
const noOtherApps = {
  group: ["**/backend/**", "**/infra/**", "@/../*"],
  message:
    "The website talks to the API over HTTP (src/lib/api), never by importing backend/ or infra/.",
};
const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrict(noApp, noOtherApps),
  },
  {
    // shadcn primitives know nothing about PhumReader patterns, layout, auth or demo data.
    files: ["src/components/ui/**"],
    rules: restrict(
      noApp,
      noOtherApps,
      {
        group: [
          "@/components/pr",
          "@/components/pr/*",
          "@/components/layout",
          "@/components/layout/*",
          "@/components/auth",
          "@/components/auth/*",
        ],
        message:
          "components/ui is the bottom layer: it cannot import PhumReader components.",
      },
      {
        group: ["@/data", "@/data/*"],
        message: "components/ui must not read demo data.",
      },
    ),
  },
  {
    // The data helpers sit below the UI: no components, no pages.
    files: ["src/data/**"],
    rules: restrict(noApp, noOtherApps, {
      group: ["@/components", "@/components/*"],
      message: "src/data cannot import components.",
    }),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from backend/openapi/openapi.json by `npm run api:gen`.
    "src/lib/api/schema.d.ts",
    // Spring Boot API (Java).
    "backend/**",
    // Cloudflare Worker with its own package and tests (node --test).
    "infra/**",
  ]),
]);

export default eslintConfig;
