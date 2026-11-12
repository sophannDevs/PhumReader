---
name: playwright-qa
description: "Executes, writes, and debugs Playwright end-to-end tests for PhumiReader. Use immediately after fixing bugs or adding UI features to prevent regressions and verify user flows."
---

# Playwright QA Skill — E2E Testing & Regression Verification

Use this skill whenever code is modified, a bug is fixed, or a new flow is introduced in PhumiReader.

## When to Run Tests
- **After every bugfix**: Run the targeted test covering the affected page or flow.
- **Before task completion**: Run the full suite to verify no regressions were introduced.
- **When modifying responsive layout**: Verify both `desktop` (1440x900) and `mobile` (390x844 Pixel 5) project targets.
- **Visual Browser Requirement**: Tests run in headed mode (`headless: false` configured in `playwright.config.ts` and `playwright.real.config.ts`) so the user can watch the browser pop up and observe actions live.

## Running Tests

### 1. Targeted Verification (Fastest)
Run the specific test file matching the area changed:
```bash
# Core user flows (navigation, unlock, coins, bookmarks, reading)
npx playwright test e2e/flows.spec.ts

# States (empty, error, slow loading states)
npx playwright test e2e/states.spec.ts

# System pages (terms, privacy, help, about)
npx playwright test e2e/system-pages.spec.ts

# Creator studio & series management
npx playwright test e2e/creator-series.spec.ts

# Admin flows
npx playwright test e2e/admin.spec.ts
```

### 2. Full Demo-Mode Test Suite
Runs all specs except `real.spec.ts` against the Next.js dev server with `NEXT_PUBLIC_DEMO=1`:
```bash
npm run test:e2e
```

### 3. Debugging Failures
If a test fails:
- Check test output list and trace:
  ```bash
  # Run in headed mode to see browser interaction:
  npx playwright test e2e/<file>.spec.ts --headed

  # Inspect trace on failure (stored in test-results/):
  npx playwright show-trace test-results/<test-run-dir>/trace.zip
  ```
- Look for common failure causes:
  - Selector mismatch or missing `data-testid` / accessible role.
  - Mock API delay exceeded (default expectation timeout is 15s).
  - Unhandled error state or hydration failure.

### 4. Real-Mode E2E Suite (Backend Integration)
When backend endpoints in `backend/` are modified or real API integration is being tested:
```bash
# Ensure services are up
npm run services:check

# Run real E2E suite
npm run test:e2e:real
```

## Adding New Tests
When adding new test cases to `e2e/`:
1. Use semantic locators (`getByRole`, `getByText`, `getByLabel`). Avoid brittle CSS paths.
2. Account for demo API latency (300–800ms per request).
3. Check both English (`/en/...`) and Khmer (`/km/...`) routes where appropriate.
4. Keep localStorage keys consistent (`phumireader.*`).

