# Multi-track audio extraction

`extractMono16kPcm()` feeds the existing native STT helper. Before this change,
FFmpeg's default selection kept only the first audio stream. A silent first track
therefore produced empty PCM even when a later track contained speech.

The extractor now uses the already resolved FFmpeg binary for a bounded stream
count probe (`-map 0:a -t 0 -f null -`); this reads FFmpeg's input stream listing
without decoding the media. The count determines the `amix` input count, so this
handles any number of audio streams without adding an `ffprobe` dependency. A
single-track input keeps the direct decode path. For multiple tracks, the extractor
opens the source once per track and maps one audio stream from each input. Ubuntu's
FFmpeg 6.1.1 truncates same-container `amix` output to the shorter stream even with
`duration=longest`; decoding each stream alone confirmed their full durations, and
repeated inputs preserve the longest duration. The mix keeps normalization disabled
to preserve quiet speech beside a silent track, then downmixes to mono before
limiting to 0.95 peak with limiter auto-leveling disabled.

The regression evidence is in `/Users/mohamedb/dev/loop-evidence/showhow-215`:

- `BEFORE-STEREO.log` and `BEFORE-STT.log` capture the original silent PCM and
  empty native STT result for the two-track recording. The earlier first mono
  fixture was not RED; `BEFORE-EXTRACTION.log` is retained as that limitation.
- `RED-ACTUAL-EXTRACTION.log` records the real-FFmpeg silent-first/speech-second
  regression before the extractor change.
- `RED-QUIET-AMPLITUDE.log` records the normalized mix at 0.50 of the one-track
  control level and a hot two-track peak of 1.000396 before the quiet-speech fix.
- `HOT-STEREO-PROBE.log` records the later stereo safety defect (PCM peak
  `1.344012856`). `RED-HOT-STEREO-INTEGRATION.log` reproduces it with actual
  FFmpeg stereo media before the repair (`1.3439537`); the repair inserts
  `aformat=channel_layouts=mono` before `alimiter`.
- `GREEN-QUIET-MIX.log` records focused GREEN for actual FFmpeg fixtures covering
  one track, either track order with a silent companion, both non-silent tracks,
  longest-track duration, quiet-track level preservation, peak limiting, and
  `NoAudioTrackError`.
- `QUIET-FINAL-EXTRACTION-2.log` and `QUIET-FINAL-BASE-STT.log` are the lead's
  exact overnight recording proof at extractor SHA-256
  `797cbac5e7de31e9ffc12b4a093867d5da5334b534a64511d62899af6bcbd117`. The output
  mean/peak levels match the speech-only control, and the native-base/VAD transcript
  and speech intervals match the control, including the earlier TextEdit and Next
  click Save phrases. `NATIVE-ASSET-HASHES.json` records helper, model, and FFmpeg
  hashes; the original media hash is unchanged.

Probe errors retain the existing contract: unavailable FFmpeg still raises
`FfmpegUnavailableError` for the caller's fallback, access-denied reads remain
`MediaUnreadableError`, missing audio remains `NoAudioTrackError`, and abort and
timeout paths kill the active child and retain their error typing. The probe uses
the same 60-second timeout and abort signal as extraction.

The actual-fixture test skips only when FFmpeg is absent from `PATH`; the CI unit
job installs FFmpeg before running `npm run test`. The native quiet-speech and
application proof are owner/lead evidence, not reproduced by the synthetic
fixture suite.
