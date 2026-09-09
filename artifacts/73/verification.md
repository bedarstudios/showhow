# Issue 73 verification

Base: `493965eb7174c231f6689c359a632b4dad1c6e8e`, macOS, 2026-09-08.

- [passed] Recovery copies match source bytes; SHA-256 provenance is recorded.
- [passed] Old lane has only the supplied three-file dirty diff.
- [failed] Current-base RED: the granted focused Vitest command exited 1 (1 failed, 49 skipped).
  After the deferred title save resolved, the saved title was present but `Newer step label` was absent
  at `RecordingLibrary.test.tsx:440`. This is the expected stale-entry assertion failure, not a
  config or fixture error; complete output is in `red-tests.txt`.
- [passed] Current-base Studio BEFORE and patched AFTER were observed in real IPC.

Historical evidence is separately attributed in `historical-52/README.md`.

- [passed] Recovered test diff matches historical patch byte-for-byte.
- [passed] Production file remains unchanged against merged base 493965e.

- [passed] Pre-fix GUI: newer step visible and persisted while title pending.
- [passed] Late title reverted UI step; disk retained newer step and title.
- [passed] Removed QA delay; production bytes restored to base source hash.
- [passed] All 506 original hashes unchanged; QA-only cleanup restored dirs.
- [passed] Owned runtime PIDs exited; ports 5173/8765 have no listeners.
- [passed] GUI slot released with 202 MiB free, above the 100 MiB floor.
- [passed] Recovered production patch matches historical +9/-1 exactly.
- [passed] Focused RecordingLibrary tests exited 0; see green-tests.txt.
- [passed] Portable TypeScript exited 0; approved read-only ws fallback.
- [passed] Targeted Biome exited 0; four changed source/config files.
- [passed] Full unit suite exited 0; full output in full-unit.txt.
- [passed] Scoped source/scripts/CI Biome exited 0; full-source-biome.txt.
- [passed] Fresh patched GUI retained newer step while real title IPC pending.
- [passed] Late real title completion kept newer step in patched UI and disk.
- [passed] Cache-busted served source has no QA delay and keeps title-only merge.
- [passed] Ordinary real save showed success and retained newer step on disk.
- [passed] AFTER shutdown left no owned PIDs/listeners; 190 MiB free.
- [passed] AFTER cleanup retained 506 original hashes and full directory inventory.
- [untested] Unrelated exporter browser tests are CI-only per coordinator scope.
