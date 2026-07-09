import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import torch
import whisper


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v"}


def natural_video_key(path: Path) -> tuple[int, str]:
    match = re.match(r"^(\d+)", path.name)
    leading_number = int(match.group(1)) if match else 10_000
    return leading_number, path.name.lower()


def format_timestamp(seconds: float, separator: str = ",") -> str:
    milliseconds = int(round((seconds - int(seconds)) * 1000))
    whole_seconds = int(seconds)
    hours = whole_seconds // 3600
    minutes = (whole_seconds % 3600) // 60
    secs = whole_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{separator}{milliseconds:03d}"


def write_srt(segments: list[dict], path: Path) -> None:
    with path.open("w", encoding="utf-8") as file:
        for index, segment in enumerate(segments, 1):
            start = format_timestamp(float(segment["start"]))
            end = format_timestamp(float(segment["end"]))
            text = segment["text"].strip()
            file.write(f"{index}\n{start} --> {end}\n{text}\n\n")


def write_vtt(segments: list[dict], path: Path) -> None:
    with path.open("w", encoding="utf-8") as file:
        file.write("WEBVTT\n\n")
        for segment in segments:
            start = format_timestamp(float(segment["start"]), ".")
            end = format_timestamp(float(segment["end"]), ".")
            text = segment["text"].strip()
            file.write(f"{start} --> {end}\n{text}\n\n")


def pid_is_running(pid: int) -> bool:
    if pid <= 0:
        return False

    if os.name == "nt":
        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"if (Get-Process -Id {pid} -ErrorAction SilentlyContinue) {{ exit 0 }} else {{ exit 1 }}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return completed.returncode == 0

    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def acquire_lock(lock_path: Path) -> bool:
    if lock_path.exists():
        try:
            pid = int(lock_path.read_text(encoding="utf-8").strip())
        except ValueError:
            pid = -1

        if pid_is_running(pid):
            print(f"Skipping locked file: {lock_path.name} is owned by running PID {pid}.")
            return False

        print(f"Removing stale lock: {lock_path.name}.")
        lock_path.unlink()

    try:
        lock_path.write_text(str(os.getpid()), encoding="utf-8")
    except OSError as exc:
        print(f"Could not create lock {lock_path}: {exc}")
        return False
    return True


def release_lock(lock_path: Path) -> None:
    try:
        if lock_path.exists():
            lock_path.unlink()
    except OSError as exc:
        print(f"Could not remove lock {lock_path}: {exc}")


def clean_segments(segments: list[dict]) -> list[dict]:
    cleaned = []
    for segment in segments:
        cleaned.append(
            {
                "id": segment.get("id"),
                "start": round(float(segment["start"]), 3),
                "end": round(float(segment["end"]), 3),
                "text": segment["text"].strip(),
            }
        )
    return cleaned


def transcribe_video(model, video_path: Path, output_dir: Path, force: bool) -> None:
    stem = video_path.stem
    txt_path = output_dir / f"{stem}.txt"
    json_path = output_dir / f"{stem}.segments.json"
    srt_path = output_dir / f"{stem}.srt"
    vtt_path = output_dir / f"{stem}.vtt"
    lock_path = output_dir / f"{stem}.lock"

    if not force and txt_path.exists() and json_path.exists() and srt_path.exists() and vtt_path.exists():
        print(f"Skipping {video_path.name}: transcript artifacts already exist.")
        return

    if not acquire_lock(lock_path):
        return

    started = time.time()
    print(f"Transcribing {video_path.name}...")
    try:
        result = model.transcribe(
            str(video_path),
            language="es",
            task="transcribe",
            verbose=None,
            fp16=torch.cuda.is_available(),
        )
        segments = clean_segments(result.get("segments", []))
        txt_path.write_text(result.get("text", "").strip() + "\n", encoding="utf-8")
        json_path.write_text(
            json.dumps(
                {
                    "source": video_path.name,
                    "language": result.get("language", "es"),
                    "duration_seconds": segments[-1]["end"] if segments else None,
                    "segments": segments,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        write_srt(segments, srt_path)
        write_vtt(segments, vtt_path)
        elapsed = time.time() - started
        print(f"Finished {video_path.name} in {elapsed / 60:.2f} minutes.")
    finally:
        release_lock(lock_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe all course videos with Whisper.")
    parser.add_argument("--video-dir", default=".", help="Directory containing course videos.")
    parser.add_argument("--output-dir", default="transcripts", help="Directory for transcript artifacts.")
    parser.add_argument("--model", default="small", help="Whisper model name.")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--force", action="store_true", help="Regenerate existing artifacts.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of videos to process.")
    parser.add_argument("--only", default=None, help="Substring filter for a single video name.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    video_dir = Path(args.video_dir).resolve()
    output_dir = (video_dir / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    videos = sorted(
        [path for path in video_dir.iterdir() if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS],
        key=natural_video_key,
    )
    if args.only:
        videos = [path for path in videos if args.only.lower() in path.name.lower()]
    if args.limit is not None:
        videos = videos[: args.limit]

    print(f"Found {len(videos)} video(s).")
    if not videos:
        return 0

    print(f"Loading Whisper model '{args.model}' on {args.device}...")
    model = whisper.load_model(args.model, device=args.device)

    for video in videos:
        transcribe_video(model, video, output_dir, args.force)

    print("Transcription pass complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted by user.", file=sys.stderr)
        raise SystemExit(130)
