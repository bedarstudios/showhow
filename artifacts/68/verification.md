## Verification
Environment: macOS 26.5.2; Node 22.22.1; Electron dev code `e62d394`; PID 43581, lane cwd and `localhost:5178` verified, then cleanly shut down.

- [passed] Genuine RED detects missing length and partial status 200.
- [passed] Three early-abort regressions fail before the cancellation fix.
- [passed] Early abort closes acquired files; locked readers reject AbortError.
- [passed] All 41 protocol tests and 210 affected tests across 8 files pass.
- [passed] Committed portable tsc config and Biome on five files pass.
- [passed] Real Range 0-99 returns 206, correct range/length, and 100 bytes.
- [passed] Workflow 0:13 and 0:18 reach 13.197s and 18.516s.
- [passed] Native scrubber reaches 9.466666s; full duration is seekable.
- [passed] A timestamp clicked at readyState0 applies at 13.197s after load.
- [passed] Native Home+Play reaches 18.933333s, ended=true, with no error.
- [passed] All three workflow screenshots load at 460px natural width.
- [passed] Sparse 16 MiB media streams in bounded chunks and cancels safely.
- [passed] Malformed paths, nonmedia files, and symlink escapes are rejected.
- [passed] All nine original source hashes remain unchanged after verification.
- [untested] Windows/Linux Electron runtime; this GUI audit ran on macOS.

Review rerun: CLI checks above cover the cancellation correction; GUI measurements
remain from `e62d394`; the additional current-source smoke is recorded with
its source SHA256 and PID77890 in `review-runtime.txt`. The portable tsc command used the documented read-only
local ws fallback; normal installed checkouts use the declared dependency.
- [passed] Current-code Studio normal and rapid seeks retain requested times.
- [passed] Real renderer fetch and body aborts reject AbortError.
- [passed] Studio navigation survives; current dev exits cleanly, hashes match.
