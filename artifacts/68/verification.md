## Verification
Environment: macOS 26.5.2; Node 22.22.1; npm 10.9.4; Electron GUI pending.
- [passed] All nine original files match the preserved lane copy hashes.
- [passed] RED detects missing full length and incorrect partial status 200.
- [passed] Protocol range and strict-trust regressions pass: 33 tests.
- [passed] Affected Showhow/library suites pass: 202 tests across 8 files.
- [passed] TypeScript passes with the isolated read-only ws type mapping.
- [passed] Biome checks four affected TS/JSON files without changes.
- [untested] Real Electron seeking awaits the coordinated GUI slot.
