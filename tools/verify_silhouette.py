"""Generate frames that ALREADY EXIST and measure them against the recorded ones.

No generated frame should be written into src/animations until the pipeline can
reproduce frames that are already there. This rasterises both the generated
silhouette and meleelight's recorded path for the same frame and reports the
intersection-over-union, plus the offset that best aligns them.

Usage:
    python tools/verify_silhouette.py tools/dat Falcon FURASLEEPLOOP FuraSleepLoop
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
import silhouette as S

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# render.js:247 -- the path is drawn at charScale * (stage.scale / 4.5), and a
# position at pos * stage.scale, so one game unit is stage.scale / charScale
# path units. 4.5 is meleelight's reference stage scale.
REF_STAGE_SCALE = 4.5


def char_scale(char):
    fn = {"Marth": "marth/marthAttributes.js", "Puff": "puff/puffAttributes.js"}.get(
        char, char.lower() + "/attributes.js")
    path = os.path.join(ROOT, "src", "characters", fn)
    txt = open(path, encoding="utf8").read()
    import re
    m = re.search(r"charScale\s*:\s*([0-9.]+)", txt)
    return float(m.group(1))


def baked(char, state):
    path = os.path.join(ROOT, "src", "animations", char.lower(), state + ".js")
    if not os.path.exists(path):
        return None
    js = ("const a=require(%s);"
          "console.log(JSON.stringify(a.map(f=>f.map(p=>Array.from(p)))));"
          % json.dumps(path.replace("\\", "/")))
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True,
                         cwd=ROOT)
    out.check_returncode()
    return json.loads(out.stdout)


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    char = sys.argv[2] if len(sys.argv) > 2 else "Falcon"
    state = sys.argv[3] if len(sys.argv) > 3 else "FURASLEEPLOOP"
    sub = sys.argv[4] if len(sys.argv) > 4 else "FuraSleepLoop"
    nframes = int(sys.argv[5]) if len(sys.argv) > 5 else 4

    dat, root, ajn, nr = CHARS[char]
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    off, size = anims[sub]
    mscale = model_scale(datdir, dat, root)
    cs = char_scale(char)
    scale = REF_STAGE_SCALE / cs

    rec = baked(char, state)
    print("%s %s  charScale=%.3f -> path units per game unit = %.4f"
          % (char, state, cs, scale))
    print("model_scale=%.4f  recorded frames=%d  figatree frames=%d"
          % (mscale, len(rec), int(aj.frame_count(off, size))))
    print()
    print("%-6s %-9s %-26s %s" % ("frame", "IoU", "generated bbox", "recorded bbox"))
    print("-" * 88)

    RES = 1.0     # one mask cell per path unit
    for f in range(1, min(nframes, len(rec)) + 1):
        world = pose(joints, aj, off, size, f, root_scale=mscale)
        tris = mesh.world_triangles(world)
        tris2d = S.project(tris, scale)

        recpts = []
        for p in rec[f - 1]:
            recpts += S.flatten_path(p)
        rxs = [p[0] for p in recpts]
        rys = [p[1] for p in recpts]
        gxs = [p[0] for t in tris2d for p in t]
        gys = [p[1] for t in tris2d for p in t]
        bounds = (min(min(gxs), min(rxs)), max(max(gxs), max(rxs)),
                  min(min(gys), min(rys)), max(max(gys), max(rys)))

        mask, w, h, ox, oy, res = S.rasterize(tris2d, RES, bounds)
        mask = S.fill_holes(mask, w, h)
        mask = S.largest_component(mask, w, h)
        rmask = S.polygon_mask(recpts, w, h, ox, oy, res)

        # Centroid difference estimates any systematic origin offset between
        # the generated shape and the traced one. Reported, not applied --
        # a constant offset would mean the projection is anchored differently,
        # which is worth understanding rather than fitting away.
        def centroid(m):
            sx = sy = n = 0
            for i, v in enumerate(m):
                if v:
                    sx += i % w
                    sy += i // w
                    n += 1
            return (sx / n, sy / n) if n else (0, 0)
        gcx, gcy = centroid(mask)
        rcx, rcy = centroid(rmask)

        print("%-6d %-9.4f x[%6.1f,%6.1f] y[%6.1f,%6.1f]  x[%6.1f,%6.1f] y[%6.1f,%6.1f]"
              "  dcx=%+.2f dcy=%+.2f"
              % (f, S.iou(mask, rmask),
                 min(gxs), max(gxs), min(gys), max(gys),
                 min(rxs), max(rxs), min(rys), max(rys),
                 (rcx - gcx) / res, (rcy - gcy) / res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
