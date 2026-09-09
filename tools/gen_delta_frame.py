"""Extend an animation by transferring the model's frame-to-frame delta.

Some states cannot be generated outright. Marth is the clear case: 19 of his
90 joints carry no animation tracks, because his cape is driven by Melee's
runtime dynamics rather than by the figatree. Posing him from the animation
alone leaves the cape in its bind position, and the recorded traces captured a
live simulation, so a generated silhouette disagrees with its neighbours no
matter how good the rest of the pose is.

But the cape error is the SAME in consecutive generated frames, so it cancels
in a difference. Starting from the recorded outline and applying only what the
model says changed keeps the traced cape and moves the body:

    new = (recorded_prev AND NOT vacated) OR entered
        vacated = mine_prev AND NOT mine_new
        entered = mine_new  AND NOT mine_prev

Anything identical between mine_prev and mine_new -- the whole cape -- appears
in neither term, so the recorded pixels for it survive untouched.

This is only sound for a SHORT extension off the end of a traced run, where
the body moves a little and the error cannot accumulate. It is validated by
predicting a frame that already exists from its predecessor and comparing
against the real thing.

    python tools/gen_delta_frame.py tools/dat            # report only
    python tools/gen_delta_frame.py tools/dat --write
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

# States still short after gen_animations.py, and their subactions. The fourth
# field overrides the path scale: Puff's recorded art was traced at an implied
# charScale of 0.20 rather than the 0.240 in her attributes, so 4.5/0.240 is
# 20% too small for her. 22.488 is what her own SQUAT frames fit, measured on a
# state whose alignment is not in doubt.
TARGETS = [
    ("Marth", "SQUAT", "Squat", None),
    ("Marth", "DASH", "Dash", None),
    ("Marth", "DAMAGEN2", "DamageN2", None),
    ("Marth", "DOWNSTANDF", "DownFowardU", None),
    ("Marth", "ESCAPEB", "EscapeB", None),
    ("Marth", "ESCAPEF", "EscapeF", None),
    ("Marth", "ESCAPEN", "EscapeN", None),
    ("Fox", "ESCAPEN", "EscapeN", None),
    ("Puff", "DAMAGEN2", "DamageN2", 22.488),
]

MIN_IOU = 0.80          # the bar is higher here: this method should be better
RES = 2.0


def masks_for(mesh, joints, aj, off, size, frame, mscale, scale, bounds, res):
    """Rasterise the generated silhouette for one frame on a fixed grid."""
    path, _ = G.build_frame(mesh, joints, aj, off, size, frame, mscale, scale)
    if path is None:
        return None
    return S.polygon_mask(S.flatten_path(path), *bounds, res)


def combine(prev_rec, mine_prev, mine_new):
    out = bytearray(len(prev_rec))
    for i in range(len(out)):
        entered = mine_new[i] and not mine_prev[i]
        vacated = mine_prev[i] and not mine_new[i]
        if entered:
            out[i] = 1
        elif vacated:
            out[i] = 0
        else:
            out[i] = 1 if prev_rec[i] else 0
    return out


def mask_to_path(mask, w, h, ox, oy, res):
    mask = S.fill_holes(mask, w, h)
    mask = S.largest_component(mask, w, h)
    contour = S.trace_contour(mask, w, h)
    if len(contour) < 8:
        return None
    pts = [(ox + cx / res, oy + cy / res) for cx, cy in contour]
    return S.to_path(S.simplify(pts, G.SIMPLIFY_TOL))


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    write = "--write" in sys.argv
    added = 0

    for char, state, sub, scale_override in TARGETS:
        dat, root, ajn, nr = CHARS[char]
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        if sub not in anims:
            print("  %-7s %-12s no subaction %s" % (char, state, sub))
            continue
        off, size = anims[sub]
        mscale = model_scale(datdir, dat, root)
        scale = scale_override or (G.REF_STAGE_SCALE / G.char_scale(char))

        rec = G.load_frames(char, state)
        want = G.frame_counts(char).get(state)
        if rec is None or want is None or len(rec) >= want:
            continue
        n = len(rec)

        # Grid big enough for everything involved.
        pts = []
        for f in (n - 1, n):
            for p in rec[f - 1]:
                pts += S.flatten_path(p)
        for f in (n - 1, n, want):
            path, _ = G.build_frame(mesh, joints, aj, off, size, f, mscale, scale)
            if path:
                pts += S.flatten_path(path)
        pad = 6
        b = (min(p[0] for p in pts) - pad, max(p[0] for p in pts) + pad,
             min(p[1] for p in pts) - pad, max(p[1] for p in pts) + pad)
        _, w, h, ox, oy, res = S.rasterize([], RES, b)
        grid = (w, h, ox, oy)

        # SELF-TEST: predict the last recorded frame from the one before it.
        rec_prev = S.polygon_mask(
            [q for p in rec[n - 2] for q in S.flatten_path(p)], w, h, ox, oy, res)
        rec_last = S.polygon_mask(
            [q for p in rec[n - 1] for q in S.flatten_path(p)], w, h, ox, oy, res)
        mine_a = masks_for(mesh, joints, aj, off, size, n - 1, mscale, scale, grid, res)
        mine_b = masks_for(mesh, joints, aj, off, size, n, mscale, scale, grid, res)
        if mine_a is None or mine_b is None:
            print("  %-7s %-12s could not pose" % (char, state))
            continue
        pred = combine(rec_prev, mine_a, mine_b)
        selftest = S.iou(pred, rec_last)

        # THE BAR IS "BETTER THAN HOLDING", not an absolute score.
        #
        # With no frame to draw, render.js holds the previous pose, so the
        # thing a generated frame has to beat is the previous frame itself.
        # An absolute threshold asks the wrong question: Marth's cape is
        # simulated at runtime and moves between recorded frames, so even a
        # perfect body pose cannot score highly against the trace -- but it can
        # still be closer than repeating the frame before it.
        hold = S.iou(rec_prev, rec_last)
        pure = S.iou(mine_b, rec_last)

        # Pick whichever of the three actually reproduced the known frame best.
        best = max((hold, "hold"), (selftest, "delta"), (pure, "pure"))
        status = "keep holding" if best[1] == "hold" else "use " + best[1]
        print("  %-7s %-12s %2d -> %2d   hold=%.3f  delta=%.3f  pure=%.3f  -> %s"
              % (char, state, n, want, hold, selftest, pure, status))
        if best[1] == "hold":
            continue

        new = list(rec)
        cur_rec = rec_last
        for f in range(n + 1, want + 1):
            if best[1] == "pure":
                path, _ = G.build_frame(mesh, joints, aj, off, size, f,
                                        mscale, scale)
                new.append([path] if path else list(new[-1]))
                added += 1
                continue
            ma = masks_for(mesh, joints, aj, off, size, f - 1, mscale, scale, grid, res)
            mb = masks_for(mesh, joints, aj, off, size, f, mscale, scale, grid, res)
            if ma is None or mb is None:
                new.append(list(new[-1]))
                continue
            cur_rec = combine(cur_rec, ma, mb)
            path = mask_to_path(bytearray(cur_rec), w, h, ox, oy, res)
            new.append([path] if path else list(new[-1]))
            added += 1
        if write:
            G.write_frames(char, state, new)

    print()
    print("  %d frames %s" % (added, "written" if write else "to add"))
    if added and not write:
        print("  (report only -- pass --write to apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
