# PhumiReader – weekly plan (one person, every job)

You are the developer, story writer, script writer, maintainer and user manager. You can't do every job every
week, so this plan gives each job its own time and a small, clear next step. Change the hours to fit your life.

Started: 2026-11-10. Look at this file every Sunday (30 minutes, see "Weekly review").

---

## 1. Where we are (update every Sunday)

| Track | Open | Done | Source |
|---|---|---|---|
| Website V2.1 redesign | 3 | 69 | `docs/CHECKLIST.md` (F01–F27, T01–T42 done; follow-ups T43–T45) |
| Backend + launch (Phase 2) | 28 | 41 | `docs/BACKEND_CHECKLIST.md` (includes the 7 new "V2.1 API additions") |
| Story: episodes ready before launch | 0 / 10 | 0 | `docs/STORY_CHECKLIST.md` |
| Launch blockers outside code | 7 | 0 | Section 4 below |

**Stage: before launch.** Nobody uses the site yet. So:
- Development is the main job. Story is the second job.
- User management and maintenance are almost zero for now. They start at launch (section 6).

**Launch date: not set yet.** After 4 weeks with this plan, count how many tasks you really finish per week, then
set the date: `open tasks ÷ tasks per week = weeks left`. For example: 93 open tasks at 3 a week is about 31 weeks.
At 5 a week it is about 19 weeks. If that's too long, cut scope (section 7) instead of working more hours.

---

## 2. The weekly rhythm

One job per day, so you don't switch between code and story in the same evening.

| Day | Job | Time | What you do |
|---|---|---|---|
| Mon | Developer | 2 h | Next task in the work order (`/next-task`). Finish, check, commit, stop. |
| Tue | Developer | 2 h | Next task. |
| Wed | Developer | 2 h | Next task, or finish what's left from Mon/Tue. |
| Thu | Story writer | 1.5 h | Story bible, outline, or the next script (`docs/STORY_CHECKLIST.md`). |
| Fri | Business | 1 h | One launch-blocker task (section 4): send the email, fill the form, make the account. |
| Sat | Story production | 3–4 h | Storyboard, art, lettering, upload one episode as a draft. |
| Sun | Planner | 30 min | Weekly review (section 3). Then rest. |

Rules:
- **One task = one sitting.** If a task is too big, split it and commit the first part.
- **If a dev day runs over, the dev task moves, not the story day.** The story needs steady time too.
- **Office PC:** only tasks that need no downloads. Tasks that need installs or new accounts (Step 3 services,
  Google / Facebook apps, Cloudflare) are done at home.
- **At least one full evening off each week.** A tired solo founder makes the most bugs.

---

## 3. Weekly review (Sunday, 30 minutes)

1. Tick everything you finished in the checklists. Update the numbers in section 1.
2. Read the log (section 8). What blocked you this week?
3. Choose next week. Never more than this:
   - 3 dev tasks (the next ones in the work order)
   - 1 story step (one outline, one script or one episode of art)
   - 1 business task (section 4)
4. Write next week's line in the log.
5. Energy check: if you finished less than half of last week's list two weeks in a row, take less next week. Don't
   add more hours.

---

## 4. Launch blockers outside the code (Friday tasks)

These take weeks of waiting on other people, so **start them early**, even before the code is ready. One per Friday.

| # | Task | Why | Waits on | Status |
|---|---|---|---|---|
| 1 | ABA PayWay merchant account and production keys (A4) | No real coin sales without it | ABA (can take weeks) | |
| 2 | Pick and buy the domain (phumireader.app or other) (A15) | Email, Google / Facebook apps and hosting all need it | You | |
| 3 | Email sending on the domain: Resend, SPF / DKIM (A13) | Sign-up codes and password resets | Domain | |
| 4 | Google and Facebook login apps for staging and production (A14) | Social login (P3-04) | Domain | |
| 5 | Real coin prices in USD and KHR (A2) | Coins page shows placeholders | You | |
| 6 | Khmer text review by a native reader (A12) | `km.json` is a draft | Reviewer | |
| 7 | Terms, Privacy and refund pages reviewed by a lawyer (A16) | Pages are draft templates | Lawyer | |

Also needs an account, but it's a dev task: Supabase staging / production (P1-10), Cloudflare R2 + Worker (P3-08),
Firebase for push notifications (P3-16).

---

## 5. Order of the big pieces

1. ~~**Save your work.**~~ Done 2026-11-11: everything is committed on `v2.1-redesign` (pull request #5; merge it
   once its checks are green).
2. ~~**Website V2.1**~~ Done 2026-11-11 (F01–F27, T01–T42). Follow-ups in `docs/CHECKLIST.md`: T43 badge size (office
   PC), T44 Khmer review and digits (needs the reviewer), T45 real-API e2e (home PC).
3. **V2.1 API additions** (`docs/BACKEND_CHECKLIST.md`, V21-01 … V21-07, home PC): the V2.1 features that only save on
   the device today. V21-01 (series review) first.
4. **Backend leftovers that need accounts** (P1-10, P3-04, P3-08, P3-11, P3-16). Do each one as soon as its Friday
   task (section 4) is done. P1-01 and P1-02 are done (2026-11-08); P3-04 has Google working locally, while Facebook
   and staging wait for the domain and the provider apps.
5. **Quality gates** (Phase 6: tests, accessibility, speed, security). P6-02 (377 frontend tests) is done.
6. **Deployment and go-live** (Phase 7), only when every row in section 4 is done.

Story runs beside all of this: the goal is **10 episodes of your first series ready before launch day**.

---

## 6. After launch: maintenance and user management

Build these so the site does the people work, not you. Most are already in the plan (P3-18 admin, P7-03 monitoring).

**Every day (15 minutes, morning or lunch):**
- `/admin/reports`: handle new reports (hide content, ban if needed).
- `/admin/payments`: look at failed or stuck payments; refund if a reader paid and got no coins.
- Error alerts (Sentry, P7-03): anything new? If yes, it becomes Monday's dev task.

**Every week (Sunday, in the review):**
- Answer help / support messages.
- Check uptime and backups are green.
- Publish your scheduled episode (or check that the scheduler did).

**Every month:**
- Update dependencies (at home), run `./gradlew check` and the website checks.
- Look at the numbers: sign-ups, readers, unlocks, purchases. Decide what to improve next.

When the daily routine takes more than 30 minutes, that is the signal to add a tool (an automatic rule, a
better admin filter) or to find a helper. Don't just work longer.

---

## 7. How to keep the work smaller

- **Don't add new features before launch** unless they are in a checklist. Write new ideas in "Ideas for later"
  below and move on.
- **You don't have to make all the stories.** The site has a creator portal. Launch with your own 1–2 series, then
  invite Khmer creators.
- **Let Claude do the repeated work:**
  - Code: `/next-task` does one checklist task. You review the result and approve the commit.
  - Story: give Claude your notes and ask for an outline or a first script draft. You decide the story.
  - Planning: on Sunday, ask Claude to "update docs/WEEKLY_PLAN.md section 1 from the checklists".

### Ideas for later (not before launch)
-

---

## 8. Log

One line per week. Plan on Sunday, fill in "Done" the next Sunday.

| Week of | Planned dev | Planned story | Planned business | Done | Notes / what blocked me |
|---|---|---|---|---|---|
| 2026-11-16 | Commit V2.1 upgrade; next 2 tasks in the work order | Series 1: fill in the story bible | Start ABA PayWay merchant application (#1) | | |
| 2026-11-23 | | | | | |
| 2026-11-30 | | | | | |
| 2026-12-07 | | | | | |
