"""Generate src/animations/<char>/CATCHDASH.js -- the DASH GRAB outlines.

CATCHDASH is a state meleelight never had, so unlike gen_animations.py there
are no recorded frames to extend and none to calibrate against. Both problems
are solved by the character's OWN STANDING GRAB:

  * the scale is fitted against the recorded GRAB frames, then reused. GRAB and
    CATCHDASH are the same model at the same charScale, one state apart, so a
    scale that reproduces one reproduces the other. This is the same reasoning
    regen_puff_damagen2.py used when it fitted Puff's DAMAGEN2 scale from her
    SQUAT.

  * the fit is REPORTED as intersection-over-union against those recorded GRAB
    frames before anything is written. A character whose GRAB cannot be
    reproduced does not get a generated CATCHDASH, because a generator that
    cannot match a state the project already trusts has no business inventing
    one it does not have.

Every frame is generated -- there is nothing to preserve here, which makes this
the one clean case for whole-state generation.

    python tools/gen_catchdash_anim.py tools/dat            # report only
    python tools/gen_catchdash_anim.py tools/dat --write
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

STATE = "CATCHDASH"
SUB = "CatchDash"
REF_STATE = "GRAB"     # meleelight's name for ftCo_MS_Catch
REF_SUB = "Catch"

# Below this the fit is not trustworthy enough to generate from. gen_animations
# uses the same bar for deciding a state may be extended.
MIN_IOU = 0.55


def fit_scale(char, mesh, joints, aj, anims, mscale):
    """(scale, mean IoU) fitted against the recorded GRAB frames.

    Tries the declared scale (render.js's stage.scale / charScale) first and a
    height-fitted one second, and keeps whichever reproduces GRAB better --
    exactly gen_animations.py's rule. Puff's declared scale is genuinely ~20%
    wrong, so she needs the fit; Marth's cape adds noise to a height fit, so
    his declared scale wins.
    """
    rec = G.load_frames(char, REF_STATE)
    if not rec:
        return None, None, "no recorded %s to calibrate against" % REF_STATE
    off, size = anims[REF_SUB]
    declared = G.REF_STAGE_SCALE / G.char_scale(char)

    # Height-fitted alternative: unit-scale the model, compare bbox heights.
    hs = []
    for f in range(min(len(rec), 6)):
        p, _ = G.build_frame(mesh, joints, aj, off, size, f, mscale, 1.0)
        if p is None:
            continue
        gy = [q[1] for q in S.flatten_path(p)]
        ry = [q[1] for q in S.flatten_path(rec[f][0])]
        if max(gy) - min(gy) > 1e-6:
            hs.append((max(ry) - min(ry)) / (max(gy) - min(gy)))
    fitted = sorted(hs)[len(hs) // 2] if hs else declared

    best = (None, -1.0)
    for cand in (declared, fitted):
        ious = []
        for f in range(min(len(rec), 8)):
            p, _ = G.build_frame(mesh, joints, aj, off, size, f, mscale, cand)
            if p is None:
                continue
            ious.append(S.iou(p, rec[f][0]))
        if ious:
            m = sum(ious) / len(ious)
            if m > best[1]:
                best = (cand, m)
    return best[0], best[1], None


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    write = "--write" in sys.argv

    print("%-8s %8s %8s %8s  %s" % ("char", "frames", "scale", "GRAB IoU", "status"))
    results = {}
    for char in ("Marth", "Puff", "Fox", "Falco", "Falcon"):
        dat, root, ajn, nr = CHARS[char]
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        mscale = model_scale(datdir, dat, root)

        if SUB not in anims:
            print("%-8s %8s %8s %8s  no %s subaction" % (char, "-", "-", "-", SUB))
            continue
        off, size = anims[SUB]
        n = int(aj.frame_count(off, size) or 1)

        scale, iou, err = fit_scale(char, mesh, joints, aj, anims, mscale)
        if err:
            print("%-8s %8d %8s %8s  %s" % (char, n, "-", "-", err))
            continue
        if iou < MIN_IOU:
            print("%-8s %8d %8.3f %8.3f  SKIPPED (below %.2f)"
                  % (char, n, scale, iou, MIN_IOU))
            continue

        frames = []
        failed = None
        for f in range(n):
            path, _ = G.build_frame(mesh, joints, aj, off, size, f, mscale, scale)
            if path is None:
                failed = f
                break
            frames.append([path])
        if failed is not None:
            print("%-8s %8d %8.3f %8.3f  FAILED to pose frame %d"
                  % (char, n, scale, iou, failed))
            continue

        print("%-8s %8d %8.3f %8.3f  %d frames ready"
              % (char, n, scale, iou, len(frames)))
        results[char] = frames

    if not write:
        print("\n  report only -- pass --write to apply")
        return 0

    for char, frames in results.items():
        G.write_frames(char, STATE, frames)
        print("  wrote src/animations/%s/%s.js (%d frames)"
              % (G.CHAR_DIR[char] if hasattr(G, "CHAR_DIR") else char.lower(),
                 STATE, len(frames)))
    return 0 if len(results) == 5 else 1


if __name__ == "__main__":
    sys.exit(main())
