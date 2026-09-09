Head08e2109 CI34172041375/Test101894066490 failed browser tests:
7passed,2timeouts,1opt-in skipped. Paired AVC test exceeded120s; native4K
AVC test exceeded180s. Neither reached a size/glyph assertion. Exact failed
log is preserved as ci-08e2109-failed.log (original download also at
/tmp/showhow-72-08e2109-failed.log). Units, Build, Types, Lint and title passed.
Greptile08e2109 scored5/5,193files reviewed,0newcomments; CI remains a blocker.

Working VP9 fixture exports are320x180@15; failing AVC exports are1080p60
and4K60. Codec, resolution and frame rate are confounded. Encoder software
fallback does not identify decoder backend: VP9 explicitly prefers software;
AVC leaves decoder acceleration unspecified. Both reported supported=true.
No root cause or production quality failure is established by these logs.

One controlled observation run: normal Linux CI settings unchanged, with a
CI+linux-only test transform adding sparse logs at source/demux readiness,
decoder configured preference, chunk feed/output, onFrame/render completion,
encoder queue/flush and mux completion. No production files, budgets, quality
thresholds, codec/render flags, frame data, or timeout limits are modified.
Maximum six progress messages per named boundary; no frame dumps/intervals.
Mac software diagnostic draft was superseded before execution and is excluded.

Static validation: scopedBiome passed; isolatedtsc exit0. Read-only transform
sentinels matched exact current source and generatedTypeScript parsed cleanly.
Unchanged source SHA256:
- streamingDecoder.ts:0e36f43cd67a8e937dfa1d337f178c7d6e6b34726859101cfd9c3ed55b5ffaba
- videoExporter.ts:ff5792d35f26d93c61ed996a4cddfb58ff6b7f4d23a35bada7f1799fd7498eff
- mp4ExportSettings.ts:669c2c342a54d5a9c389ab2b2daf7c97608a922f4733e131b484c1c8eeb80c4c

No local browser/cache rebuild, install, GUI or build was run for this step.
Interpret the next Linux boundary evidence before making any behavioral fix.
