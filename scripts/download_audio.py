"""Download the question audio once per source URL and rewrite JSON references.

Run from the repository root: python scripts/download_audio.py
Repeated runs resume already downloaded files. The downloaded media stays in
media/audio and each source URL maps to a stable, collision resistant filename.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from pathlib import Path
import json
import time
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "media" / "json"
AUDIO = ROOT / "media" / "audio"
RESULTS = AUDIO / "sources.json"
UNAVAILABLE_QUESTION_AUDIO = (
    "https://res.ioe.vn/edu/EOlympic/ExamData/ImageExam/2014/3/21/"
    "635310082611492700_Audio.mp3"
)


def audio_path(url):
    return AUDIO / (sha256(url.encode("utf-8")).hexdigest()[:20] + ".mp3")


def download(url):
    target = audio_path(url)
    if target.is_file() and target.stat().st_size > 128:
        return url, None
    last_error = None
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(req, timeout=20) as response:
                payload = response.read()
                mime = response.headers.get("content-type", "")
            if len(payload) < 128 or "text/html" in mime:
                raise ValueError(f"Invalid MP3 response: {mime}, {len(payload)} bytes")
            target.write_bytes(payload)
            return url, None
        except Exception as error:
            last_error = str(error)
            time.sleep(min(1 + attempt, 3))
    return url, last_error


def main():
    AUDIO.mkdir(parents=True, exist_ok=True)
    sources = {}
    for path in sorted(CONTENT.glob("**/*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for part in ("part_A", "part_B", "part_C"):
            for item in data.get(part, []):
                url = item.get("audio")
                if url and url.startswith(("https://", "http://")):
                    sources[url] = None
    print(f"Found {len(sources)} unique MP3 sources", flush=True)
    if not sources:
        print("No remote audio references remain; existing MP3 files are unchanged.")
        return
    failures = {}
    with ThreadPoolExecutor(max_workers=24) as pool:
        futures = [pool.submit(download, url) for url in sources]
        for i, future in enumerate(as_completed(futures), 1):
            url, error = future.result()
            if error:
                failures[url] = error
            if i % 100 == 0 or i == len(futures):
                print(f"{i}/{len(futures)} processed; {len(failures)} failed", flush=True)

    replacements = 0
    for path in sorted(CONTENT.glob("**/*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        modified = False
        for part in ("part_A", "part_B", "part_C"):
            for item in data.get(part, []):
                url = item.get("audio")
                if url in sources and url not in failures:
                    item["audio"] = "media/audio/" + audio_path(url).name
                    replacements += 1
                    modified = True
                elif url == UNAVAILABLE_QUESTION_AUDIO and url in failures:
                    # The original MP3 returns 404; retain the answer as a text question.
                    item.pop("audio")
                    item["explanation"] = (
                        "Điền “sing” để hoàn thành câu “May I sing a song?” "
                        "(Tôi có thể hát một bài hát không?)."
                    )
                    modified = True
        if modified:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    previous = json.loads(RESULTS.read_text(encoding="utf-8")) if RESULTS.exists() else {}
    downloaded = dict(previous.get("downloaded", {}))
    downloaded.update({url: "media/audio/" + audio_path(url).name
                       for url in sources if url not in failures})
    unavailable = dict(previous.get("unavailable", {}))
    unavailable.update(failures)
    for url in downloaded:
        unavailable.pop(url, None)
    RESULTS.write_text(json.dumps({"unique_sources": len(downloaded) + len(unavailable),
                                    "rewritten_references": replacements,
                                    "downloaded": downloaded,
                                    "unavailable": unavailable}, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
    print(f"Rewrote {replacements} references; {len(failures)} sources failed", flush=True)
    unexpected = {url: error for url, error in failures.items()
                  if url != UNAVAILABLE_QUESTION_AUDIO}
    if unexpected:
        raise RuntimeError(f"{len(unexpected)} audio sources could not be downloaded")


if __name__ == "__main__":
    main()
