"""Prepare portfolio images: crop, resize (<=2560px), strip metadata.

Run with the miniconda Python (Pillow):  python -I tools/img/prepare.py <scratch_dir>
<scratch_dir> holds images extracted from PDFs with `pdfimages -png` (see README).
Outputs go to src/assets/... ; originals are never modified.
"""
import sys, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCR = sys.argv[1] if len(sys.argv) > 1 else ""
OUT = os.path.join(ROOT, "src", "assets")
MAX = 2560

def save(im, rel, fmt="png", quality=90):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if max(im.size) > MAX:
        im.thumbnail((MAX, MAX), Image.LANCZOS)
    clean = Image.new(im.mode, im.size)  # drops EXIF / ancillary chunks
    clean.paste(im)
    if fmt == "jpg":
        clean.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    else:
        clean.save(path, "PNG", optimize=True)
    print(f"{rel:60s} {clean.size}")

def op(p): return Image.open(p)
def scr(*p): return os.path.join(SCR, *p)

P = "E:/profile"
TH = f"{P}/BScThesis/figures"
# ---------- profile ----------
save(op(os.path.join(ROOT, "images/profile.png")).convert("RGB"), "profile/portrait.jpg", "jpg", 86)

# ---------- dragonfly ----------
D = "projects/dragonfly-fwmav"
save(op(os.path.join(ROOT, "images/dragonfly.png")).convert("RGB"), f"{D}/vehicle-render.jpg", "jpg", 88)
im = op(f"{TH}/S04-M4-fig02_bionicopter-final-cad.png").convert("RGB")
save(im.crop((3700, 0, 6335, 1650)), f"{D}/mechanism-v46-detail.jpg", "jpg", 88)
save(im.crop((0, 0, 3600, 2860)), f"{D}/mechanism-v46-front.jpg", "jpg", 88)
save(op(f"{TH}/S06-fig01_latest-mechanism.png").convert("RGB"), f"{D}/prototype-flapping.jpg", "jpg", 86)
save(op(f"{TH}/S05-fig02_final-mass.png").convert("RGB"), f"{D}/prototype-82g.jpg", "jpg", 86)
save(op(f"{TH}/S05-fig03_test-setup.png").convert("RGB"), f"{D}/test-bench.jpg", "jpg", 86)
save(op(f"{TH}/S05-fig01_wing-proto.png").convert("RGB"), f"{D}/wing.jpg", "jpg", 86)
save(op(f"{TH}/S04-M1-fig01_coil-magnet-cad.png").convert("RGB"), f"{D}/m1-coil-magnet.jpg", "jpg", 86)
save(op(f"{TH}/S04-M2-fig01_coreless-cad.png").convert("RGB"), f"{D}/m2-coreless.jpg", "jpg", 86)
save(op(f"{TH}/S04-M3-fig01_dove-cad.png").convert("RGB"), f"{D}/m3-dove.jpg", "jpg", 86)
save(op(f"{TH}/S04-M4-fig01_bionicopter-evolution.png").convert("RGB"), f"{D}/m4-evolution.jpg", "jpg", 86)
save(op(f"{TH}/S04-M4-fig08_bionicopter-proto-v4.6.png").convert("RGB"), f"{D}/prototype-v46-annotated.jpg", "jpg", 86)
save(op(f"{P}/dragonfly_patent/Drawings/fig01.png").convert("L"), f"{D}/patent-fig01.png")
save(op(f"{P}/dragonfly_patent/Drawings/fig02.png").convert("L"), f"{D}/patent-fig02.png")
if SCR:
    rgb = op(scr("deck", "d1-007.png")).convert("RGB"); a = op(scr("deck", "d1-008.png")).convert("L")
    rgb.putalpha(a); save(rgb, f"{D}/fwmav-render-alpha.png")
    save(op(scr("deck", "d1-006.png")).convert("RGB"), f"{D}/prototype-lab.jpg", "jpg", 86)

# ---------- small projects ----------
if SCR:
    im = op(scr("deck", "d1-002.png")).convert("RGB"); w, h = im.size
    save(im.crop((30, 30, w - 30, h - 30)), "projects/misc/rotary-pendulum.jpg", "jpg", 86)
    im = op(scr("deck", "d1-000.png")).convert("RGB"); w, h = im.size
    save(im.crop((14, 14, w - 14, h - 14)), "projects/misc/quadrotor-simulink.png")
    im = op(scr("deck", "d1-013.png")).convert("RGB"); w, h = im.size
    save(im.crop((40, 40, w - 40, h - 40)), "profile/thesis-defense.jpg", "jpg", 84)

# ---------- AeroNEX (AD2) ----------
A = "projects/aeronex-dep-air-taxi"
if SCR:
    save(op(scr("ad2", "cock-010.png")).convert("RGB"), f"{A}/iso-cutaway.jpg", "jpg", 88)
    save(op(scr("ad2", "cock-006.png")).convert("RGB"), f"{A}/top.jpg", "jpg", 88)
    save(op(scr("ad2", "cock-008.png")).convert("RGB"), f"{A}/side.jpg", "jpg", 88)
    save(op(scr("ad2", "cock-002.png")).convert("RGB"), f"{A}/nose-gear.jpg", "jpg", 88)
    save(op(scr("ad2", "fus-000.png")).convert("RGB"), f"{A}/cabin.jpg", "jpg", 88)
    save(op(scr("ad2", "stab-007.png")).convert("RGB").crop((560, 100, 1350, 1000)), f"{A}/openvsp-cp.jpg", "jpg", 88)
    save(op(scr("ad2", "stab-009.png")).convert("RGB").crop((300, 120, 1700, 1000)), f"{A}/openvsp-model.jpg", "jpg", 88)
    save(op(scr("ad2", "wing-007.png")).convert("RGB").crop((250, 160, 1280, 640)), f"{A}/wing-structure.jpg", "jpg", 88)

# ---------- Manticores (AD1) ----------
M = "projects/amphibious-manticores"
MP = "E:/SUT/BSc/Semester7/Aircraft Design 1/Project 2/Manticores_FinalReport"
save(op(f"{MP}/Poster_AD1.jpg").convert("RGB").crop((7030, 3420, 12880, 5900)), f"{M}/hero-render.jpg", "jpg", 88)
if SCR:
    for n, name in [("129", "iso"), ("130", "front"), ("135", "top"), ("136", "side")]:
        save(op(scr("mant", f"rep-{n}.png")).convert("RGB"), f"{M}/{name}.jpg", "jpg", 88)
