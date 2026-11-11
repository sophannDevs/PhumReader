import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
    // Design pack (reference only): the V2.1 prototype source is plain browser JS, not app code.
    "design/**",
  ]),

  // Import rules for the website's API client (P1-06). The API side has the same kind of rules in
  // backend/src/test/java/app/phumreader/ArchitectureTest.java.
  //
  // 1. The browser reaches the API only through src/lib/api (one client: cookies, CSRF, refresh, typed errors).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/api/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Call the API through src/lib/api (client.ts), not fetch directly." },
        { name: "XMLHttpRequest", message: "Call the API through src/lib/api (uploads.ts handles file uploads)." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: "Call the API through src/lib/api (client.ts)." },
        { object: "globalThis", property: "fetch", message: "Call the API through src/lib/api (client.ts)." },
      ],
    },
  },
  // 2. Screens (components and pages) use the typed helpers in src/lib, never the generated schema file, and
  //    components never import the server-only fetcher (only server pages in src/app may).
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/api/schema", "**/lib/api/schema"], message: "Use the types in src/lib/api/types.ts or Schemas from client.ts." },
            { group: ["@/lib/api/server", "**/lib/api/server"], message: "server.ts is for server pages in src/app only." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/api/schema", "**/lib/api/schema"], message: "Use the types in src/lib/api/types.ts or Schemas from client.ts." },
          ],
        },
      ],
    },
  },
  // 3. The API client layer never depends on screens. (Other files in src/lib, such as query.tsx and
  //    use-reader-nav.ts, mix UI and logic today; separating them is outside P1-06.)
  {
    files: ["src/lib/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/components/*", "**/components/**"], message: "src/lib/api must not depend on components." },
            { group: ["@/app/*", "**/app/**"], message: "src/lib/api must not depend on pages." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
