"""Regenerate Puff's DAMAGEN2 outright, all 24 frames.

This is the ONE place in this project where generated frames REPLACE recorded
ones rather than being appended after them, so the reason needs to be on the
record.

DAMAGEN2 is a 24-frame animation (validate_frames.py checks it against the
figatree header). Puff has only 11 recorded outlines, and they cannot be
reproduced: the generated silhouette matches at frame 3 (IoU 0.61) and drifts
steadily away by frame 10 (0.34), with the recorded shape sliding down and to
the right of the generated one while staying the same size and shape.

That drift is not scale and not pose:
  * her scale is settled -- 22.488 path units per game unit, fitted from her
    own SQUAT, and the same value reproduces her CLIFFCATCH (0.857), ESCAPEF
    (0.815), ESCAPEB (0.782), ESCAPEN (0.743) and SHIELDBREAKFALL (0.768);
  * subtracting TransN or not makes no difference at all (identical IoU to
    four decimals), so the animation carries no root translation to blame.

What is left is that the capture included the fighter's own KNOCKBACK
DISPLACEMENT -- DamageN2 is a hit reaction, and the character is being pushed
while it plays. Every other character's DAMAGEN2 reproduces cleanly (Fox
0.766, Falco 0.833, Falcon 0.791), so this is one bad recording rather than a
pipeline fault.

Appending 13 position-independent frames onto 11 drifting ones would produce a
visible jump at the seam. Regenerating all 24 gives a self-consistent
animation, position-independent like every other state in the project. The old
frames are in git if this turns out worse.

    python tools/regen_puff_damagen2.py            # report only
    python tools/regen_puff_damagen2.py --write
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

CHAR = "Puff"
STATE = "DAMAGEN2"
SUB = "DamageN2"
# Fitted from Puff's own SQUAT; her charScale of 0.240 is 20% off what her art
# was traced at (an implied 0.20), so 4.5/charScale cannot be used for her.
SCALE = 22.488


def main():
    datdir = "tools/dat"
    write = "--write" in sys.argv

    dat, root, ajn, nr = CHARS[CHAR]
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
    aj = AJ(os.path.join(datdir, ajn))
    off, size = subaction_anims(os.path.join(datdir, dat), root)[SUB]
    mscale = model_scale(datdir, dat, root)

    want = G.frame_counts(CHAR).get(STATE)
    rec = G.load_frames(CHAR, STATE)
    print("%s %s: %d recorded, %d animation frames, scale %.3f"
          % (CHAR, STATE, len(rec), want, SCALE))
    print()

    frames = []
    prev = None
    print("%-6s %-9s %-24s %s" % ("frame", "points", "bbox", "step"))
    for f in range(1, want + 1):
        path, _ = G.build_frame(mesh, joints, aj, off, size, f, mscale, SCALE)
        if path is None:
            print("  frame %d failed to pose" % f)
            return 1
        frames.append([path])
        pts = S.flatten_path(path)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        step = "" if prev is None else "%.2f" % (
            ((cx - prev[0]) ** 2 + (cy - prev[1]) ** 2) ** 0.5)
        prev = (cx, cy)
        print("%-6d %-9d x[%6.1f,%6.1f] y[%6.1f,%6.1f] %s"
              % (f, (len(path) - 2) // 6, min(xs), max(xs), min(ys), max(ys), step))

    if write:
        G.write_frames(CHAR, STATE, frames)
        print("\n  wrote %d frames (replacing %d recorded)" % (len(frames), len(rec)))
    else:
        print("\n  %d frames ready (report only -- pass --write to apply)" % len(frames))
    return 0


if __name__ == "__main__":
    sys.exit(main())
