# Showhow verification recipe Implementation Plan

> **For agentic workers:** this plan is published to GitHub by `/new-project`
> or `/phase`; `/ticket` delivers a review-ready PR in maintenance mode or a
> verified MVP phase push. Do not execute inline. Track steps with checkboxes (`- [ ]`).

## Feedback addressed

PLAN-FEEDBACK.md: none open (file absent at planning base).

**Goal:** Give agents one repeatable, isolated native Electron journey from a synthetic recording to a real, decodable GIF export, with diagnostic, evidence and cleanup results.

**Architecture:** Add a project-owned recipe and one foreground Node/Playwright driver. Reuse the committed recording fixture, production built main/preload/renderer, existing editor locators and actual export-write IPC. A generated test bootstrap isolates Electron paths before importing the production entry; only the operating-system save dialog selection is replaced.

**Tech Stack:** Node 22.22.1, npm 10.9.4, Electron and Playwright versions resolved from the existing lockfile, FFmpeg/ffprobe, existing Vitest/browser and CI commands.

## Global Constraints

- Task mode (`maintenance`): one standalone task PR; no priority label; agents never merge.
- No production renderer, IPC, native helper, runtime, global skill, dependency-version or OS permission changes.
- Preserve phases 6 and 10 without adding mode; this task does not unpark product work.
- Preserve canonical checkout's dirty `design/showhow.pen` and untracked `design/showhow-export.html`; implementation uses a fresh isolated ticket worktree.
- Use lane-owned dependencies installed with the exact engine pins; every install, build, suite and native run uses `ruby ~/.local/bin/bedar-runtime.rb run --resource heavy --`.
- Record actual role-shell `command -v` and version outputs for Node 22.22.1, npm 10.9.4 and Codex 0.160.0 (planning observation); a stale or mismatched required CLI blocks the attempt. No tool repair or version substitution is part of this task.
- Use only committed synthetic `tests/fixtures/sample.webm` (VP9, 640x480, 2.000 seconds, 23,869 bytes at planning base); no personal recording discovery or cursor sidecar search.
- If an OS permission prompt, personal recording content or non-isolated profile appears, stop that attempt, preserve sanitized failure evidence and clean up only owned processes; do not change permissions or bypass isolation.
- This journey proves editor load, renderer GIF export and actual filesystem save. It does not prove native recording permissions, recording bundles, native save-dialog interaction, MP4 export or Windows/Linux behavior.

## File structure

- Create `docs/testing/verification-recipe.md`: ordered doctor, launch, drive, evidence and cleanup procedure, command, failure/resume and proof limits.
- Create `scripts/verify-showhow-export.mjs`: single foreground entrypoint, pure preflight/result helpers, isolated Electron bootstrap and actual journey.
- Create `scripts/verify-showhow-export.node-test.mjs`: same-package tests of safety boundaries, prerequisite failures and independent result validation.
- Modify `AGENTS.md`: one conditional pointer to the project recipe when verifying editor/export work; no copied OS rules.
- Modify `package.json`: add `verify:export` and its focused test command without dependency changes.
- Create `artifacts/verification-recipe/Verification.md` and safe reviewed result/screenshots: actual execution assertions, commands, exits, source identity and scope limits.
- Create `implementation-notes.md`: source/evidence deviations and their conservative resolution.
- Planning only: `PLAN.md`, `.bedar/project-plan.yml`, `references/verification-recipe-planning-2026-10-02.md`, append `.agents/decisions.md` for approved mode/priority/scope.

### Task 1: Isolated Electron export verification recipe

**What:** Ship and exercise one command that diagnoses prerequisites, launches actual Showhow, opens the synthetic clip, exports a GIF through the renderer and production write handler, saves bounded evidence, then proves owned-process and temporary-data cleanup.

**Files:** All implementation paths in the file structure above. Existing `tests/e2e/gif-export.spec.ts`, `electron/bootstrap.ts`, `electron/main.ts`, `electron/ipc/handlers.ts` and `tests/fixtures/sample.webm` are read-only references.

**Interfaces:**
- Consumes: built `dist-electron/main.js` and `dist/index.html`, committed synthetic fixture, Playwright `_electron`, production `window.electronAPI.setCurrentVideoPath` and `switchToEditor`, `testId-export-panel-button`, `testId-gif-format-button`, `testId-export-button`, FFmpeg/ffprobe commands.
- Produces: `npm run verify:export -- --evidence-dir <new-lane-owned-directory>`; a fresh directory containing reviewable sanitized `result.json`, editor and completion screenshots, and the synthetic exported GIF when successful. Reject an existing evidence directory rather than overwrite earlier proof. Exit 0 requires all journey and cleanup assertions. Nonzero preserves failure evidence and identifies the failed stage.

**MUST:** Declare the save-dialog override in the result. Keep the production `write-export-to-path` handler intact. Assert actual Electron path isolation before opening the fixture. Wait on observed window/video/export/file state with explicit timeouts, not fixed sleeps as success criteria. Capture actual process, source SHA/dirty status, tool versions, fixture hash, file/decoded-media assertions, and cleanup observations.

**MUST NOT:** Reuse the current GIF e2e's default userData, fixed `test-sample.webm` or mock writer, use preview capture's newest cursor recording search, change HOME or credentials, kill unrelated apps, delete outside the created temporary run root, retry failed native attempts automatically, or count screenshots/signatures alone as media/export proof. **REASON:** Those defaults can mutate owner data or produce a false acceptance result.

**Sequence:**
1. Doctor resolves repository identity and exact Node/npm pins, dependency modules and Electron binary, built main/renderer, readable fixture/hash, FFmpeg/ffprobe availability and a new evidence path. It fails before launch if any prerequisite is missing. Record actual tools/role/harness and source identity, including resolved Codex binary path/version and actual role-launch context when Codex drives the recipe (mark other harnesses explicitly, never assume an API agent role from a shell environment). Do not change model/profile settings or install/build inside the driver.
2. Allocate private temporary run root with `mkdtemp`. Create appData, userData, sessionData, downloads, logs, crash and tmp directories. Launch only the owned Electron child with private TMPDIR/TMP/TEMP so `os.tmpdir()` stable-instance locks remain inside that root. Generated bootstrap calls Electron `app.setPath` synchronously for appData, userData, sessionData, downloads, temp, logs and crashDumps before importing production `dist-electron/main.js`. Production bootstrap will select `<isolated-appData>/Showhow`; verify the final runtime paths and lock paths remain within the run root. Keep HOME and user credentials unchanged.
3. Copy the synthetic clip into isolated runtime recordings. Confirm IPC readiness and fixture readability. Switch to the actual editor with production IPC; subscribe to the new-window event before switching and tolerate only a proven closed-HUD transition. Wait for loaded video with finite duration and canvas. Save editor screenshot.
4. Replace only `pick-export-save-path` to return one unique absolute GIF path inside the temporary root. Click the existing export-panel, GIF-format and export buttons. Wait for actual file existence and completed export UI. Preserve the production writer and renderer encoder. Assert GIF magic, size >1 KiB, positive decoded width/height, at least two decoded frames and decoded duration between 1 and 4 seconds for the 2-second fixture. Independently decode the entire output with FFmpeg; exit 0 required. Copy the synthetic GIF and completion screenshot to the evidence directory before cleanup.
5. Finally close the owned Electron app, wait boundedly for its owned process tree, escalate only owned PIDs if required, and confirm those processes are gone before removing only the created run root. On every failure retain already captured evidence with failure stage and cleanup result. Incomplete cleanup keeps overall exit nonzero. Rehash the source fixture and prove it unchanged. Evidence and logs are sanitized before publication; retained screenshots contain only the synthetic app journey.

- [ ] Capture the baseline observable absence of this recipe and the existing e2e writer-mock gap. Observe meaningful assertion RED for missing-prerequisite/no-launch behavior, existing evidence path rejection, cleanup failure preventing success, and corrupted or undecodable output failing validation before implementing helpers; a missing module or setup failure is not behavioral RED.
- [ ] Implement the smallest complete recipe and driver; critical isolation and writer invariants stay beside the launch/export code.
- [ ] Run focused helper tests, then a real macOS Electron journey and inspect actual screenshots, decoded output and cleanup proof.
- [ ] Run the full project CI checks below, inspect owned changes, obtain independent Standards and Requirements review, then commit only owned changes and open one PR.

**Verification:**
- Focused `node --test scripts/verify-showhow-export.node-test.mjs`: missing tools/build/fixture prevent app launch; output directory collision preserves original bytes; successful media assertions alone cannot mask cleanup failure; invalid GIF and decoder failure reject proof; bootstrap ordering is a supporting static check and fixture hash mismatch fails acceptance. The actual native boundary must independently assert runtime appData/userData/sessionData/recordings and stable-lock containment and production writer output; bootstrap-string checks do not substitute for these observations.
- Real macOS `npm run verify:export -- --evidence-dir artifacts/verification-recipe/native-<unique-run>` through heavy runtime: actual editor screenshot, completed GIF UI, real file and independent full decode, immutable fixture and bounded owned cleanup. Preserve failed attempts beside later passing runs. A second invocation uses a different new directory and proves repeatability and cleanup rather than overwriting the first.
- CI parity, sequential through heavy runtime with exact Node/npm: `npm run lint`; `npm run branding:check`; `npx tsc --noEmit`; `npm run test`; `node --test .github/scripts/overnight-evidence-integration.node-test.mjs`; `npm run test:browser:install`; `npm run test:browser`; `npx vite build`; `node --test .github/scripts/overnight.node-test.mjs .github/scripts/overnight-review.node-test.mjs .github/scripts/overnight-reconcile.node-test.mjs .github/scripts/overnight-evidence.node-test.mjs .github/scripts/overnight-github.node-test.mjs`. Also run `npm run i18n:check` only if translations change (outside expected scope). Use semantic PR title; all applicable current-head GitHub CI checks must pass. Conditional `copilot/` cloud-evidence job is not applicable to a local ticket branch.
- First install `npm ci` in the lane only; browser install is the repository's required prerequisite, not a version upgrade. Build `npm run build-vite` before the native journey. No packaging or native helper build required for fixture import/export.

**DONE WHEN:** Two fresh native macOS runs show isolated real editor load and real GIF filesystem export with successful independent full decode, identical before/after fixture hashes, no surviving owned Electron processes and no temporary run root; focused negative tests and complete applicable project CI pass; reviewed sanitized evidence states the dialog override and platform/proof limits; fresh independent review has zero blocking findings; one review-ready standalone task PR is open and unmerged.

## Decision checkpoint

- 2026-10-02: Owner approved the five-stage verification recipe and real journey with “Go for it”; selected Task mode and no priority label. One bounded task, one PR; phases remain parked.
- Cheap choices: GIF reuses the existing supported format/locators and avoids an unrelated MP4 optimization task. One committed 2-second synthetic fixture; no new product UI or design mock is needed for a verification tool.
- Factual risks addressed in this plan: default Node is 24.14.0/npm 11.9.0; exact required 22.22.1/10.9.4 are installed. Existing GIF E2E overrides real writes and touches default userData. Production bootstrap resets userData from appData, and stable instance locks use os.tmpdir; early path and temp isolation is mandatory.
- Expensive uncertainty retained as acceptance, not assumed success: actual GIF encoding/decoding and native process cleanup have not run in this fresh worktree. If current application behavior blocks the recipe, record evidence and stop; production fixes require a separate authorized task.
- Publication: preview pending; no fingerprint approved and no GitHub mutation authorized yet. Next action: generate and show the exact selected-phase preview for owner approval.

## Implementation notes

Keep an `implementation-notes.md` in the repo root during the build. If an edge
case or discovery forces a deviation from this plan, pick the conservative
path and record the deviation there with its reason. Surface it to Mohamed at
the end; do not silently change scope or acceptance.
