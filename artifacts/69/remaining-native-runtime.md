# Remaining Restart/Cancel native verification

Granted warm-cache run: Electron PID12122, Vite12120, this ticket cwd, native AX
URL localhost:5179/?windowType=hud-overlay. Same source and Vite config hashes as
after-runtime.md; no source edits. Optimizer metadata SHA256 before and after:
b7ecd941aa6c64534e21faf1562a58887f49b336960d97483d709329e3b7f34b.
Cache remains10516KiB; no optimizer invalidation/rebuild was observed.

Free KiB: prelaunch193300, startup201648, precapture210732, before Restart215400,
final214108. All sampled thresholds passed and no incremental10MiB breach was
observed. Existing identical main/preload rebuilt as part of ordinary dev startup;
no native build, dependencies, browser tests, hooks or permissions changed.

Only necessary Calculator capture initialization repeated. Native source-card AX
click remains required (#75); no full keyboard-source-picker claim. Inputs off.
From Start focus, Return started capture; fresh AX was polled until actual Pause
appeared, then Tab/Space paused. Confirmed Resume focus; wall time5920ms including
startup. From Resume, Tab reached Restart, verified by fresh AX, Return activated.
No confirmation dialog appeared, matching the nativeMac discard/restart branch.

Dev log records distinct native output identities:
- Initial owned recording: recording-1788829540912.mp4
- Restarted owned recording: recording-1788829567056.mp4

Fresh restarted AX shows Pause recording (not Resume), reset00:00 and named Stop/
Restart/Cancel. Keyboard Tab through observed enabled controls reached Cancel;
verified focus, Return activated. Fresh AX shows idle Start, enabled source and
Studio; no editor or saved-bundle transition. Restart-through-cancel wall2467ms.
Combined bounded sequences8387ms including startup conservatively bound active
time below15s; each is below8s. Exact encoded durations are unavailable because
both owned recordings were discarded, so no precise encoded-duration claim is made.

Native Cmd+Q quit owned Electron; Vite exited0 automatically. Both PIDs and port5179
listener absent. Original-files-post-remaining.json.txt confirms all586 originals
unchanged and zero new recording paths: native discard removed owned files, with
no manual cleanup needed. This does not alter earlier captured durations: installed
BEFORE19.009s (18s HUD), first patched AFTER465ms.

Evidence: after-restart-focus.jpg and its AX, after-restarted.jpg/AX,
after-cancel-focus-ax.txt, after-cancelled.jpg/AX, remaining-native-dev.txt.
