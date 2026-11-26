"""Check that every question asset resolves inside this static site."""
from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parents[1]
missing = []
external = []
counts = {"json": 0, "image": 0, "audio": 0}

for path in sorted((ROOT / "media" / "json").glob("**/*.json")):
    counts["json"] += 1
    data = json.loads(path.read_text(encoding="utf-8"))
    for part in ("part_A", "part_B", "part_C"):
        for question in data.get(part, []):
            for kind in ("image", "audio"):
                asset = question.get(kind)
                if not asset:
                    continue
                counts[kind] += 1
                if asset.startswith(("http:", "https:", "data:")):
                    external.append((str(path), kind, asset[:100]))
                elif not asset.startswith("media/") or not (ROOT / asset).is_file():
                    missing.append((str(path), kind, asset[:100]))

for grade in range(3, 10):
    for round_number in range(1, 5):
        for topic in range(1, 6):
            path = ROOT / "media" / "json" / f"lop{grade}" / f"json{grade}.vong{round_number}.{topic}.json"
            if not path.is_file():
                missing.append(("expected question set", "json", str(path)))

print(f"JSON files: {counts['json']}; image references: {counts['image']}; "
      f"audio references: {counts['audio']}")
print(f"Missing paths: {len(missing)}; external/embedded assets: {len(external)}")
for problem in (missing + external)[:20]:
    print(problem)
if missing or external:
    sys.exit(1)
