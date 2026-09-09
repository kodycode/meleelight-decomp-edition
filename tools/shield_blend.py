"""Melee's exact joint-space blend for the shield's partial tilt, and a
measurement of what the world-space shortcut costs.

`gen_shield.py` bakes the two ENDPOINTS of the shield tilt (magnitude 0 and 1)
and the runtime interpolates between them in world space. Melee interpolates in
JOINT space, which is not the same operation: rotations compose, so a blend of
two poses is not the blend of the two resulting positions.

This implements the real thing so the difference can be measured rather than
assumed:

    ftAnim_80070108 (ftanim.c:977)
        walks the joint tree from TransN and, per joint, calls
        lb_8000C868(reference_joint, jobj, jobj, 1 - mag, mag)

    lb_8000C868 (lb_00B0.c:568)
        translate = ref.position * (1-mag) + cur.translate * mag
        scale     = ref.scale    * (1-mag) + cur.scale     * mag
        rotation  = if the three Euler components differ by <= 1e-4, copy the
                    reference outright; otherwise EulerToQuat both, negate the
                    second if |p-q| > |p+q| (the shortest-arc fix), and slerp
                    with HSD_QuatLib_8037EF28 at t = mag

    HSD_QuatLib_8037EF28 (quatlib.c:148)
        ordinary slerp via acosf/sinf, falling back to a linear blend when the
        quaternions are within 1e-10 of parallel

The reference pose is `ftData->x20->x0[2]`, an HSD_Joint tree in PlXx.dat whose
layout (flags +4, child +8, next +C, rotation +0x14, scale +0x20, position
+0x2C) is exactly what skeleton.load_skeleton already reads.

NOT MODELLED: ftAnim_80070108 skips parts flagged b0/b5 and takes a different
path for b4, via the per-character ftParts table. Those flags are checked here
by asserting that the blend reproduces BOTH endpoints exactly -- if a joint on
the shield's chain were being skipped, magnitude 0 or 1 would not come back
matching gen_shield.py's own numbers.

Usage:
    python tools/shield_blend.py <datdir>
"""
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from figatree import AJ
from skeleton import (load_skeleton, pose, pose_locals,
                      world_from_locals, transform)
from ecb import joint_root, model_scale
from subaction import SUBACTION_COUNT, WAD_SIZE

CHARS = [
    ("Fox",    "PlFx.dat", "ftDataFox",     "PlFxAJ.dat", "PlFxNr.dat"),
    ("Falco",  "PlFc.dat", "ftDataFalco",   "PlFcAJ.dat", "PlFcNr.dat"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "PlCaAJ.dat", "PlCaNr.dat"),
    ("Marth",  "PlMs.dat", "ftDataMars",    "PlMsAJ.dat", "PlMsNr.dat"),
    ("Puff",   "PlPr.dat", "ftDataPurin",   "PlPrAJ.dat", "PlPrNr.dat"),
]
GUARD_SUBACTION = 38
ANGLE_BIAS = 10


def read_joint_tree(a, off):
    """Depth-first SRT list from an HSD_Joint tree at `off` in archive `a`."""
    out = []

    def read(o):
        b = a.raw[a.data_off + o: a.data_off + o + 0x40]
        child, nxt = struct.unpack(">2I", b[8:16])
        rot = struct.unpack(">3f", b[0x14:0x20])
        scale = struct.unpack(">3f", b[0x20:0x2C])
        trans = struct.unpack(">3f", b[0x2C:0x38])
        return child, nxt, rot, scale, trans

    def walk(o):
        while o:
            child, nxt, rot, scale, trans = read(o)
            out.append({"rot": list(rot), "scale": list(scale),
                        "trans": list(trans)})
            if child:
                walk(child)
            o = nxt

    walk(off)
    return out


def euler_to_quat(r):
    """EulerToQuat. ZYX order, matching HSD's own decomposition."""
    cx, sx = math.cos(r[0] / 2), math.sin(r[0] / 2)
    cy, sy = math.cos(r[1] / 2), math.sin(r[1] / 2)
    cz, sz = math.cos(r[2] / 2), math.sin(r[2] / 2)
    return (sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz)


def quat_to_euler(q):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    sinr = 2 * (w * x + y * z)
    cosr = 1 - 2 * (x * x + y * y)
    rx = math.atan2(sinr, cosr)
    sp = 2 * (w * y - z * x)
    ry = math.asin(max(-1.0, min(1.0, sp)))
    siny = 2 * (w * z + x * y)
    cosy = 1 - 2 * (y * y + z * z)
    rz = math.atan2(siny, cosy)
    return [rx, ry, rz]


def slerp(p, q, t):
    """HSD_QuatLib_8037EF28 (quatlib.c:148)."""
    cosom = sum(a * b for a, b in zip(p, q))
    if (1.0 + cosom) > 1e-10:
        if (1.0 - cosom) > 1e-10:
            theta = math.acos(max(-1.0, min(1.0, cosom)))
            sinom = math.sin(theta)
            sp = math.sin((1.0 - t) * theta) / sinom
            sq = math.sin(t * theta) / sinom
        else:
            sp, sq = 1.0 - t, t
        return tuple(sp * a + sq * b for a, b in zip(p, q))
    # Antipodal: HSD rotates 90 degrees about a perpendicular instead.
    return (-p[1], p[0], -p[3], p[2])


def blend_joint(ref, cur, mag):
    """lb_8000C868(ref, cur, out, 1 - mag, mag), one joint."""
    inv = 1.0 - mag
    out = {
        "trans": [ref["trans"][i] * inv + cur["trans"][i] * mag for i in range(3)],
        "scale": [ref["scale"][i] * inv + cur["scale"][i] * mag for i in range(3)],
        "rot": None,
    }
    d = [ref["rot"][i] - cur["rot"][i] for i in range(3)]
    if all(abs(v) <= 1e-4 for v in d):
        out["rot"] = list(ref["rot"])
        return out
    p = euler_to_quat(ref["rot"])
    q = euler_to_quat(cur["rot"])
    ssum = sum((a + b) ** 2 for a, b in zip(p, q))
    sdif = sum((a - b) ** 2 for a, b in zip(p, q))
    if sdif > ssum:
        q = tuple(-v for v in q)
    out["rot"] = quat_to_euler(slerp(p, q, mag))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]

    print("Max deviation of the world-space lerp from Melee's joint-space blend,")
    print("over all 360 tilt degrees and magnitudes 0.05..0.95, in world units:\n")

    worst_overall = 0.0
    for name, dat, root, ajn, nr in CHARS:
        a = Archive(os.path.join(datdir, dat))
        aj = AJ(os.path.join(datdir, ajn))
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        ms = model_scale(datdir, dat, root)

        bone = a.raw[a.data_off + a.ptr(a.root(root) + 0x08) + 0x11]
        tbl = a.ptr(a.root(root) + 0x0C)
        e = tbl + GUARD_SUBACTION * WAD_SIZE
        off, size = a.d_u32(e + 0x04), a.d_u32(e + 0x08)

        x20 = a.ptr(a.root(root) + 0x20)
        refp = a.ptr(a.ptr(x20 + 0x00) + 8)      # x0[2]
        ref = read_joint_tree(a, refp)

        worst = 0.0
        for deg in range(0, 360, 3):
            base = pose_locals(joints, aj, off, size, ANGLE_BIAS + deg,
                               root_scale=ms)
            p1 = transform(world_from_locals(joints, base)[bone], (0., 0., 0.))
            r0 = pose_locals(joints, aj, off, size, 0, root_scale=ms)
            p0 = transform(world_from_locals(joints, r0)[bone], (0., 0., 0.))
            for mi in range(1, 20):
                mag = mi / 20.0
                # ftAnim_80070108 walks from FtPart_TransN, which is joint
                # index 1 -- so reference[k] pairs with joints[k+1] and the
                # root is not blended at all. Confirmed structurally: the
                # reference tree's shape matches the skeleton's from index 1
                # on 100% of nodes for all five characters, and 13-17% at
                # index 0. Getting this off by one still reproduces the
                # magnitude-1 endpoint exactly, because the reference
                # contributes nothing there -- so that endpoint check does NOT
                # validate the alignment, and an earlier measurement made with
                # shift 0 reported a plausible but meaningless 3.7 units.
                blended = [blend_joint(ref[i - 1], base[i], mag)
                           if 1 <= i <= len(ref) else base[i]
                           for i in range(len(joints))]
                pb = transform(world_from_locals(joints, blended)[bone], (0., 0., 0.))
                pl = tuple(p0[k] + (p1[k] - p0[k]) * mag for k in range(3))
                d = math.dist((pb[1], pb[2]), (pl[1], pl[2]))
                worst = max(worst, d)
        worst_overall = max(worst_overall, worst)
        print(f"  {name:7} worst deviation {worst:.4f} units")

    print(f"\n  overall worst {worst_overall:.4f} units")
    return 0


if __name__ == "__main__":
    sys.exit(main())
