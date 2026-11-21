#!/usr/bin/env python3
"""让 ppt-master 导出的 PPTX 真正用上本机中文字体。

背景：ppt-master 的 svg_to_pptx 会把 Source Han / LXGW 等家族按“PPT 安全字体”
映射成微软雅黑 / 宋体，并且只写 a:latin、不写 a:ea；而 PowerPoint 的中文
实际走 a:ea，所以新装字体不会生效。

本脚本做三件事（不改 skill 源码）：
  1. 按 spec_lock.md 的 title_family / body_family 改写主题 major/minor 字体；
  2. 把所有显式使用中文字体家族的 run 的 a:ea / a:cs 对齐到 a:latin；
  3. 把被映射成 SimSun / Microsoft YaHei 的 run 还原为 title/body 家族。

用法：
  python fix-pptx-cjk-fonts.py deck.pptx --spec-lock project/spec_lock.md
         [--title-font "Source Han Serif SC"] [--body-font "Source Han Sans SC"]
         [-o deck.fixed.pptx]
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"a": A}
CJK_MARKERS = ("Source Han", "LXGW", "Smiley Sans", "Glow Sans")
SERIF_FALLBACKS = {"SimSun", "宋体", "STSong"}
SANS_FALLBACKS = {"Microsoft YaHei", "微软雅黑", "Microsoft YaHei UI"}
CJK_SCRIPTS = ("Hans", "Hant", "Jpan", "Hang")


def read_typography(lock_path: Path) -> dict[str, str]:
    rows: dict[str, str] = {}
    section = None
    for raw in lock_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if section != "typography":
            continue
        m = re.match(r"^-\s+([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$", line)
        if m:
            rows[m.group(1)] = m.group(2)
    return rows


def patch_theme(data: bytes, major: str | None, minor: str | None) -> bytes:
    root = etree.fromstring(data)
    for tag, family in (("majorFont", major), ("minorFont", minor)):
        if not family:
            continue
        coll = root.find(f".//a:{tag}", NS)
        if coll is None:
            continue
        for child_tag in ("latin", "ea", "cs"):
            el = coll.find(f"a:{child_tag}", NS)
            if el is None:
                el = etree.SubElement(coll, f"{{{A}}}{child_tag}")
            el.set("typeface", family)
        for item in coll.findall("a:font", NS):
            if item.get("script") in CJK_SCRIPTS:
                item.set("typeface", family)
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def _ensure_after(parent: etree._Element, tag: str, previous: etree._Element) -> etree._Element:
    el = parent.find(f"{{{A}}}{tag}")
    if el is None:
        el = etree.Element(f"{{{A}}}{tag}")
        previous.addnext(el)
    return el


def patch_slide(data: bytes, title: str | None = None, body: str | None = None) -> tuple[bytes, int, int]:
    root = etree.fromstring(data)
    aligned = 0
    mapped = 0
    for rpr in root.iter(f"{{{A}}}rPr"):
        latin = rpr.find(f"{{{A}}}latin")
        if latin is None:
            continue
        face = (latin.get("typeface") or "").strip()
        if not face:
            continue

        target = None
        if any(marker in face for marker in CJK_MARKERS):
            target = face
            aligned += 1
        elif face in SERIF_FALLBACKS and title:
            target = title
            mapped += 1
        elif face in SANS_FALLBACKS and body:
            target = body
            mapped += 1
        if not target:
            continue

        latin.set("typeface", target)
        ea = _ensure_after(rpr, "ea", latin)
        ea.set("typeface", target)
        cs = _ensure_after(rpr, "cs", ea)
        cs.set("typeface", target)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True), aligned, mapped


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pptx")
    ap.add_argument("--spec-lock", help="spec_lock.md 路径（读取 title_family/body_family）")
    ap.add_argument("--title-font")
    ap.add_argument("--body-font")
    ap.add_argument("-o", "--output")
    args = ap.parse_args()

    src = Path(args.pptx).resolve()
    if not src.is_file():
        print(f"not found: {src}")
        return 1
    dst = Path(args.output).resolve() if args.output else src.with_name(src.stem + ".cjk" + src.suffix)

    title = args.title_font
    body = args.body_font
    if args.spec_lock:
        rows = read_typography(Path(args.spec_lock))
        title = title or rows.get("title_family") or rows.get("font_family")
        body = body or rows.get("body_family") or rows.get("font_family")
    if not title and not body:
        print("warning: 未提供 --spec-lock/--title-font/--body-font，只修 run 级 ea/cs")

    aligned_count = 0
    mapped_count = 0
    theme_count = 0
    tmp_fd, tmp_name = tempfile.mkstemp(suffix=".pptx")
    os.close(tmp_fd)
    try:
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp_name, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                name = item.filename
                if name.startswith("ppt/theme/theme") and name.endswith(".xml") and (title or body):
                    data = patch_theme(data, title, body)
                    theme_count += 1
                elif name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                    data, aligned, mapped = patch_slide(data, title, body)
                    aligned_count += aligned
                    mapped_count += mapped
                zout.writestr(item, data)
        shutil.move(tmp_name, dst)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)

    print(
        f"themes patched: {theme_count}; runs aligned: {aligned_count}; "
        f"fallback runs mapped: {mapped_count}"
    )
    print(f"saved: {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
