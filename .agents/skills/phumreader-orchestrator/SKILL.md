---
name: phumreader-orchestrator
description: "Orchestrates multi-agent development and quality assurance for PhumReader. Coordinates planning, frontend/backend implementation, and Playwright verification loops."
---

# PhumReader Team Orchestrator

This orchestrator coordinates specialized agents using the **Producer-Reviewer with Adversarial Verification** pattern.

## Agent Team Structure

| Agent | Type | Primary Skill | Output Contract |
|-------|------|---------------|-----------------|
| `frontend-developer` | Custom (`.claude/agents/frontend-developer.md`) | Next.js / Tailwind / Zustand | Component / Page / Store changes |
| `backend-developer` | Custom (`.claude/agents/backend-developer.md`) | Spring Boot / Java / OpenAPI | REST Controller / Service / Schema sync |
| `qa-verifier` | Custom (`.claude/agents/qa-verifier.md`) | `playwright-qa`, `api-sync` | Test Pass/Fail report, Regression alerts |

## Execution Workflow

```
[User Request / Checklist Task]
             │
             ▼
    Phase 0: Task Inspection & Scope Definition
             │
             ▼
    Phase 1: Implementation
    ├── Frontend task ──► frontend-developer
    └── Backend task  ──► backend-developer
             │
             ▼
    Phase 2: Adversarial QA & Playwright Verification (qa-verifier)
    ├── Run Playwright E2E: npm run test:e2e or targeted spec
    ├── Run TypeScript check: npm run typecheck
    ├── Run ESLint: npm run lint
    └── (If backend) Run: ./gradlew check && npm run api:check
             │
     ┌───────┴───────┐
   Passed          Failed
     │               │
     ▼               ▼
Phase 4: Done   Phase 3: Fix & Re-verify loop
```

### Phase 0: Inspection
1. Read the target task in `docs/CHECKLIST.md` or `docs/BACKEND_CHECKLIST.md` (or the bug report).
2. Identify which domain components are affected:
   - UI pages / components (`src/app/`, `src/components/`)
   - Demo API / Zustand store (`src/lib/`)
   - Backend service (`backend/src/`)
   - E2E tests (`e2e/`)

### Phase 1: Implementation
- Dispatch implementation to `frontend-developer` or `backend-developer`.
- Adhere strictly to project styling, brand rules (`PhumReader`), and clean code standards.

### Phase 2: Verification Loop (Playwright QA)
- Immediately after changes are made, execute the relevant Playwright test:
  ```bash
  npx playwright test e2e/<affected-spec>.spec.ts
  ```
- If any test fails, do not report success. Return to the developer agent to fix the defect.

### Phase 3: Full Quality Assurance Sweep
Run the complete quality gate:
```bash
npm run lint && npm run typecheck && npm run test:e2e
```
If backend was modified:
```bash
cd backend && ./gradlew check && cd .. && npm run api:check
```

### Phase 4: Reporting
- Provide a concise summary of files changed, Playwright test results, and status.
- Tick completed item in `docs/CHECKLIST.md` or `docs/BACKEND_CHECKLIST.md`.
