Observed Linux CI34172908071 on e245ed5: tracing worked,7browser tests passed,
2timed out,1opt-in skipped. Both AVC decoders output frames and feed encoders.
4K render samples1/10/30 took1954/3021/4417ms;1080p samples1/10/30/60 took
552/1197/1109/768ms. Encoder queue0 at every sampled feed. Small VP9 MP4
renders took237/28/19ms and reached decoder/encoder flush and mux completion.
This falsifies simple AVC decoder-initialization deadlock. It locates measured
throughput cost inside renderFrame, not a specific rendering operation.
Exact log:ci-e245ed5-failed.log. Rendering includes texture upload, Pixi render,
Linux readPixels/row flip/putImageData, and compositing; no refactor is proposed.

Authorized test-workload correction (authoring only): keep source inputs and
all dimensions,60fps,bitrate configs,42/42 glyph requirement,contrast>=.5,
blur rejection and paired actual-byte inequality. Use existing tail-trim path
to render first0.4s:24frames per export. Paired work drops360->48rendered frames;
4K drops60->24. Input generation/decoding are unchanged. Assert exact24packets,
60fps and0.4s video duration. Paired AAC is still required; total duration must
be >=.38s and <.5s, retaining explicit100ms upper padding allowance from the
historical3s audio export (93ms extra). No duration validation is removed.

Score frames6/18 at0.1/0.3s using exact corresponding reference positions;
motion between samples is12px text scroll and180px colored-panel displacement.
Unencoded oracle and blurred reference/decoded negatives must pass/fail as
specified. Old15/45 measurements and40/42 diagnostics remain intact. Shorter
I-frame-heavy output could affect byte inequality; a failure must be investigated,
not weakened. Original18.933s actual-app52.34% reduction is historical acceptance
with unchanged production, not replaced by this small regression workload.

Normal CI tracing is removed after explaining the timeouts as continuing slow
render progress; plugin/config and exact logs remain available opt-in. No
production fix, timeout increase, quality threshold relaxation or skip added.

Prepared sequential slot request: review-check.py format,types,oracle,
red-paired,red-quality,green;180s per child,100MiB disk floor,<5MB blobs,
no savedMP4. Browser cache was removed with authorization: rebuilding it needs
~41MiB; require >=150MiB free before browser phases, reserve <2MiB evidence.
At authoring, only~124MiB free: no browser run is safe under that reservation.
