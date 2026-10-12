# Project handoff

Updated: 2026-10-12 (session wrap-up)

## In flight

Step 2 of `NEXT-SESSION.md` (design the full experience), on local branch `design/full-experience`. The branch is not pushed; the repository is public, so the owner decides before any push.

- Step 1 is done: the upstream v2 assessment in `docs/research/` was refreshed.
- Unknowns-pass interview is done; answers are in `.agents/decisions.md` (2026-10-12, step 2 interview).
- A throwaway flow mock was built and checked in Chrome (28 screens, no console errors, four click-paths pass): `design/mocks/2026-10-12-full-experience-flow/index.html`, spec `SPEC.md` beside it.
- Owner reaction (2026-10-12): "The designs need more work." Specifics were not yet given.
- The repository cleanup is done (decision log, 2026-10-12).

## Next action

Ask the owner what is not working in the mock: structure, visual feel, or specific screens, plus any reference. Run one revision round on the mock (spec by Claude, build by Codex GPT 6.1 Sol in a right-hand Herdr pane). Then do the assumptions sign-off and get the owner's explicit confirmation before putting anything into `design/showhow.pen`. Tidy the Pen file's "OLD · …" frames as part of step 2.

## Open decisions

- Cursor packs: remove the 17 bundled third-party packs from shipped builds, or find redistribution terms for each first. This blocks release.
- Rebuild on upstream v2 after step 2: confirm once the design is approved. A rebuild needs an `UPSTREAM.md` policy change and a migration plan for bundles, legacy project-file compatibility and `<video path>.cursor.json`.
- The three confirmed macOS recorder fixes are on hold: v2 already contains them, so port them only if the rebuild does not happen.
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
