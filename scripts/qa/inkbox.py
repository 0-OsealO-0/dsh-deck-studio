"""Ink bounding box of one tight region, for checking a single text block.

Usage:
    python scripts/qa/inkbox.py svg.png pptx.png 1400 820 1540 890

Prints the two boxes plus dx/dy/dw/dh. Requires Pillow.
"""
import sys

from PIL import Image


def bbox(path, box, threshold=160):
    img = Image.open(path).convert("L")
    px = img.load()
    x0, y0, x1, y1 = box
    left = top = right = bottom = None
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y] < threshold:
                left = x if left is None else min(left, x)
                right = x if right is None else max(right, x)
                top = y if top is None else min(top, y)
                bottom = y if bottom is None else max(bottom, y)
    return None if left is None else (left, top, right - left + 1, bottom - top + 1)


def main():
    if len(sys.argv) != 7:
        raise SystemExit(__doc__)
    x0, y0, x1, y1 = (int(v) for v in sys.argv[3:7])
    a = bbox(sys.argv[1], (x0, y0, x1, y1))
    b = bbox(sys.argv[2], (x0, y0, x1, y1))
    print(f"svg={a} pptx={b}")
    if a and b:
        print(
            f"dx={b[0] - a[0]} dy={b[1] - a[1]} "
            f"dw={b[2] - a[2]} dh={b[3] - a[3]}"
        )


if __name__ == "__main__":
    main()
