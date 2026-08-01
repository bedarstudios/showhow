# AFTER — issue #26

Environment: macOS, Electron dev app, ticket worktree at the final implementation.

- [passed] All six real workflow steps rendered, including screenshotless redactions
- [passed] Inline title edit persisted to `meta.json`
- [passed] Inline instruction edit persisted to `steps.json` and `steps.md`
- [passed] Local reveal left `steps.md` redacted by default
- [passed] Per-step opt-in persisted and included only that label in `steps.md`
- [passed] Step deletion reduced `steps.json` and regenerated `steps.md`
- [passed] Deleting an earlier step cleared local reveal state safely
- [passed] Unselected redacted steps remained hidden in the UI and Markdown
- [passed] Verification bundle files were restored byte-for-byte after capture

`after.png` shows the edited instruction, Edit/Delete controls, one revealed step with its
explicit Markdown checkbox enabled, and another step still hidden by default.
