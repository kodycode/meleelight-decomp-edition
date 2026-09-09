"""Render a recorded outline and the generated one side by side, as a PNG.

Numbers say how much two silhouettes differ; a picture says WHERE. Used to
settle whether the recorded traces include a character's sword.

    red   = recorded only
    green = generated only
    grey  = both

Usage:
    python tools/compare_frame.py tools/dat Marth SQUAT Squat 1 out.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS, joint_root, model_scale
from figatree import AJ, subaction_anims
from model import Mesh
from skeleton import load_skeleton
import silhouette as S
import gen_animations as G
from PIL import Image


def main():
    datdir = sys.argv[1]
    char = sys.argv[2]
    state = sys.argv[3]
    sub = sys.argv[4]
    frame = int(sys.argv[5])
    out = sys.argv[6]
    scale_override = float(sys.argv[7]) if len(sys.argv) > 7 else None

    dat, root, ajn, nr = CHARS[char]
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
    aj = AJ(os.path.join(datdir, ajn))
    off, size = subaction_anims(os.path.join(datdir, dat), root)[sub]
    ms = model_scale(datdir, dat, root)
    sc = scale_override or (G.REF_STAGE_SCALE / G.char_scale(char))

    rec = G.load_frames(char, state)
    path, _ = G.build_frame(mesh, joints, aj, off, size, frame, ms, sc)

    g = S.flatten_path(path)
    r = []
    for p in rec[frame - 1]:
        r += S.flatten_path(p)

    allp = g + r
    b = (min(p[0] for p in allp) - 4, max(p[0] for p in allp) + 4,
         min(p[1] for p in allp) - 4, max(p[1] for p in allp) + 4)
    RES = 2.0
    _, w, h, ox, oy, res = S.rasterize([], RES, b)
    gm = S.polygon_mask(g, w, h, ox, oy, res)
    rm = S.polygon_mask(r, w, h, ox, oy, res)

    img = Image.new("RGB", (w, h), (255, 255, 255))
    px = img.load()
    for i in range(w * h):
        a, bb = gm[i], rm[i]
        if a and bb:
            c = (110, 110, 110)
        elif bb:
            c = (220, 40, 40)
        elif a:
            c = (40, 170, 40)
        else:
            continue
        px[i % w, i // w] = c
    img.save(out)
    print("%s %s frame %d scale=%.3f -> %s  (%dx%d)  IoU=%.4f"
          % (char, state, frame, sc, out, w, h, S.iou(gm, rm)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
