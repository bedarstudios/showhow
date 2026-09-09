# Actual app acceptance

The selected 1080p upscale setting exports 1920×1080 at 60fps. Source460 is
input metadata. The saved Calculator audit was loaded through the native Open
Project dialog. The dev renderer URL was localhost:5177/?windowType=editor,
from this worktree at commit 0c99358 plus the recorded bitrate-only trial diff.

| Requested anchor | Output bytes | Reduction from installed baseline |
| --- | ---: | ---: |
| Existing 20 Mbps | 7,542,944 | — |
| 4 Mbps trial | 4,387,478 | 41.83% |
| 3 Mbps trial | 3,941,008 | 47.75% |
| 2.4 Mbps accepted audit trial | 3,594,630 | 52.34% |

The last output was exported after reloading the original project, at padding50
and the same two 1.8× zooms. Its ffprobe duration is18.933333 seconds, H.264,
1920×1080,60/1fps. Save-click to file mtime was9.379 seconds. Installed baseline
reproduction took52.561 seconds by the same wall-clock proxy; different builds
and warm-up state mean this is not a controlled speedup claim.

Exact decoded frames at1s and13s retain readable Calculator digits/operators
and the same composition. Some edge texture differs at lower bitrate; the
sample does not establish universal visual equivalence. QuickTime played the
actual output through18s and sought backward to13s. The original is silent;
this playback does not prove audio sync.

Save As created showhow-67-edit-roundtrip-20260907.showhow. After reopening,
padding changed50→49 through Video Effects, Save Project confirmed the COPY
path, and reopening displayed49% again. Reloading the original displayed50%.
All four hashes in baseline.json still match, including both original MP4s
and the original project. The copy normalizes depth3 to1.8× and adds manual
focus mode without changing the effective zoom.

Evidence: app-trial-24mbps.json, app-trial-24mbps-timing.json,
after-24mbps-settings.png, before-frame-1.png, after-frame-1.png,
before-frame-13.png, after-frame-13.png, after-playback.png, after-seek.png,
roundtrip-reopened.png. Earlier failed trial measurements are retained.

Final fresh-launch round trip: the edited copy reopened at padding 49 and
exported to a unique new output, 3,566,928 bytes, H.264 1920×1080 at 60 fps,
18.933333 seconds. Save-click to file mtime: 9.416 seconds. This edited output
is excluded from the identical-content reduction comparison. Evidence:
roundtrip-final-reopened.png, roundtrip-export-settings.png,
roundtrip-export.json and roundtrip-timing.json. Original hashes again match.
