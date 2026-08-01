# Issue 25 BEFORE evidence

Captured before source changes on 2026-08-01 from branch `ticket/25-browser-companion-capture` at commit `9af1fa931673a3b8b9183e75bcbbf3d5afb13053`.

## Observed baseline

- The live Electron HUD has recording-source and media controls, but no paired-browser status indicator and no companion semantic-step controls.
- The repository contains the desktop localhost bridge from issue #24, but no browser companion capture implementation: there are no extension capture listeners, accessibility labels, capture-time redaction, SPA navigation handling, meaningful-action filtering, or `captureVisibleTab` calls.
- The only companion fixture, `artifacts/24/bridge-client.html`, sends a placeholder `Browser step` and a hello without the required pairing token; it cannot implement the issue #25 capture contract.
- The approved design requires the companion to retain capture-phase listeners, DOM accessibility labels, capture-time redaction, SPA navigation detection, meaningful-action filtering, and pre-action `captureVisibleTab` screenshots while start/stop remain desktop-owned.

The committed `before.png` is a real screenshot of the running Electron HUD showing the current UI without companion pairing or browser-step capture status. This is a feature-gap baseline, not a claim that issue #25 behavior exists.
