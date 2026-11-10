# PhumiReader V2 – start here

## New project (empty folder)
1. Make a new folder, for example `C:\Projects\phumireader-web`, and unzip this pack into it, so the folder contains CLAUDE.md, START-HERE.md, design/, docs/ and .claude/.
2. Open the folder in VS Code, open the terminal and run `claude`.
3. Type: `/next-task`
   Claude does T01 (project setup), then stops and tells you what it did.
4. Check it with `npm run dev` and open http://localhost:3000.
5. Type `/next-task` again for each next task. One task at a time, and check each one in the browser.

## Existing project (you already started with the PhumReader pack)
1. Commit your work first: `git add -A && git commit -m "Before V2.1 update"`.
2. Copy everything from this pack into the project folder and replace when asked. It replaces CLAUDE.md, design/ and .claude/commands/. Then rename `docs/CHECKLIST.md` in the pack to `docs/CHECKLIST-v2.md` before copying, so your progress is kept.
3. In Claude Code, type: `/upgrade-to-v2`
4. Check the merged checklist it shows you, then continue with `/next-task`.

## Demo logins (in the built site)
- Reader: reader@phumireader.app / PhumiReader1!
- Creator: creator@phumireader.app / Creator1!
- Admin: admin@phumireader.app / Admin1!
- Email code: 123456

## Before launch (not part of the frontend tasks)
- Native Khmer review of design/i18n/km-dictionary.json.
- A lawyer reviews Terms, Privacy, and Coins and refunds; fill in every [PLACEHOLDER].
- Real backend, payments (ABA PayWay / KHQR), email and hosting come in the next phase.
