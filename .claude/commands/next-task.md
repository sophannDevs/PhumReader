Do the next unchecked task in docs/CHECKLIST.md only, with the agent team.

1. Find the next unchecked task, following the checklist's "Work order".
2. Run it with the `phumreader-orchestrator` skill (Skill tool): tech-advisor → frontend-developer / backend-developer
   → qa-verifier + code-reviewer → doc-writer. The skill handles the design reading, the states, en + km, the checks
   (`npm run lint && npm run typecheck && npm test && npm run build`), ticking the task, Assumptions and the commit.
3. If the advisor finds a decision that is mine (for example T44 needs a native Khmer reviewer), stop and ask me.
4. Stop and give me a short summary: what was built, how to see it in the browser (URL + demo login if needed), the
   QA and review results, and anything assumed.
