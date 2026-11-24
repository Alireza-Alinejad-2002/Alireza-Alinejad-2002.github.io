"""Turn raw SOLIDWORKS captures (print-capture PNG or SaveBMP) into site images.

Crops to the model's bounding box (anything not near-white), centres it on a
white canvas of the target size with an even margin, and writes an optimised
RGB PNG with no metadata (no EXIF, no text chunks).

usage: python postprocess.py <in.png|in.bmp> <out.png> [--width 2560] [--height 1600] [--margin 0.06]
"""
import argparse

from PIL import Image, ImageChops


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--width", type=int, default=2560)
    ap.add_argument("--height", type=int, default=1600)
    ap.add_argument("--margin", type=float, default=0.06)
    ap.add_argument("--threshold", type=int, default=12, help="difference from white that counts as model")
    a = ap.parse_args()

    with Image.open(a.src) as im:
        img = im.convert("RGB")
    white = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, white).convert("L").point(lambda v: 255 if v > a.threshold else 0)
    box = diff.getbbox()
    if box is None:
        raise SystemExit(f"{a.src}: image is blank")
    if box[0] <= 1 or box[1] <= 1 or box[2] >= img.width - 1 or box[3] >= img.height - 1:
        print(f"WARNING {a.src}: model touches the image edge (clipped?) bbox={box} size={img.size}")
    obj = img.crop(box)

    inner_w = a.width * (1 - 2 * a.margin)
    inner_h = a.height * (1 - 2 * a.margin)
    scale = min(inner_w / obj.width, inner_h / obj.height)
    size = (max(1, round(obj.width * scale)), max(1, round(obj.height * scale)))
    obj = obj.resize(size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (a.width, a.height), (255, 255, 255))
    canvas.paste(obj, ((a.width - size[0]) // 2, (a.height - size[1]) // 2))
    canvas.save(a.dst, "PNG", optimize=True)
    print(f"{a.dst}: {a.width}x{a.height}, model {size[0]}x{size[1]} (from {img.size[0]}x{img.size[1]}, scale {scale:.2f})")


if __name__ == "__main__":
    main()
