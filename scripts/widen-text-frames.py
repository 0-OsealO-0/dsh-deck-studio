#!/usr/bin/env python3
"""给 PPTX 的文本框留出横向余量，避免 WPS/其他渲染器把最后一行挤断。

ppt-master 导出的文本框宽度 = 文字估算宽度 + 极小 padding，bodyPr 里写着
wrap="none"。PowerPoint 认这条属性，所以本机回渲看不出问题；WPS 等渲染器
会忽略 wrap="none"，按框宽折行，于是每行最后一个字被挤到下一行。

做法：只调宽度，不动字号、颜色、位置语义——
- algn="l"：x 不动，cx 加余量（文字左对齐，视觉位置不变）
- algn="ctr"：x 左移半份余量，cx 加整份
- algn="r"：x 左移整份余量，cx 加整份（右边线保持不动）

用法：
    python widen-text-frames.py <deck.pptx> [--ratio 0.12] [--min-px 6]
输出覆盖原文件，并在同目录留一份 .bak。
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import zipfile
from pathlib import Path

SLIDE_RE = re.compile(r'ppt/slides/slide\d+\.xml$')
SP_RE = re.compile(r'<p:sp>.*?</p:sp>', re.S)
OFF_RE = re.compile(r'<a:off x="(\d+)" y="(\d+)"/>')
EXT_RE = re.compile(r'<a:ext cx="(\d+)" cy="(\d+)"/>')
ALGN_RE = re.compile(r'<a:pPr[^>]*algn="(l|ctr|r|just)"')

EMU_PER_PX = 9525


def widen_shape(shape: str, ratio: float, min_emu: int) -> tuple[str, bool]:
    # 只处理真正的文本框：普通形状（细线、色块、分隔线）宽度是版面尺寸，不能动。
    if '<p:txBody>' not in shape or '<a:bodyPr' not in shape:
        return shape, False
    off = OFF_RE.search(shape)
    ext = EXT_RE.search(shape)
    if not off or not ext:
        return shape, False

    cx = int(ext.group(1))
    # 余量按框宽比例算，但不小于固定像素下限，保证短文本也不被挤断。
    slack = max(min_emu, int(cx * ratio))
    algn_match = ALGN_RE.search(shape)
    algn = algn_match.group(1) if algn_match else 'l'

    x = int(off.group(1))
    if algn == 'ctr':
        x -= slack // 2
    elif algn == 'r':
        x -= slack
    elif algn == 'just':
        return shape, False

    new_cx = cx + slack
    patched = shape[: off.start()] + f'<a:off x="{x}" y="{off.group(2)}"/>' + shape[off.end() :]
    ext = EXT_RE.search(patched)
    patched = patched[: ext.start()] + f'<a:ext cx="{new_cx}" cy="{ext.group(2)}"/>' + patched[ext.end() :]
    return patched, True


def widen_slide(xml: str, ratio: float, min_emu: int) -> tuple[str, int]:
    changed = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal changed
        shape, ok = widen_shape(match.group(0), ratio, min_emu)
        if ok:
            changed += 1
        return shape

    return SP_RE.sub(repl, xml), changed


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pptx')
    parser.add_argument('--ratio', type=float, default=0.12)
    parser.add_argument('--min-px', type=float, default=6.0)
    args = parser.parse_args(argv[1:])

    target = Path(args.pptx).expanduser().resolve()
    if not target.is_file():
        print(f'找不到文件：{target}', file=sys.stderr)
        return 2

    backup = target.with_suffix(target.suffix + '.bak')
    shutil.copy(target, backup)

    min_emu = int(args.min_px * EMU_PER_PX)
    with zipfile.ZipFile(target) as zin:
        items = [(info, zin.read(info.filename)) for info in zin.infolist()]

    total = 0
    out: list[tuple[zipfile.ZipInfo, bytes]] = []
    for info, data in items:
        if SLIDE_RE.match(info.filename):
            xml, changed = widen_slide(data.decode('utf-8'), args.ratio, min_emu)
            total += changed
            data = xml.encode('utf-8')
        out.append((info, data))

    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info, data in out:
            zout.writestr(info, data)

    print(f'加宽了 {total} 个文本框（ratio={args.ratio}, min={args.min_px}px）；备份：{backup.name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
