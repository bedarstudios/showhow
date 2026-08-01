# Issue #27 BEFORE evidence

Environment: macOS, Electron development build at `a8bcc3fe1c765b083f73d55cc110f1d62a4ef9bc`.

Observed in the recording library using the preserved bundle
`2026-07-23_001514-recording`, which has a valid recording but no `steps.json`:

- The detail view shows the recording title, folder path, Copy path action, and video area.
- The entire workflow-document area is blank.
- There is no approved empty state or Create workflow doc action.
- There is no generating state, retryable failure state, or fallback explanation.
- Companion-unpaired and accessibility-denied degradation are not explained in this view.

`before.png` captures this genuine pre-change gap before any source edit.
