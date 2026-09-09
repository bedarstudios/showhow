Temporary PR72-only changes in the existing CI Test job:

1. Existing unit tests and browser installation remain.
2. Fetch only historical commit7b8885497986829d4498e70c7c1c8ec876f77222.
3. Run ci-controls.py oracle,red-paired,red-quality,green-paired,green-quality
   as five separate children. No combined GREEN process shares a180s budget.
4. Record any phase failure but attempt subsequent phases with their own guards.
5. Upload only artifacts/67/ci-validation with seven-day retention, always on
   this PR/head branch. Upload has no new permissions or secrets.
6. Run the unchanged normal browser command even if observation failed, provided
   browser installation succeeded and the job was not cancelled.

Scope condition requires pull_request number72 AND exact head branch
ticket/67-optimize-mp4-size. Existing job gets30min total ceiling; observation
step16min allows five180s children plus cleanup. No individual test timeout rises.
This workflow change is temporary and will be removed after proof, followed by
normal final-head CI and a fresh Greptile review. No push/run authorized yet.

Classifier requires fresh exclusive phase directories, exactly one selected
test, expected selected/skipped counts, no suite/setup/runtime/timeout errors,
and exact metadata indicating the assertion reached. Paired RED requires two
valid24frame H264/AAC outputs at20Mbps and equal positive actual byte counts,
with the exact less-than assertion failure. Blur RED requires two valid4K
samples at6/18, readable positive scores and unreadable negatives, with the
exact first negative glyph-equality failure. GREEN requires exit0 and actual
paired reduction or strict42/42 quality; oracle requires exact contrast1.

Historical module SHA73307eafa42c8604b01dc37f249e0f821ba5a67a1219da598cda43d1098f6022
must match before isolated injection; production hash is recorded before/after.
All phases preserve100MiB disk floor and180s child cap. The child process group
is stopped on failure/timeout, including surviving browser descendants. New
evidence has2MiB total budget, with64KiB reserved for manifests; only final
quality GREEN saves small crops. No savedMP4, downloads beyond existing CI
setup, cloud encoder, changed codec settings, threshold relaxation or skip.

Risks remain explicit: shortspan quality/byte assertions can fail; Linux render
time can still exceed its cap; classifier/setup failure is never accepted RED.
Current authoring has not executed these new controls or validated their outputs.
