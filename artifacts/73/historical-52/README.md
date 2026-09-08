# Historical issue 52 evidence

These files were copied read-only from the preserved issue 52 worktree on 2026-09-08. See `copy-provenance.json.txt` for source paths, commits, and SHA-256 hashes. The recovered patches describe its uncommitted correction, not changes already applied to issue 73.

The three concurrent-step screenshots show **fixed code** before title completion, after title completion, and an ordinary save after instrumentation removal. They are NOT a before-fix reproduction and do NOT prove behavior on the issue 73 base.

`verification.md` is an exact copy of the old observed assertion record. Its RED/GREEN counts, timings, and GUI observations are historical only. No old raw test logs were available as files; none have been reconstructed.

`showhow52-round2-original-hashes.json.txt.txt` is an unchanged copy of the historical original-file inventory (reported as 506 files and 45 directories). New runtime work requires its own baseline and verification.

The supplied handoff describes round-two localhost:5173 verification using a disclosed 20-second delay only before genuine title IPC for owned `qa52-round2-a`, a real step save while title IPC was pending, then ordinary saving after shim removal. It reports QA cleanup, unchanged originals and exited processes. This description is inherited evidence, not a new observation by issue 73.

## Additional historical handoff

The old orchestrator supplied the round-two recipe directly in this conversation. Its GUI assertions were not yet added to the copied verification file when work stopped. The run used the normal `/Users/mohamedb/Library/Application Support/Showhow` profile, not an isolated user-data profile; do not infer an absence of shared profile writes. Only expendable `qa52-round2-a` and `qa52-round2-b` recording bundles were mutated.

The before-completion screenshot showed `QA52 concurrent A` and `QA52 newer step`; the after-completion screenshot showed `QA52 concurrent saved` and the same newer step. The ordinary-save screenshot showed `QA52 final ordinary save`, `Title saved`, and `QA52 newer step`. The handoff reports corresponding genuine disk writes. These remain historical observations from the old orchestrator.
