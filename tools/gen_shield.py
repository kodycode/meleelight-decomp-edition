"""Bake the shield's collision position, per character, per tilt degree.

The shield is NOT drawn at a fixed offset from the fighter. Its collision
centre is the world position of ONE BONE with a zero offset, and that bone is
posed by a dedicated 370-frame animation seeked to the tilt angle:

    ftCo_80091E78 (ftCo_Guard.c:214)
        ftAnim_8006F4C8(fp, true, ftData_80085E50(fp, 38));   // the Guard anim
        ftAnim_80070710(jobj, fp->mv.co.guard.x8);            // seek to angle
        ...
        HSD_JObjAnimAll(jobj);

    ftColl_8007B1B8 (ftcoll.c:3175)
        fp->shield_hit.bone   = fp->parts[shield->bone].joint;
        fp->shield_hit.offset = shield->pos;      // (0,0,0) for the shield
        fp->shield_hit.size   = shield->radius;

    lbColl_80007BCC (lbcollision.c:1586)
        lb_8000B1CC(shield_hit->bone, &shield_hit->offset, &shield_hit->pos);

Three facts make this bakeable rather than guessable, and all three are checked
by this tool rather than assumed:

  * subaction index 38 is the `Guard` animation and it is 370 FRAMES on every
    character -- which is exactly the range `mv.co.guard.x8` produces, since
    ftCo_80091BC4 stores `10 + degrees` with degrees clamped to 0..359. One
    animation frame per degree of tilt.
  * the shield bone is `ftData->x8->x11`, a per-character index.
  * the collision offset is (0, 0, 0), so the bone's world position IS the
    shield centre; there is nothing else to add.

PARTIAL TILT. Melee blends the Guard pose toward a reference pose with weight
`mv.co.guard.x4` (ftAnim_80070108 -> lb_8000C868, ftCo_Guard.c:228), in JOINT
space -- rotations slerp, so it is not the same as interpolating the two
resulting positions. tools/shield_blend.py implements that blend exactly and
measures the difference; this tool bakes MAGNITUDE KNOTS so the runtime's
linear interpolation lands on the real curve.

With knots only at the endpoints the error is zero for Fox, Falco, Falcon and
Marth -- their shield chains are effectively rigid between the two poses -- and
0.0635 units for Puff, whose chain rotates. It falls fourfold per doubling of
the knot count, so MAG_KNOTS below sets the residual.

The magnitude-0 pose is the REFERENCE joint tree (`ftData->x20->x0[2]`), which
is the blend's true limit as the magnitude approaches zero. Melee skips the
whole block when the magnitude is exactly zero and uses the ordinary animation
pose instead; those two differ by at most 0.0038 units, so the discontinuity is
not observable.

Usage:
    python tools/gen_shield.py <datdir> [--write|--check]
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from figatree import AJ
from subaction import SUBACTION_COUNT, WAD_SIZE
from skeleton import load_skeleton, pose, pose_locals, world_from_locals, transform
from shield_blend import read_joint_tree, blend_joint
from ecb import joint_root, model_scale

# name, PlXx.dat, ftData root, PlXxAJ.dat, PlXxNr.dat, meleelight char id
CHARS = [
    ("Fox",    "PlFx.dat", "ftDataFox",     "PlFxAJ.dat", "PlFxNr.dat", 2),
    ("Falco",  "PlFc.dat", "ftDataFalco",   "PlFcAJ.dat", "PlFcNr.dat", 3),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "PlCaAJ.dat", "PlCaNr.dat", 4),
    ("Marth",  "PlMs.dat", "ftDataMars",    "PlMsAJ.dat", "PlMsNr.dat", 0),
    ("Puff",   "PlPr.dat", "ftDataPurin",   "PlPrAJ.dat", "PlPrNr.dat", 1),
]

GUARD_SUBACTION = 38     # ftData_80085E50(fp, 38), ftCo_Guard.c:222
# Magnitude samples per degree. 9 knots puts the worst residual (Puff) at
# 0.00095 units, ~0.01% of a shield radius; the other four are exact at 2.
MAG_KNOTS = 9
GUARD_FRAMES = 370       # asserted below, not assumed
ANGLE_BIAS = 10          # mv.co.guard.x8 == 10 + degrees (ftCo_80091BC4)

OUT = os.path.join("src", "main", "shieldData.js")


def shield_bone(a, root):
    """ftData->x8->x11 -- the bone whose world position is the shield centre."""
    p = a.ptr(a.root(root) + 0x08)
    if p is None:
        raise SystemExit("!! ftData+0x08 is not a relocation")
    return a.raw[a.data_off + p + 0x11]


def guard_anim(a, root, aj):
    """(offset, size, frame_count) of subaction 38, with its length checked."""
    tbl = a.ptr(a.root(root) + 0x0C)
    if tbl is None or GUARD_SUBACTION >= SUBACTION_COUNT[root]:
        raise SystemExit("!! no subaction table, or index 38 out of range")
    e = tbl + GUARD_SUBACTION * WAD_SIZE
    off, size = a.d_u32(e + 0x04), a.d_u32(e + 0x08)
    if not size:
        raise SystemExit("!! subaction 38 has no animation")
    fc = aj.frame_count(off, size)
    return off, size, fc


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    write = "--write" in sys.argv
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    tables = {}
    for name, dat, root, ajn, nr, cid in CHARS:
        a = Archive(os.path.join(datdir, dat))
        aj = AJ(os.path.join(datdir, ajn))
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))

        bone = shield_bone(a, root)
        off, size, fc = guard_anim(a, root, aj)

        # The one-frame-per-degree model only holds if the animation really is
        # 370 frames. Assert rather than trust the comment.
        if int(fc) != GUARD_FRAMES:
            print(f"!! {name}: Guard animation is {fc} frames, expected "
                  f"{GUARD_FRAMES} -- the degree mapping does not hold")
            return 1

        mscale = model_scale(datdir, dat, root)   # ftCo_DatAttrs+0x8C

        ref = read_joint_tree(a, a.ptr(a.ptr(a.ptr(a.root(root) + 0x20) + 0x00) + 8))

        def shield_at(frame, mag):
            """The shield bone, blended toward the reference pose at `mag`.

            ftAnim_80070108 walks from FtPart_TransN, joint index 1, so the
            reference tree's node k is the skeleton's joint k+1 and the root is
            never blended. That alignment is confirmed structurally: the two
            trees' shapes match on 100% of nodes at this offset and 13-17% at
            zero. It matters -- an off-by-one here still reproduces magnitude 1
            exactly, because the reference contributes nothing there, so the
            obvious endpoint check does not catch it.
            """
            local = pose_locals(joints, aj, off, size, frame, root_scale=mscale)
            if mag < 1.0:
                local = [blend_joint(ref[i - 1], local[i], mag)
                         if 1 <= i <= len(ref) else local[i]
                         for i in range(len(joints))]
            w = world_from_locals(joints, local)
            ox, oy, oz = w[1][0][3], w[1][1][3], w[1][2][3]
            p = transform(w[bone], (0.0, 0.0, 0.0))
            return (p[0] - ox, p[1] - oy, p[2] - oz)

        # [degree][knot] -- knot k is magnitude k/(MAG_KNOTS-1).
        grid = [[shield_at(ANGLE_BIAS + d, k / (MAG_KNOTS - 1))
                 for k in range(MAG_KNOTS)] for d in range(360)]
        full = [row[-1] for row in grid]
        rest = grid[0][0]

        # Residual of the runtime's piecewise-linear read against the true
        # blend, sampled between the knots. Printed so the number in this
        # file's header stays honest.
        worst = 0.0
        for d in range(0, 360, 15):
            for t in range(1, 4 * (MAG_KNOTS - 1)):
                m = t / (4.0 * (MAG_KNOTS - 1))
                k = min(int(m * (MAG_KNOTS - 1)), MAG_KNOTS - 2)
                f = m * (MAG_KNOTS - 1) - k
                lo, hi = grid[d][k], grid[d][k + 1]
                ax = lo[2] + (hi[2] - lo[2]) * f
                ay = lo[1] + (hi[1] - lo[1]) * f
                tp = shield_at(ANGLE_BIAS + d, m)
                e = ((tp[2] - ax) ** 2 + (tp[1] - ay) ** 2) ** 0.5
                worst = max(worst, e)

        hs = [p[2] for p in full]
        ys = [p[1] for p in full]
        print(f"  {name:7} bone {bone:3}  anim {int(fc)}f  "
              f"rest=(h {rest[2]:.2f}, v {rest[1]:.2f})  "
              f"h {min(hs):6.2f}..{max(hs):5.2f}  "
              f"v {min(ys):5.2f}..{max(ys):5.2f}  "
              f"residual {worst:.5f}")
        tables[cid] = (name, bone, grid)

    lines = [
        "// GENERATED by tools/gen_shield.py -- do not edit by hand.",
        "//",
        "// The shield's COLLISION CENTRE, per character, per degree of tilt.",
        "//",
        "// Melee poses the shield with a dedicated 370-frame `Guard` animation",
        "// (subaction 38) seeked to the tilt angle -- one frame per degree,",
        "// biased by 10 (ftCo_80091BC4 stores `10 + degrees`). The shield's",
        "// collision position is then the world position of one bone with a",
        "// ZERO offset (ftColl_8007B1B8, ftcoll.c:3175), so the posed bone IS",
        "// the shield centre.",
        "//",
        "// It then BLENDS that pose toward a reference pose in JOINT space at",
        "// the tilt magnitude (ftAnim_80070108 -> lb_8000C868). Because the",
        "// blend slerps rotations, interpolating the two endpoint POSITIONS is",
        "// a different operation -- so these are magnitude KNOTS sampled from",
        "// the real blend, and a linear read between adjacent knots follows",
        "// the true curve.",
        "//",
        "// Entries are [horizontal, vertical] offsets from TransN in Melee's",
        "// (Z, Y), with the model scale already applied.",
        "",
        "export const SHIELD_MAG_KNOTS = %d;" % MAG_KNOTS,
        "",
        "// [degree][knot]; knot k is tilt magnitude k / (SHIELD_MAG_KNOTS - 1).",
        "export const SHIELD_POS = {",
    ]
    for cid in sorted(tables):
        nm, bone, grid = tables[cid]
        lines.append("  %d: [   // %s, bone %d" % (cid, nm, bone))
        for d in range(360):
            row = ",".join("[%r,%r]" % (q[2], q[1]) for q in grid[d])
            lines.append("    [%s]," % row)
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    text = "\n".join(lines)

    path = os.path.join(root_dir, OUT)
    if "--check" in sys.argv:
        cur = io.open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        if cur == text:
            print("shieldData.js is up to date")
            return 0
        print("!! shieldData.js differs from what the disc produces")
        return 1
    if write:
        io.open(path, "w", encoding="utf-8", newline="").write(text)
        print(f"\nwrote {OUT}  ({len(text)/1e3:.1f} kB)")
    else:
        print(f"\ndry run -- {len(text)/1e3:.1f} kB, pass --write to emit {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
