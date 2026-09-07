# Implementation Notes -- Showhow Phase 1

Deviations from `docs/superpowers/plans/2026-07-11-phase-1-fork-folder-bundle.md`,
logged as they're discovered mid-build. Nothing is deleted from this file.

## Deviations

### 2026-07-31: Issue 35 gain-only correction was disproven by orchestrator-owned runtime evidence

**What changed:** The ticket orchestrator reran the exact Electron generator at 21:14:30 after gain
normalization landed. Timestamp bounds were corrected, but near-equal words remained shuffled and
the final two step labels were still incoherent.

**What was done instead:** Retained the gain fix and added explicit integer-millisecond plus source-index
ordering in `transcribeCore`, including a RED regression proving raw fractional timestamp sorting produces
the observed reordering. A final Electron rerun against
`~/Showhow/Recordings/2026-07-25_175438-recording` produced ordered phrases, a maximum timestamp of
24,000 ms against the 26,552 ms duration, and six complete phrase-level step labels.

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

## Issue 24 deviations

- The first Electron dev launch exposed Vite bundling `ws` optional dependency
  stubs as a runtime throw. The narrow fix externalizes `ws` from the Electron
  main bundle in `vite.config.ts`; `scripts/check-bridge-bundle.mjs` guards the
  generated bundle against the original throw.
- The real recorder UI reached the existing native-helper/accessibility alert
  before a recording-start epoch could be exercised manually. The bridge pair,
  disconnect, and Electron startup paths were driven; epoch conversion is
  covered by the focused integration tests and is marked untested in the
  verification record for the physical recording path.
- The installed Herdr CLI lacks the documented `herdr wait` command. The
  supplied executor pane was preserved and monitored via `herdr pane get`.

### 2026-08-01: Issue 25 companion source required a focused local build target

**What changed:** The desktop repository retained the localhost bridge from Issue 24 but contained no
browser-extension source or build entry point. The browser companion is added as a Manifest V3 source
folder and bundled with the repository's existing esbuild dependency via `npm run build:browser-companion`.

**Why:** Shipping unbundled TypeScript or recreating accessibility-name logic in plain JavaScript would
either be unusable by Chromium or bypass the approved `dom-accessibility-api` labeling path.

**What was done instead (conservative option):** The generated `browser-companion/dist/` stays ignored;
only the small extension source, its manifest/popup, and the build script are versioned. The popup exposes
pairing status/configuration only and contains no recording controls. A narrow local declaration resolves
the installed package's broken TypeScript export typing without adding a dependency.

### 2026-08-01: Issue 25 bridge restart required persistent companion reconnect policy

**What changed:** A real desktop restart left Chrome storage at `paired: true` after its service-worker
socket failed before opening. The original worker only attempted one connection; its close handler cleared
storage but never retried, and an error-before-close had no cleanup path.

**What was done instead:** Extracted the socket lifecycle into a tested policy that clears paired state on
every attempted/rejected connection, treats `error` and `close` as one disconnect, and retries with a
bounded 500ms-to-10s exponential backoff. A manual pairing-token update cancels any pending retry and
starts a fresh connection. The policy owns no recording controls.

### 2026-08-01: Issue 25 MV3 wake-up required a connection-ready step queue

**What changed:** A real paired recording produced only the desktop tier because the MV3 worker woke on
the first content message, created a `CONNECTING` socket, and immediately discarded that step when its
ready state was not OPEN.

**What was done instead:** Pending browser steps now wait in the connection policy until the same socket's
open event sends the hello handshake, then flush in order. The queue survives the existing reconnect path;
there are still no extension recording controls.

### 2026-08-01: Issue 25 MV3 startup and first-step connection race

**What changed:** A second paired recording still omitted browser steps. The worker's startup
`connection.connect()` and the first content-message `send()` both crossed the empty-socket check while
their shared storage read was pending, creating two sockets. The queued step could attach to the stale one.

**What was done instead:** `connect()` is now single-flight while configuration is loading. Concurrent
startup and first-step callers share one socket, and the existing open-event queue flushes the step through
that socket.

### 2026-08-01: Issue 25 MV3 message-response channel closure

**What changed:** Chrome DevTools proved the content script was injected but reported closed message ports
and back/forward-cache channel closure. The worker's `async` runtime listener awaited capture/step work
without synchronously returning `true`, so Chrome could close the response channel first.

**What was done instead:** The listener is now synchronous and delegates to a tested message handler. Each
asynchronous capture, queued step, and reconnect response calls `sendResponse`; the handler returns `true`
before work begins. Capture failures return a null screenshot and step/reconnect failures return `{ ok: false }`.

### 2026-08-01: Issue 25 Chrome screenshot data URLs require payload decoding

**What changed:** A genuine paired recording still wrote no usable browser artifacts, and the acceptance
bundle exposed that `captureVisibleTab` returns `data:image/png;base64,...`, not raw base64. Persisting the
whole URL decoded its text prefix into non-PNG screenshot bytes.

**What was done instead:** Browser screenshot persistence accepts the existing raw-base64 bridge contract
and strips Chrome's PNG data-URL prefix when present. A RED bundle integration test proves the written file
starts with PNG magic bytes for the real Chrome form.

### 2026-08-01: Issue 25 late transcript regeneration must retain browser source steps

**What changed:** A genuine paired recording delivered semantic browser steps, but the later transcript
write reran the desktop telemetry doc generator and replaced `steps.json` with desktop-derived output.

**What was done instead:** Regeneration detects existing browser-tier source steps and leaves that artifact
pair intact. A RED bundle seam proves the late transcript write preserves the semantic label, redaction flag,
and screenshot reference.

### 2026-08-01: Issue 26 reveal state cannot recover capture-time typed values

**What changed:** The workflow-document view provides per-step reveal state for redacted steps, but it does
not expose an original typed value.

**Why:** The companion contract deliberately never reads or persists typed values; a redacted step retains
only its safe instruction label and `redaction` flag. Recovering a value at edit time would violate the
privacy contract.

**What was done instead:** Reveal displays the stored instruction label only in the local UI. An explicit,
persisted `includeRevealedText` opt-in is still required before that label is rendered into `steps.md`; without
it Markdown uses `[redacted]`. Users may edit the instruction themselves before opting in.

### 2026-08-01: Issue 27 — missing focused IPC test for `showhow:regenerate-doc`

**Root cause:** `electron/showhow/bundle.ts#regenerateDocArtifacts` is fail-open (never throws, never removes
source video/meta/transcript), but no IPC/preload route exposed it to the renderer. The scanner mapped an absent
`steps.json` to no steps, and `src/components/library/RecordingLibrary.tsx` gated the entire workflow area on
`entry.steps && entry.steps.length > 0`, hiding any doc status, Create action, generating/retry state, or
fallback explanation. The initial implementation pass added the IPC handler, preload bridge, scanner
orchestration (`regenerateRecordingDoc`), and renderer resilience states, but missed the explicitly required
focused main-process/IPC test that *invokes* the registered `showhow:regenerate-doc` handler and proves a
derivation failure returns a typed safe result while source video/meta/transcript remain intact.

**Initial missed IPC-test requirement:** The first pass added main-level tests for `regenerateRecordingDoc`
(in `electron/showhow/recordingLibrary.test.ts`) and renderer tests (in
`src/components/library/RecordingLibrary.test.tsx`), but no test exercised the actual `ipcMain.handle`
registration. The repository's existing handler-test pattern (`electron/ipc/handlers.test.ts`) mocks
`ipcMain.handle` as a no-op, so the handler was never invoked through the IPC boundary.

**Correction:** Added `electron/ipc/showhowRegenerateDoc.test.ts` following the existing handler-test patterns
(hoisted temp roots, `vi.mock("electron", ...)`, `vi.mock("../main", ...)`), extended so `ipcMain.handle`
captures each registration into a `Map` keyed by channel. The real `regenerateDocArtifacts` and
`createRecordingBundle` run end-to-end against a real bundle on disk (the `../showhow/bundle` mock uses
`importOriginal` to preserve all exports and only override `SHOWHOW_RECORDINGS_ROOT` to a temp dir). The bridge
server is stubbed so registration never binds a real WebSocket. The test builds a real bundle, corrupts the
cursor telemetry to force a derivation failure, invokes the captured handler as the renderer would, and asserts
the typed safe failure result (`{ success: false, stepsWritten: 0, transcriptAvailable: false, ... }`) plus
intact source video/meta/transcript and preserved prior `steps.json`/`steps.md`. Path validation (outside-root
and non-string bundle paths) is also asserted. No test-only production APIs were added and path validation was
not weakened.

### 2026-08-01: Issue 27 — live native macOS accessibility-denied reason lost across stop→bundle

**Root cause:** The recorder-first fail-open policy degrades editable-overlay to system-cursor mode when macOS
accessibility is denied, and the renderer tracks the structured `accessibility-denied` step-capture reason in
`pendingStepCaptureReasonRef`. However, the native macOS stop path (`finalizeNativeMacRecording` →
`stopNativeMacRecording(discard, duration)`) never passed that reason to the main process, and the
`stop-native-mac-recording` IPC handler called `createRecordingBundle` without `stepCaptureReason`. The result:
a system-mode recording with no cursor JSON was classified as generic `no-clicks` in `meta.stepCapture.reason`
instead of the root-cause `accessibility-denied`, making the degradation indistinguishable from a genuine
zero-click recording. The same gap existed in the `attach-native-mac-webcam-recording` re-bundle path.

**Live failure:** A real macOS recording made with accessibility denied produced a bundle whose
`meta.stepCapture.reason` was `no-clicks`, not `accessibility-denied`. The renderer's `getEffectiveCursorCaptureMode`
ref-based approach already correctly produced `cursor.mode: system` and `hideSystemCursor: false` in the
`startNativeMacRecording` request (no stale closure), so the start path was not the defect; the defect was
solely the lost reason across the stop→bundle boundary.

**Correction:** The renderer now passes `pendingStepCaptureReasonRef.current` as the third argument to
`stopNativeMacRecording` and includes it in the `attachNativeMacWebcamRecording` payload. The preload bridge
and `Window.electronAPI` type declaration forward the optional `stepCaptureReason` parameter. The
`stop-native-mac-recording` and `attach-native-mac-webcam-recording` IPC handlers accept the typed
`StepCaptureReason` and forward it to `createRecordingBundle` only when present, so normal
editable-overlay/no-click recordings are unaffected. The fail-open contract (video/transcript preserved on any
derivation failure) is unchanged. No test-only production APIs were added; path validation was not weakened.

**Tests added:** `src/hooks/useScreenRecorder.test.ts` gained a block proving the actual
`startNativeMacRecording` request uses `cursor.mode: system` + `hideSystemCursor: false` on accessibility denial
(and `editable-overlay` + `true` on grant), plus a block proving `stopNativeMacRecording` receives
`stepCaptureReason: accessibility-denied` on denial and `undefined` on grant.
`electron/ipc/showhowMacStepCaptureReason.test.ts` proves `createRecordingBundle` with
`stepCaptureReason: accessibility-denied` persists `meta.stepCapture.reason = accessibility-denied` (not
`no-clicks`) while preserving the video, and that a normal system-mode recording without the reason still
classifies as `no-clicks`. The start-request test was initially expected to be RED but passed immediately
because `getEffectiveCursorCaptureMode` already reads the ref at call time; the stop-reason test was the
genuine RED (3rd arg `undefined`) before the fix.


# Issue 67 implementation notes

Attempt 1. Supplied topology honored: w1P:p1 executor, w1P:p2 orchestrator,
w1C:p7 coordinator callback. No additional worktree or orchestrator.

Coordinator owns installed-app GUI. Baseline evidence supplied by coordinator
is preserved before any production edit; local GUI reproduction waits for a
granted slot. Headless CLI inspection only so far.

Dependency deviation: npm ci failed with ENOSPC before tests. Installer exited;
removed only this lane's 43 MB partial node_modules with coordinator approval.
Coordinator approved symlink to /Users/mohamedb/dev/projects/showhow/node_modules
because manifests match. Never install into or mutate shared dependencies.
Tests, builds and GUI wait for a coordinator slot while issue 66 verifies.

Baseline GUI slot granted and released after Load Project ->1080p export.
New export matches original byte count but differs in SHA-256; no byte-identical
claim. Original file hashes still match. Editor timer advances while preview
appears stuck, consistent with coordinator-owned mediaProtocol issue; excluded
from MP4 changes and not represented as a passing playback check.

Shared ENOSPC loop snare logged centrally by issue66 as BL-042 in
/Users/mohamedb/dev/OS/references/bedar-loop-issues.md; coordinator confirmed
no duplicate entry needed. First test slot released after actual encoder
capability preflight while executor authors bounded benchmark.

Verifier authored mp4BitrateScaling.test.ts after executor evidence authoring
stalled. Five genuine assertion failures observed before any production edit.
System FFmpeg lacks drawtext; fixture generator uses existing sharp-rendered SVG
text. Generated three complete 3-second fixtures total15MB; conservative10MB
generator guard fired after final write. Benchmark blobs stay in memory; no
frame dumps or browser downloads. Investigative generator guard to be tightened.

First browser benchmark stopped after about3min with no export logs and high
SwiftShader CPU. No benchmark result or bitrate selection inferred. Retry config
uses macOS Metal and lane-local cache instead of shared-node_modules Vite cache.
Browser config only; production rendering unchanged. All owned processes exited.

Browser setup root cause: installed @vitest/browser-playwright4.1.5 expects
launchOptions; inherited launch key was ignored. Isolated benchmark config
corrected; one real export passed in8.08s (10.05s full run). No production change.

Production bitrate change applied after genuine RED evidence (browser
regression artifacts/67/red-browser.log: 1,414,031.25 B/s exceeds the
779,446 B/s measured ceiling; five unit failures committed in 7b88854).
calculateBitrate in src/lib/exporter/mp4ExportSettings.ts now returns the
100 kbps-rounded, 1_000_000-24_000_000-clamped pixel-proportional budget
(width * height * 4_000_000 / 2_073_600, times 1.5 for source quality),
anchored on the benchmark-selected 4 Mbps at 1920x1080/60. Dimension,
upscale, crop, encoder VBR quality/fallback, capture, and persistence
behavior are untouched. Nine stale bitrate expectations in
mp4ExportSettings.test.ts updated to the computed values (4.2M, 5.7M,
1.9M, 4M, 6M, 24M, 4M, 1.2M, 4M in existing case order); every dimension
assertion preserved. Tests, builds, and GUI not run per coordinator
instruction; verification pending the granted re-run of the RED suites.

Trial adjustment: actual app audit export at the 4 Mbps anchor produced
4,387,478 bytes, exceeding the 3,771,472-byte acceptance ceiling. Only
BITRATE_REFERENCE_BPS changed, 4_000_000 to 3_000_000, as a trial pending
actual app output/readability; formula, source 1.5 multiplier, 1-24 Mbps
clamp, and 100 kbps rounding are unchanged. The nine expectations were
recomputed independently from the formula: 3.1M, 4.3M, 1.4M, 3M, 4.5M,
18M, 3M, 1M (floor-clamped from 900k), 3M. The 854x480 source case now
sits on the 1 Mbps floor and remains under half of the 4.5 Mbps
full-frame source budget, so the committed crop regression still passes
by construction. No tests, builds, GUI, commits, or package commands run.

Second trial adjustment: the real app 3 Mbps trial export produced
3,941,008 bytes, still above the 3,771,472-byte acceptance ceiling, though
frames remained readable. Only BITRATE_REFERENCE_BPS changed, 3_000_000 to
2_400_000; formula, source 1.5 multiplier, 1-24 Mbps clamp, and 100 kbps
rounding unchanged. The nine expectations were recomputed independently
from the formula: 2.5M, 3.4M, 1.1M, 2.4M, 3.6M, 14.4M, 2.4M, 1M (floor
clamped, value unchanged from prior trial), 2.4M. All four cliff cases
round to identical values on both sides (1.1M, 2.4M, 3.6M, 6.4M) and the
854x480 crop stays below half of the 3.6 Mbps full-frame source budget.
Trial awaits actual app acceptance; no tests, builds, GUI, commits, or
package commands run.

Final 2.4Mbps audit acceptance produced3,594,630bytes (52.344% reduction),
readable exact1s/13s frames and native QuickTime play/seek. Copied project
padding49 persisted after save/reopen; original hashes still match. Final
headless static/scroll/motion/sync exports each under1MB. The generated
flash/beep input offset is0ms; output audio lags65ms, within the predeclared
100ms tolerance. This is a timing measurement, not a listening claim.
Affected browser run encountered Vite optimizing gif.js midrun, reloading
and invalidating dynamic WebGLRenderer URL:3GIF failures,4pass,1optin skip.
Lane-only benchmark config now prebundles gif.js; no production GIF changes.
All processes exited; rerun awaits coordinator slot. Shared cache untouched.

The short browser rerun progressed past initial dependency discovery but
GIF worker resolution hit Vite fs.allow because node_modules is an approved
shared symlink. Intentionally stopped Vitest with SIGTERM (exit143), preserved
logs; lane-only config permits resolved gif.js/dist and scans only exporter
test entries. No product GIF or shared dependency change. Rerun pending.

### 2026-09-07: Issue 68 — serialized verification and nested writer recovery

The coordinator supplied installed-app BEFORE evidence and required preserving the
source Calculator recording. This lane copied all nine source files and verified
SHA-256 hashes before changes. Real Electron acceptance will read the original
bundle without edits, after cleanly quitting the installed app; CLI tests use
isolated temporary fixtures. No simultaneous installed/dev instances are allowed.

After ENOSPC in another lane, dependency installation is prohibited. This lane
uses the matching main checkout node_modules symlink read-only, disables Vitest
caching, and uses local Vite/Vitest config wrappers with local cache directories
and the runner config loader. TypeScript uses a local config extending this lane
and the coordinator-supplied read-only `/tmp/showhow-ticket66-types/ws` mapping;
`artifacts/68/typecheck-config.json` records it. No dependency manifests change.

The nested RED writer reported activity without delivering a file, so the lane
released its unused test slot. A replacement wrote two tests just before its
cancellation; the verifier retained that diff, added missing full-response header
assertions and took ownership of test execution, as the coordinator authorized.
The executor retains ownership of the subsequent production fix. The delivery
snare is logged once as BL-044 in the canonical OS loop-issues log.

The Vite runner config loader does not inject `__dirname`, so the first RED
attempt failed before tests. The ignored local configs now copy the repository
configs with an explicit lane directory and local cache; no production config
changed. The retry reached real assertions: full Content-Length was null and
range status was 200 instead of 206 (2 failed, 3 passed), before production edits.


Issue 68 acceptance passed on real Electron dev code `e62d394` after 33 protocol
and 202 affected tests, TypeScript with the isolated ws mapping, and Biome.
The first production pass exposed arbitrary MP4 paths; two real regressions
caught this, and the executor restricted the whitelist to the bundle video and
direct raster screenshots. Both failed and corrected results remain in evidence.

The native GUI audit temporarily unloaded/restored only the page's video URL to
exercise a timestamp clicked before metadata. It did not change any source file
or project. Actual timestamp/scrubber positions, full playback, range headers,
screenshot decoding, runtime PID/cwd, hashes and clean shutdown are recorded in
`artifacts/68`. User-required inline uploads accompany the committed evidence.

### 2026-09-08: Issue 68 — Greptile cancellation and evidence review

Read both unresolved review threads with pagination and `isResolved`, and the
latest 4/5 summary. The early-cancellation finding was independently reproduced:
three deterministic tests for pre-abort, abort during realpath, and abort while
opening a real file all returned 200 instead of AbortError before the correction.
The executor owns the production lifetime fix; verifier owns tests and evidence.

The original absolute typecheck artifact was not reproducible elsewhere. Its
contents are retained as historical text, while the actual config now extends
the repository relatively and prefers its declared @types/ws dependency. An
optional ignored local fallback links only the coordinator-supplied real types
read-only; no stubs or weaker compiler options were introduced. A committed
portable Vitest config preserves the repository test contract and avoids writes
to shared node_modules. Review logs name these committed configs directly.

The issue uses in-progress plus needs-fixes while fixing; the PR card remains
Reviewing. The semantic PR title was corrected as metadata, not a product fix.

PR72 follow-up: Greptile latest summary moved to5/5 on unchanged32ef356
(updated2026-09-07T23:00:50Z) while explicitly retaining2unresolved validation
threads. Not accepted as completion. Existing Ubuntu CI has704unit pass/1skip,
2browser timeouts amid dependency reload,14JSON evidence formatting errors,
and a nonsemantic title. Title metadata corrected; checks remain historical red.
Executor fix-1 delivered no test diff, was cancelled to terminal/error and
reconciled; user authorized verifier test-only takeover (existingBL-044 pattern,
no duplicate central entry). Production remains unchanged and executor-owned.
Verifier authored paired encoder comparison, native4K glyph/motion fixture,
blurred negative control and six bounded crop sink images. RED uses an isolated
Vite load plugin with the genuine7b88854 source, never mutating production.
First granted batch stopped at preflight:132440KiB free (~129MiB) versus100MiB
floor and<=35MB estimated growth. No test/fixture run or cleanup performed;
slot released. Await coordinated headroom, preserving original acceptance.

### Same-encoder control diagnostic: incomplete at resource cap

- [passed] Targeted Biome and isolated tsc exited 0 (suffixed logs).
- [passed] Unencoded reference: 42/42, contrast ratio 1 at frames 15 and 45.
- [failed] 80 Mbps control exceeded 5 MB cap: 5,238,219 bytes.
- [untested] Control decoded scores/config identity: cap stopped before checks.
- Candidate 14.4 Mbps output: 1,954,941 bytes; frame 15 (0.25 s) and
  frame 45 (0.75 s) each scored 40/42 with unchanged first-row templates.
  Frame 15 row 30 mismatches: B→8 at (443,1263), E→8 at (538,1263).
  Frame 45 row 30 mismatches: D→0 at (536,1263), E→8 at (568,1263).
  All rectangles are 24×30. Contrast ratios: 0.752525 and 0.839024.
  Diagnostic matched-row templates scored 42/42 at both times; this alone
  does not distinguish bitrate loss from classifier sensitivity.
- Fixture SHA256: 1c254d14ac3faa813829e2544309d110d980c0be823ec8d7250bd8a62d92b135.
- Vitest PID 84190 exited 1 in 14.1 s. Runner accepted expected exit 1, but
  manual classification is incomplete diagnostic/resource-cap failure, NOT
  expected quality RED. Only two of four decoded measurements exist.
- Six small crops and explicit JSON preserved, including earlier failures.
  No output MP4 was persisted. Production SHA256 remains
  669c2c342a54d5a9c389ab2b2daf7c97608a922f4733e131b484c1c8eeb80c4c.
  Process inspection found no remaining Vitest/Vite/runner; slot released.
- Next diagnostic needs a separately approved resource-bound adjustment;
  no scorer, threshold, production budget, or branch update is justified yet.

### Complete 64 Mbps diagnostic (review-control-1)

- [passed] Targeted format and isolated tsc exited 0.
- [passed] Four NEW scores: identical source SHA/config except bitrate/times.
- [passed] Candidate 1,954,941 bytes; control 4,980,880 bytes, both below 5 MB.
- [failed] Unchanged first-row scorer: 40/42 in all four decoded samples.
- [passed] Blurred negative: 2/42 in all four samples.
- [passed] Diagnostic matched-row scorer: 42/42 in all four samples.

Both budgets produce exactly the same mismatches at the same coordinates:
frame15 B→8 / E→8; frame45 D→0 / E→8, all on row30 (coordinates in JSON).
Candidate contrast ratios .752525/.839024; control .747475/.829268.
Shared source SHA256 within this batch:
9aacc7a6a1a27e41164779889eec27df6aee69f6a69a5b2e0b52cf904afae7be.
The fixture was generated once for this batch; its container hash differs from
prior batch, so only within-batch SHA identity is claimed. Both comparisons
used sample timestamps .25/.75 and identical final hardware-preferred H264
encoder config except bitrate. These results support row-phase classifier
sensitivity, not an inference that the 14.4 Mbps budget caused these errors.
They are not a general lossless-quality claim. The 64 Mbps control was only
19,120 bytes below the cap; no future cap-compliance guarantee is inferred.

Vitest PID87167 exited1 after14.1s at the actual40-vs42 assertion; the runner
verified all4 new measurements and exited0. This is a completed diagnostic
with an unchanged failing quality scorer, distinct from the prior incomplete
80 Mbps cap failure. No production/scorer/threshold changes. No test/Vite
processes remained; slot released to coordinator for73. Suffixed logs, JSON
and eight bounded crops preserve history.

### Authorized row-reference correction authored (not run)

Default templates now come from the corresponding reference row. All42 glyphs
and the .5 minimum contrast criterion are unchanged. Historical first-row mode
remains explicit and is recorded alongside corrected scores; old40/42 and80M
incomplete evidence are untouched. Exact-reference calibration at frames15/45
now additionally requires contrast ratio1, no mismatches, and rejection of an
8px-blurred reference. Encoded regression already requires all42 at both times
and independently rejects blurred decoded frames. Thus reverting the row choice
reintroduces the observed40/42 failure without lowering any acceptance metric.
Rationale is the complete14.4M/64M comparison: identical glyph errors using the
first-row templates,42/42 using corresponding rows, and known differing raster
phases. This is reference calibration, not proof of losslessness or a production
budget correction. Control runner now expects exit0 for corrected quality.

Prepared slot request: format, types, oracle, red-paired, red-quality, green,
unit, browser via review-check.py, sequential180s each and100MiB floor. RED
paired uses isolated audited7b88854 injection; production file stays untouched.
Normal GREEN has no injection or diagnostic high-budget flag. Browser directory
has all benchmark/acceptance/evidence flags unset. Bounded PNG/JSON evidence only;
no retained output MP4 or frame dumps; same5MB blob guard and cache reuse.

### Row-corrected RED/GREEN segment verified

- [passed] Format and isolated types: exit0 (review-format-3/types-3).
- [passed] Oracle: 1passed, 1filtered skip; both frame phases calibrated.
- [passed] Paired legacy RED fails actual4374070 < 4374070 byte assertion.
- [passed] Quality negative RED fails blurred3 vs42 assertion.
- [passed] GREEN: 2files,3tests passed; no skipped tests.
- [passed] Corrected4K:42/42 at both times, contrast .752525/.839024.
- [passed] Corrected blur:3/42 and2/42 rejected; historical scores40/42 both.
- [passed] Production SHA unchanged after isolated legacy module injection.
- [untested] Affected full directory suites await separate coordinated slot.

All child processes exited (GREEN PID89151 exit0,13.1s). Process inspection
found no remaining Vitest/Vite/review runner. Free253636KiB on release to73.
No production edits, savedMP4, cap changes, or extra directory runs.

### Affected suites and final scoped checks

- [passed] Exporter unit directory:99passed,0failed,0skipped;13files.
- [passed] Exporter browser directory:9passed,0failed;4files passed.
- [untested] Opt-in benchmark:1test/1file skipped with flags unset as intended.
- [passed] Final scoped Biome:58files,no fixes; JSON values unchanged.
- [passed] No source change since successful isolated tsc; repeat unnecessary.
- [passed] Production hash669c2c34... unchanged; all owned children exited.

Unit child90468 exit0; browser child90554 exit0 (17.1s); formatter child90919
exit0. Fresh process inspection found no Vitest/Vite/runner/tsc. Slot released
to73. Free171208KiB; no cleanup. Commit hooks await explicit coordinated slot.
Fresh-head remote CI remains pending; local Mac results do not prove Ubuntu.
