# Issue #27 verification

Environment: macOS 26.5.2, Electron dev build, built arm64 ScreenCaptureKit helper.

- [passed] Missing workflow doc shows an approved Create action.
- [passed] Create regenerates a legacy bundle and refreshes its steps.
- [passed] Native recording produced a valid folder bundle and playable video.
- [passed] No-click recording explains the transcript-only fallback.
- [passed] Copy path copied the exact fresh bundle directory.
- [passed] HUD visibly reported the browser companion as unpaired.
- [passed] Derivation failure tests preserve video, meta, transcript, and prior doc.
- [passed] Generating, retry, companion, and accessibility states have focused tests.
- [untested] Live accessibility-denied metadata; permission was not denied after helper build.
- [untested] Live mid-recording companion disconnect; no paired browser lane was disturbed.
