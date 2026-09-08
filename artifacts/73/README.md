# Issue 73: preserve newer workflow state on late title save

Base: `493965eb7174c231f6689c359a632b4dad1c6e8e`.

The recovered production correction adds a dedicated title callback that maps
current entries and merges only title into the matching bundle. It preserves
newer steps/video, does not insert missing entries, and leaves the generic
step/generation replacement callback unchanged. False or rejected IPC never
calls the title callback. Navigation feedback retains the mounted-instance guard.

## Evidence provenance

`historical-52/` contains read-only copies from the preserved old lane at
`8b1c367`, including its uncommitted patches. Its screenshots show fixed code
before/after title completion. They are not issue73 pre-fix evidence. See its
README and copy-provenance.json.txt for exact source attribution.

Fresh `red-tests.txt` contains the expected late-title failure on issue73 base,
plus an explicitly identified wrapper retry to record the actual test exit.
`green-tests.txt` records all50 focused tests passing after the exact recovered
patch. `typecheck.txt` and `biome.txt` record the subsequent successful checks.

Fresh real Studio evidence:

- `before-title-pending.png` and `pending-disk.json.txt`: merged-base runtime showed
  the newer step before the delayed genuine title IPC completed; disk still
  had the old title and already had the newer step.
- `before.png` and `resolved-disk.json.txt`: after title completion the UI reverted
  the step, while the saved JSON and Markdown retained the newer instruction.
- `timing-miss.png`: the first attempt completed the title before the step was
  saved. Retained as a disclosed timing miss, not a failure reproduction.

The renderer delay was20seconds, conditional on the exact owned QA A path,
immediately before genuine title IPC. No results or writes were mocked. All
interactions used native Computer Use. The new original inventory has506files,
45 top-level directories and90recursive directories; hashes all matched after
QA-only cleanup. The normal Showhow user-data profile was used, so no claim of
profile isolation is made. `runtime.txt` records processes, URL, source proof,
shutdown, and the immediate post-removal HMR-cache caveat. Source was restored
exactly before applying the recovered correction.

Fresh AFTER verification passed in a new Electron process. `after-title-pending.png`
and `after-pending-disk.json.txt` show the newer step before title completion;
`after.png` and `after-resolved-disk.json.txt` show it retained afterward. A
cache-busted request then proved the QA delay absent from served source, and
`ordinary-save.png`/`ordinary-disk.json.txt` show ordinary real save success.
The fixed source hash was restored exactly, all506original hashes matched,
owned QA directories were removed, and all owned processes/listeners exited.

Full unit suite:87files and750tests passed (27.04s), no skips. Scoped Biome:
408files passed with one pre-existing deferredClick.test.ts empty-block warning.
TypeScript and targeted Biome had already passed with unchanged source/config.
The unrelated exporter browser suite is CI-only; no library browser test exists.

Raw JSON evidence uses a `.json.txt` suffix to preserve original bytes through
normal source/config pre-commit checks. It remains parseable JSON, and source
paths in copy-provenance retain their original names. No historical source file
was reformatted or edited.
See `verification.md` for observed results and `gui-plan.md` for planned checks.

## Portable check commands

Run from this checkout with matching declared dependencies already available:

```sh
node node_modules/vitest/vitest.mjs run --config artifacts/73/vitest.config.ts --configLoader runner --no-cache --maxWorkers=1 src/components/library/RecordingLibrary.test.tsx
node node_modules/typescript/bin/tsc --noEmit -p artifacts/73/typecheck-config.json
node node_modules/@biomejs/biome/bin/biome check src/components/library/RecordingLibrary.tsx src/components/library/RecordingLibrary.test.tsx artifacts/73/vitest.config.ts artifacts/73/typecheck-config.json
```

The Vitest config preserves the repository test contract and resolves paths
from its own URL with a lane-local cache. TypeScript first uses the declared
`node_modules/@types/ws`; only when absent it can use the ignored local fallback
`.local/issue-73/types/ws`, linked read-only to the coordinator-supplied
`/tmp/showhow-ticket66-types/ws`. No dependencies were installed or stubbed and
no checks disabled. Normal installed checkouts need no fallback.
