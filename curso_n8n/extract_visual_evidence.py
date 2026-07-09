import argparse
import json
import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v"}


def natural_video_key(path: Path) -> tuple[int, str]:
    match = re.match(r"^(\d+)", path.name)
    leading_number = int(match.group(1)) if match else 10_000
    return leading_number, path.name.lower()


def hhmmss(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}-{minutes:02d}-{secs:02d}"


def ffprobe_duration(video_path: Path) -> float:
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(video_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(completed.stdout.strip())


def sample_timestamps(duration: float, interval_minutes: int) -> list[float]:
    if duration <= 0:
        return []

    interval = interval_minutes * 60
    if duration <= 15 * 60:
        interval = 2 * 60
    elif duration <= 45 * 60:
        interval = 5 * 60

    stamps = {60.0, max(0.0, duration - 60.0)}
    current = interval
    while current < duration:
        stamps.add(float(current))
        current += interval

    return sorted(stamp for stamp in stamps if 0 <= stamp <= duration)


def extract_frame(video_path: Path, timestamp: float, output_path: Path, width: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            str(timestamp),
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-vf",
            f"scale={width}:-1",
            "-q:v",
            "3",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def load_font(size: int) -> ImageFont.ImageFont:
    for font_name in ("arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(font_name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_contact_sheet(video_name: str, frame_paths: list[Path], output_path: Path, columns: int) -> None:
    if not frame_paths:
        return

    images = [Image.open(path).convert("RGB") for path in frame_paths]
    thumb_width = max(image.width for image in images)
    thumb_height = max(image.height for image in images)
    label_height = 34
    gutter = 12
    title_height = 48
    rows = math.ceil(len(images) / columns)

    sheet_width = columns * thumb_width + (columns + 1) * gutter
    sheet_height = title_height + rows * (thumb_height + label_height) + (rows + 1) * gutter
    sheet = Image.new("RGB", (sheet_width, sheet_height), "white")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(20)
    label_font = load_font(16)
    draw.text((gutter, 12), video_name, fill=(20, 20, 20), font=title_font)

    for index, (path, image) in enumerate(zip(frame_paths, images)):
        row = index // columns
        col = index % columns
        x = gutter + col * (thumb_width + gutter)
        y = title_height + gutter + row * (thumb_height + label_height + gutter)
        sheet.paste(image, (x, y))
        label = path.stem.split("__")[-1].replace("-", ":")
        draw.text((x, y + thumb_height + 7), label, fill=(20, 20, 20), font=label_font)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, quality=90)

    for image in images:
        image.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract sampled visual evidence from course videos.")
    parser.add_argument("--video-dir", default=".", help="Directory containing course videos.")
    parser.add_argument("--output-dir", default="visual_evidence", help="Output directory.")
    parser.add_argument("--interval-minutes", type=int, default=10, help="Default sample interval.")
    parser.add_argument("--width", type=int, default=960, help="Frame width in pixels.")
    parser.add_argument("--columns", type=int, default=2, help="Contact sheet columns.")
    parser.add_argument("--force", action="store_true", help="Regenerate existing frames.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    video_dir = Path(args.video_dir).resolve()
    output_dir = (video_dir / args.output_dir).resolve()
    frames_root = output_dir / "frames"
    sheets_root = output_dir / "contact_sheets"

    videos = sorted(
        [path for path in video_dir.iterdir() if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS],
        key=natural_video_key,
    )

    index = []
    for video in videos:
        duration = ffprobe_duration(video)
        stamps = sample_timestamps(duration, args.interval_minutes)
        frame_dir = frames_root / video.stem
        frame_paths = []
        print(f"{video.name}: extracting {len(stamps)} frame(s).")
        for stamp in stamps:
            frame_path = frame_dir / f"{video.stem}__{hhmmss(stamp)}.jpg"
            if args.force or not frame_path.exists():
                extract_frame(video, stamp, frame_path, args.width)
            frame_paths.append(frame_path)

        sheet_path = sheets_root / f"{video.stem}.jpg"
        if args.force or not sheet_path.exists():
            make_contact_sheet(video.name, frame_paths, sheet_path, args.columns)

        index.append(
            {
                "video": video.name,
                "duration_seconds": round(duration, 3),
                "frames": [str(path.relative_to(output_dir)) for path in frame_paths],
                "contact_sheet": str(sheet_path.relative_to(output_dir)),
            }
        )

    (output_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output_dir / 'index.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
