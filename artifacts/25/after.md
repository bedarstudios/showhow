# AFTER — paired browser companion capture

Live acceptance was recorded on macOS with the unpacked Chrome companion paired to the
Electron app. Recording start and stop were both initiated by the desktop HUD.

- Bundle: `/Users/mohamedb/Showhow/Recordings/2026-08-01_172524-recording`
- Duration: 68,532 ms
- Bridge state immediately before stop: `paired: true`, `recording: true`
- Semantic steps: Click Text input, Type Text input, Click Password, Type Password,
  Click Default checkbox, Navigate to `/selenium/web/verified-final-spa`
- Redaction: both Type steps are marked `redaction: true`; the entered text and password values
  are absent from the bundle files.
- Screenshots: the three click steps contain genuine `captureVisibleTab` PNGs. `after.png` is the
  checkbox click screenshot and visibly preserves its unchecked pre-action state.
- Clock contract: all six timestamps are ordered and fall within the recording duration.

`after-steps.json` is the exact persisted semantic-step payload from this accepted recording.
