# Project handoff

Updated: 2026-10-24 09:50 (supervisor wrap-up)

## In flight

### Supervisor session wrap-up — 2026-10-24 09:50

- Merged this morning, each CLEAN at its passing head: #218 (#200), #219 (#201), #220 (#212), #221 (#211; one test-file conflict with #218 resolved by keeping both tests, CI rerun green), #224 (#203), #225 (#215), #222 and #226 (housekeeping). `main` is `46566135` or later.
- Another session (Fable 5.1, Herdr workspace w8R) is on #202 with a reviewer pane running. Leave its worktree alone.
- #223 (slow VAD, 600 s per pass on an 86 s clip) is unconfirmed outside the unpackaged test rig. Reproduce in the packaged app before anyone starts a fix.
- #199 has the owner's decision and its `needs-human` label is removed; it is ready to dispatch with #213.
- #217 (landing share image, favicons, Mac icon delivery) awaits owner approval; its plan is the uncommitted `PLAN.md` hunk, plus untracked `design/landing-export.html`. Both preserved.
- Handoff commits to `main` bypass the branch rule because the owner account can; the owner has not asked to change this.

#215 is merged and Done: PR #225, reviewed head `58076b5c2103dd2c5b2e0d08def1bf8aea596de8`, merge `297ea752cccabc306e111f6623ffc7151b021775` (owner/supervisor merge, 2026-10-24). Fresh Standards and Requirements review passed; all 10 CI checks passed. The initial CI duration failures were reproduced on FFmpeg 6.1.1 and repaired without weakening assertions. Evidence: `~/dev/loop-evidence/showhow-215/READY.md`, `PORTABLE-PROVE.md`, `COORDINATOR-PR-READY.json`.

- The #215 private runtime is stopped; its clean worktree, lane w8H and local branch are removed. The remote ticket branch was already absent after merge. Preserve all external proof, failed receipts, source bundle and owner media. Other sessions own the #202/#203 worktrees and PR #226 evidence-cleanup worktree; leave them untouched.
- Separate follow-up #223: app-managed VAD took about 600 s per pass on an 86 s recording and timed out. Owner/supervisor accepted the exact extractor/real-helper speech proof for #215; no app-guide completion is claimed. Cause remains unknown. Issue #223 is Todo, with its owner:ai vault idea note.
- Settled owner decisions: #199 option A keeps Showhow in the menu bar after the last macOS window closes; Cmd+Q quits. Pair #199 with #213 (Cmd+W closes only the window). #204 is closed as not planned; MP4 has no Cancel, preserving the 2026-10-19 decision. These are recorded in `.agents/decisions.md`.
- Main was fast-forwarded to `297ea752`. Unrelated dirty `PLAN.md` and untracked `design/landing-export.html` were preserved byte-for-byte. No new product ticket was dispatched during this close-out.

### Historical overnight wrap-up — 2026-10-23

Historical snapshot: Overnight 2026-10-23 (owner /goal, supervisor-merged with explicit authority) cleared the queue:
- Merged: #175 (PR #190), #187 (#191), #170 (#192), #178 (#193), #179 (#194), #180 (#195), #181 (#196), #182 (#197), #148 (#198), #137 (#206, landing page live at https://showhow-agy.pages.dev/), #207 (#208, new logo icons). Plan docs PR #189.
- Closed: stale #56–#59, #61–#63; #128 not planned (branch `ticket/128-chatgpt-connect` kept on GitHub); outside fork PR #214 closed unmerged on owner instruction.
- Open for owner triage: end-to-end findings #199–#205, #209–#213, #215. Highest impact: #215 (transcription reads only the first audio track, so mic speech is lost), #200, #201. #204 repeats the accepted 2026-10-19 "MP4 Cancel disabled" decision.
- Uncommitted on main (another session's work, preserved): `PLAN.md` gains "Showhow landing share image, favicon fallbacks and Mac icon delivery Plan". Untracked owner file `design/landing-export.html`.
- Evidence: `~/dev/loop-evidence/showhow-e2e-20261023/` (BRIEF*.md, FINDINGS.md to FINDINGS-4.md, verified/). Report: vault inbox "2026-10-23 Showhow end-to-end test report".

### Earlier in flight (before the 2026-10-23 overnight run; historical)

- **#122 AI guide shipped** (PR #126, merged 2026-10-17 as `500cea16`). Make guide runs an AI pass over the deterministic steps through OpenRouter, with `anthropic/claude-haiku-5.5` as the default model (owner decision 2026-10-17, no bake-off). Plan: "Showhow AI guide Plan" in `PLAN.md`. Evidence: `~/dev/loop-evidence/showhow-122/` (READY.md, PROVE.md, PROVE-CI.md, `live-smoke/run-OKsXUE/`). Lane removed; card Done.
- **#128 Connect ChatGPT** is published and deferred (`needs-human`, Creating plan/spec). Retain parked lane w6Q; no implementation or auth changes. The installed Codex version lacks the required proven tool/config isolation. Original approved scope remains in: "Showhow Connect ChatGPT Plan" in `PLAN.md`, mock in `design/mocks/2026-10-17-chatgpt-connect/`. It uses the owner's own Codex login (`codex app-server`) for Make guide only. Issue #128 is published. Resume only after owner direction and supported isolation controls.
- **Move onto upstream v2:** #115 and #116 are done (#116 merged on stable upstream `v2.0.0` via PR #121). #117 is closed: owner merged PR #130 as `371d940d14d7392ae090b9bfc57b2cf311c6de78`; both boards show Done and its clean lane is removed. Evidence: `~/dev/loop-evidence/showhow-117/READY.md`, `PROVE.md` and `SHOWHOW-COORDINATOR-HANDOFF.md`. #118 is closed: owner merged PR #132 as `573d9f2c8fea9855b6f0ab9cdd47aabdb49c8db0`. All four milestone tickets are complete. #118 passed fresh review and all 11 CI checks; its clean lane is removed and evidence remains at `~/dev/loop-evidence/showhow-118/READY.md`. No release tag was created. The authorised handoff index is `~/dev/loop-evidence/HANDOFF-INDEX.md`.
- **#125 Done:** owner merged PR #150 as `27494aa34f2467cc107adfb586db308157ccc372`; issue closed and card Done. Reviewed head `a2873cf`: fresh Standards PASS / Requirements PASS and all 10 CI checks passed. Evidence: `~/dev/loop-evidence/showhow-125/READY.md`. No active #125 source work.
- **Final designs: 9/10 Done.** Milestone 13 implements the approved Library, HUD, Editor and Settings frames through #139-#148. Merged on 2026-10-19: #139 (PR #151), #140 (PR #152), #141 (PR #153), #142 (PR #155, `d6a076de`, hardening PR #156, `24ae675b`), #143 (PR #158, `a4fc6008`) and #144 (PR #159, `7d0c21e7`). Merged on 2026-10-19/20, each by owner instruction at the reviewed head after all 10 checks passed:
  - **#145 HUD and recording sheets:** PR #164, head `5b871349`, merge `6d4b9876`.
  - **#146 Editor shell, inspector and timeline:** PR #165, head `f2d3443e`, merge `44fcd1a4`.
  - **#147 Editor assistant, export and dialogs:** PR #166, head `4402d254`, merge `cba41f83`. Owner decisions are in `.agents/decisions.md` (2026-10-19): agent edits auto-apply, with an "Applied · N changes" card and a guarded Undo (Editor-02 is not built); export is the inspector's share panel with a rendering sheet; the Guide format is left out; MP4 Cancel is disabled with its reason. Two fresh reviews: round 1 failed on keyboard focus in the export sheet, which was fixed; round 2 passed with no blocking findings.
  - **#148 integrated acceptance:** current candidate `e1fab9047b6cd7c797a9ade025749d4c9cfa4d3e`, branch `ticket/148-final-design-acceptance`, fresh executor w79:p3 on 2026-10-23. The old `498151af` package/tool STOP is HISTORICAL. Documentation reconciles all 49 frames against current source; Journey A retains the explicit supervisor-approved owner-owed source-selection limitation, with dependent completed-take/#175 rows unverified. The candidate is ready for one fresh independent review, then a conventional documentation PR if passed. Failed-review count 0, no verdict. Current receipts are under `~/dev/loop-evidence/showhow-148/`; supervisor alone merges.
  - Issues are closed. Evidence: `~/dev/loop-evidence/showhow-{142,143,144,145,146,147}/`.
- **#147 follow-ups, not yet fixed** (non-blocking, listed under Follow-ups in PR #166). A proposed session card, "Harden #147 export and Undo edge cases", covers 1-3; it starts only when the owner starts it.
  1. The native File menu (Cmd/Ctrl+N, Cmd/Ctrl+O) or switching to a screen-recording project can unmount the export panel mid-render and orphan the job.
  2. Focus drops to the page while a GIF cancel is pending.
  3. A retried Undo after a failed save can overwrite a manual edit made during that save.
  4. Clicking AI chat during a render opens it hidden behind the export panel.
- **Bug #124 fixed** (PR #160, `b72c6324`): on macOS, clicks on the HUD's drawn bar (not its transparent reserve) are tagged `ownUi` in cursor telemetry and skipped by step generation. Owed: a real recording smoke test, since Stop on the HUD should give no step and that needs the owner's permissions. Windows/Linux are follow-ups. Evidence: `~/dev/loop-evidence/showhow-124/`.
- **Phase 6 closed** (PR #162, `986cf494`): milestone 6 is closed, #55 (recoverable recording deletion) moved to the backlog without a milestone, and #54 closed as not planned.
- **No open PRs** (2026-10-20). #157 (landing page) has since merged.
- **How 2026-10-19 work ran:** the Codex weekly limit ran out (resets 24 Oct 22:45), so #142, #143, #144 and #124 were built in a single Claude Code session per the owner's instruction, not in Herdr ticket lanes. Each had its own worktree, test-first work, fresh independent subagent reviews, a native Electron proof on synthetic data and one PR. The owner authorised each merge in chat. #158 merged before CI finished because repo auto-merge is disabled, so `gh pr merge --auto` merges at once; all 10 checks then passed on that head. Since then, merges wait for green and then run `gh pr merge --match-head-commit`. #145-#147 (2026-10-19/20) used the same single-session route with BEFORE/AFTER native evidence and fresh subagent reviews.
- **`main` is protected** (owner request 2026-10-19): the 10 CI checks are required, with no required reviews, no strict up-to-date rule and admins not enforced. The repo setting "Allow auto-merge" is off; only the owner should change it.

### Earlier context (2026-10-16)
The move onto upstream v2 is shaped and published: milestone "Move onto upstream v2" with #115 → #116 → #117 → #118, all in Ready to implement, none priority. The plan is the "Showhow move onto upstream v2 Plan" section of `PLAN.md`; decisions are in `.agents/decisions.md` (2026-10-16). The design phase is merged (#109). The app size ticket (#110, PR #113) and the Copilot controller retirement (#108, PR #112) shipped on 2026-10-16.

- App size: installed 867 MB → 321 MB, DMG 337 MB → 167 MB (macOS arm64). `npm run check:package` audits a packaged app (only `ws` in `node_modules`, 14 Chromium locales, each wallpaper once, ≤ 330 MB). The owner installed the new build and confirmed that recording, transcription and export work. Windows and Linux are untested. #118 re-applies the trim to the v2 build with a ≤ 400 MB target.

- V1 brief and ship list: `~/Brain/projects/showhow/brief.md` and `ship list.md` (owner's vault). It ships six features: recording, the one-button AI guide, the editor with the v2 AI assistant, the library with MP4 import, Copy for agent, and PDF export.
- Locked mock: `design/mocks/2026-10-15-house-style/` (`index.html`, `SPEC.md`).
- Final designs: 50 `Final · <Area> — <state>` frames in `design/showhow.pen`, built from 25 new components. PNGs, `REPORT.md` and verification files are in `design/mocks/2026-10-15-house-style/pen-final/`.
- Design audit: `design/mocks/2026-10-15-house-style/DESIGN-AUDIT.md`. Its findings are drawn, and the owner's resolutions are in `.agents/decisions.md` (2026-10-15).
- Superseded mocks and the closed Design Max handoff are in `Archive/design/`.

## Next action

1. Reproduce #223 in the packaged Showhow app: record about 60 s while speaking, time how long "transcription pending" lasts. Under a minute: close #223 as a rig artefact. Minutes: #223 becomes the next ticket ahead of #199.
2. Then dispatch #199 together with #213 through the normal Loop route from current main, using the settled macOS window/menu-bar decisions. Coordinate with the supervisor before creating a lane so another session does not dispatch the same work. Do not reopen #204.
