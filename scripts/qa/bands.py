"""Compare two 1600x900 renders band by band (SVG vs PowerPoint export).

Usage:
    python scripts/qa/bands.py svg.png pptx.png

Prints dx/dy/dw/dh of the ink bounding box inside the headline and footer bands.
Requires Pillow (the DSH runtime python has it).
"""
import sys

from PIL import Image

BANDS = {
    "headline": (100, 240, 1520, 640),
    "footer": (100, 700, 1520, 890),
}


def ink_box(img, box, threshold=128):
    x0, y0, x1, y1 = box
    px = img.load()
    left = top = right = bottom = None
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y] < threshold:
                left = x if left is None else min(left, x)
                right = x if right is None else max(right, x)
                top = y if top is None else min(top, y)
                bottom = y if bottom is None else max(bottom, y)
    if left is None:
        return None
    return left, top, right - left + 1, bottom - top + 1


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    a = Image.open(sys.argv[1]).convert("L")
    b = Image.open(sys.argv[2]).convert("L")
    print(f"{'band':<9} {'dx':>4} {'dy':>4} {'dw':>4} {'dh':>4}")
    for name, box in BANDS.items():
        ba = ink_box(a, box)
        bb = ink_box(b, box)
        if ba is None or bb is None:
            print(f"{name:<9}  (no ink in one render)")
            continue
        print(
            f"{name:<9} {bb[0] - ba[0]:>4} {bb[1] - ba[1]:>4} "
            f"{bb[2] - ba[2]:>4} {bb[3] - ba[3]:>4}"
        )


if __name__ == "__main__":
    main()
