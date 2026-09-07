"""Slot-gated, bounded PR72 verification. Run one named batch at a time."""
import json
import hashlib
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
os.chdir(root)
evidence = root / "artifacts/67"
phase = sys.argv[1]
browser = ["node", "node_modules/vitest/vitest.mjs", "--config", "artifacts/67/review-evidence.config.ts", "--run"]
paired = "src/lib/exporter/mp4Bitrate.browser.test.ts"
high = "src/lib/exporter/mp4HighResolution.browser.test.ts"
env = os.environ.copy()
for key in ["VITE_MP4_BENCHMARK", "VITE_MP4_ACCEPTANCE", "VITE_MP4_BENCHMARK_SMOKE", "VITE_MP4_QUALITY_NEGATIVE", "VITE_MP4_REVIEW_EVIDENCE", "VITE_MP4_QUALITY_DIAGNOSTIC"]:
    env.pop(key, None)


def guard():
    free = shutil.disk_usage(root).free
    if free < 100 * 1024**2:
        raise RuntimeError(f"Below 100MiB disk floor: {free} bytes")
    return free


def run(command, expected=0):
    free = guard()
    print(json.dumps({"phase": phase, "command": command, "freeBefore": free}), flush=True)
    started = time.monotonic()
    label = phase
    counter = 1
    while (evidence / f"review-{label}.log").exists():
        label = f"{phase}-{counter}"
        counter += 1
    with (evidence / f"review-{label}.log").open("w") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
        try:
            while process.poll() is None:
                guard()
                if time.monotonic() - started > 180:
                    raise TimeoutError("180s process limit")
                time.sleep(1)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
    result = {"phase": phase, "log": f"review-{label}.log", "pid": process.pid, "exitCode": process.returncode,
              "expectedExit": expected, "seconds": time.monotonic() - started,
              "freeAfter": shutil.disk_usage(root).free}
    print(json.dumps(result), flush=True)
    guard()
    (evidence / f"review-{label}-status.json").write_text(json.dumps(result, indent="\t") + "\n")
    if process.returncode != expected:
        raise RuntimeError(f"Expected exit {expected}, got {process.returncode}; inspect log")


if phase == "red-paired":
    source = root / "src/lib/exporter/mp4ExportSettings.ts"
    current = source.read_bytes()
    current_hash = hashlib.sha256(current).hexdigest()
    legacy = subprocess.check_output(["git", "show", "7b88854:src/lib/exporter/mp4ExportSettings.ts"])
    guard()
    (evidence / "legacy-settings.red.txt").write_bytes(legacy)
    print(json.dumps({"productionHashBefore": current_hash, "legacyHash": hashlib.sha256(legacy).hexdigest()}), flush=True)
    try:
        run(["node", "node_modules/vitest/vitest.mjs", "--config", "artifacts/67/review-red.config.ts", "--run", paired], expected=1)
    finally:
        print(json.dumps({"productionHashAfter": hashlib.sha256(source.read_bytes()).hexdigest()}), flush=True)
    assert source.read_bytes() == current
elif phase == "red-quality":
    env["VITE_MP4_QUALITY_NEGATIVE"] = "1"
    run(browser + [high], expected=1)
elif phase == "oracle":
    env["VITE_MP4_REVIEW_EVIDENCE"] = "1"
    run(browser + [high, "-t", "exact unencoded reference control"])
elif phase == "control":
    env["VITE_MP4_REVIEW_EVIDENCE"] = "1"
    env["VITE_MP4_QUALITY_DIAGNOSTIC"] = "1"
    before = set(evidence.glob("review-quality-*.json"))
    run(browser + [high])
    measurements = [json.loads(p.read_text()) for p in set(evidence.glob("review-quality-*.json")) - before]
    assert len(measurements) == 4, "Incomplete control diagnostic: require four new decoded scores"
    assert {(d["bitrate"], d["frame"]) for d in measurements} == {
        (bitrate, frame) for bitrate in [14_400_000, 64_000_000] for frame in [15, 45]
    }
    assert len({d["fixtureSha256"] for d in measurements}) == 1
    identities = [{k: v for k, v in d["configurations"][-1].items() if k != "bitrate"} for d in measurements]
    assert all(identity == identities[0] for identity in identities)
    assert all(d["sampleTimestamp"] == d["frame"] / 60 for d in measurements)
    assert all(d["outputBytes"] < 5_000_000 for d in measurements)
    assert all(d["negative"]["correct"] < d["negative"]["total"] for d in measurements)
    print("Complete control measurements verified; inspect unchanged positive scores before interpretation", flush=True)
elif phase == "green":
    env["VITE_MP4_REVIEW_EVIDENCE"] = "1"
    run(["node", "node_modules/vitest/vitest.mjs", "--config", "artifacts/67/review-evidence.config.ts", "--run", paired, high])
elif phase == "browser":
    run(browser + ["src/lib/exporter"])
elif phase == "unit":
    run(["node", "node_modules/vitest/vitest.mjs", "--run", "src/lib/exporter"])
elif phase == "types":
    run(["node", "node_modules/typescript/bin/tsc", "--noEmit", "-p", "artifacts/67/typecheck-config.json"])
elif phase == "format":
    paths = ["vitest.browser.config.ts", paired, high, "src/lib/exporter/mp4TextFixture.ts", "artifacts/67/review-red.config.ts", "artifacts/67/review-evidence.config.ts"]
    paths += [str(p.relative_to(root)) for p in evidence.glob("*.json")]
    originals = {p: json.loads(Path(p).read_text()) for p in paths if p.endswith(".json")}
    run(["node", "node_modules/@biomejs/biome/bin/biome", "check", "--write", *paths])
    assert all(json.loads(Path(p).read_text()) == value for p, value in originals.items())
else:
    raise ValueError("Expected format/types/red-paired/red-quality/green/browser/unit")
