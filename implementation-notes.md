# Implementation Notes -- Showhow Phase 1

Deviations from `docs/superpowers/plans/2026-07-11-phase-1-fork-folder-bundle.md`,
logged as they're discovered mid-build. Nothing is deleted from this file.

## Deviations

### 2026-07-28: Acceptance audit output retains JSON in a `.txt` artifact

**What changed:** Issue 21 writes its stable JSON audit observation to
`artifacts/21/bundle-audit.txt` instead of a `.json` file.

**Why:** Biome reformats JSON array layout differently from `JSON.stringify`; rerunning the audit
would otherwise recreate a tracked artifact that fails the repository-wide lint check.

**What was done instead (conservative option):** The CLI still emits structured JSON and the artifact
contains that exact output, but its `.txt` extension keeps the repeatable evidence outside Biome's JSON
formatter. The acceptance report records the generation command and artifact path.

### 2026-07-22: Frame extraction uses an optional system ffmpeg

**What changed:** Desktop click frames are extracted with `ffmpeg`, which is available
on the development machine but is not a declared application dependency.

**Why:** Adding and shipping a video-processing binary is outside this ticket's narrow
scope, while the existing recording must never fail because documentation artifacts
cannot be generated.

**What was done instead (conservative option):** Bundle creation attempts extraction
after the video and cursor telemetry have been moved. If ffmpeg is unavailable or a
frame command fails, the video stays intact and `meta.json` marks the bundle as a
transcript-only document with an explanation.

### 2026-07-12: Native macOS capture path bypasses bundling entirely

**What changed:** Task 3 wired `createRecordingBundle` into
`storeRecordedSessionFiles` (electron/ipc/handlers.ts), on the assumption that
every finished recording flows through it. Manual acceptance testing (a real
20s recording via the app UI) proved this wrong: on macOS, OpenScreen tries
**native ScreenCaptureKit capture first** (`startNativeMacRecordingIfAvailable`,
src/hooks/useScreenRecorder.ts:1167), and that path's completion handler is a
**separate IPC handler**, `stop-native-mac-recording`
(electron/ipc/handlers.ts:2090-2172), which writes its own session manifest
directly and never calls `storeRecordedSessionFiles`. `store-recorded-session`
(the path Task 3 modified) is only reached via the browser-MediaRecorder
fallback, used when native capture is unavailable.

Result: the manual verification recording landed as flat files in
`~/Library/Application Support/openscreen/recordings/` -- no bundle folder,
no `meta.json`, no `screenshots/` -- exactly the "silent fallback" the
try/catch was designed to produce, except triggered by the wrong root cause
(bundling code never ran at all, not that it ran and failed).

**Why:** the plan and its brief did not account for OpenScreen having two
independent save-completion code paths on macOS (native ScreenCaptureKit vs.
browser MediaRecorder). Static code reading during planning found
`storeRecordedSessionFiles` as *a* completion path; it was not cross-checked
against which path the recorder actually prefers at runtime.

**What was done instead (conservative option):** extend the same bundling
try/catch pattern -- already reviewed and approved in `storeRecordedSessionFiles`
-- to `stop-native-mac-recording` (the primary/default macOS path) and
`attach-native-mac-webcam-recording` (the native webcam-attach path, for
consistency, since OpenScreen's webcam PiP feature must keep working per the
spec's "keep all OpenScreen features" requirement). Same ordering rule applies:
bundle after `writePendingCursorTelemetry`, before the session manifest write;
same fail-open behavior: bundling failure logs and falls back to the
flat/unbundled session, never rejects the IPC call.

Native Windows capture (`stop-native-windows-recording`, handlers.ts ~2000-2070)
has the identical shape but is explicitly out of scope -- spec is macOS-only
for V1 (personal tool, "macOS 13+, unsigned" per the signed-off assumptions).
Left unbundled; noted here so it isn't mistaken for an oversight later.

**Task retroactively affected:** Task 3 (already reviewed/approved based on
code-reading verification only; the manual runtime check that would have
caught this was still pending when the review ran). Re-opened as
Task 3b/fix rather than reverting the approval, since the original diff is
correct as far as it goes -- it's incomplete, not wrong.

### 2026-07-12: Task 4 transcript hook-in follows the same three-path discovery

**What changed:** Task 4's brief (written before the deviation above was
discovered and fixed) assumed `storeRecordedSessionFiles` /
`store-recorded-session` was the only save-completion path and told the
implementer to hook `generateTranscriptForBundle` into `useScreenRecorder.ts`
at its two `storeRecordedSession` call sites only. Per the corrected task
instructions (informed by the deviation above, and by the same-commit fix
that added `bundleDir`/`videoFileUrl` to all three IPC results), the
fire-and-forget transcript call was wired into all three places a macOS
recording save can succeed:

1. The primary `storeRecordedSession` call site (browser-MediaRecorder path,
   `useScreenRecorder.ts` ~line 391), guarded on `result.bundleDir &&
   result.videoFileUrl`.
2. The nested `storeRecordedSession` call inside `finalizeNativeWindowsRecording`
   (used only when a webcam was recorded alongside native Windows capture),
   guarded on `stored.bundleDir && stored.videoFileUrl`. The Windows-native
   `stopNativeWindowsRecording` result itself is untouched and unhooked --
   that result type has no `bundleDir`/`videoFileUrl` fields since native
   Windows bundling is explicitly out of scope for V1 (macOS-only spec).
3. `finalizeNativeMacRecording`'s final save state: tracked
   `finalBundleDir`/`finalVideoFileUrl` starting from `stopNativeMacRecording`'s
   result, overwritten by `attachNativeMacWebcamRecording`'s result when a
   webcam was attached (since that call's result reflects the final bundle,
   not the screen-only one), then fired once right before
   `clearNativeRecordingState()`.

**Why:** the native macOS path (default on macOS) never goes through
`storeRecordedSession`, so hooking only those two call sites would mean the
primary recording path -- and thus the vast majority of real usage -- never
gets a transcript.

**Task retroactively affected:** none -- Task 4 was corrected before
implementation started, so no rework needed.

### 2026-07-15: Live acceptance exposed renderer-lifetime and container mismatches

**What changed:** A real native macOS recording showed that ScreenCaptureKit writes MP4,
while the bundle module renamed every video to `video.webm`. It also showed that starting
Whisper fire-and-forget in the recorder renderer does not survive `switchToEditor()`, which
destroys that renderer before transcription completes.

**What was done instead:** Preserve the source container as `video.mp4` or `video.webm`,
including the matching cursor telemetry name. Persist the pending Showhow transcript job on
`RecordingSession`; the editor renderer claims it after the window transition and clears the
pending fields only after the transcript write completes.

### 2026-07-15: Startup activation raced IPC registration

**What changed:** Live automation reproduced a HUD window whose renderer called IPC before
the handlers existed. Startup awaited proactive microphone permission, while a second-instance
activation could create the HUD during that wait.

**What was done instead:** Gate window activation until startup registration is complete and
request microphone access only when the user enables microphone capture. Regression coverage
verifies that an early activation is deferred until readiness.

## Phase 1 acceptance -- 2026-07-15

- Recorded 45 seconds of the full display through native ScreenCaptureKit with system audio.
- Played a deterministic macOS text-to-speech phrase containing "green lighthouse",
  "seven forty two", "local speech transcription", and "agent ready folder".
- Verified the recording opened in the editor with a 45-second duration.
- Verified `~/Showhow/Recordings/2026-07-15_100533-recording/` contains `video.mp4`,
  `video.mp4.cursor.json`, `transcript.txt`, `meta.json`, and `screenshots/`.
- Verified `transcript.txt` contains timestamped recognition of the deterministic phrase.
- Verified `meta.json` identifies `video.mp4` and `video.mp4.cursor.json` accurately.
- Verification: 45 test files / 328 tests passed; `tsc --noEmit` passed; Biome checked
  346 files with no errors.

## Workspace retirement -- 2026-07-16

### Generated design exports are documentation, not application source

**What changed:** Moving the approved mock and design-system exports into `docs/design/`
caused the pre-commit hook to lint their generated JavaScript and JSON. The exports contain
bundled runtime patterns that intentionally violate the application Biome rules.

**What was done instead:** Added the narrow `!docs/design/**` exclusion to
`biome.json`'s file set. The exact failing `lint-staged` path then passed, and the full test
suite remained green. The generated exports were preserved byte-for-byte rather than rewritten.

### The parent feature backlog was OS-tracked

**What changed:** The plan treated `Projects/web/showhow/feature-backlog.md` as parent-owned
material but did not initially list its tracked deletion in the OS commit.

**What was done instead:** Staged the deletion explicitly alongside the nine planned OS
alignment files. Unrelated pre-existing OS changes remained unstaged.

## Issue 32 loop deviations

- Phase 0: Herdr 0.7.3 rejected the documented `pane move --json` option.
  Retrying without `--json` succeeded and still returned the new pane ID as JSON.
  Logged as BL-013 in the OS loop-issues reference.
- Attempt 1 executor: OpenCode remained on `Delegating` for more than six minutes
  without a source or test delta. The resumable session was interrupted and reopened
  without incrementing the product-fix attempt. Logged as BL-014.
- Attempt 1 executor recovery: fresh/resumed TUI sessions kept reporting a phantom
  active fixer without a completion channel or file delta. The same brief was sent
  directly to OpenCode's configured `fixer` agent in the executor pane.
- OpenCode rejected `--agent fixer` because it is subagent-only and fell back to the
  broken orchestrator. Recovery continued with OpenCode's primary `build` agent,
  explicitly instructed to implement directly under the same TDD guardrails.
- Issue 32 GREEN (review correction 2026-07-26): `normalizeTelemetrySample`
  clamps `timeMs` to `Math.max(0, Math.min(sample.timeMs, totalMs))` -- the
  baseline contract that no sample escapes the recording's span. The sample is
  spread (`...sample`) before clamping, so `interactionType` survives into the
  normalized output and downstream click detection keeps its original anchors;
  `cx`/`cy` remain clamped to [0, 1]. The earlier note (claiming `timeMs` was
  intentionally NOT clamped to preserve a trailing sample's identity) is
  retracted: that broke the baseline normalization invariant. The normalization
  test is narrowed to prove all six in-range click samples preserve
  `interactionType` and coordinates, plus an assertion that the fixture's
  trailing `mouseup` at t=26571 (16ms past `durationMs`=26552) is clamped to
  t=26552. It no longer requires the out-of-range mouseup timestamp to remain
  unchanged. Click-candidate behavior artifacts (`artifacts/32/after.txt`) are
  unaffected: every click anchor is within `[0, durationMs]`, so clamping does
  not move any click center, and click selection remains the sole candidate
  source whenever any click exists; dwell ranking/centering is fallback-only for
  zero-click telemetry.
- Functional app verification was blocked by a pre-existing main-checkout
  Showhow editor session containing unsaved changes. The open 26-second project
  visibly retained 10 baseline dwell spans. Loading the ticket build required
  closing that session via Save or Discard, so the orchestrator preserved the
  unrelated project and recorded app verification as untested.

### 2026-07-26: IPC boundary stripped interactionType, defeating click-mode auto-zoom

**Root cause (functional discovery):** The ticket app loaded
`~/Showhow/Recordings/2026-07-25_175438-recording/video.mp4`. The raw adjacent
`video.mp4.cursor.json` carries 650 samples with 6 `interactionType=click`.
Vite serves the new click-mode `zoomSuggestionUtils`, and toggling auto-zoom
OFF then ON still produced the same 10 dwell spans. Tracing the telemetry
flow proved the renderer never received click metadata:

- `electron/ipc/handlers.ts` `readCursorTelemetryFile` mapped
  `recordingData.samples` to only `{ timeMs, cx, cy }`, stripping
  `interactionType` before it crossed the IPC channel.
- `src/native/contracts.ts` `CursorTelemetryPoint` lacked `interactionType`,
  so even if a hand-rolled mapper tried to forward it, the contract type
  erased it.
- The renderer's click detection (`zoomSuggestionUtils.buildAutoZoomSuggestions`)
  filters on `sample.interactionType === "click"`. With the field absent the
  click branch never engaged and `detectZoomDwellCandidates` (dwell fallback)
  ran unconditionally, producing the 10 dwell spans observed in the live app.
- The fixture test bypassed the IPC boundary by loading
  `__fixtures__/issue32-cursor.json` directly into the renderer's
  `CursorTelemetryPoint[]` (which already declared the broader
  `interactionType` union in `src/components/video-editor/types.ts`). It
  proved the algorithm but not the data path that feeds it.

**What was done instead (TDD, IPC-boundary fix only):**

1. Added a same-package failing test `electron/ipc/cursorTelemetry.test.ts`
   for a pure mapper `mapCursorSampleToTelemetryPoint` projecting
   `CursorRecordingSample` -> `CursorTelemetryPoint`. Verified RED: the test
   failed because `./cursorTelemetry` did not exist.
2. Created `electron/ipc/cursorTelemetry.ts` exporting the tested mapper.
   It preserves `interactionType` for `move | click | mouseup` (the active
   recording contract) and falls back to `"move"` when the sample omits or
   carries an unrecognized value. Verified GREEN: 6/6 tests pass.
3. Extended `src/native/contracts.ts` `CursorTelemetryPoint` with optional
   `interactionType?: "move" | "click" | "mouseup"` so the IPC contract
   can carry the field. Mirrored the same field on the ambient
   `CursorTelemetryPoint` interface in `electron/electron-env.d.ts` (the
   legacy `get-cursor-telemetry` IPC channel's declared return shape).
4. Replaced the stripping inline object in `readCursorTelemetryFile` with
   `samples.map(mapCursorSampleToTelemetryPoint)`. No other call site
   changed; `loadCursorRecordingData` still returns the full
   `CursorRecordingData` (with `assetId`, `cursorType`, `visible`, etc.) for
   the editor cursor renderer.

**Scope guardrails:** No refactor of the already-green click suggestion
algorithm or fixture. The renderer-side `CursorTelemetryPoint` in
`src/components/video-editor/types.ts` keeps its broader union
(`move | click | double-click | right-click | middle-click | mouseup`) --
that type describes what the renderer tolerates, while the IPC contract
in `src/native/contracts.ts` describes what the main process emits. The
mapper's fallback to `"move"` means a future recording that emits a
broader value (e.g. `double-click`) is normalized at the boundary rather
than silently dropped, and the renderer's downstream click filter
continues to treat only `interactionType === "click"` as a click anchor.

**Verification:** new test 6/6 pass; `zoomSuggestionUtils.test.ts` 6/6
pass; `npm run test` 511/511 across 65 files; `npx tsc --noEmit` clean;
`npm run lint` clean. Not committed, pushed, or PR'd.
## Label-driven pull loop -- 2026-07-28

### Deviations

**Test runner and file extensions.** The plan specified
`.github/scripts/derive-status.js` verified with `node --test .github/scripts/`.
The repo is `"type": "module"`, runs vitest, and already carries four
`.github/scripts/*.test.mjs` files that `vitest.config.ts` picks up via its
`{src,electron,.github}/**` include. Used `.mjs` and vitest instead so the new
test runs under `npm test` with everything else. `node --test` would have left
it orphaned from CI.

**Formatting.** Biome reformatted the test file's long `expect(...)` lines onto
multiple lines. Accepted its output rather than fighting the shared config.

### Not a deviation, worth recording

`deriveStatus` accepts both bare label strings and the `{name}` objects the REST
API returns. The workflow in Task 3 passes API objects straight through; tests
use strings. One coercion in the function beats remembering which shape a caller
holds.

### 2026-07-28: Issue 23 stalled delegated lanes were replaced with synchronous implementation

**What changed:** The bounded data/API and UI implementation lanes produced no shared-tree
implementation delta and were cancelled at the user's direction. The parent executor completed
the approved red-to-green implementation directly.

**Why:** Waiting further would have delayed the scoped issue without producing reviewable code.

**What was done instead (conservative option):** Preserved the existing 138-line renderer red-test
delta unchanged, used it to drive the minimal scanner and document-view additions, and ran the
affected tests, TypeScript, Biome, i18n, and branding checks before reporting.

### 2026-07-28: Issue 23 live Electron media and clipboard boundary correction

**What changed:** The initial document view used the renderer's `navigator.clipboard` and direct
`file://` artifact URLs. Live Electron verification proved neither integration worked: the system
clipboard stayed unchanged and the player remained at 0:00 because the library renderer could not
load the local file URLs.

**What was done instead:** Added a typed `showhow:copy-path` IPC boundary backed by Electron's
clipboard service. Local recording artifacts now use the privileged, root-scoped
`showhow-media://recordings/<bundle>/<artifact>` protocol rather than raw filesystem URLs. The
protocol rejects traversal outside `~/Showhow/Recordings`; step seeking records a pending seek and
reapplies it when media metadata becomes available.

**TDD evidence:** New tests failed first because the clipboard helper and media protocol modules
did not exist, while the renderer test failed because Copy path still used `navigator.clipboard`.
After implementation the focused suite passed.

### 2026-07-28: Issue 23 media protocol preserves Chromium Range requests

**Root cause:** The first `showhow-media` handler converted the approved artifact path to a local
file URL, but invoked `net.fetch()` without forwarding the renderer request headers. Chromium's
initial media load could expose a frame and duration, while native play/seek requests requiring a
`Range` response were served as unrelated full-file fetches and left the player at 0:00.

**What changed:** `fetchShowhowMedia` now forwards all inbound protocol request headers, including
`Range`, to Electron's `net.fetch(fileUrl, { headers })`. The resulting response retains the native
media status and range headers (`206`, `Content-Range`, `Accept-Ranges`) from Electron's file
fetch rather than synthesizing a cosmetic renderer seek state.

**TDD evidence:** The new same-package protocol test failed RED with
`TypeError: fetchShowhowMedia is not a function`; after the narrow forwarding helper and handler
wiring, it passed GREEN and asserts that `range: bytes=1024-` reaches the local fetch.
