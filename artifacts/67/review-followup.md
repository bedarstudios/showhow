# PR72 review follow-up

Starting head:32ef35647a265b3aad3017f4004907b59bc63c1e.
The paginated reviewThreads query returned exactly two unresolved threads;
both thread and comment pageInfo.hasNextPage values were false.

- PRRT_kwDOTWWnWc6gB7NR: source-quality4K dense text/motion encoder coverage.
- PRRT_kwDOTWWnWc6gB7NU: machine-specific always-on encoded-size ceiling.

Both are valid validation gaps, not demonstrated production failures. The
subsequent unchanged-head5/5 summary explicitly retains both concerns; it
is not sufficient for completion. Original Calculator50% absolute reduction
and committed actual app evidence remain acceptance requirements.

Existing Ubuntu CI run34163156851:
- Unit704 pass,1skip; Build and Type Check pass.
- Lint:14 owned JSON artifacts need formatting; one unrelated empty-block warning.
- Semantic title fails; title corrected to fix(export):... (rerun pending).
- Browser:2timeouts,5pass,1skip. Hardware unavailable then software fallback;
  Vite dependency reload occurs during execution. No encoded-byte assertion
  failure was observed. Keep this distinct from the portable-ceiling concern.

Verifier owns normal browser config corrections: locked provider4.1.5 exposes
launchOptions, not launch. Explicit browser-test dependency scan/prebundle,
serial file execution and a local cache outside shared node_modules are
prepared. Linux uses ANGLE SwiftShader; Mac uses Metal. Execution awaits slot.
Executor owns paired real-encoder size regression and native4K quality tests.
No speculative bitrate change, dependencies or native capture changes.

Portable size proposal: compare computed-budget output with the old20Mbps
control on the same encoder/run/fixture, preserving format/audio/dimensions.
Keep the measured779446B/s Mac bound in opt-in acceptance evidence, without
presenting it as a universal encoder bound. Verify real RED on restored old
settings in a reversible controlled mutation, then GREEN on current settings.

High-resolution proposal: at most1s60frames native3840×2160 source text/motion,
not an upscaled1080 fixture; real source-quality settings and exported decoded
text-region quality against known reference, including a deliberately degraded
negative control. Metrics/negative controls must justify readability thresholds.
No unsupported-platform pass/skip can be called crossplatform quality evidence.

Runs remain slot-gated, no generated fixtures before approval. No installs or
shared writes; stop new writes below100MiB. PR72 and issue67 move together back
to needs-review when pushed; no merge. Watcher remains registered unchanged.

## First bounded local batch

Format22files passed with all JSON values preserved; isolated TypeScript passed.
Injected legacy module from7b88854 produced two identical4,374,070-byte outputs.
RED initially stopped at requested-budget guard; actual-byte comparison now
precedes it so next RED must establish encoded-output failure directly. The
production hash stayed669c2c342a54d5a9c389ab2b2daf7c97608a922f4733e131b484c1c8eeb80c4c.

Native4K source fixture1,350,183bytes; output1,954,941bytes at14.4Mbps,
3840×2160/60fps/1s. Frame15 quality measured40/42 known glyphs, minimum
contrast ratio0.7525; intentionally blurred control2/42 and0.0859. GREEN
failed; this result is preserved and not reclassified from visual inspection.

Reference/decoded crops look very similar/readable to verifier and coordinator,
while blurred is visibly unreadable. This observation does not prove oracle
mismatches false. Scorer currently compares both rows to first-row templates;
fractional padding scaling may change their raster phase. An exact unencoded
reference test and per-glyph coordinates are prepared, with a row-matched
comparison for diagnosis only. No threshold or production budget change.

Geometry:21cells×2rows=42. Frame15 cell x coordinates span94..729 (24px wide),
y72/1263 (30px high); all cells are inside3840×2160. Original visualcrop672px
included clipped beginning of next repeated0 beyond the scored grid. New sink
usesceil(21×32×0.992)=667px; original crops/logs preserved with suffixes.

### Same-encoder control diagnostic: incomplete at resource cap

- [passed] Targeted Biome and isolated tsc exited 0 (suffixed logs).
- [passed] Unencoded reference: 42/42, contrast ratio 1 at frames 15 and 45.
- [failed] 80 Mbps control exceeded 5 MB cap: 5,238,219 bytes.
- [untested] Control decoded scores/config identity: cap stopped before checks.
- Candidate 14.4 Mbps output: 1,954,941 bytes; frame 15 (0.25 s) and
  frame 45 (0.75 s) each scored 40/42 with unchanged first-row templates.
  Frame 15 row 30 mismatches: B→8 at (443,1263), E→8 at (538,1263).
  Frame 45 row 30 mismatches: D→0 at (536,1263), E→8 at (568,1263).
  All rectangles are 24×30. Contrast ratios: 0.752525 and 0.839024.
  Diagnostic matched-row templates scored 42/42 at both times; this alone
  does not distinguish bitrate loss from classifier sensitivity.
- Fixture SHA256: 1c254d14ac3faa813829e2544309d110d980c0be823ec8d7250bd8a62d92b135.
- Vitest PID 84190 exited 1 in 14.1 s. Runner accepted expected exit 1, but
  manual classification is incomplete diagnostic/resource-cap failure, NOT
  expected quality RED. Only two of four decoded measurements exist.
- Six small crops and explicit JSON preserved, including earlier failures.
  No output MP4 was persisted. Production SHA256 remains
  669c2c342a54d5a9c389ab2b2daf7c97608a922f4733e131b484c1c8eeb80c4c.
  Process inspection found no remaining Vitest/Vite/runner; slot released.
- Next diagnostic needs a separately approved resource-bound adjustment;
  no scorer, threshold, production budget, or branch update is justified yet.

### Prepared 64 Mbps control and row-template rationale (not run)

The measured 80 Mbps output was 5,238,219 bytes. A 64 Mbps control is 20%
lower, still 4.44 times the candidate 14.4 Mbps budget. Proportional output
would be 4,190,575 bytes, about 16% below the unchanged 5 MB cap; VBR need
not scale proportionally, so the cap remains enforced and no retry is implicit.
This is a higher-budget comparison, not a claim of losslessness. The original
1 s fixture, SHA, two sample times and scoring remain unchanged. The runner
now requires four NEW measurement files and checks identical source hashes,
encoder identities excluding bitrate, timestamps, size bounds and blur rejection.

Why row-matched templates have a geometric basis: with padding=2, scale=.992
and vertical offset=8.64, row0 starts at y=72.128 and row30 at y=1262.528.
Their raster phases differ by .4 pixels. First-row templates therefore compare
row30 observations with glyphs rasterized at a different vertical subpixel phase.
A reference from the same row preserves that phase independently of codec or
budget. Both frame15 and frame45 move only horizontally, so the same vertical
reason applies at both times. This explains a plausible classifier sensitivity;
it does NOT prove the current encoded errors are harmless. Candidate-column
horizontal phases can also differ and remain a limitation of this recognizer.
No template selection, 42/42 criterion or .5 contrast threshold was changed.
A future calibration change requires the higher-budget comparison, exact
unencoded checks, and blurred negatives still failing at both times; current
40/42 and all prior failures remain evidence.

### Complete 64 Mbps diagnostic (review-control-1)

- [passed] Targeted format and isolated tsc exited 0.
- [passed] Four NEW scores: identical source SHA/config except bitrate/times.
- [passed] Candidate 1,954,941 bytes; control 4,980,880 bytes, both below 5 MB.
- [failed] Unchanged first-row scorer: 40/42 in all four decoded samples.
- [passed] Blurred negative: 2/42 in all four samples.
- [passed] Diagnostic matched-row scorer: 42/42 in all four samples.

Both budgets produce exactly the same mismatches at the same coordinates:
frame15 B→8 / E→8; frame45 D→0 / E→8, all on row30 (coordinates in JSON).
Candidate contrast ratios .752525/.839024; control .747475/.829268.
Shared source SHA256 within this batch:
9aacc7a6a1a27e41164779889eec27df6aee69f6a69a5b2e0b52cf904afae7be.
The fixture was generated once for this batch; its container hash differs from
prior batch, so only within-batch SHA identity is claimed. Both comparisons
used sample timestamps .25/.75 and identical final hardware-preferred H264
encoder config except bitrate. These results support row-phase classifier
sensitivity, not an inference that the 14.4 Mbps budget caused these errors.
They are not a general lossless-quality claim. The 64 Mbps control was only
19,120 bytes below the cap; no future cap-compliance guarantee is inferred.

Vitest PID87167 exited1 after14.1s at the actual40-vs42 assertion; the runner
verified all4 new measurements and exited0. This is a completed diagnostic
with an unchanged failing quality scorer, distinct from the prior incomplete
80 Mbps cap failure. No production/scorer/threshold changes. No test/Vite
processes remained; slot released to coordinator for73. Suffixed logs, JSON
and eight bounded crops preserve history.

### Authorized row-reference correction authored (not run)

Default templates now come from the corresponding reference row. All42 glyphs
and the .5 minimum contrast criterion are unchanged. Historical first-row mode
remains explicit and is recorded alongside corrected scores; old40/42 and80M
incomplete evidence are untouched. Exact-reference calibration at frames15/45
now additionally requires contrast ratio1, no mismatches, and rejection of an
8px-blurred reference. Encoded regression already requires all42 at both times
and independently rejects blurred decoded frames. Thus reverting the row choice
reintroduces the observed40/42 failure without lowering any acceptance metric.
Rationale is the complete14.4M/64M comparison: identical glyph errors using the
first-row templates,42/42 using corresponding rows, and known differing raster
phases. This is reference calibration, not proof of losslessness or a production
budget correction. Control runner now expects exit0 for corrected quality.

Prepared slot request: format, types, oracle, red-paired, red-quality, green,
unit, browser via review-check.py, sequential180s each and100MiB floor. RED
paired uses isolated audited7b88854 injection; production file stays untouched.
Normal GREEN has no injection or diagnostic high-budget flag. Browser directory
has all benchmark/acceptance/evidence flags unset. Bounded PNG/JSON evidence only;
no retained output MP4 or frame dumps; same5MB blob guard and cache reuse.

### Row-corrected RED/GREEN segment verified

- [passed] Format and isolated types: exit0 (review-format-3/types-3).
- [passed] Oracle: 1passed, 1filtered skip; both frame phases calibrated.
- [passed] Paired legacy RED fails actual4374070 < 4374070 byte assertion.
- [passed] Quality negative RED fails blurred3 vs42 assertion.
- [passed] GREEN: 2files,3tests passed; no skipped tests.
- [passed] Corrected4K:42/42 at both times, contrast .752525/.839024.
- [passed] Corrected blur:3/42 and2/42 rejected; historical scores40/42 both.
- [passed] Production SHA unchanged after isolated legacy module injection.
- [untested] Affected full directory suites await separate coordinated slot.

All child processes exited (GREEN PID89151 exit0,13.1s). Process inspection
found no remaining Vitest/Vite/review runner. Free253636KiB on release to73.
No production edits, savedMP4, cap changes, or extra directory runs.

### Affected suites and final scoped checks

- [passed] Exporter unit directory:99passed,0failed,0skipped;13files.
- [passed] Exporter browser directory:9passed,0failed;4files passed.
- [untested] Opt-in benchmark:1test/1file skipped with flags unset as intended.
- [passed] Final scoped Biome:58files,no fixes; JSON values unchanged.
- [passed] No source change since successful isolated tsc; repeat unnecessary.
- [passed] Production hash669c2c34... unchanged; all owned children exited.

Unit child90468 exit0; browser child90554 exit0 (17.1s); formatter child90919
exit0. Fresh process inspection found no Vitest/Vite/runner/tsc. Slot released
to73. Free171208KiB; no cleanup. Commit hooks await explicit coordinated slot.
Fresh-head remote CI remains pending; local Mac results do not prove Ubuntu.
