# Patched-lane native AFTER

September8 2026, macOS; Electron PID8969, parent Vite8966. Native app executable
is the reused installed dependency Electron.app, running `.` with cwd this ticket
worktree. Renderer AX URL `localhost:5179/?windowType=hud-overlay` (library/editor
routes observed separately). Served LaunchWindow source contains all four new
action keys. Baseline commit493965e plus the uncommitted issue69 patch:

- LaunchWindow SHA256 cd0e573830003fa6de3c2abcdef618a9a26b57181e1476698a13bd6561306f7f
- English locale SHA256 3dff192ab2417114eb38f88372cb7a26e9e4a03037763048fdb7a33f2fa5ef1e
- Japanese locale SHA256 bd76f290ac16dee6f0afea9b3b5f924e82b991eb27e985ae25d7fe28d74823a4
- Vite config SHA256 b414dda29920c54ff4e9f0c3161051c9ccc582f0ca83170b2972599b8f292ba5

Command is the exact granted artifacts/69/vite.config.ts runner on port5179,
recorded in PLAN.md and after-dev.txt. The initial electron/native/bin symlink
pointed read-only to installed Showhow.app helpers; no native build or permission
change. After shutdown it was replaced by an ignored bin directory containing
read-only darwin-arm64/darwin-x64 links, because the existing trailing-slash ignore
pattern matches a directory but did not match the initial top-level symlink.

Native keyboard Tab/Return on Open Studio opened library. Library auto-selected
its existing latest entry for display; no original content was edited. Native Back
to recorder click returned HUD. Tab/Return on Select recording source opened picker;
Tab/Right selected Windows, native AX click selected Calculator (issue75 gap), Tab/
Return activated Share. Selected-source accessible name retains visible Calculator.

Five Tabs from picker focus reached Start recording. Return started asynchronous
native capture; code reread fresh AX until actual Pause recording appeared before
sending Tab/Space. Recording AX exposes Stop, Pause, Restart, Cancel; paused AX
changes only Pause to Resume and screenshot shows amber state. Start-to-confirmed
paused wall time6046ms includes startup. Space resumed; fresh AX showed Pause.
Shift-Tab/Return stopped; elapsed wall time through Stop972ms. Fresh AX captured
Saving... with native disabled source/restart/cancel/notes/language controls.
Subsequent editor displayed the owned short recording. Saved metadata duration
465ms; this is the observed capture duration, not a wall-time estimate.

Return to Recorder opened a confirmation dialog saying the current session had
been saved; no confirmation was activated because the next disk sample triggered
the narrower growth-budget stop. Restart/Cancel accessible names are native-proven;
native activation remains untested in this session. Their unit boundary tests pass.

Free disk: prelaunch207108KiB; startup209012; selected idle218564; stopped213956;
editor/return dialog163284. Observed initial-to-minimum difference43824KiB exceeds
the narrower35MiB budget but is below original45MiB; minimum remains above130MiB
operational threshold. Immediately quit owned Electron with native Cmd+Q. Vite
exited automatically, exit0; PID8966/8969 and port5179 listener absent. Cache10516KiB,
dist-electron348KiB; do not attribute all disk fluctuation to these outputs. Postquit
185852KiB. All586 original files rehashed unchanged. Exact owned465ms capture,
session linkage and hashes were verified in a private local ownership manifest;
only the aggregate result is committed here.
