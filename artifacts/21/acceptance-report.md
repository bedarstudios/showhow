# Issue 21 acceptance: agent-ready bug-report bundle

## Source and prompt

Bundle inspected (read-only):

`/Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording`

Generic inspection prompt given to the independent coding-agent run, with only the folder path as
source material:

> Inspect every artifact in this recording folder, compare its timestamps with the video and
> meta.json, and report the bug you infer solely from those contents.

## Independent diagnosis

The independent run inferred that transcript timing is not clamped to the recording: `transcript.txt`
contains entries through `0:29`, while `meta.json` declares `durationMs: 26552`. The inspected MP4
container duration was `26.651 s`. This remains the separately tracked product defect **#35**; it is
recorded as a diagnostic, not corrected here.

## Observed inventory

The audit recorded all six required handoff artifacts as present:

- `video.mp4`
- `transcript.txt`
- `steps.json`
- `steps.md`
- `screenshots/`
- `meta.json`

Supporting cursor telemetry is present as `video.mp4.cursor.json`. The screenshot directory contains
six files and `steps.json` contains six steps.

## Timestamp evidence

`meta.json` declares `26552 ms`. The audit found these exact, ordered click telemetry and
`steps.json` timestamps (ms):

`4082, 4468, 5500, 6236, 25899, 26491`

They agree exactly. The corresponding `steps.md` chips resolve to `4000, 4000, 5000, 6000, 25000,
26000 ms`, with absolute deltas of `82, 468, 500, 236, 899, 491 ms`; every chip is within one second
of its click. The audit found seven `29000 ms` transcript timestamps beyond the declared duration.

The complete JSON observation is `bundle-audit.txt`, generated with:

```sh
npm run audit:showhow-bundle -- \
  /Users/mohamedb/Showhow/Recordings/2026-07-25_175438-recording \
  --output artifacts/21/bundle-audit.txt
```

## Acceptance conclusion

**Pass.** An independent diagnosis identified the real timestamp defect solely from the folder
contents, while the audit confirms the six-artifact handoff contract and its
click/step/screenshot timing evidence. This acceptance does not close or mask #35.
