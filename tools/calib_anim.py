"""Calibrate posed model geometry against meleelight's existing baked outlines.

Before any missing animation frame can be generated, the pipeline has to be
shown to reproduce frames that already exist. This poses the costume model at a
given frame and compares the projected point cloud's extent with the recorded
silhouette's extent for the same frame.

Melee's fighters face along Z, so the side-on plane meleelight draws is (Z, Y)
-- the same projection bake_offsets.py uses for hitboxes (see tools/README).

Usage:
    python tools/calib_anim.py tools/dat Falcon FURASLEEPLOOP FuraSleepLoop
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS, joint_root, model_scale
from figatree import AJ, subaction_anims
from model import Mesh
from skeleton import load_skeleton, pose

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def baked_frames(char, state):
    """Load meleelight's recorded outlines for one state via node."""
    path = os.path.join(ROOT, "src", "animations", char.lower(), state + ".js")
    if not os.path.exists(path):
        return None
    js = ("const a=require(%s);"
          "console.log(JSON.stringify(a.map(f=>f.map(p=>Array.from(p)))));"
          % json.dumps(path.replace("\\", "/")))
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True,
                         cwd=ROOT)
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:400])
    return json.loads(out.stdout)


def extent(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), max(xs), min(ys), max(ys)


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    char = sys.argv[2] if len(sys.argv) > 2 else "Falcon"
    state = sys.argv[3] if len(sys.argv) > 3 else "FURASLEEPLOOP"
    sub = sys.argv[4] if len(sys.argv) > 4 else "FuraSleepLoop"

    dat, root, ajn, nr = CHARS[char]
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    if sub not in anims:
        print("no subaction %s for %s" % (sub, char))
        return 2
    off, size = anims[sub]
    mscale = model_scale(datdir, dat, root)

    baked = baked_frames(char, state)
    print("%s %s: figatree frames=%s  baked frames=%s  model_scale=%.4f"
          % (char, state, int(aj.frame_count(off, size)),
             "none" if baked is None else len(baked), mscale))
    print()
    print("%-6s | %-34s | %s" % ("frame", "posed (Z,Y) extent",
                                 "baked outline extent"))
    print("-" * 92)

    n = min(6, len(baked) if baked else 6)
    for f in range(n):
        world = pose(joints, aj, off, size, f + 1, root_scale=mscale)
        pts = mesh.world_vertices(world)
        # Melee's Z is meleelight's x.
        proj = [(p[2], p[1]) for p in pts]
        pminx, pmaxx, pminy, pmaxy = extent(proj)
        cell = "x[%7.2f,%7.2f] y[%7.2f,%7.2f]" % (pminx, pmaxx, pminy, pmaxy)
        if baked and f < len(baked):
            flat = [(pt[i], pt[i + 1]) for pt in baked[f]
                    for i in range(0, len(pt), 2)]
            bminx, bmaxx, bminy, bmaxy = extent(flat)
            bcell = "x[%5d,%5d] y[%5d,%5d]" % (bminx, bmaxx, bminy, bmaxy)
            sx = (bmaxx - bminx) / (pmaxx - pminx) if pmaxx > pminx else 0
            sy = (bmaxy - bminy) / (pmaxy - pminy) if pmaxy > pminy else 0
            bcell += "   scaleX=%.3f scaleY=%.3f" % (sx, sy)
        else:
            bcell = "(no baked frame)"
        print("%-6d | %-34s | %s" % (f + 1, cell, bcell))
    return 0


if __name__ == "__main__":
    sys.exit(main())
