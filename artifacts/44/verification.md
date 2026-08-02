# Issue #44 verification

Environment: macOS 26.5.2 (25F84), Apple silicon, Showhow 1.6.0 arm64

- [passed] Canonical arm64 and x64 apps and DMGs built with Node 22.22.1.
- [passed] Arm64 DMG checksum and app deep signature verification passed.
- [passed] Installed app bytes matched the arm64 packaged application.
- [passed] Dock launch loaded the packaged app.asar without a dev server.
- [passed] Screen Recording granted to the exact installed application.
- [passed] Accessibility granted to the exact installed application.
- [passed] Native ScreenCaptureKit recording produced a 3.59-second MP4.
- [passed] Folder bundle contains video, metadata, cursor data, and doc files.
- [passed] Library displayed the recording and transcript-only workflow doc.
- [passed] Copy path matched the selected recording bundle directory.
- [passed] Replacement preserved recording, project, and user-data hashes.
- [passed] Unit suite passed: 87 files and 700 tests.
- [passed] Browser suite passed: 2 files and 6 tests.
- [passed] TypeScript, lint, i18n, branding, docs, and diff checks passed.

Packaged acceptance bundle:
`~/Showhow/Recordings/2026-08-02_162926-recording`

Artifact hashes:

- `before.png`: `497d33ed2f3647c8c96a591f26bf31b87af1842dac75a13a20aedcbb78f2846c`
- `after.png`: `77ba499a8da2731abdcb8270c0aacb1c6260354650bc78507aa0accf5c897d6c`
