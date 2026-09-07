# Issue 67: efficient MP4 export

## Diagnosis and boundaries

The supplied installed-app baseline is 7,542,944 bytes / 18.933333 seconds,
1920x1080 H.264 at 60 fps. Its selected setting is 1080p upscale. Source460 is
metadata, not a mismatch. The current export settings request 20 Mbps for this
choice, and 30 Mbps even for small source-sized videos. Actual encoder output
is content-dependent. VideoExporter already uses variable bitrate, quality
latency, hardware preference with software fallback. Capture is a separate path.

Own only MP4 export settings and their callers/tests. Do not change native capture,
bundle click filtering (issue 66), persistence formats, frame rate, resolution
choices, originals, or dependencies. Keep explicit upscale, crop and aspect ratios.

## Implementation contract

1. Benchmark the unchanged export path with static text, scrolling UI, and moving
   content with audio. Record output bytes, dimensions, duration and wall time.
2. Write genuine failing tests before production changes. Catch excessive budgets
   for small crops and discontinuous budgets at resolution thresholds. Preserve
   dimension tests. Include real browser encoder coverage using computed settings.
3. Prefer a smooth pixel-based bitrate budget through the existing WebCodecs path.
   Benchmark candidate budgets before finalizing; maintain sufficient headroom
   for moving text. Do not infer final output size from requested bitrate.
4. Export the saved audit project through the actual updated app at 1080p60.
   Acceptance: at most 3,771,472 bytes (50% baseline), unchanged dimensions,
   readable text, correct seek/play/duration. Capture original and updated app
   output video evidence, and record wall time for repeatable before/after runs.
5. Validate static/scrolling text and moving content plus audio sync. Save a COPY,
   reopen, edit and export again. Confirm all original SHA-256 hashes unchanged.
6. Run focused regressions, affected unit/browser suites, TypeScript and relevant
   Biome checks. Record observations as they occur in Verification.md.

## Evidence and exit

baseline.json preserves hashes and ffprobe data. before.jpg and before.mp4 are
copies of coordinator-supplied app evidence, collected before any patch. The
839,375-byte CRF23 experiment is exploratory, never app-fixed evidence; SSIM
0.997702 is supplied context for one sample only. Baseline export wall time was
not supplied and must not be invented.

GUI remains reserved by coordinator until a slot is explicitly granted. Ask
w1C:p7 via Herdr, then perform the required baseline and updated-app interactions.
Only open the PR after acceptance, with priority at creation, inline before/after
attachments, committed evidence, identical issue/PR Verification blocks,
Reviewing board state and confirmed durable watcher. Never merge.
