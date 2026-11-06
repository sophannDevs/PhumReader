import { z } from "zod"

/**
 * Demo or real API. `NEXT_PUBLIC_DEMO=1` keeps the Phase 1 demo (demo-api.ts and the local
 * store, no backend needed); anything else talks to the Spring Boot API through `/api/v1`.
 * Read at build time (NEXT_PUBLIC_*), so a build serves one mode only.
 */
const demoSetting = z
  .enum(["0", "1"], { message: "NEXT_PUBLIC_DEMO must be 1 (demo) or 0 / unset (real API)" })
  .optional()
  .parse(process.env.NEXT_PUBLIC_DEMO || undefined)

export const DEMO_MODE = demoSetting === "1"

/** The API base path; Next.js forwards it to BACKEND_URL (next.config.ts). */
export const API_BASE = "/api/v1"
