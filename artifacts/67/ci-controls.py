"""Temporary PR72 Linux controls. Every phase is a separate bounded child."""
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "artifacts/67/ci-validation"
LEGACY = "7b8885497986829d4498e70c7c1c8ec876f77222"
MODULE_HASH = "73307eafa42c8604b01dc37f249e0f821ba5a67a1219da598cda43d1098f6022"
PAIRED = "reduces scrolling UI bytes against a paired legacy encoder control"
QUALITY = "preserves native 4K source-quality text through motion and rejects blurred text"
ORACLE = "recognizes every glyph in the exact unencoded reference control"
LIMIT = 2 * 1024**2


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def used():
    return sum(p.stat().st_size for p in BASE.rglob("*") if p.is_file())


def guard():
    require(shutil.disk_usage(ROOT).free >= 100 * 1024**2, "100MiB disk floor")
    require(used() < LIMIT - 65536, "2MiB evidence budget (64KiB reserved for manifests)")


def stop(process):
    # Also terminate surviving members of the owned group after the leader exits.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            os.killpg(process.pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.05)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def readable(score):
    return score["total"] == 42 and score["correct"] == 42 and score["minimumContrastRatio"] >= 0.5


def classify(phase, directory, exit_code):
    report = json.loads((directory / "vitest.json").read_text())
    suites = report["testResults"]
    require(len(suites) == 1 and not suites[0]["message"], "Unexpected suite/setup error")
    tests = suites[0]["assertionResults"]
    selected = [t for t in tests if t["status"] != "skipped"]
    title = ORACLE if phase == "oracle" else PAIRED if "paired" in phase else QUALITY
    require(len(selected) == 1 and selected[0]["title"] == title, "Wrong test count/name")
    test = selected[0]
    red = phase.startswith("red-")
    require(exit_code == (1 if red else 0), "Wrong child exit")
    require(report["numFailedTests"] == int(red), "Unexpected additional test failure")
    require(report["numPassedTests"] == int(not red), "Unexpected pass count")
    require(report["numTodoTests"] == 0, "Unexpected todo test")
    require(report["numPendingTests"] == (0 if "paired" in phase else 1), "Unexpected skipped test")
    log = (directory / "process.log").read_text()
    require(not re.search(r"Test timed out|Unhandled (?:Error|Rejection)|Uncaught Exception|Vitest caught|Failed Suites|Trace boundary changed", log, re.I), "Harness/timeout/unhandled error")
    failures = test["failureMessages"]
    require(len(failures) == int(red), "Unexpected assertion errors")
    records = [json.loads(p.read_text()) for p in directory.glob("review-*.json")]
    if "paired" in phase:
        require(len(records) == 1, "Missing/extra paired measurement")
        record = records[0]
        outputs = record["outputs"]
        require(len(outputs) == 2, "Incomplete paired exports")
        for output in outputs:
            require(0 < output["bytes"] < 5_000_000, "Blob bound")
            require((output["width"], output["height"], output["codec"], output["audioCodec"]) == (1920, 1080, "avc", "aac"), "Paired media mismatch")
            require(abs(output["videoDuration"] - 0.4) < 0.005 and 0.38 <= output["duration"] < 0.5, "Trimmed video/AAC duration")
            require(output["packets"]["packetCount"] == 24 and abs(output["packets"]["averagePacketRate"] - 60) < 0.5, "Frame count/rate")
        before, after = [o["bytes"] for o in outputs]
        if red:
            require(record["bitrate"] == 20_000_000 and all(o["bitrate"] == 20_000_000 for o in outputs), "Legacy config not used")
            require(before == after and before > 0, "RED lacks equal actual output bytes")
            require(test["meta"].get("mp4Assertion") == "paired-byte-reduction", "Wrong RED assertion stage")
            require(f"expected {after} to be less than {before}" in failures[0], "Not the intended byte assertion")
        else:
            require(record["bitrate"] == 2_400_000 and outputs[0]["bitrate"] == 20_000_000 and outputs[1]["bitrate"] == 2_400_000 and after < before, "Actual size reduction failed")
    else:
        require(len(records) == 2 and {d["frame"] for d in records} == {6, 18}, "Missing/extra phase samples")
        for record in records:
            score = record["score"] if phase == "oracle" else record["positive"]
            require(readable(score), "Positive reference/decoded quality failed")
            require(not readable(record["negative"]), "Blur negative incorrectly readable")
            if phase == "oracle":
                require(score["minimumContrastRatio"] == 1, "Unencoded calibration mismatch")
            else:
                require(record["sampleTimestamp"] == record["frame"] / 60, "Wrong sampled time")
                require((record["width"], record["height"], record["codec"], record["bitrate"]) == (3840, 2160, "avc", 14_400_000), "4K config mismatch")
                require(abs(record["duration"] - 0.4) < 0.005 and record["packets"]["packetCount"] == 24, "4K duration/count")
                require(abs(record["packets"]["averagePacketRate"] - 60) < 0.5 and 0 < record["outputBytes"] < 5_000_000, "4K rate/blob bound")
        if phase != "oracle":
            require(len({r["fixtureSha256"] for r in records}) == 1, "Source changed within export")
        if red:
            first = next(r for r in records if r["frame"] == 6)["negative"]["correct"]
            require(first < 42 and test["meta"].get("mp4Assertion") == "glyph-equality" and test["meta"].get("mp4GlyphScore") == first, "Wrong negative assertion")
            require(f"expected {first} to be 42" in failures[0], "Not intended glyph assertion")
    return {"classification": "intended RED" if red else "GREEN", "test": title, "records": len(records)}


def main():
    os.chdir(ROOT)
    phase = sys.argv[1]
    require(phase in {"oracle", "red-paired", "red-quality", "green-paired", "green-quality"}, "Unknown phase")
    guard()
    directory = BASE / phase
    directory.mkdir(parents=True, exist_ok=False)  # Never accept stale measurements.
    source = ROOT / "src/lib/exporter/mp4ExportSettings.ts"
    source_before = sha(source.read_bytes())
    result = {"phase": phase, "head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(), "productionHashBefore": source_before, "fixtureHash": sha((ROOT / "tests/fixtures/mp4-scrolling-text.mp4").read_bytes())}
    process = None
    started = time.monotonic()
    try:
        config = "artifacts/67/review-evidence.config.ts"
        if phase == "red-paired":
            actual = subprocess.check_output(["git", "rev-parse", f"{LEGACY}^{{commit}}"], text=True).strip()
            require(actual == LEGACY, "Unexpected historical commit")
            legacy = subprocess.check_output(["git", "show", f"{LEGACY}:src/lib/exporter/mp4ExportSettings.ts"])
            require(sha(legacy) == MODULE_HASH, "Historical module hash mismatch")
            (ROOT / "artifacts/67/legacy-settings.red.txt").write_bytes(legacy)
            result["legacyCommit"], result["legacyModuleHash"] = LEGACY, MODULE_HASH
            config = "artifacts/67/review-red.config.ts"
        env = {k: v for k, v in os.environ.items() if not k.startswith("VITE_MP4_") and k != "MP4_CI_PHASE_DIR"}
        env.update(VITE_MP4_REVIEW_EVIDENCE="1", MP4_CI_PHASE_DIR=str(directory), NO_COLOR="1")
        if phase == "red-quality":
            env["VITE_MP4_QUALITY_NEGATIVE"] = "1"
        file = "src/lib/exporter/mp4Bitrate.browser.test.ts" if "paired" in phase else "src/lib/exporter/mp4HighResolution.browser.test.ts"
        title = ORACLE if phase == "oracle" else PAIRED if "paired" in phase else QUALITY
        command = ["node", "node_modules/vitest/vitest.mjs", "--config", config, "--run", file, "-t", title, "--maxWorkers=1", "--no-cache", "--reporter=default", "--reporter=json", f"--outputFile={directory / 'vitest.json'}"]
        result["command"] = command
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, start_new_session=True)
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        with (directory / "process.log").open("wb") as log:
            while selector.get_map():
                guard()
                require(time.monotonic() - started < 180, "180s child cap")
                for key, _ in selector.select(0.2):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    require(used() + len(chunk) < LIMIT - 65536, "Evidence log budget")
                    log.write(chunk)
                    log.flush()
            result["exitCode"] = process.wait(timeout=max(0.1, 180 - (time.monotonic() - started)))
        guard()
        result.update(classify(phase, directory, result["exitCode"]))
    except Exception as error:
        result.update(classification="FAILED observation", error=str(error))
    finally:
        if process is not None:
            stop(process)
            result["exitCode"] = process.returncode
        result["seconds"] = time.monotonic() - started
        result["productionHashAfter"] = sha(source.read_bytes())
        if result["productionHashAfter"] != source_before:
            result.update(classification="FAILED observation", error="Production source changed")
        result["files"] = [{"name": p.name, "bytes": p.stat().st_size} for p in directory.iterdir() if p.is_file()]
        print(json.dumps(result), flush=True)
        if shutil.disk_usage(ROOT).free >= 100 * 1024**2:
            (directory / "manifest.json").write_text(json.dumps(result, indent="\t") + "\n")
    return 0 if result["classification"] in {"intended RED", "GREEN"} else 1


if __name__ == "__main__":
    sys.exit(main())
