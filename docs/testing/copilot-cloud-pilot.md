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

The scheduler and controller are a subsequent change. This environment PR does
not schedule or assign any work.
