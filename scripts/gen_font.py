# -*- coding: utf-8 -*-
"""Subset Noto Sans TC (variable) to the characters this site actually uses,
producing docs/fonts/NotoSansTC-sub.woff2 (self-hosted, no CDN).

Char sources: gma.json (data), t2s.js (incl. simplified forms shown in
simp mode), app.js / index.html (UI strings), plus ASCII and CJK punctuation.
"""
from pathlib import Path
import subprocess, sys

ROOT = Path(__file__).resolve().parent.parent
SRC_FONT = ROOT / "data" / "fonts" / "NotoSansTC-var.ttf"
OUT = ROOT / "docs" / "fonts" / "NotoSansTC-sub.woff2"

chars = set()
for f in ["docs/data/gma.json", "docs/t2s.js", "docs/app.js", "docs/index.html"]:
    chars.update((ROOT / f).read_text(encoding="utf-8"))
chars.update(chr(c) for c in range(0x20, 0x7F))          # ASCII
chars.update("《》〈〉「」『』（）、。，；：！？—～·・％℃")  # CJK punctuation
chars.update("←→↑↓©🏆")
chars = {c for c in chars if ord(c) >= 0x20}

text_file = ROOT / "data" / "fonts" / "subset_chars.txt"
text_file.write_text("".join(sorted(chars)), encoding="utf-8")

OUT.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([
    sys.executable, "-m", "fontTools.subset", str(SRC_FONT),
    f"--text-file={text_file}",
    "--flavor=woff2",
    f"--output-file={OUT}",
    "--layout-features=*",
    "--drop-tables+=FFTM",
    "--no-hinting",
], check=True)
print(f"chars: {len(chars)}, wrote {OUT} ({OUT.stat().st_size//1024} KB)")
