# Issue 69 execution plan

Canonical repository verified with gh repo view: bedarstudios/showhow.
Worktree: ticket-69-accessible-recorder-actions; branch ticket/69-accessible-recorder-actions.
Baseline: 493965eb7174c231f6689c359a632b4dad1c6e8e.
Approved scope: issue comment 5576454891, plus current user constraints.

## Ownership and gates

Codex w1S:p2 owns failing tests, verification config, plan, evidence and independent review.
OpenCode w1S:p1 delegates to its GLM fixer and owns only LaunchWindow.tsx and the
13 launch locale JSON files after BOTH genuine RED and fresh baseline GUI evidence.
Root w1C:p7 owns test/dev/GUI/hook scheduling. No such execution without an explicit
slot grant. Author/read-only is the initial grant. No new worktrees, installs,
downloads, shared node_modules/cache writes, packaging, native builds or merge.
Hard disk floor: 100 MiB. Check before and after each resource operation.

## Diagnosis and regression contract

The source selector and Record/Stop aria-label both use selectedSource. The five
Studio/pause/resume/restart/cancel icon actions have tooltip text but no explicit
button name. Existing Notes/layout/mic/webcam buttons demonstrate localized names.

Tests query real LaunchWindow button roles and accessible names, with recorder hook
and Electron boundary doubles already used in this package. Expectations are hand
specified, not derived from production labels. Regressions caught:

- No source: source selection includes visible Screen; Start recording differs and
  remains enabled, opens the picker and records after selection.
- Selected source: picker includes visible Display 1; Start and Studio named.
- Start -> Stop -> Start on the same mounted component, with source disabled and
  Studio absent during recording.
- Pause -> Resume -> Pause on the same component, Stop still available while paused.
- Restart and Cancel named and dispatch correctly while recording and paused.
- Saving takes precedence over Start/Stop, retains visible Saving... and native
  disabled semantics for source/record and whichever auxiliary actions are present.

Seven authored cases (two parameterized pairs); none executed at authoring time.
RED command, short slot requested independently:

```sh
node node_modules/vitest/vitest.mjs run src/components/launch/LaunchWindow.test.tsx --config artifacts/69/vitest.config.ts --configLoader runner --maxWorkers 1 -t 'LaunchWindow accessible recorder actions'
```

Capture complete output to artifacts/69/red-tests.txt and actual exit status using
`test_exit_code`, never zsh's reserved `status`. Config puts caches under ignored
.local/issue-69/vitest-cache; runner loader avoids shared .vite-temp. Reserve <=5MiB
for this test/cache/log, expected runtime under 30s. Infrastructure errors do not
count as RED. No production edit until expected missing-name assertions fail.

## Fresh native BEFORE and AFTER plan (separate GUI grants)

Read Computer Use skill; interact only through node_repl and @oai/sky.
Original audit attachment is context, not a substitute for fresh baseline.

Before requesting launch, finish exact lane-local Vite startup config and budget:
cache/output paths confined to lane, disable dependency discovery if needed to stay
under budget, inspect installed read-only helper locations and actual dev scripts.
Verify no other Electron/Vite owner active. Snapshot SHA-256 for every original
recording file in current and legacy roots; never rename/edit/delete originals.
Use ignored links to installed helpers only if missing, never native build or
permission changes. Record cwd, head, served renderer URL and source provenance.

Launch baseline from this unchanged production checkout only after root GUI grant.
Use native sky to select Calculator. Capture idle, recording and paused AX trees
and real screenshots to artifacts/69/before*.png and before-ax.txt. Exercise normal
Tab/Shift-Tab, Return/Space for source/start/pause/resume/stop and observe states.
Make only a short owned Calculator QA recording; stop promptly, preserve all
original data, inventory owned outputs, clean only owned QA and verify original
hashes again. No pointer telemetry or screen-reader speech claims from AX alone.
Stop owned app/server processes and release slot.

After implementation and green tests, re-drive the same fresh runtime and capture
artifacts/69/after*.png and after-ax.txt; verify meaningful names, keyboard action
outcomes and unchanged layout. Cover Studio, restart and cancel with owned QA only.
Record saving state when observable; deterministic tests cover transient saving.
Report Windows/Linux GUI untested. Abort resource operations before 100MiB floor.

## Implementation after both gates

Only localized aria-label changes. Reuse tooltips.pauseRecording/resumeRecording/
restartRecording/cancelRecording/openStudio and recording.saving. Add exactly
sourceSelector.selectSource (Select recording source: {{source}}), recording.start
(Start recording), recording.stop (Stop recording), across all 13 locales. Keep
source visible text in the translated interpolated name. Do not change tooltip
text, styling, handlers, shortcuts, persistence, capture or native permissions.

## Independent checks and delivery

Request fresh serialized checks slot: affected full launch suite; relevant full unit
and browser coverage as justified by changed DOM; tsc --noEmit; Biome on changed
files; i18n check. Use installed binaries only. Typecheck config if needed must
prefer declared normally installed @types/ws, then optional ignored .local fallback
linked read-only to temporary actual types; no committed absolute machine paths.
Normal commit hooks also need a slot; inspect generated wrapper availability and
use equivalent configured validation if BL-048 applies. Log observed assertions as
they happen, plus deviations in implementation-notes.md; do not invent passes.

Open NEW priority PR with conventional title, priority applied ON CREATE. Commit
meaningful before/after and AX evidence; attach authenticated inline evidence using
gh --attach. Identical Verification blocks on issue and PR. Synchronize source/PR
labels (in-progress+needs-fixes while fixing, needs-review before fresh review,
review-passed only current-head genuine5/5, greenCI and zero actionable threads).
Explicit PR project card Reviewing; source board derives issue labels. Paginate all
review comments/threads/checks. Never duplicate requests during automatic review.
Register durable watcher callback w1C:p7, verify JSON record, report exact current
readiness to root using herdr pane run. Never merge or enable auto-merge.

## Coordinator-authorized BEFORE alternative and concrete resource request

Fresh dev optimizer (~42MiB observed in prior lane evidence) would breach disk
headroom. User explicitly permits installed Showhow for BEFORE if correspondence
is proven. Read-only ASAR inspection now records version1.6.0, renderer asset hash,
exact relevant bundled fragments and their mapping to unchanged493965e source in
installed-source-correspondence.txt. BEFORE is installed1.6.0, NOT currentmain.
AFTER must be actual patched lane runtime under a later independent plan/grant.

Proposed installed BEFORE slot: <=10 minutes; no dev/Vite/build/optimizer. Budget
<=20MiB total for owned short recording, app runtime/cache growth and native sky
screenshots. Disk currently ~135MiB; require >=125MiB immediately before launch,
check after each state, stop operation if below120MiB to retain cleanup headroom
above hard100MiB. Do not delete unrelated caches to create space.

1. Before launch, SHA256 all regular files recursively under the local Showhow
   recording roots, including both current and legacy-compatible locations.
   Deduplicate canonical roots on this case-insensitive filesystem; record missing
   roots. Current inventory is506 bundle files,61 Showhow raw files,19 legacy raw
   files (about1GB read-only hashing, no video copies). Record preexisting file list,
   sizes and hashes to a private local inventory (not committed to the PR).
2. Confirm ps shows no competing Electron/Showhow/Vite process. Native sky opens
   /Applications/Showhow.app and Calculator; record Showhow pid/executable plus
   AX URL identifying installed renderer. Fresh AX+screenshots after every action.
3. Idle: inspect current source and microphone/camera/audio state. Do not change
   mic permissions. If mic enabled or Calculator cannot be selected without new
   permissions, stop and report rather than silently expand capture scope.
4. Use ordinary Tab/Shift-Tab from observed focus to the source button, Return to
   open picker; inspect new tree, navigate Windows and Calculator via keyboard
   focus and Return/Space (native indexed click only to establish focus if needed).
   Do not assume element indices or Tab counts before inspecting live state.
5. Save idle screenshot/AX showing two Calculator buttons and unnamed Studio.
   Tab from source through existing audio/camera/cursor controls to Record; Return
   activates recording. Immediately capture recording AX and screenshot, then Tab
   to Pause and Space to pause. Capture paused AX+screen while recorder is paused
   so evidence inspection adds no encoded duration.
6. Space on the focused Resume returns recording; inspect AX then Shift-Tab back
   to Stop and Return. Bound actual active capture to <=15s across start/resume;
   stop immediately if unexpected delay. Saving may be transient; inspect if seen.
7. Verify return to idle or owned output editor. Record exact resulting QA paths
   by comparing inventories, not assuming all new files are ours. Do not open or
   mutate an original recording. Request/report any cleanup outside explicitly
   identified owned QA files. Quit only owned app, check all its children exited.
8. Rehash every original path; require identical hashes, record owned differences,
   final free disk, and release GUI slot through herdr pane run w1C:p7.

Japanese caveat: existing tooltips.resumeRecording and restartRecording both say
録画を再開. Coordinator notified: preserving existing tooltip text and unique names
requires a dedicated restart accessible translation (uniform key across13), or an
explicit narrow tooltip correction. No production locale change until resolved.

### Explicit root amendment, September 8

Root reviewed and approved this complete plan under existing user specification
authority. Installed1.6.0 BEFORE is allowed only with relevant source/behavior
correspondence and exact installed-runtime provenance, never labeled493965e runtime.
AFTER must use actual patched lane. No-source Start retains existing picker then
record-after-selection behavior; visible source remains inside the picker name.
Source issue advances creating-spec -> ready-to-implement -> in-progress for actual
reproduction work. Production remains gated on fresh native BEFORE. RED7 expected
assertions acknowledged by root. This approval does not grant GUI execution.

### Approved localized uniqueness amendment

Root approved a fourth new key recording.restart across all13 locales for the
Restart button aria-label, preserving every tooltip. Japanese accessible Restart
is 録画を最初からやり直す, distinct from actual Resume 録画を再開. Same-package regression
reads actual ja-JP launch.json through the translation boundary and queries both
buttons by role/name, requiring uniqueness and their respective boundary actions.

## Prepared patched-lane AFTER runtime (not yet granted or run)

artifacts/69/vite.config.ts copies the repository dev contract with portable root
resolution for runner loader, lane-local cacheDir, and optimizer source maps off
plus dependency minification to limit disk. Installed Vite source inspection shows
esbuildOptions overrides its default sourcemap:true. Read-only existing shared
cache inventory: JS20358184B and maps37750901B; maps dominate. No shared cache is
modified or reused by this config. Minified output size remains an estimate until
an authorized startup. Main/preload builds remain ordinary repository sources and
lane-local ignored dist-electron; app source is the patched lane. Native helpers
may be linked read-only from installed app into ignored electron/native/bin only.

Prepared command (requires fresh root GUI/dev grant and adequate disk headroom):

```sh
node node_modules/vite/bin/vite.js --config artifacts/69/vite.config.ts --configLoader runner --host 127.0.0.1 --port 5179 --strictPort
```

Do not launch at current low disk without a conservative root-approved budget.
A later grant must include source provenance/renderer URL, pre/post original hashes,
app child cleanup, meaningful AX screenshots, and bounded capture with observed
active-state confirmation before any Pause key. Prior async-start snare BL-050
requires a deadline/stop path before starting capture; do not batch a speculative
Tab/Space immediately after Start while the observed tree is still idle.

### Exact AFTER interaction and budget proposal

Request only after disk recovery: >=180MiB fresh preflight, <=45MiB incremental
budget including optimizer/build output, runtime caches, native screenshots and
owned QA; operational stop at130MiB retains30MiB over hard100MiB. No optimizer
launch is authorized by this plan alone. The installed baseline is not reused
as AFTER. All new local files and native links remain inside this ticket lane.

Before launch rehash all586 original paths against the private local inventory;
inventory must contain no unexplained additions. Confirm no competing app/dev.
After startup record process cwd, renderer127.0.0.1:5179 URL and served source
correspondence, production file hashes, exact config and readonly helper links.

Idle AX must name Start recording, Select recording source: Screen and Open Studio.
Native Tab/Return opens source selector; Windows tab keyboard works, Calculator
card selection uses native AX click with issue75 limitation, then Share keyboard.
Selected idle AX must retain Calculator within the picker name, distinct from Start.

Run Start-to-Pause as one bounded native-sky operation: activate focused Start with
Return, repeatedly obtain fresh AX until the actual Pause recording button exists.
Do not send Tab while the latest observed tree is still idle. Once active, save
recording AX/screenshot, Tab to Pause and Space, then require Resume recording in
fresh AX and an amber paused screenshot. Preserve Start, recording and paused states
without extra active capture for inspection. An8s active-state deadline must stop
the owned recording through its freshly observed Stop button if pause fails; report
the exact native fallback and never claim keyboard pause succeeded in that case.

From confirmed paused state, Space resumes, fresh AX requires Pause recording,
Shift-Tab/Return stops. Observe saving if captured and subsequent editor/idle;
deterministic tests cover transient saving regardless. Bound total active time
to15s, including any subsequent owned Restart/Cancel trial. Restart is a destructive
discard-and-restart of only this owned in-flight QA, never an existing recording;
Cancel likewise discards only owned QA. If time/disk cannot support those actions,
report untested native activation while retaining their unit boundary evidence.
Studio keyboard activation must open library without opening/editing original data.

Save actual native JPEGs using .jpg extension with matching AX text. Rehash all
originals, identify each QA output using original absence plus session linkage and
hashes, remove only separately authorized exact owned files, quit only owned app
and dev parent/children, verify listener exit and final disk, release root slot.

### Revised exact AFTER request after coordinator disk recovery

Root recovered40,788KiB using reversible worktree-only historical docs/evidence
exclusion; originals remain main+Git and issue69 evidence is untouched. Reported
free165868KiB (~162MiB). No old52 cleanup or dependency changes occurred.

Revised proposed bounds: fresh >=160MiB; <=35MiB total incremental; stop further
work below125MiB, hard100MiB. Expected allocation is <=20MiB optimizer JS (existing
unminified cache JS20.36MB, minification should reduce it; source maps disabled),
<=2MiB main/preload, <=5MiB native JPEGs/AX/owned QA, <=8MiB runtime/OS slack. These
are estimates, not measured patched startup results. Check disk after startup and
each state; root grant required. If fresh available space is <160MiB do not launch.
One <=10minute dev/GUI slot; <=15s total active owned Calculator capture. Retain
the actual-active-state prerequisite and8s stop deadline described above. Browser
tests, commits/hooks and unrelated cleanup are outside this request.
