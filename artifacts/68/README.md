# Issue 68: Studio media seeking

## Baseline and original preservation

The coordinator reproduced the failure in installed Showhow 1.6.0 on macOS on
2026-09-07, before this lane changed production code. Activating workflow
0:13/0:18 or the native scrubber reset playback to 0:00. Sequential playback
worked. DevTools reported duration 18.933333 and seekable `[[0,0]]`.

A real request with `Range: bytes=0-99` returned 100 bytes with status 200 and no
Content-Range or Content-Length. `before-seek-diagnostics.jpg` preserves the
actual installed-app screenshot; `before-seek-reset.jpg` and
`before-studio-step-seek.jpg` preserve the corresponding UI evidence. Originals
came from `/tmp/showhow-audit-20260907.8QcChm` and were copied unchanged.

The original bundle is
`/Users/mohamedb/Showhow/Recordings/2026-09-07_205623-recording`.
All nine files were copied to this lane's ignored
`.local/issue-68/Recordings/2026-09-07_205623-recording` before implementation.
`original-sha256.txt` records hashes verified against that copy. CLI tests use the copy. The coordinator requires real Studio verification to
read the original safe Calculator bundle using the existing home path; no edits,
deletion or regeneration are needed. Quit the installed app cleanly before dev
launch, never run both against shared user data, and recheck original hashes
afterwards. Do not override HOME or introduce production-only testing hooks.

## Scope and verification contract

The fault is at the media protocol boundary: `fetchShowhowMedia` returns
Electron's file-fetch response unchanged. The existing mock supplies a 206
itself, so the test cannot detect the observed 200 response without metadata.

Implement an explicit streaming response for approved bundle media with correct
full/partial lengths, inclusive byte bounds, 206 and Content-Range for accepted
ranges, and safe rejection of unsatisfiable ranges. Cover open-ended and suffix
ranges, oversized ends, malformed/multiple ranges, empty files, bounded streaming
and cancellation. Preserve MIME types for video and screenshots. Reject unsafe
URLs, malformed encoding, path traversal and symlink escapes; never read entire
videos into memory.

Run genuine failing same-package regressions before production edits. After the
fix run targeted and affected tests, TypeScript and Biome. Test/build and GUI
slots are serialized by the main coordinator. No dependency installs are
permitted; the lane uses the existing main-checkout node_modules symlink.

Real Electron acceptance must drive workflow timestamps and native scrubber,
observe playback position, exercise seeking before/after metadata load, verify
sequential playback and screenshots, and record the actual range response.
Capture meaningful AFTER screenshots and write observed verification assertions
as checks run. Tests alone do not complete the ticket.

References: [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol)
and [HTTP range semantics, RFC 9110 section 14](https://www.rfc-editor.org/rfc/rfc9110.html#section-14).

## CLI results

`red-tests.txt` preserves the genuine original failures (2 failed, 3 passed),
including an initial local config-loader setup error and its correction.
`green-tests.txt` retains the first patch's two trust failures (31/33 passed)
and the corrected result (33/33 passed). `affected-tests.txt` records 202 passing
tests across eight files, and `typecheck.txt` / `biome.txt` record successful
checks. The final protocol uses 64 KiB reads, approves only canonical bundle
video files and direct raster screenshots, and enforces canonical bundle/root
containment. `verification.md` is the final observed assertion list.

## Real Electron acceptance

The verified code commit is `e62d394`. The dev process was PID 43581 with this
lane as cwd and renderer `localhost:5178/?windowType=library`. The prior lane
app was quit cleanly before launch. The unrelated ticket 52 Electron process
remained untouched. `runtime.txt` records exact launch, measurements, original
hash verification, and clean shutdown; no source bundle was edited.

Native computer use activated workflow 0:13 and 0:18 and the video scrubber.
DevTools measured 13.197s, 18.516s and 9.466666s respectively, and the seekable
interval was `[0, 18.933333]`. The actual range fetch returned 206,
`Content-Range: bytes 0-99/1621607`, `Content-Length: 100`, and 100 body bytes.

The early-metadata case temporarily removed only the video element's source,
called `load()`, clicked the actual workflow timestamp at readyState0, then
restored the same URL. It reached 13.197s at readyState4. Native scrubber Home
and Play then played the entire recording to 18.933333s with ended=true and
no media error. All three screenshots decoded successfully.

AFTER evidence: `after-scrubber.png` shows native player position plus runtime
range/seek diagnostics. `after-range-and-seek-13.png`, `after-seek-18.png`,
`after-early-metadata.png`, and `after-full-playback.png` preserve the other
observed checkpoints. BEFORE and AFTER files are committed and also attached
inline to the issue/PR as explicitly requested.

No packaging, new recording, source regeneration, dependency install, or HOME
override was performed. Vite's normal dev launch compiled the Electron main
and preload and used a 42 MiB local optimizer cache. Disk remained above
300 MiB during verification. TypeScript used the coordinator's temporary
read-only ws declarations; the checked-in manifests and shared dependencies
were not modified.
