---
name: phumreader-orchestrator
description: "Runs the PhumiReader agent team on one task: Advisor (tech-advisor) → Dev (frontend-developer / backend-developer) → QA (qa-verifier) + Review (code-reviewer) → Doc (doc-writer). Use it automatically whenever the user asks to do, build or fix something, even without mentioning the team: a checklist task ('do T45', 'build F12', 'next task', /next-task), a backend plan task ('P3-02'), or a bug ('X doesn't work', 'fix this'). Also for follow-ups: 're-review', 'run QA again', 'only update the docs', 'redo the fix from the review'. Not for questions or explanations, or when the user says 'without the team' or 'do it yourself'."
---

# PhumiReader Team Orchestrator

Coordinates five roles with the **pipeline + producer-reviewer** pattern: one agent plans, one builds, two check, one
records. The main session (you) runs this skill, calls each agent, and passes each report to the next.

**Run mode: subagent delegation.** Each step is one `Agent` call with `subagent_type` set to the agent name. Agents
don't talk to each other; you pass their reports on in the next prompt. Run QA and Review in the same message so
they work in parallel.

## Team

| Role | Agent | Edits files? | Model | Skills it uses | Returns |
|---|---|---|---|---|---|
| Advisor | `tech-advisor` | No | opus | — | Brief: files, approach, risks, user decisions, guesses |
| Dev | `frontend-developer` / `backend-developer` | Yes | opus | `api-sync` (backend) | Files changed, guesses, endpoints, checks run |
| QA | `qa-verifier` | No (runs tests) | opus | `playwright-qa`, `api-sync` | PASSED / FAILED / BLOCKED + test results |
| Review | `code-reviewer` | No | opus | — | APPROVE / CHANGES NEEDED + ranked findings |
| Doc | `doc-writer` | `docs/` only | sonnet | — | Docs changed, assumption numbers added |

## Flow

```
[Task: checklist ID, plan task or bug]
        ▼
Step 0  Inspect (you)            find the task, pick the steps to run
        ▼
Step 1  Advise   tech-advisor    brief ── "Needs user decision" or backend task? → ask the user, wait
        ▼
Step 2  Build    developer(s)    code changes
        ▼
Step 3  Check    qa-verifier ∥ code-reviewer   (same message, parallel)
        │   FAILED or CHANGES NEEDED → back to Step 2 with the findings (max 3 rounds)
        ▼
Step 4  Record   doc-writer      tick task, Assumptions, API docs
        ▼
Step 5  Report + commit (you)
```

### Step 0: Inspect
This skill runs automatically for task requests (CLAUDE.md "Team trigger"). If the user said "without the team" or
"do it yourself", don't run the flow; do the task directly.

1. Find the task in `docs/CHECKLIST.md` (V2.1, follow its "Work order") or `docs/BACKEND_CHECKLIST.md`, or read the
   bug report. "Next task" or `/next-task` means the next unchecked task in the Work order. One task at a time
   (CLAUDE.md "Working rules"), unless the user asked for a batch.
2. Check what already exists, so follow-ups don't start from zero:
   - `git status` / `git diff HEAD`: uncommitted work for this task means a follow-up, not a new start.
   - A partial request runs only its step: "review again" → Step 3 Review; "run QA again" → Step 3 QA;
     "only update the docs" → Step 4; "fix what the review found" → Step 2 with those findings, then Step 3.
3. Decide whether to run Step 1. Skip the Advisor only for small fixes where the file and the change are obvious
   (a typo, one wrong condition). Every checklist task and every backend task gets a brief.

### Step 1: Advise (`tech-advisor`)
- Prompt: the task text, its ID, and any bug details or user notes.
- If the brief has anything under **Needs user decision**, show those points to the user and wait for an answer
  before Step 2.
- **Backend tasks:** show the brief to the user and wait for a go-ahead before Step 2 (the user approves backend
  plans before code is written).

### Step 2: Build (`frontend-developer` / `backend-developer`)
- Prompt: the task, the full Advisor brief, and the user's answers to any decisions.
- "Who builds it: both" → run `backend-developer` first, then `npm run api:gen`, then `frontend-developer`.
- In a fix round, send only the open findings (QA failures + review blockers and should-fixes) and say "fix only
  these".

### Step 3: Check (`qa-verifier` ∥ `code-reviewer`)
Call both in **one message**:
- `qa-verifier`: the task, the developer's list of changed files, and which specs to run. It runs the CLAUDE.md gate
  (`npm run lint && npm run typecheck && npm test && npm run build`), the affected Playwright specs, and, if the
  backend changed, `cd backend && ./gradlew check` and `npm run api:check`.
- `code-reviewer`: the task, the Advisor brief, and what to review (default: uncommitted changes, `git diff HEAD`).
  On a re-review, also pass its earlier findings so it checks each one.

Then:
- QA **PASSED** and Review **APPROVE** → Step 4. Keep any nits for the final report.
- QA **FAILED** or Review **CHANGES NEEDED** → Step 2 fix round, then Step 3 again (re-run only the failed specs
  first, then the full gate once they pass).
- After **3 fix rounds** still failing → stop, report what is still open, and ask the user how to continue.
- QA **BLOCKED** (e.g. the backend isn't running for `test:e2e:real`, or a dev dependency such as `vitest` isn't
  installed on this PC) → tell the user what is needed; don't count it as a pass. It is not a fix round: don't send
  it to a developer, and never ask an agent to install packages.

### Step 4: Record (`doc-writer`)
- Prompt: the task ID, the developers' reports (files, guesses, endpoints), and the Advisor brief's "Guesses".
- Check its report: the task is ticked, and every guess became an assumption or is listed as missing.

### Step 5: Report and commit (you)
- Summarise for the user: what was built, how to see it in the browser (URL + demo login if needed), files changed,
  QA results, review verdict (with any nits left), docs updated, anything assumed, and any open questions.
- Commit as CLAUDE.md "Working rules" says: `T12: <short description>` (V2.1), `F01: …` (Fix tasks), or
  `P3-02: …` (backend). Don't commit if the user asked to hold, or if any check didn't pass.

## Single-role requests
Not every request needs the whole team. Call one agent directly when the user asks for one role:

| Request | Agent |
|---|---|
| "How should I build T43?", "which approach is better?" | `tech-advisor` |
| "Review my changes", "review this branch" | `code-reviewer` |
| "Run the tests", "check T43 works" | `qa-verifier` |
| "Update the docs for T43", "add this assumption" | `doc-writer` |
| A small fix with no plan needed | `frontend-developer` / `backend-developer`, then Step 3 |

## Errors
- An agent call fails: retry once with the same prompt. If it fails again, continue without it and say so in the
  final report. Don't present a missing check as passed.
- Same-cause failures (usage limit, permission denied, login expired): don't retry. Report what finished, what
  didn't, and (for a usage limit) when it resets.
- A read-only agent needs a command it can't run: run it yourself and pass the output on.
- Agents disagree (e.g. reviewer vs. advisor brief): send the reviewer's point back to `tech-advisor` once; if they
  still disagree, show both views to the user and let them decide.
- Fill gaps only with facts you checked yourself. Never invent an agent's verdict or test result.

## Test scenarios

### Normal flow
"Do the next task with the team" with T43 open in `docs/CHECKLIST.md`:
Step 0 finds T43 → Advisor brief (no user decisions) → `frontend-developer` builds → QA PASSED and Review APPROVE
(one nit) → `doc-writer` ticks T43 and adds V2-71 → report lists the nit → commit `T43: …`.

### Fix-loop flow
Same task, but Review returns CHANGES NEEDED (blocker: missing `km.json` key) and QA FAILED (`e2e/flows.spec.ts`):
Step 2 fix round with both findings → Step 3 re-run → PASSED / APPROVE → Step 4 → Step 5.

### Stop flow
Backend task P3-02: the Advisor brief is shown to the user, who hasn't approved it yet → no `backend-developer`
call; the turn ends with the brief and the question.

### Partial re-run
"Review my changes again" with uncommitted work: Step 0 sees the diff → only `code-reviewer` runs → its verdict is
reported. No other agent is called.
