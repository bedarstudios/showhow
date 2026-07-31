## Summary

Adds the Showhow localhost browser companion bridge with a versioned pairing and
recording-start clock contract. Browser steps are normalized to recording-relative
milliseconds and disconnects fail open so video remains available for desktop-tier
fallback.

## Changes

- `electron/showhow/bridgeProtocol.ts` validates the versioned wire contract and converts epoch timestamps.
- `electron/showhow/bridgeServer.ts` owns localhost pairing, epoch handshakes, ingestion, and disconnect state.
- `electron/showhow/bundle.ts` persists browser-tier steps and screenshots without replacing video artifacts.
- `electron/ipc/handlers.ts` starts the bridge and wires recording epochs and bundle persistence.
- `vite.config.ts` externalizes the Node-only `ws` dependency; `scripts/check-bridge-bundle.mjs` guards the dev bundle.
- `artifacts/24/after.png` and `artifacts/24/before.png` provide committed visual evidence.

## Testing

- `npm test` -> 77 files, 604 tests passed
- `npx vitest run electron/showhow/bridgeProtocol.test.ts electron/showhow/bridgeServer.test.ts` -> 32 tests passed
- `npx tsc --noEmit` -> passed
- `npm run lint` -> passed
- `npm run build-vite` -> passed
- `npm run i18n:check` -> passed
- `npm run branding:check` -> passed
- `npm run check:bridge-bundle` -> passed

## Done-when

- [x] Browser events retain recording-relative timestamps after the handshake, and a mid-recording disconnect preserves video while marking semantic steps unavailable.

## Verification

Environment: macOS / Electron dev build / commit a1c8164
- [passed] Electron dev launch loads after ws is externalized
- [passed] Main process listens only on 127.0.0.1:8765
- [passed] Safari companion receives the paired acknowledgement
- [passed] Safari disconnect produces CLOSED while bridge stays alive
- [passed] Protocol tests convert epoch timestamps to relative milliseconds
- [passed] Disconnect tests preserve steps and expose desktop fallback state
- [passed] Full unit suite reports 77 files and 604 tests passed
- [passed] TypeScript, Biome, i18n, branding, and renderer build pass
- [untested] Real recording epoch path blocked by native helper/accessibility alert

## Evidence

Committed BEFORE: `artifacts/24/before.png` and `artifacts/24/before.md`.
Committed AFTER: `artifacts/24/after.png` and `artifacts/24/after.md`.
The AFTER screenshot shows the real Safari companion page with `OPEN` and
`{"v":1,"type":"paired"}` after reconnect; the captured bytes were converted
to actual PNG and verified with `file`.

Functional path: launched Electron, observed the localhost bridge listener,
paired Safari over the local fixture, and observed `CLOSED` after disconnect.

Closes #24
