"""Show why one offset property does or does not pair, track against track.

pair_offsets.py reduces a property to a single number. When that number is bad
the useful question is HOW it is bad, and the shape of the disagreement says
which of several very different things went wrong:

  * both tracks agree            -- pairing is right, nothing to see
  * a constant difference        -- right bone, different measuring origin
  * the AXES are exchanged       -- Melee rotates the fighter by code during
                                    this move, so the pose alone cannot
                                    reproduce it. Fox's Firefox is the example:
                                    the disc has x fixed at 3.91 and y moving,
                                    meleelight has y fixed at 11.72 and x
                                    moving, and ml_x = 8.18 - disc_y holds
                                    across all 30 frames.
  * meleelight's track is FLAT   -- a placeholder, not an observation
  * the disc track is flat       -- the hitbox is on the root joint, so any
                                    per-frame variation meleelight recorded
                                    came from somewhere else
  * neither matches anything     -- genuinely unresolved

    python tools/explain_offset.py tools/dat Fox upb2 SpecialHi 0
    python tools/explain_offset.py tools/dat Marth pummel CatchAttack 6 6

The subaction and frame are the group to test against; the trailing number is
the frame shift, default 0. pair_offsets.py names both in its report.
"""
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose, transform
from ecb import CHARS, joint_root, model_scale
from pair_offsets import script_groups, parse_offsets, JS


def spread(vals):
    return max(vals) - min(vals) if vals else 0.0


def main():
    if len(sys.argv) < 6:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    datdir, char, prop, sub = sys.argv[1:5]
    frame = int(sys.argv[5])
    shift = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    dat, root, ajn, nr = CHARS[char]
    ml = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    offs, vals, synth = parse_offsets(os.path.join(ml, JS[char]))
    groups = script_groups(datdir, dat, root)
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    mscale = model_scale(datdir, dat, root)
    if sub not in anims or sub not in groups:
        print(f"{char} has no subaction {sub}", file=sys.stderr)
        return 1
    hs = next((h for f, h, _a in groups[sub] if f == frame), None)
    if hs is None:
        print(f"{sub} has no hitbox group at frame {frame}; groups are at "
              + ", ".join(str(f) for f, _h, _a in groups[sub]), file=sys.stderr)
        return 1

    off, size = anims[sub]
    n = int(aj.frame_count(off, size) or 1)
    keys = sorted(hs)
    print(f"{char} {prop} vs {sub}@f{frame}+{shift}   "
          f"({len(keys)} disc hitbox(es), animation {n} frames)")

    for pos, (_o, idn, sz, dm) in enumerate(vals.get(prop, [])):
        if pos >= len(keys):
            print(f"  {idn}: meleelight declares this hitbox, the disc group "
                  f"has only {len(keys)}")
            continue
        h = hs[keys[pos]]
        rec = offs.get(prop, {}).get(idn)
        note = ""
        if rec is None:
            k = synth.get((prop, idn))
            note = f" (placeholder, {k} frames)" if k else " (no recorded array)"
            rec = []
        print(f"  {idn}: size {float(sz):g} vs {h['size']:.4g}, "
              f"dmg {int(float(dm))} vs {int(h['damage'])}, "
              f"bone {h['bone']}, b_offset {tuple(round(v, 3) for v in h['b_offset'])}"
              f"{note}")
        dx, dy, mx, my, err = [], [], [], [], []
        for t in range(max(len(rec), 1)):
            f = min(frame + t + shift, n - 1)
            w = pose(joints, aj, off, size, f, root_scale=mscale)
            p = transform(w[h["bone"]], h["b_offset"])
            gx, gy = p[2] - w[1][2][3], p[1] - w[1][1][3]
            dx.append(gx)
            dy.append(gy)
            if t < len(rec):
                mx.append(rec[t][0])
                my.append(rec[t][1])
                err.append(((gx - rec[t][0]) ** 2 + (gy - rec[t][1]) ** 2) ** 0.5)
        print(f"      disc  x {min(dx):7.2f}..{max(dx):7.2f}  "
              f"y {min(dy):7.2f}..{max(dy):7.2f}")
        if not mx:
            continue
        print(f"      ml    x {min(mx):7.2f}..{max(mx):7.2f}  "
              f"y {min(my):7.2f}..{max(my):7.2f}   mean dist {statistics.mean(err):.2f}")
        # The four shapes the docstring names, tested rather than eyeballed.
        # Per-axis, because half-flat is the interesting case: a track that is
        # fixed in one axis and moving in the other is what an exchanged pair
        # of axes looks like from each side.
        flat_ml = [a for a, s in (("x", spread(mx)), ("y", spread(my))) if s < 0.05]
        flat_dc = [a for a, s in (("x", spread(dx)), ("y", spread(dy))) if s < 0.05]
        if len(flat_ml) == 2:
            print("      -> meleelight's track is FLAT: a placeholder, not an "
                  "observation")
        elif flat_ml:
            print(f"      -> meleelight's {flat_ml[0]} never moves")
        if len(flat_dc) == 2:
            print(f"      -> the disc track is FLAT (bone {h['bone']} does not "
                  "move relative to TransN in this animation)")
        elif flat_dc:
            print(f"      -> the disc's {flat_dc[0]} never moves")
        if len(mx) > 2:
            sx = [a + b for a, b in zip(mx, dy)]
            sy = [a - b for a, b in zip(my, dx)]
            if spread(mx) > 0.2 and spread(sx) < 0.1:
                print(f"      -> AXES EXCHANGED: ml_x = {statistics.mean(sx):.2f} "
                      f"- disc_y across every frame. Melee rotates the fighter "
                      f"by code in this move; the pose alone cannot show it.")
            elif spread(sy) < 0.1 and spread(my) > 0.2:
                print(f"      -> AXES EXCHANGED: ml_y = {statistics.mean(sy):.2f} "
                      f"+ disc_x across every frame.")
            cx = [a - b for a, b in zip(mx, dx)]
            cy = [a - b for a, b in zip(my, dy)]
            if spread(cx) < 0.2 and spread(cy) < 0.2 and statistics.mean(err) > 0.3:
                print(f"      -> CONSTANT OFFSET ({statistics.mean(cx):.2f}, "
                      f"{statistics.mean(cy):.2f}): the right bone measured "
                      f"from a different origin")
    return 0


if __name__ == "__main__":
    sys.exit(main())
