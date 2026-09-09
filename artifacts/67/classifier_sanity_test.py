"""CLASSIFIER ONLY: synthetic reports, never real export/quality evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ci_controls", Path(__file__).with_name("ci-controls.py"))
controls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controls)


class ClassifierOnlySanity(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="mp4-classifier-only-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.report = {
            "numFailedTests": 1,
            "numPassedTests": 0,
            "numPendingTests": 0,
            "numTodoTests": 0,
            "testResults": [{
                "message": "",
                "assertionResults": [{
                    "title": controls.PAIRED,
                    "status": "failed",
                    "failureMessages": ["AssertionError: expected 1234 to be less than 1234"],
                    "meta": {"mp4Assertion": "paired-byte-reduction"},
                }],
            }],
        }
        output = {
            "bytes": 1234, "bitrate": 20_000_000,
            "width": 1920, "height": 1080, "codec": "avc", "audioCodec": "aac",
            "videoDuration": 0.4, "duration": 0.49,
            "packets": {"packetCount": 24, "averagePacketRate": 60},
        }
        self.write("review-paired.json", {"bitrate": 20_000_000, "outputs": [output, output]})
        self.write("vitest.json", self.report)
        (self.directory / "process.log").write_text("CLASSIFIER ONLY synthetic log\n")

    def write(self, name, value):
        (self.directory / name).write_text(json.dumps(value))

    def classify(self):
        return controls.classify("red-paired", self.directory, 1)

    def test_accepts_synthetic_intended_byte_red(self):
        self.assertEqual(self.classify()["classification"], "intended RED")

    def test_rejects_timeout_even_with_expected_exit_and_measurements(self):
        (self.directory / "process.log").write_text("Error: Test timed out in 120000ms")
        with self.assertRaisesRegex(RuntimeError, "Harness/timeout"):
            self.classify()

    def test_rejects_suite_setup_error(self):
        self.report["testResults"][0]["message"] = "Cannot import browser setup"
        self.write("vitest.json", self.report)
        with self.assertRaisesRegex(RuntimeError, "suite/setup"):
            self.classify()

    def test_rejects_extra_assertion_error(self):
        self.report["testResults"][0]["assertionResults"][0]["failureMessages"].append("Unexpected renderer error")
        self.write("vitest.json", self.report)
        with self.assertRaisesRegex(RuntimeError, "Unexpected assertion errors"):
            self.classify()

    def test_rejects_unhandled_error(self):
        (self.directory / "process.log").write_text("Vitest caught 1 unhandled error")
        with self.assertRaisesRegex(RuntimeError, "Harness/timeout/unhandled"):
            self.classify()

    def test_rejects_missing_fresh_measurement(self):
        (self.directory / "review-paired.json").unlink()
        with self.assertRaisesRegex(RuntimeError, "Missing/extra paired"):
            self.classify()

    def test_rejects_exit_one_alone_without_report(self):
        (self.directory / "vitest.json").unlink()
        with self.assertRaises(FileNotFoundError):
            self.classify()

    def test_rejects_wrong_failure_stage(self):
        self.report["testResults"][0]["assertionResults"][0]["meta"]["mp4Assertion"] = "setup"
        self.write("vitest.json", self.report)
        with self.assertRaisesRegex(RuntimeError, "Wrong RED assertion stage"):
            self.classify()


if __name__ == "__main__":
    unittest.main(verbosity=2)
