"""Fighter hurtboxes: the capsules Melee actually tests hitboxes against.

meleelight collides against ONE axis-aligned box, built from a two-number
`hurtboxOffset` attribute and never changed by the animation
(physics.js:1372). A crouching Fox has the same hurtbox as a standing one.

Melee has nothing of the sort. Each fighter carries a list of CAPSULES, each
riding a bone, each with its own radius:

    ftData+0x30 -> { int count; ftHurtboxInit* inits; }

    struct ftHurtboxInit {          // 0x28 bytes   (ftCommon/types.h:23)
        Fighter_Part bone_idx;      // +0x00
        HurtHeight   height;        // +0x04   0 = low, 1 = mid, 2 = high
        u32          is_grabbable;  // +0x08
        Vec3         a_offset;      // +0x0C   one end, in the bone's frame
        Vec3         b_offset;      // +0x18   the other end
        float        scale;         // +0x24   the capsule radius
    };

The data is self-checking. Every limb appears as a mirrored PAIR with identical
offsets and radius -- Fox's bones 55/25, 56/26, 12/6, 13/7 -- so a
misinterpretation of the layout would show up immediately as pairs that do not
match. They do.

    python tools/hurtbox.py tools/dat                 # list every capsule
    python tools/hurtbox.py tools/dat Fox Wait1 0     # posed, one frame

MIRRORED LIMBS DO NOT COLLAPSE IN 2D, which is worth stating because it is the
natural assumption and it is wrong. meleelight's horizontal is Melee's Z, so
the axis thrown away is Melee's X -- and a left and right leg differ mostly
along Z, not X, whenever the fighter is mid-stride. Measured on Fox: the two
leg capsules project 3.5 units apart in Wait, 11.6 apart in Dash. There is no
halving the data this way.
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose_cached as pose, transform
from ecb import CHARS, joint_root, model_scale

HEIGHT = {0: "low", 1: "mid", 2: "high"}


def hurt_inits(datdir, dat, root):
    """The character's hurtbox capsules, straight from ftData+0x30."""
    a = Archive(os.path.join(datdir, dat))
    p = a.ptr(a.root(root) + 0x30)
    if p is None:
        return []
    base = a.data_off + p
    count = struct.unpack(">I", a.raw[base:base + 4])[0]
    ptr = struct.unpack(">I", a.raw[base + 4:base + 8])[0]
    off = a.data_off + ptr
    out = []
    for i in range(count):
        e = off + i * 0x28
        bone, height, grab = struct.unpack(">3I", a.raw[e:e + 12])
        a_off = struct.unpack(">3f", a.raw[e + 12:e + 24])
        b_off = struct.unpack(">3f", a.raw[e + 24:e + 36])
        radius = struct.unpack(">f", a.raw[e + 36:e + 40])[0]
        out.append({"index": i, "bone": bone, "height": height,
                    "grabbable": bool(grab), "a": a_off, "b": b_off,
                    "radius": radius})
    return out


def posed(joints, aj, off, size, frame, caps, mscale):
    """Each capsule as ((x1, y1), (x2, y2), radius) in meleelight's plane.

    Same projection and same reference point as the hitbox offsets: the (Z, Y)
    components, measured from TransN, with the fighter's model scale applied.
    The radius is NOT scaled here -- see the note in the runtime data.
    """
    w = pose(joints, aj, off, size, frame, root_scale=mscale)
    oz, oy = w[1][2][3], w[1][1][3]
    out = []
    for c in caps:
        m = w[c["bone"]]
        pa = transform(m, c["a"])
        pb = transform(m, c["b"])
        out.append(((pa[2] - oz, pa[1] - oy),
                    (pb[2] - oz, pb[1] - oy), c["radius"]))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]

    if len(sys.argv) < 4:
        for char, (dat, root, ajn, nr) in CHARS.items():
            caps = hurt_inits(datdir, dat, root)
            print(f"== {char}: {len(caps)} hurtbox capsules")
            for c in caps:
                print(f"   {c['index']:2}  bone {c['bone']:3}  "
                      f"{HEIGHT.get(c['height'], '?'):4}  "
                      f"{'grabbable' if c['grabbable'] else '         '}  "
                      f"a=({c['a'][0]:6.3f},{c['a'][1]:6.3f},{c['a'][2]:6.3f})  "
                      f"b=({c['b'][0]:6.3f},{c['b'][1]:6.3f},{c['b'][2]:6.3f})  "
                      f"r={c['radius']:.4f}")
        return 0

    char, sub = sys.argv[2], sys.argv[3]
    frame = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    dat, root, ajn, nr = CHARS[char]
    caps = hurt_inits(datdir, dat, root)
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    if sub not in anims:
        print(f"{char} has no subaction {sub}", file=sys.stderr)
        return 1
    off, size = anims[sub]
    ms = model_scale(datdir, dat, root)
    n = int(aj.frame_count(off, size) or 1)
    frame = min(frame, n - 1)
    print(f"{char} {sub} frame {frame} of {n}, {len(caps)} capsules, "
          f"projected to (Z, Y) from TransN:")
    for c, (p, q, r) in zip(caps, posed(joints, aj, off, size, frame, caps, ms)):
        print(f"   {c['index']:2}  bone {c['bone']:3}  "
              f"({p[0]:7.3f},{p[1]:7.3f}) -> ({q[0]:7.3f},{q[1]:7.3f})  r={r:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
