## Verification

Environment: macOS, ticket/32-auto-zoom-dwell worktree
- [passed] Focused regressions: 12/12 assertions passed
- [passed] Unit suite: 65 files and 511 tests passed
- [passed] TypeScript, Biome, i18n, branding, and diff checks passed
- [passed] Production renderer and Electron build completed
- [passed] Fixture changed 10 dwell spans to 3 click-led HIT spans
- [passed] Every accepted span reaches full strength by its click
- [passed] Every accepted focus matches its anchor click coordinates
- [passed] Ticket app rendered only 3 click-led zoom regions
