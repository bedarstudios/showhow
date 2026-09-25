---
name: overnight-ticket
description: Implement one explicitly approved, Linux-verifiable Showhow cloud ticket and return commit-specific evidence for independent review.
---

# Approved cloud ticket

## Establish scope

Read the issue and its recorded scope approval. Match the approval digest to the
current issue scope. Confirm the task's base, allowed files, acceptance commands
and exclusive cloud ownership. Missing or conflicting approval/ownership is a
blocker. Use the existing PR for a corrective dispatch.

Run `node --version`, `npm --version` and the targeted check to confirm the
configured environment. Failed dependency installation, missing tools and a
missing setup success marker at `/tmp/showhow-copilot-setup-ok` are setup blockers,
not evidence of a product regression. Resolve setup before implementation.

## Implement and prove

1. Identify the downstream assumption that makes this change safe, then choose
   a check that actually exercises it.
2. Add a behavioral test with independent expected results. Observe the relevant
   assertion fail before the fix. For a new module, introduce only the minimum
   interface stub needed to reach the behavioral assertion; an import error is
   insufficient evidence. Record command, failure and source revision.
3. Implement only the approved scope. Run the targeted check, then required
   lint, branding, type, unit, browser and renderer-build checks. Record actual
   exit results; a timeout or skipped job is not a pass.
4. Leave a short PR record: change, reason, before/after evidence, tested commit,
   commands and limitations. Preserve logs in GitHub run artifacts or committed
   text evidence inside the issue's allowed paths. Keep credentials and personal
   data out of evidence.

The pilot allows portable code only. Native capture, platform permissions and
visual acceptance require their real target environment; return a blocker when
those are required. Preserve existing tests and acceptance requirements.

## Exit and correction

Return a PR for separate Copilot review and human merge. For a correction,
address the supplied findings on the same PR, rerun affected checks and report
the new commit. The controller owns dispatch/review limits and scheduling.

Leave policy, workflows, instructions, `.bedar`, release/signing configuration and
native helpers unchanged unless this is an infrastructure ticket explicitly
allowing those paths. Never merge, release, deploy, close the issue, create a
second implementation task or fall back to local agents.

Evidence conventions adapt the safety-assumption and decision-trail ideas from
pstack at fadd23794c0075468eb8964b0fd93e06e09486ad; no Cursor tools or plugin runtime
are required. Product rules remain in `AGENTS.md`.
