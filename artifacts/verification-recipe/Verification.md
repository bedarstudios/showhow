# Showhow #102 verification evidence

This is macOS native evidence from the isolated ticket lane. Final acceptance runs `native-08` and `native-09` passed using identical driver bytes (SHA256 `616061302965e26e512749a735ad8b2888d224367edcd16495795d159ea22169`). Actual source hashes are recorded in each result. The production renderer GIF encoder and `write-export-to-path` handler remain intact. Only `pick-export-save-path` chooses the private synthetic destination.

- [passed] Baseline recipe and npm command were absent before implementation.
- [passed] Existing GIF E2E removes the writer and captures bytes in main memory.
- [passed] Five intended behavior assertions reached RED before implementation.
- [passed] Focused negative/helper tests passed 9/9, including real CLI doctor.
- [passed] `npm ci` and `npm run build-vite` exited zero in the lane.
- [passed] Two fresh native runs opened the synthetic editor and exported a GIF.
- [passed] Actual runtime paths and both lock PID files were private and owned.
- [passed] Native first load lacked WebCodecs; one reload exposed both APIs.
- [passed] Production completion toast and actual filesystem output were observed.
- [passed] GIF: 1280×720, 30 decoded frames, 2.1 seconds, 6,199,282 bytes.
- [passed] Full independent FFmpeg decode exited zero with no decoder errors.
- [passed] Both fixture hashes equal `34e62f67d3d9dd50ea7fa0b76cbfe7ed568ddb4be2d6b0a63513d2a97dda95d6`.
- [passed] All observed owned processes were gone; private run roots were removed.
- [passed] Executor inspected synthetic editor, completion and decoded GIF images.
- [untested] At the initial source handoff, full CI and review remained next gates.
  The completed lead checks are recorded below; independent review follows them.

## Commands and exits

All installs, builds, tests and native invocations used `ruby ~/.local/bin/bedar-runtime.rb run --resource heavy --` and the exact PATH prefix `$HOME/.nvm/versions/node/v22.22.1/bin:$HOME/.npm-global/bin:$PATH`. No command returned queue exit 75.

| Command after the heavy wrapper | Exit | Evidence |
| --- | --- | --- |
| `npm ci` | 0 | `npm-ci.txt` |
| `node --test scripts/verify-showhow-export.node-test.mjs` (prerequisite RED/GREEN) | 1 / 0 | `red-prerequisites.txt` / `green-prerequisites.txt` |
| Same focused command (collision RED/GREEN) | 1 / 0 | `red-collision.txt` / `green-collision.txt` |
| Same focused command (cleanup/fixture RED/GREEN) | 1 / 0 | `red-cleanup.txt` / `green-cleanup.txt` |
| Same focused command (corrupt bytes RED/GREEN) | 1 / 0 | `red-corrupt.txt` / `green-corrupt.txt` |
| Same focused command (independent decoder RED/GREEN) | 1 / 0 | `red-decode.txt` / `green-decode.txt` |
| `npm run build-vite` | 0 | `build-vite.txt` |
| `node --test scripts/verify-showhow-export.node-test.mjs` (final 9 tests) | 0 | `focused.txt` |
| `./node_modules/.bin/biome check --write scripts/verify-showhow-export.mjs scripts/verify-showhow-export.node-test.mjs package.json` (final formatting) | 0 | `format.txt` |
| `npm run verify:export -- --evidence-dir artifacts/verification-recipe/native-01` | 1 | `native-01/result.json` |
| Same command, fresh `native-02` directory | 1 | `native-02/result.json` |
| Same command, fresh `native-03` directory | 1 | `native-03/result.json` |
| Same command, fresh `native-04` directory | 1 | `native-04/result.json` |
| Same command, fresh `native-05` directory | 0 | `native-05/result.json` |
| Same command, fresh `native-06` directory | 0 | `native-06/result.json` |
| Same command, fresh `native-07` directory | 0 | `native-07/result.json` |
| Same command, fresh `native-08` directory | 0 | `native-08/result.json` |
| Same command, fresh `native-09` directory | 0 | `native-09/result.json` |
| `ffmpeg -v error -i artifacts/verification-recipe/native-06/export.gif -frames:v 1 artifacts/verification-recipe/native-06/decoded-frame.png` | 0 | `decoded-frame-command.txt`, `native-06/decoded-frame.png` |

Runs 05 onward set `SHOWHOW_VERIFY_HARNESS=codex-api-executor`; shell role variables were not set for these invocations. `role-shell.txt` separately records the actual executor role-env shell probe: Node22.22.1/npm10.9.4/Codex0.160.0, resolved executables and ZDOTDIR. It is not evidence that this API worker ran a native Codex profile. Exact normalized role-launch command and that limitation are in `implementation-notes.md`.

## Failed attempts and corrections

01 failed at isolation inspection: Playwright main evaluation cannot dynamically import Node modules. The generated isolated bootstrap now owns that inspection. 02 timed out waiting for a completion dialog. 03 diagnosed undefined first-load WebCodecs APIs; the existing GIF E2E's one editor reload exposed both APIs in 04. 04 still timed out because production `VideoEditor.tsx` finally immediately closes ExportDialog and clears progress. The actual completion UI is the `GIF exported successfully` toast, observed concurrently with the real file in subsequent runs. None of these earlier failures was relabelled successful. All failed native attempts left the fixture unchanged, removed their run root and reported zero surviving observed owned processes.

05 first passed the actual journey. Its completion screenshot contained an ephemeral absolute temp path and is preserved privately at the lane's `git rev-parse --git-path verification-private/native-05-complete.png` location. 06 and 07 passed identical encoder/decode/cleanup boundaries, but 07's moving toast escaped part of its screenshot mask. Its original completion image is likewise private at `verification-private/native-07-complete.png` in lane git metadata. Final 08/09 screenshot capture disables toast transitions and masks/hides only the path description during capture; application behavior and media output are unchanged. Other retained images contain only the synthetic journey.

## Independent media validation

The driver invokes ffprobe with `-v error -count_frames -select_streams v:0 -show_entries stream=width,height,nb_read_frames,duration:format=duration -of json <owned-output>`. It separately invokes FFmpeg with `-v error -xerror -i <owned-output> -f null -` and requires exit zero. Final results retain the probe output, decoder command, exit, stdout/stderr, media signature/size/bounds/hash, source SHA/dirty state/file hashes, actual runtime paths (sanitized after containment checks), and observed PID birth times plus cleanup outcomes. The real exported GIF's SHA256 is `6b424e8231641f8f1f2b0c816418a12314e8cefe0370289584380a47b7c83d66`.

Text paths are normalized as `<home>`, `<repo>`, and `<run>` for publication; exact path containment was checked at runtime before normalization. Evidence JSON may be formatted for repository lint without changing any observations. Native console warnings about the inherited development renderer configuration are retained; no security settings were changed to obtain acceptance.

## Limits

This proves synthetic editor load, production renderer GIF export, real filesystem save, independent full decode and isolated cleanup on this macOS machine. It requires the observed first-load editor reload. It does not prove recording permissions, recording bundles, native save-dialog interaction, MP4, packaging, Windows or Linux. No personal recordings, default profile, source fixture, production code, dependencies, global skills, HOME or OS permissions were changed.

## Lead CI completion

The following checks ran sequentially through the heavy wrapper with Node 22.22.1/npm 10.9.4. Each command's output and exit was recorded immediately in the accompanying result JSON and log. `ci-attempt-01` preserves the branding failure; `ci-attempt-02` preserves the cold browser failure and the single warm-cache diagnostic. Both failures remain failed records.

- [passed] `npm run lint`: exit 0; one unchanged empty-block warning.
- [passed] `npm run branding:check`: exit 0 after exact-line classification.
- [passed] `npx tsc --noEmit`: exit 0.
- [passed] `npm run test`: exit 0; 96 files and 822 tests passed.
- [passed] Evidence integration Node test: exit 0; one test passed.
- [passed] `npm run test:browser:install`: exit 0.
- [passed] Fresh cold browser suite: exit 0; 8 files and 17 tests passed.
- [passed] `npx vite build`: exit 0.
- [passed] Cloud controller Node suites: exit 0; all 75 tests passed.
- [passed] Lead independently viewed final native completion and decoded GIF images.
- [passed] Final driver, test and package hashes still match native 08/09.

The browser suite retains its existing one skipped test/file. A cold optimizer reload initially invalidated the fonts test import; a single warm diagnostic passed. The scoped correction adds only the 15 imports named by that observed optimizer message. The previous lane cache was renamed intact, and one fresh-cache run passed without a dependency reload. See `browser-correction/result.json` and `cold-browser.txt`. This changes browser test setup, not product behavior or dependency versions.

`ci-attempt-02/result.json` links the first six passing checks and the failed browser run. `browser-correction/result.json` links the corrected cold browser pass. `ci-final/result.json` links the remaining build and 75-test cloud suite on source commit `03897af59b04e562662b37fd8dcee0fb64da07ff`. Branding's four policy regression tests passed separately; the scanner was unchanged. Translation files did not change, so conditional i18n checking is not applicable. Conditional cloud-evidence CI is not applicable to this local ticket branch; semantic PR title validation and current-head GitHub CI are required after PR creation.

## Independent review

- [passed] Fresh independent Standards review: zero blockers.
- [passed] Fresh independent Requirements review: zero blockers.

Pinned candidate and reviewed evidence are recorded in `Review.md`. Preserved raw-log whitespace is nonblocking. This follow-up commit adds only review records; driver, tests, package commands and browser configuration remain unchanged. Current-head GitHub CI is the final Ship check.
