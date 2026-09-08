Merged base: 6c065401882dfebf332f5f758de5e8fb6bae3fb1, parents
7ea2aae3c01daa0797f5ae08ac20c4a2edf24c67 and
615ba1682feaf33b2d50d6a39d03c1fb3d72b01a. Only append-only notes conflicted;
both suffixes preserved. All other incoming files match remote exactly.
Exporter production/tests/browser config are byte-identical to tested7ea2aae.
Production SHA256: 669c2c342a54d5a9c389ab2b2daf7c97608a922f4733e131b484c1c8eeb80c4c.

- [passed] Normal staged lint-staged:7files; merge commit exited0.
- [passed] Exporter units:99passed,0failed,0skipped.
- [passed] Browser:9passed,0failed,1opt-in benchmark skipped.
- [passed] Imported mediaProtocol/RecordingLibrary:89passed,0failed,0skipped.
- [passed] Isolated types exit0; scopedBiome64files,no fixes.
- [passed] Children exited;180s/child and100MiB floor respected.
- [untested] Fresh pushed-head CI/review pending at evidence recording.

Vitest used maxWorkers1/no-cache with benchmark/acceptance flags unset.
Historical GUI acceptance remains scoped to32ef356; no merged-base GUI rerun.
Production MP4 settings unchanged. Generated Husky launcher was absent;
configured lint-staged ran explicitly against preservation commit (59files)
and normally against staged merge files (7files), both exit0. No install or
shared config changes. Initial in-memory wrapper had an incorrect __file__;
it failed before child launch, then used the corrected lane path.

After all checks, authorized regenerable cache cleanup is recorded separately
in review-vite-cache-recovery.json. Logs/evidence/originals remain intact.
