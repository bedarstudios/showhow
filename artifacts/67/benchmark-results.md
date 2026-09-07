# MP4 benchmark, unchanged production code

Nine real VideoExporter exports passed in 18.02s test time, 19.13s total.
1080p60, 3s generated inputs, padding2 to defeat source-copy, H.264 VBR
quality with prefer-hardware configure calls, AAC output. Every output duration
was3.093333s including existing mux/audio padding. Encoding wall times and exact
configurations are in measurements.jsonl. Fixed readability crops at1s were
visually reviewed:4Mbps static/scrolling/moving text remains readable. This is
a limited synthetic sample, not universal quality or audio-sync proof.

| Content |20Mbps bytes|4Mbps bytes|Reduction|
|---|---:|---:|---:|
|Static text|377885|334050|11.60%|
|Scrolling text|4374070|1607390|63.25%|
|Moving pattern|7554760|1570718|79.21%|

2Mbps candidates are also in JSONL, but4Mbps retains more detail headroom.
Provisional pixel budget anchor:4Mbps at1920x1080/60, smoothly scaled by pixels.
Actual installed-app audit target remains untested after implementation.

Browser regression ceiling:779446 bytes/second, derived as ceil(1.5 times
maximum measured4Mbps candidate density across all3 fixtures). The1.5 variance
margin is explicit; original scrolling output exceeds the resulting ceiling.
The always-on regression uses the exact generated scrolling fixture, preserved
at tests/fixtures/mp4-scrolling-text.mp4 (see fixture-manifest.json for hash).
