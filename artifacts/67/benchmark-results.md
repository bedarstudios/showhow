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

## Final 2.4Mbps acceptance

The provisional4Mbps setting missed the real app target (41.83% reduction);
3Mbps also missed (47.75%). At2.4Mbps, actual app output is3,594,630bytes,
52.34% smaller at matching dimensions. See app-acceptance.md for GUI proof.

| Content |20Mbps control bytes|2.4Mbps bytes|Reduction|
|---|---:|---:|---:|
|Static text|377885|332878|11.91%|
|Scrolling text|4374070|990521|77.35%|
|Moving pattern|7554760|972656|87.13%|

Four final exports (the three fixtures plus synchronized flash/beep) passed
in8.15s test time,9.18s total. Fixed1s text crops remain readable. Motion-header
edges are less smooth than20Mbps; this evidence supports readability, not
lossless equivalence or a blanket50% reduction for all content.

Decoded flash/beep input offset0ms; output audio lags65ms. Both flash onsets
are1.000s, versus output audible onset1.065s. Predeclared tolerance100ms;
see audio-sync.py/json. Audio duration3.093333s includes existing pipeline
padding; no audio production changes. The Calculator audit itself is silent.

The always-on browser regression keeps its original measured779446B/s ceiling
and genuine20Mbps RED provenance; it was not relaxed for the final setting.
