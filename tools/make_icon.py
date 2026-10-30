"""توليد أيقونة ProCashier (PNG + ICO) — التشغيل: python tools/make_icon.py"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
S = 1024

BLUE_TOP = (14, 165, 233)    # #0EA5E9
BLUE_BOTTOM = (37, 99, 235)  # #2563EB
WHITE = (255, 255, 255, 255)
GREEN = (34, 197, 94, 255)   # #22C55E


def _lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def _gradient(size: int) -> Image.Image:
    col = Image.new("RGB", (1, size))
    px = col.load()
    for y in range(size):
        t = y / (size - 1)
        px[0, y] = (
            _lerp(BLUE_TOP[0], BLUE_BOTTOM[0], t),
            _lerp(BLUE_TOP[1], BLUE_BOTTOM[1], t),
            _lerp(BLUE_TOP[2], BLUE_BOTTOM[2], t),
        )
    return col.resize((size, size))


def _rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def _receipt(draw: ImageDraw.ImageDraw, s: int) -> None:
    x0, x1 = int(s * 0.30), int(s * 0.70)
    y0, y1 = int(s * 0.14), int(s * 0.70)
    teeth = 8
    zig = int(s * 0.035)
    step = (x1 - x0) / teeth

    pts = [(x0, y0), (x1, y0), (x1, y1)]
    for i in range(teeth):
        a = x1 - i * step
        b = a - step
        pts.append(((a + b) / 2, y1 + zig))
        pts.append((b, y1))
    draw.polygon(pts, fill=WHITE)

    bar_h = int(s * 0.048)
    bars = [
        (int(s * 0.36), int(s * 0.64)),
        (int(s * 0.36), int(s * 0.52)),
        (int(s * 0.36), int(s * 0.60)),
    ]
    for i, (bx0, bx1) in enumerate(bars):
        by = int(s * (0.26 + i * 0.12))
        draw.rounded_rectangle([bx0, by, bx1, by + bar_h], radius=bar_h // 2, fill=BLUE_TOP + (255,))


def _check_badge(draw: ImageDraw.ImageDraw, s: int) -> None:
    cx, cy, r = int(s * 0.735), int(s * 0.735), int(s * 0.175)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GREEN, outline=WHITE, width=int(s * 0.035))
    w = int(s * 0.055)
    draw.line([(cx - r * 0.45, cy), (cx - r * 0.10, cy + r * 0.38)], fill=WHITE, width=w)
    draw.line([(cx - r * 0.10, cy + r * 0.38), (cx + r * 0.50, cy - r * 0.36)], fill=WHITE, width=w)


def build(size: int = S) -> Image.Image:
    bg = _gradient(size).convert("RGBA")
    bg.putalpha(_rounded_mask(size, int(size * 0.22)))
    draw = ImageDraw.Draw(bg)
    _receipt(draw, size)
    _check_badge(draw, size)
    return bg


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    icon = build()

    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon.save(PUBLIC / "icon.ico", sizes=sizes)
    icon.resize((512, 512), Image.LANCZOS).save(PUBLIC / "icon.png")
    icon.resize((512, 512), Image.LANCZOS).save(PUBLIC / "icon-512.png")
    icon.resize((192, 192), Image.LANCZOS).save(PUBLIC / "icon-192.png")

    favicon = ROOT / "flutter_app" / "web" / "favicon.png"
    if favicon.parent.exists():
        icon.resize((48, 48), Image.LANCZOS).save(favicon)

    for name in ("icon.ico", "icon.png", "icon-192.png", "icon-512.png"):
        print("wrote", PUBLIC / name)


if __name__ == "__main__":
    main()
