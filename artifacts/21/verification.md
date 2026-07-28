# Verification

Environment: macOS, ticket worktree build, real bundle at
`/Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording`

- [passed] A coding agent given the bundle path and a generic inspection instruction inferred the
  transcript-overflow bug from the artifacts alone.
- [passed] `npm run --silent audit:showhow-bundle -- <bundle>` reports
  `acceptancePassed: true`.
- [passed] The audit confirms all six contract artifacts and cursor telemetry are present.
- [passed] Six screenshots match six steps, and all six step timestamps exactly match click
  telemetry.
- [passed] Every Markdown timestamp chip is within one second of its corresponding click.
- [passed] The audit diagnoses a 29,000 ms transcript timestamp beyond the 26,552 ms metadata
  duration.
- [passed] The ticket-worktree Electron build launched and the Showhow HUD and Notes window were
  driven successfully; `after-app.jpg` records the app-level result.
- [passed] Focused bundle-audit test: 1 file and 1 test passed.
- [passed] Unit suite: 68 files and 525 tests passed.
- [passed] Browser suite: 2 files and 6 tests passed.
- [passed] TypeScript: `npx tsc --noEmit`.
- [passed] Biome: 380 files checked with no fixes required.
- [passed] i18n: all 12 locales match English across 7 namespaces.
- [passed] Branding audit: all legacy-brand references are classified.
- [passed] Renderer/Electron build: `npm run build-vite`.
