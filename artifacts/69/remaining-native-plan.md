# Tiny remaining native Restart/Cancel verification

Only after a fresh explicit root slot, after issue67 releases local resources.
Fresh >=180MiB required; <=10MiB incremental budget; stop further work below150MiB;
hard100MiB. Existing unchanged10.3MiB lane optimizer cache must be reused, no fresh
optimizer, no Studio/editor visit or repeat of completed verification. No tests,
hooks, builds beyond existing dev main/preload startup, installs or permissions.

Exact same warm-cache startup command/config (no edits that invalidate hash):

`node node_modules/vite/bin/vite.js --config artifacts/69/vite.config.ts --configLoader runner --host 127.0.0.1 --port 5179 --strictPort`

Before launch verify no app/Vite/listener, record optimizer metadata hash and
cache size, original586 file hashes and no new recording paths, source/config
hashes unchanged. If startup reports reoptimization or cache invalidation, abort
instead of running a fresh optimizer. Recheck disk before any owned capture.

Native sky only. Select Calculator through source picker using the known necessary
AX card click (#75), with microphone/webcam/system audio off. No unrelated UI work.
Focus Start and Return; poll fresh AX for actual Pause before further keyboard
input. On active state Tab/Space pauses, with8s deadline/fresh Stop fallback. Save
only needed state evidence while paused to avoid recording inspection time.

From focused Resume, Tab reaches Restart recording; verify focus, Return activates
it. Current unchanged useScreenRecorder.ts nativeMac branch1638-1647 discards only
the active owned recording via finalizeNativeMacRecording(true), then starts a
new recording. There is NO confirmation dialog in this branch. Expect saving/start
transition, new native recording identity in dev log, then Pause recording (not
Resume) and reset elapsed state. Do not invent a confirmation interaction.

Immediately after fresh restarted-active AX, navigate observed focus by Tab until
Cancel recording is focused; verify at each step or use the current known focus
and ordered enabled controls, max6 steps. Return cancels. NativeMac branch1715-1720
sets discard identity, disables auto-finalize and finalizes with discard=true.
No confirmation expected. Require idle Start, enabled source and Studio returning;
no editor, no saved recording bundle from canceled captures. Capture native AX/
JPEG and native helper log identities as evidence; no pointer telemetry claims.

Budget <=8s per active segment, <=15s total active time. Count elapsed native active
segments from helper start/stop evidence where available; wall deadlines include
startup so are conservative. If state is unexpected, stop/cancel owned capture
immediately using freshly observed native action, report limited result. Never
leave active recording between lengthy model turns. Prefer one native-sky call
for restart->observed active->keyboard cancel, while rechecking AX between actions.

Quit owned Electron promptly, Vite should exit with it; verify PID/listener exit.
Rehash all586 originals. Original recording files are read-only throughout. If
discard leaves any new files, require before-inventory absence, matching native
recording/session identity and hashes before removing only exact authorized QA.
Record real durations/limits and disk samples, release slot to root immediately.
