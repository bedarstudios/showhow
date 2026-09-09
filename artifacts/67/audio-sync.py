"""Bounded flash/beep fixture and decoded output timing evidence; no frame dumps."""
import array
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent


def run(args):
    return subprocess.check_output(["ffmpeg", "-v", "error", *args], timeout=60)


if sys.argv[1] == "generate":
    run(["-n", "-i", str(root / "fixtures/motion.mp4"), "-f", "lavfi", "-i",
         "aevalsrc=if(between(t\\,1\\,1.2)\\,0.5*sin(2*PI*880*t)\\,0):s=48000:d=3",
         "-map", "0:v", "-map", "1:a", "-t", "3", "-vf",
         "drawbox=x=1800:y=950:w=100:h=100:color=black:t=fill,drawbox=x=1800:y=950:w=100:h=100:color=white:t=fill:enable='between(t,1,1.2)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac",
         "-b:a", "96k", str(root / "fixtures/sync.mp4")])
    assert (root / "fixtures/sync.mp4").stat().st_size < 5_000_000
else:
    results = []
    for path in [root / "fixtures/sync.mp4", root / "sync-2400000.mp4"]:
        pixels = run(["-i", str(path), "-vf", "crop=20:20:1840:990,scale=1:1,format=gray",
                      "-an", "-f", "rawvideo", "-"])
        pcm = array.array("f", run(["-i", str(path), "-vn", "-ac", "1", "-ar", "48000",
                                   "-f", "f32le", "-"]))
        video_onset = next(i / 60 for i, value in enumerate(pixels) if value > 220)
        # 5ms RMS windows reject AAC pre-echo and establish audible pulse onset.
        audio_onset = next(i / 48000 for i in range(0, len(pcm) - 240, 240)
                           if sum(x*x for x in pcm[i:i+240]) / 240 > 0.01)
        results.append({"file": path.name, "videoOnsetSeconds": video_onset,
                        "audioOnsetSeconds": audio_onset, "offsetSeconds": audio_onset-video_onset,
                        "videoFrames": len(pixels), "decodedAudioSeconds": len(pcm)/48000})
    report = {"method": "100px flash and 880Hz beep at 1s for 0.2s; decoded luminance and 5ms audio RMS",
              "maximumOffsetSeconds": 0.1, "results": results}
    (root / "audio-sync.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
    assert abs(results[1]["offsetSeconds"]) <= 0.1
    assert abs(results[1]["videoOnsetSeconds"] - results[0]["videoOnsetSeconds"]) <= 1/60
