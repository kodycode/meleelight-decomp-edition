"""Generate everything meleelight needs for the DASH GRAB (ftCo_MS_CatchDash).

Melee has TWO grabs and meleelight had one:

    ftCo_MS_Catch       30 frames   entered from KneeBend_IASA
                                    (ftCo_Catch_CheckInput, ftCo_Catch.c:16)
    ftCo_MS_CatchDash   40 frames   entered from Dash_IASA (ftCo_Dash.c:91)
                                    and Run_IASA (ftCo_Run.c:109), both via
                                    ftCo_800D8A38 (ftCo_Catch.c:38)

Both check `(held & HSD_PAD_LR) && (pressed & HSD_PAD_A)`; the ONLY difference
is which motion state they enter. That difference is the whole of the tech the
community calls jump-cancel grab: out of a dash or run you get the slow grab,
unless you enter jumpsquat first, because KneeBend's IASA reaches the standing
one. meleelight sent DASH, RUN and KNEEBEND all to a single 30-frame GRAB, so
every run grab was already a standing grab and the tech bought nothing.

This tool emits, from the disc, per character:

  * the create_hitbox group -- frame, ids, bone, b_offset, size
  * the per-frame offsets meleelight's setOffsets block wants, computed the
    same way bake_offsets.py computes every other one:
        offset[frame] = bone_world * b_offset - TransN, projected to (Z, Y, X)
  * the animation frame count from the figatree header

SELF-CHECK FIRST. Before emitting anything it recomputes the offsets for the
STANDING grab, which meleelight already has recorded, and compares. If this
cannot reproduce a value the project already trusts it has no business
generating the one it does not have, so a mismatch aborts.

    python tools/gen_catchdash.py tools/dat            # report + self-check
    python tools/gen_catchdash.py tools/dat --emit     # print the JS blocks
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS, joint_root, model_scale
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose_cached as pose, transform
from pair_offsets import script_groups
from f32 import shortest

# meleelight's character order / directory, and where each one's grab hitbox
# object and offsets live.
CHARS_ORDER = [
    ("Marth", "marth", "marthAttributes.js"),
    ("Puff", "puff", "puffAttributes.js"),
    ("Fox", "fox", "attributes.js"),
    ("Falco", "falco", "attributes.js"),
    ("Falcon", "falcon", "attributes.js"),
]

# What meleelight already records for the STANDING grab, as the self-check
# target. These are the values in each character's setOffsets `grab` block.
RECORDED_GRAB = {
    "Fox": {"id0": [(8.25, 6.75, 0.0)] * 2, "id1": [(4.5, 6.75, 0.0)] * 2},
}


def offsets_for(datdir, char, sub):
    """[(frame, {id: (horizontal, vertical, depth)})] for every active frame.

    Melee's fighters face along Z, so meleelight's side-on plane is (Z, Y) and
    the third component is depth -- the same projection bake_offsets.py uses.
    """
    dat, root, ajn, nr = CHARS[char]
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    if sub not in anims:
        return None, None
    off, size = anims[sub]
    nframes = int(aj.frame_count(off, size) or 1)
    mscale = model_scale(datdir, dat, root)

    groups = script_groups(datdir, dat, root).get(sub, [])
    # The live set is created on one frame and cleared on another; active_len
    # is how many frames it is live for.
    starts = [(f, hs, al) for f, hs, al in groups if hs]
    if not starts:
        return None, nframes

    frame, hs, active = starts[0]
    out = []
    for t in range(active):
        f = min(frame + t, nframes - 1)
        w = pose(joints, aj, off, size, f, root_scale=mscale)
        pts = {}
        for hid, h in sorted(hs.items()):
            p = transform(w[h["bone"]], h["b_offset"])
            pts[hid] = (p[2] - w[1][2][3],    # horizontal = Melee Z
                        p[1] - w[1][1][3],    # vertical   = Melee Y
                        p[0] - w[1][0][3])    # depth      = Melee X
        out.append((f, pts))
    return (frame, active, hs, out), nframes


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    emit = "--emit" in sys.argv

    # ---- self-check against the standing grab meleelight already records ----
    print("self-check: recompute the STANDING grab offsets already in the project")
    bad = 0
    for char, want in RECORDED_GRAB.items():
        got, _n = offsets_for(datdir, char, "Catch")
        if got is None:
            print("  %-8s Catch has no hitbox group -- cannot self-check" % char)
            bad += 1
            continue
        _f, _a, _hs, pts = got
        for idx, (hid, exp) in enumerate(sorted(want.items())):
            for t, (ex, ey, ez) in enumerate(exp):
                gx, gy, gz = pts[t][1][idx]
                d = max(abs(gx - ex), abs(gy - ey), abs(gz - ez))
                flag = "ok" if d < 0.02 else "MISMATCH"
                if d >= 0.02:
                    bad += 1
                print("  %-8s %s f%-2d  want (%7.3f,%7.3f,%7.3f)  got "
                      "(%7.3f,%7.3f,%7.3f)  d=%.4f  %s"
                      % (char, hid, t, ex, ey, ez, gx, gy, gz, d, flag))
    if bad:
        print("\n  self-check FAILED -- not emitting anything")
        return 1
    print("  self-check passed\n")

    # ---- the dash grab ----
    print("%-8s %8s %8s  %s" % ("char", "Catch", "CatchDash", "hitbox group"))
    blocks = {}
    for char, cdir, attrs in CHARS_ORDER:
        st, n_st = offsets_for(datdir, char, "Catch")
        dh, n_dh = offsets_for(datdir, char, "CatchDash")
        if dh is None:
            print("%-8s %8s %8s  NO GROUP" % (char, n_st, n_dh))
            continue
        frame, active, hs, pts = dh
        ids = ",".join("id%d" % i for i in sorted(hs))
        print("%-8s %8d %8d  f%d..f%d  %s  bones %s"
              % (char, n_st, n_dh, frame, frame + active - 1, ids,
                 ",".join(str(hs[i]["bone"]) for i in sorted(hs))))
        blocks[char] = (cdir, attrs, frame, active, hs, pts, n_dh)

    if not emit:
        print("\n  pass --emit to print the JS blocks")
        return 0

    for char, (cdir, attrs, frame, active, hs, pts, n) in blocks.items():
        print("\n" + "=" * 68)
        print("// %s  src/characters/%s/%s" % (char, cdir, attrs))
        print("// CatchDash: %d frames, hitboxes live f%d..f%d "
              "(ftCo_MS_CatchDash)" % (n, frame, frame + active - 1))
        print("  grabDash : {")
        for k, hid in enumerate(sorted(hs)):
            vs = ",".join("new Vec3D(%s,%s,%s)"
                          % (shortest(p[1][hid][0]), shortest(p[1][hid][1]),
                             shortest(p[1][hid][2]))
                          for p in pts)
            comma = "," if k < len(hs) - 1 else ""
            print("    id%d : [%s]%s" % (hid, vs, comma))
        print("  },")
        args = ",".join(
            "new createHitbox(offsets[IDX].grabDash.id%d,%s,0,361,100,0,0,2,3,1,1)"
            % (hid, shortest(hs[hid]["size"])) for hid in sorted(hs))
        print("  grabDash : new createHitboxObject(%s)," % args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
