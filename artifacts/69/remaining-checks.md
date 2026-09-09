# Remaining check slot requests

Run sequentially only under root grants. Installed binaries only; no npm/npx,
installs, browsers or dev process implied by this request. Recheck disk before each
command; abort before100MiB floor; capture exit/status and release all children.

## Affected launch suite (<5s expected, <=1MiB increment)

```sh
node node_modules/vitest/vitest.mjs run src/components/launch --config artifacts/69/vitest.config.ts --configLoader runner --maxWorkers 1
```

Covers all3 same-package launch test files including source selector interactions.

## Static checks (separate sequential slot, <=30s expected, <=1MiB file growth)

```sh
node node_modules/typescript/bin/tsc --noEmit --project artifacts/69/tsconfig.json
node node_modules/@biomejs/biome/bin/biome check src/components/launch/LaunchWindow.test.tsx artifacts/69/vitest.config.ts artifacts/69/vite.config.ts artifacts/69/tsconfig.json
node node_modules/@biomejs/biome/bin/biome check src/components/launch/LaunchWindow.tsx src/i18n/locales/*/launch.json
node scripts/i18n-check.mjs
```

Biome is read-only. Per the latest root constraint, any test/config formatting or
import changes use apply_patch; production findings return to executor with the
same apply_patch-only rule. No verifier production mutation. Typecheck uses
standard declared ws types first and ignored local actual-types fallback second.
Do not claim default dependency installation is complete: shared deps lack @types/ws.
Static checks can cause runtime/OS overhead beyond expected file growth; root may
require additional free disk. No tsc emit, package build or shared cache write.

## Subsequent gates

- Browser DOM coverage requires separate browser slot/config and disk headroom;
  installed browser only. Never install/download browsers. Native AFTER provides
  direct Chromium+macOS AX validation for these actual controls.
- AFTER app requires actual patched lane dev, separate detailed GUI budget, helpers
  links only as approved, source/runtime provenance and original data rehash.
- Commit/hook slot still required. Generated .husky/_ wrapper is absent (BL-048),
  so normal commit is not proof of lint-staged execution; arrange equivalent exact
  configured tasks without install or hook bypass claims.
- NEW priority PR only after all required checks and real AFTER; no merge.
