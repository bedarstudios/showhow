# Issue 24 BEFORE evidence

Captured before source changes on 2026-07-31 from branch `ticket/24-desktop-bridge-clock-contract`.

The live issue requires a localhost browser companion bridge with a recording-start epoch
handshake, recording-relative step timestamps, and safe mid-recording disconnect fallback.

Repository gap check:

- `rg -n "WebSocket|websocket|recording-start epoch|steps unavailable" electron src tests`
  found no Showhow desktop bridge implementation or bridge contract.
- The only current Showhow recording IPC exposes library, path-copy, transcript, and bundle
  operations; no pairing/start/stop/step-ingestion channel exists in `electron/preload.ts`.
- The design spec still describes the bridge as planned in Phase 4 (`docs/superpowers/specs/
  2026-07-11-showhow-desktop-design.md`, sections "Main process" and "Extension Bridge").

This is a feature-gap baseline, not a claim that a browser bridge was exercised successfully.
