<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Harness AI Agent Team & Playwright Verification
This project operates with **Harness AI** architecture (`revfactory/harness`).

### Verification Mandate
After fixing any bug, updating logic, or implementing a feature:
1. Always run the affected Playwright E2E test immediately to verify the fix:
   ```bash
   npx playwright test e2e/<affected-spec>.spec.ts
   ```
2. For broader changes or prior to completing a task, run the full verification:
   ```bash
   npm run lint && npm run typecheck && npm run test:e2e
   ```
3. Never conclude a task while Playwright tests are failing.
4. **Visual Headed Mode (User Mandate)**: Tests are configured with `headless: false` locally so that the browser window pops up and the user can watch all actions visually live. Do not suppress or override this with headless flags.

### Team Roles & Skills
- Agents: `frontend-developer`, `backend-developer`, `qa-verifier` (located in `.agents/agents/` and `.claude/agents/`)
- Skills: `phumreader-orchestrator`, `playwright-qa`, `api-sync`, `harness`, `harness-evolve` (located in `.agents/skills/` and `.claude/skills/`)
