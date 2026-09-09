"""Fighter skeleton, and posing it with a figatree animation.

Melee builds hurtbox positions by transforming bone-local capsule endpoints
through the joint's world matrix, so reproducing them means reproducing the
skeleton and the matrix composition. Both are in the decomp:

    HSD_JObjMakeMatrix  jobj.c:138   scl chain, local matrix, parent concat
    HSD_MtxSRT          mtx.c:362    the local matrix itself

The serialized joint (the form in the costume file, not the runtime HSD_JObj):

    +0x00 char*  class_name
    +0x04 u32    flags
    +0x08 Joint* child
    +0x0C Joint* next
    +0x10 void*  dobj
    +0x14 Vec3   rotation      (radians, Euler)
    +0x20 Vec3   scale
    +0x2C Vec3   translate
    +0x38 Mtx*   inverse bind
    +0x3C void*  robj

Joints are numbered in the order figatree's per-joint track counts use, which
is a depth-first walk from the root -- Fox has 73, matching the 73 count bytes
in every one of his animations.
"""
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from f32 import f32, add, sub, mul, sinf, cosf
from figatree import AJ
import anim

JOBJ_CLASSICAL_SCALE = 1 << 3      # jobj.h:66 -- inherit the parent's scl
JOBJ_USE_QUATERNION = 1 << 17      # jobj.h:76


class Joint(object):
    # `off` is the joint's own offset in the costume's data block. The
    # skeleton is walked from the same file that carries the model, so a
    # PObj's joint pointers can be matched back to a skeleton index with it
    # (model.py needs that to skin vertices).
    __slots__ = ("index", "parent", "children", "flags",
                 "rot", "scale", "trans", "off")

    def __init__(self, index, flags, rot, scale, trans, off=None):
        self.index = index
        self.parent = None
        self.children = []
        self.flags = flags
        self.rot = rot
        self.scale = scale
        self.trans = trans
        self.off = off


def load_skeleton(path, root_name):
    """Depth-first list of Joints. Index order matches figatree's node counts."""
    a = Archive(path)
    root = a.root(root_name)
    if root is None:
        raise KeyError(root_name + " not in " + path)

    def read(off):
        b = a.raw[a.data_off + off: a.data_off + off + 0x40]
        flags = struct.unpack(">I", b[4:8])[0]
        child, nxt = struct.unpack(">2I", b[8:16])
        rot = struct.unpack(">3f", b[0x14:0x20])
        scale = struct.unpack(">3f", b[0x20:0x2C])
        trans = struct.unpack(">3f", b[0x2C:0x38])
        return flags, child, nxt, rot, scale, trans

    joints = []

    def walk(off, parent):
        while off:
            flags, child, nxt, rot, scale, trans = read(off)
            j = Joint(len(joints), flags, list(rot), list(scale), list(trans),
                      off)
            j.parent = parent
            if parent is not None:
                parent.children.append(j)
            joints.append(j)
            if child:
                walk(child, j)
            off = nxt

    walk(root, None)
    return joints


def mtx_srt(scale, rot, trans, parent_scl, sin, cos):
    """HSD_MtxSRT (mtx.c:362). Returns a 3x4 row-major matrix.

    `parent_scl` is the parent's accumulated scale, and when present each
    column is divided through by it -- that is the "classical scale"
    compensation, NOT a plain multiply, so it cannot be folded into the
    concatenation afterwards.

    Every operation is rounded to float32 as it is performed, because the Gekko
    computes this in single precision and the parenthesisation below is the
    decompilation's, not an algebraic rearrangement of it. Grouping matters
    once each step rounds: `cosZ * (x2 * cosY)` and `(cosZ * x2) * cosY` are
    the same number in exact arithmetic and not always the same float32.
    """
    sinX, cosX = sin(rot[0]), cos(rot[0])
    sinY, cosY = sin(rot[1]), cos(rot[1])
    sinZ, cosZ = sin(rot[2]), cos(rot[2])

    x2 = x1 = x0 = f32(scale[0])
    y2 = y1 = y0 = f32(scale[1])
    z2 = z1 = z0 = f32(scale[2])
    if parent_scl is not None:
        t1 = f32(1.0 / parent_scl[0])
        t2 = f32(1.0 / parent_scl[1])
        t3 = f32(1.0 / parent_scl[2])
        y2 = mul(y2, mul(parent_scl[1], t1))
        z2 = mul(z2, mul(parent_scl[2], t1))
        x1 = mul(x1, mul(parent_scl[0], t2))
        z1 = mul(z1, mul(parent_scl[2], t2))
        x0 = mul(x0, mul(parent_scl[0], t3))
        y0 = mul(y0, mul(parent_scl[1], t3))

    return [
        [mul(cosZ, mul(x2, cosY)),
         mul(y2, sub(mul(cosZ, mul(sinX, sinY)), mul(cosX, sinZ))),
         mul(z2, add(mul(cosZ, mul(cosX, sinY)), mul(sinX, sinZ))),
         f32(trans[0])],
        [mul(sinZ, mul(x1, cosY)),
         mul(y1, add(mul(sinZ, mul(sinX, sinY)), mul(cosX, cosZ))),
         mul(z1, sub(mul(sinZ, mul(cosX, sinY)), mul(sinX, cosZ))),
         f32(trans[1])],
        [mul(-x0, sinY),
         mul(cosY, mul(y0, sinX)),
         mul(cosY, mul(z0, cosX)),
         f32(trans[2])],
    ]


def concat(a, b):
    """PSMTXConcat for 3x4 matrices: a * b, accumulated in float32."""
    out = [[0.0] * 4 for _ in range(3)]
    for r in range(3):
        ar = a[r]
        for c in range(3):
            out[r][c] = add(add(mul(ar[0], b[0][c]), mul(ar[1], b[1][c])),
                            mul(ar[2], b[2][c]))
        out[r][3] = add(add(add(mul(ar[0], b[0][3]), mul(ar[1], b[1][3])),
                            mul(ar[2], b[2][3])), ar[3])
    return out


def transform(m, v):
    """MTXMultVec, accumulated in float32."""
    return tuple(
        add(add(add(mul(m[r][0], v[0]), mul(m[r][1], v[1])),
                mul(m[r][2], v[2])), m[r][3])
        for r in range(3))


# Channel id -> (which vector, which component)
CHANNEL_SLOT = {
    1: ("rot", 0), 2: ("rot", 1), 3: ("rot", 2),
    5: ("trans", 0), 6: ("trans", 1), 7: ("trans", 2),
    8: ("scale", 0), 9: ("scale", 1), 10: ("scale", 2),
}


_POSE_CACHE = {}


def pose_cached(joints, aj, off, size, frame, root_scale=None):
    """Memoised `pose`. Posing decodes every keyframe track in the animation,
    so a search that scores many frame shifts against the same animation
    redoes that work hundreds of times -- pairing Marth went from seconds to
    minutes without this."""
    key = (id(joints), id(aj), off, size, frame, root_scale)
    hit = _POSE_CACHE.get(key)
    if hit is None:
        hit = pose(joints, aj, off, size, frame, root_scale=root_scale)
        _POSE_CACHE[key] = hit
    return hit


def pose(joints, aj, off, size, frame, sin=sinf, cos=cosf,
         root_scale=None):
    """World matrices for every joint at `frame` of one animation.

    Channels absent from the animation keep the skeleton's bind value, which
    is what leaving a JObj's field untouched does.

    `root_scale` is the fighter's model scale. Melee sets it on the ROOT JObj
    every frame:

        Fighter_UpdateModelScale   fighter.c:214   HSD_JObjSetScale(jobj, ...)
        ftCommon_GetModelScale     ftcommon.c:1407 x34_scale.y * model_scaling

    where model_scaling is ftCo_DatAttrs+0x8C. Because the root's scale
    multiplies into every descendant's world matrix through the concat chain,
    it scales every joint POSITION, and leaving it out puts every computed
    position off by that factor: Fox 0.96, Falco 1.10, Falcon 0.97, Marth
    1.15, Puff 0.94.

    That is not a small correction. Fitting a single scale from the confirmed
    hitbox pairings -- an independent measurement, made before this was applied
    -- gives 0.967, 1.092, 1.003, 1.129, 0.947, matching the attribute on four
    of the five characters. Marth's 15% is why every one of his hitboxes looked
    2 units out and needed a margin test to pair at all.
    """
    local = pose_locals(joints, aj, off, size, frame, root_scale=root_scale)
    return world_from_locals(joints, local, sin=sin, cos=cos)


def pose_locals(joints, aj, off, size, frame, root_scale=None):
    """The per-joint local SRT that `pose` computes before its world pass.

    Split out so a caller can BLEND two poses in joint space -- which is what
    Melee does for the shield's partial tilt (lb_8000C868) -- and then run the
    identical world pass over the result. Sharing world_from_locals is the
    point: a second copy of the CLASSICAL_SCALE handling would be a second
    thing to get wrong.
    """
    local = [{"rot": list(j.rot), "scale": list(j.scale),
              "trans": list(j.trans)} for j in joints]

    c = aj.raw[off:off + size]
    for jidx, tr in aj.tracks(off, size):
        slot = CHANNEL_SLOT.get(tr["obj_type"])
        if slot is None or jidx >= len(joints):
            continue          # NODE / BRANCH / PATH drive no transform
        data = c[0x20 + tr["ad_head"]: 0x20 + tr["ad_head"] + tr["length"]]
        segs = anim.decode_track(data, tr["frac_value"], tr["frac_slope"])
        if not segs:
            continue
        which, comp = slot
        local[jidx][which][comp] = anim.sample(segs, frame)

    # AFTER the animation, not before: Melee applies the figatree first and
    # then Fighter_UpdateModelScale overwrites the root's scale outright, so
    # the model scale wins over anything an animation put there.
    if root_scale is not None:
        local[0]["scale"] = [root_scale, root_scale, root_scale]

    return local


def world_from_locals(joints, local, sin=sinf, cos=cosf):
    """The world pass of `pose`, over an arbitrary set of local SRTs."""
    world = [None] * len(joints)
    scl = [None] * len(joints)

    for j in joints:
        i = j.index
        p = j.parent
        pscl = scl[p.index] if p is not None else None

        # HSD_JObjMakeMatrix (jobj.c:141): CLASSICAL_SCALE inherits the
        # parent's accumulated scale instead of multiplying its own in.
        if j.flags & JOBJ_CLASSICAL_SCALE:
            scl[i] = list(pscl) if pscl is not None else None
        elif pscl is not None:
            s = local[i]["scale"]
            scl[i] = [s[0] * pscl[0], s[1] * pscl[1], s[2] * pscl[2]]
        else:
            scl[i] = list(local[i]["scale"])

        m = mtx_srt(local[i]["scale"], local[i]["rot"], local[i]["trans"],
                    pscl, sin, cos)
        world[i] = concat(world[p.index], m) if p is not None else m

    return world
