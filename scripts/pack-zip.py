"""Build the distributable zip for Deck Studio.

Usage: python scripts/pack-zip.py [output.zip]

Packs the plugin directory (this file's parent) with a top-level
`dsh-deck-studio/` folder, skipping caches, build output and nested archives.
"""
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP_DIRS = {".tmp", "node_modules", "dist", "__pycache__", ".git", ".idea", ".vscode"}
SKIP_EXT = {".pyc", ".pyo", ".bak", ".log", ".zip"}


def main() -> int:
    with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as fh:
        pkg = json.load(fh)
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(ROOT), f"dsh-deck-studio-{pkg['version']}.zip"
    )

    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            low = name.lower()
            if os.path.splitext(low)[1] in SKIP_EXT or any(
                tok in low for tok in (".bak", ".tmp", ".orig", ".rej")
            ):
                continue
            files.append(os.path.join(dirpath, name))

    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file_path in sorted(files):
            rel = os.path.relpath(file_path, ROOT).replace("\\", "/")
            archive.write(file_path, "dsh-deck-studio/" + rel)

    size = os.path.getsize(out)
    print(f"files: {len(files)}")
    print(f"size: {round(size / 1048576, 2)} MB ({size} bytes)")
    print(f"out: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
