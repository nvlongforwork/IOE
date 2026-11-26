"""Move question JSON and images to media and extract embedded question images.

Run once from the repository root: python scripts/migrate_media.py
"""
from base64 import b64decode
from hashlib import sha256
from pathlib import Path
import json
import re
import shutil


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"


def main():
    (MEDIA / "json").mkdir(parents=True, exist_ok=True)
    (MEDIA / "images").mkdir(parents=True, exist_ok=True)
    old_images = ROOT / "data" / "images"
    if old_images.exists():
        for child in old_images.iterdir():
            shutil.move(str(child), str(MEDIA / "images" / child.name))
        old_images.rmdir()
    for grade in range(3, 10):
        source = ROOT / "data" / f"lop{grade}"
        if source.exists():
            shutil.move(str(source), str(MEDIA / "json" / source.name))

    embedded_dir = MEDIA / "images" / "embedded"
    embedded_dir.mkdir(parents=True, exist_ok=True)
    embedded_count = 0
    for path in sorted((MEDIA / "json").glob("**/*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for part in ("part_A", "part_B", "part_C"):
            for question in data.get(part, []):
                image = question.get("image")
                if not isinstance(image, str):
                    continue
                if image.startswith("data/images/"):
                    question["image"] = "media/images/" + image[len("data/images/"):]
                    changed = True
                elif image.startswith("data:image/"):
                    match = re.fullmatch(r"data:image/(jpeg|jpg|png|webp);base64,(.*)",
                                         image, flags=re.DOTALL)
                    if match is None:
                        raise ValueError(f"Unknown embedded image format: {path}")
                    payload = b64decode(match.group(2), validate=True)
                    extension = "jpg" if match.group(1) in ("jpeg", "jpg") else match.group(1)
                    name = sha256(payload).hexdigest()[:20] + "." + extension
                    dest = embedded_dir / name
                    if not dest.exists():
                        dest.write_bytes(payload)
                        embedded_count += 1
                    question["image"] = "media/images/embedded/" + name
                    changed = True
        if changed:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")

    print(f"Moved JSON to media/json and images to media/images; "
          f"extracted {embedded_count} unique embedded images.")


if __name__ == "__main__":
    main()
