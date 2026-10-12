# Project handoff

Updated: 2026-10-12

## In flight

No phase in flight. Phases 6 and 10 are parked: their `mode:` was removed by PR #100 on 2026-09-28.

On 2026-10-12 the owner locked a five-step order in `NEXT-SESSION.md`: assess the upstream v2 release, design the full experience in `design/showhow.pen`, build an interactive dummy-data UI, connect real features in small steps, then check complete workflows. Design work, research docs and shaders are on branch `design/full-experience`.

## Next action

Step 1 of `NEXT-SESSION.md`: refresh the upstream v2 assessment in `docs/research/`. It assessed upstream `eff86dc` (v2.0.0); upstream `main` was 266 commits ahead on 2026-10-12. This supersedes the earlier "unpark Phase 6, #54 first" action.

## Open decisions

- Whether Phase 10 issues #93–#96 are rewritten or closed once the full-experience Pen design is approved. They predate guides, agent briefs and AI settings.

## Rejected paths

- Design Max layout directions (Document Desk, Evidence Bench), rejected by the owner on 2026-10-12 and deleted. Do not revive them; the earlier dither frames remain the visual reference.

## Test state

Revision: BASE_SHA `adc7e99c0b575edad1f18d4675df2f4ef6d75dbd`, completed branch-office candidate on `solo/v7-2b-branch-office`: six fixed files and byte-preserving `.harness` archive rename. Only this test-result text was filled after checks; no checked configuration changed.

Sequential checks, each through `ruby ~/.local/bin/bedar-runtime.rb run --resource heavy --` with Node 22.22.1 and npm 10.9.4:

- `npm ci`: exit 0. Added 865 packages and audited 866; Husky prepare completed. Reported dependency deprecations and 62 audit vulnerabilities (3 low, 30 moderate, 24 high, 5 critical). No dependency repairs were attempted.
- `npm run lint`: exit 0. Checked 561 files, no fixes applied. One existing `lint/suspicious/noEmptyBlockStatements` warning at `src/lib/showhow/companion/deferredClick.test.ts:28:55`; that source file is unchanged from BASE_SHA.
- `npx tsc --noEmit`: exit 0, no output.

The PR's CI remains the full check. Unit, browser, E2E and native platform acceptance were outside this bounded configuration and agent-document task.

## Cloud blockers

None for this configuration and agent-document task. Native macOS and Windows acceptance remains platform-specific and is outside this task.
