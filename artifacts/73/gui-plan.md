# Issue 73 planned real Studio verification

Status: authoring only; explicit root GUI slot required. These are planned
checks, not observed results. Production correction stays unapplied until the
merged-base stale UI is captured.

1. At slot start check >=100 MiB free, port 5173 and existing Electron/Vite
   processes. Coordinate any already-running Showhow instance with root; never
   kill another lane. Record base SHA, source hash, owned PIDs and cwd.
2. Hash every original regular file below `/Users/mohamedb/Showhow/Recordings`
   into a new issue73 manifest, recording directory names as well. Do not use
   the historical manifest as the new baseline. No original edits or copies.
3. Create new `qa73-concurrent-a` and `qa73-concurrent-b` with exclusive mkdir;
   stop on collision. Use metadata-only desktop bundles with finite current
   timestamps (A newer), duration 0, video/transcript/steps null. A gets one
   step in steps.json: label `QA73 original step`, ts 1000, screenshot empty,
   redaction false; steps.md has the corresponding instruction. B has only
   meta.json. No recording, regeneration, native capture or security changes.
4. Prepare an ignored local Vite config from the current repo configuration,
   preserving plugins/aliases/external ws. Resolve paths to this checkout,
   set cacheDir to `.local/issue-73/vite-cache`, and use configLoader runner
   to avoid writes through shared node_modules. Dev launch compiles main and
   preload; no packaging/downloads. Launch needs root runtime/build scope.
   The normal Showhow profile is used; do not claim profile isolation.
5. Add only the disclosed renderer delay immediately before genuine title IPC
   inside saveTitle try, conditional on the exact owned QA A bundle path:
   `await new Promise<void>((resolve) => setTimeout(resolve, 20_000));`.
   This delays dispatch; IPC, write, error and completion remain genuine.
   Verify served source still uses base whole-entry replacement plus delay.
6. Using native Computer Use, open Studio. Edit A title to `QA73 saved title`,
   click Save, observe pending. Navigate B then A, edit step 1 to
   `QA73 newer step`, press Return. Before title completion capture screenshot
   and inspect QA disk: old title, newer step persisted. After completion
   capture `before.png`: saved title with reverted original step in UI while
   disk retains newer step. Record actual displayed strings and timing; if
   timing misses the race, classify it rather than claiming reproduction.
7. After genuine test RED and pre-fix GUI proof, dispatch recovered production
   patch to executor. Recreate only owned QA fixture state between attempts;
   reload and verify served title-only callback. Repeat exact interaction;
   capture `after.png` with saved title and retained newer step, inspect disk.
8. Remove exact delay and verify served source has no QA/timer instrumentation.
   Ordinary title save must show success and keep newer step on disk and UI;
   capture ordinary screenshot. Record failure/rejection and navigation
   regression unit coverage separately from real-runtime observations.
9. Quit owned Electron via native UI; stop owned Vite only. Verify PIDs gone
   and listeners clear. Rehash every original baseline path, verify unchanged
   original directory inventory. Remove only owned QA dirs after checking
   expected filename sets (A meta.json/steps.json/steps.md, B meta.json).
   Record free space and release slot immediately. Preserve logs and append
   observed assertion lines as each check runs.

If free space approaches 100 MiB, stop owned processes and report to root;
never remove shared caches or original files to continue.
