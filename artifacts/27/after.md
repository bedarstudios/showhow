# Issue #27 AFTER evidence

Environment: macOS 26.5.2, Electron development build from the issue branch.

The accepted native run used the built ScreenCaptureKit helper and recorded the entire screen for
4.691 seconds. The resulting bundle is:

`/Users/mohamedb/Showhow/Recordings/2026-08-01_204216-recording`

Observed result:

- Native ScreenCaptureKit recording completed and opened in the inherited editor.
- The folder contains a real MP4, cursor JSON, transcript, `steps.json`, `steps.md`, and `meta.json`.
- With no captured clicks, `meta.stepCapture` records an unavailable `no-clicks` state and the
  library explains that the transcript-only fallback is available.
- The video remains playable in the library.
- Copy path put the exact bundle path on the macOS clipboard.
- The HUD visibly reported `Browser: Unpaired`; companion-unpaired/disconnect bundle degradation
  and accessibility-denied propagation are covered by focused automated tests.

`after.png` captures the fresh native bundle, playable video, preserved recording, explicit
transcript-only fallback, and Copy path control.
