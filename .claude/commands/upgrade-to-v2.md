This project started from the earlier PhumReader design pack. The design has been updated to PhumiReader V2.1.

1. Read the new CLAUDE.md and design/README.md.
2. Rename everywhere in src/, messages and package.json: "PhumReader" → "PhumiReader", "Toonwave" → "PhumiReader" (Khmer: ភូមិReader), and the localStorage prefix → "phumireader.". Keep a one-time migration that copies old "phumreader."/"toonwave." keys to the new prefix.
3. Compare the existing docs/CHECKLIST.md with the new docs/CHECKLIST-v2.md:
   - keep the ticks for tasks already done that still match the new spec;
   - merge the new tasks in, renumbered in the same order;
   - list any finished work that now differs from design/spec.md as new "Fix:" tasks at the top.
   Save the result as docs/CHECKLIST.md and delete docs/CHECKLIST-v2.md.
4. Update src/data/demo-data.json from design/demo-data.json, keeping the same TypeScript types (extend them for the new keys).
5. Run npm run lint && npm run typecheck && npm run build, then commit "Upgrade to design V2.1".
6. Stop and show me the merged checklist and what you renamed.
