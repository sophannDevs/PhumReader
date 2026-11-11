Do the next unchecked task in docs/CHECKLIST.md only.

1. Read CLAUDE.md, then the design/spec.md section and design/foundations.md parts this task needs.
2. Open the matching design/screens/ images (desktop and phone) and the design/prototype-src/<Page>/ files for exact spacing and behaviour.
3. Build the task with demo data from src/data and the fake API in src/lib/demo-api.ts. Every visible string goes through next-intl (en + km).
4. Include loading, empty, error and success states where the task has them.
5. Check 390, 768 and 1440 px, in English and in Khmer.
6. Run: npm run lint && npm run typecheck && npm run build. Fix anything that fails.
7. Tick the task in docs/CHECKLIST.md, add any guesses under "Assumptions", and commit with the task ID.
8. Stop and give me a short summary: what you built, how to see it in the browser (URL + demo login if needed), and anything you assumed.
