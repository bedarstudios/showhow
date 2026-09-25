# Copilot cloud pilot

## Scope and authority

Showhow is the first pilot. One approved Linux-verifiable issue, one active run,
one corrective dispatch and at most two external review cycles. Human merge.
The controller must preserve exclusive cloud ownership using `overnight` before
`ready-to-implement`, then reject a racing local claim. OS prerequisite:
https://github.com/bedarstudios/OS/issues/14.

Required profile: targeted issue test, `npm run lint`, `npm run branding:check`,
`npx tsc --noEmit`, `npm run test`, `npm run test:browser`, `npx vite build`.
Run these in hosted Linux and retain current-commit results. The setup workflow
must reach main before a real Copilot task. Linux results prove no native capture
or macOS permissions behavior.

## Observed readiness, 2026-09-25

- GitHub API lists `copilot-swe-agent` as assignable in this repository.
- Signed-in account billing UI: Copilot Pro; 96/1,500 included credits used;
  additional usage not enabled. Actions and all AI-credit SKU budgets are $0
  with Stop usage Yes. No billing settings changed. Recheck before dispatch;
  these observations are a dated snapshot, not a permanent guarantee.
- Baseline main: c8b4b67c2a5bfe3e3d007f131262f2bbab36761b.
- Cloud setup, implementation, independent review, corrective pass and scheduled
  dispatch: not yet observed. No successful pilot is claimed.

## Nightly rollout

After the manual pilot passes, enable one daily 03:00 Europe/London selection of
explicitly approved, labelled eligible issues. Continue the same run/PR through
review; never restart a reviewed or blocked ticket merely because another night
arrived. Preserve paid-overage stops and human merge authority.

The disabled controller adds periodic reconciliation only. Daily admission is
not scheduled or enabled by this change.

## Controller implementation and verification

The controller is `.github/scripts/overnight-cli.mjs`, backed by admission,
GitHub adapter, review evaluator, durable dispatch and reconciliation modules.
Policy is `.bedar/overnight.json`; it starts disabled with no approvals. Run
records are bot-authored comments on #86, serialized by the workflow concurrency
group. Reservation and metered-action intent are written before assignment,
review requests or corrective comments. Ambiguous delivery is never retried
blindly. Blocked/reviewed records retain ownership until human resolution/merge.

The trusted controller runs only from main and never installs project packages
or executes candidate code. `BEDAR_LOOP_PAT` is used only in that job for the
provider and user Project reads; ordinary state writes use `GITHUB_TOKEN`.
Candidate tests have a separate read-only job, no persisted checkout credential,
and no controller secret. Board sync remains the sole Project writer.

The approved profile must include `scopeDigest` (SHA256 of the exact issue body),
`approver`, `source`, `profile: linux-portable`, `allowedFiles`, `targetTest`,
`evidenceFile` and `dependencyCommits` (full merged commit SHAs, or an explicitly
empty array when the standalone scope has no code dependency). Record verified
OS deployment and a bounded billing-verification expiry before enabling starts.

Commands:
- `node --test .github/scripts/overnight.node-test.mjs .github/scripts/overnight-review.node-test.mjs .github/scripts/overnight-reconcile.node-test.mjs .github/scripts/overnight-evidence.node-test.mjs .github/scripts/overnight-github.node-test.mjs`
- After npm ci: `node --test .github/scripts/overnight-evidence-integration.node-test.mjs`
- Local controller invocation defaults to dry-run. Mutating modes require a
  trusted main-branch Actions environment. Manual workflow input `start` requires
  an exact approved issue number. Scheduled ticks currently reconcile only.

The worker commits a minimal interface stub plus genuinely failing behavioral
assertion, then implements its fix and records the red SHA in the approved JSON
evidence path. Cloud evidence CI reruns the identical test at red and final head.
It requires failed assertion results, not import/setup errors. Existing CI still
runs all required suites against the PR's candidate content. Review acceptance
requires the dedicated Copilot reviewer on the current head, no current unresolved
threads, and an affirmative no-comments summary; ambiguous summaries block.

Observed 2026-09-25:
- OS ownership PR: https://github.com/bedarstudios/OS/pull/15 — nine local boundary
  scenarios and independent review passed; deployment still pending human merge.
- Environment PR: https://github.com/bedarstudios/showhow/pull/84 — hosted setup
  https://github.com/bedarstudios/showhow/actions/runs/36078284326 and CI
  https://github.com/bedarstudios/showhow/actions/runs/36078284275 passed on
  7d1d87fe654b2558b73b6f5cd65b15c65c312fa0.
- Controller checks passed locally (57 native tests), including API-shaped response fixtures and a
  real Vitest red/green replay in an isolated temporary git repository. These are
  infrastructure checks, not a successful product pilot.
- Live GitHub responses expose both bots as `Copilot`; immutable Bot IDs separate
  implementer 198982749 from reviewer 175728472. Dismissed reviews, draft resets
  and changed CI bases invalidate prior success; regression tests cover these.
- Live read-only snapshot correctly reports #83 has no closing implementation PR
  and no Project membership. A mere mention from PR #84 is not an implementation.
- Existing Board Sync run 36079618610 failed with `Bad credentials` for its
  existing secret. Credential refresh and successful board sync are prerequisites
  for dispatch; no substitute broad local credential was copied into Actions.

Pending: merge prerequisites, deploy OS protection, approve #83's exact scope,
refresh the existing controller/board token, verify board membership, test and
merge this disabled controller, then activate and observe the manual pilot.
Nightly starts and the first actual overnight result remain unverified.

## Review corrections, 2026-09-25

Correction instructions now require the full targeted/lint/branding/type/unit/
browser/build profile on the final corrected commit. Active ownership requires
an open issue with exactly the implementer bot assigned; human co-assignment,
removal of the bot, and missing assignee data fail closed. Approval removal or
digest replacement is persisted as a blocked run before PR inspection, so the
controller can project needs-human and continue reconciling other records.

The assignee regression initially accepted a human co-assignee; both revoked-
approval regressions initially threw without saving blocked state. All 60 native
controller checks pass after these fixes. Hosted validation remains the authority
for the current PR head; none of these tests proves an actual cloud pilot.
