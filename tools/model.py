"""Read a fighter's costume model: meshes, skinning, and posed world vertices.

meleelight's src/animations/* holds one 2D silhouette outline per frame, traced
off a rendered character. Regenerating a frame therefore needs the actual posed
geometry, which means walking the model the way sysdolphin does.

Structures, all from the decomp:

    HSD_JointDesc     skeleton.py's header comment
        +0x10 dobj
    HSD_DObjDesc      sysdolphin/baselib/dobj.h:23
        +0x00 class_name  +0x04 next  +0x08 mobjdesc  +0x0C pobjdesc
    HSD_PObjDesc      sysdolphin/baselib/pobj.h:38
        +0x00 class_name  +0x04 next  +0x08 verts  +0x0C flags(u16)
        +0x0E n_display(u16)  +0x10 display  +0x14 union{joint,shape_set,envelope_p}
    HSD_VtxDescList   sysdolphin/baselib/pobj.h:52
        +0x00 attr  +0x04 attr_type  +0x08 comp_cnt  +0x0C comp_type
        +0x10 frac(u8)  +0x12 stride(u16)  +0x14 vertex        (0x18 bytes)
    HSD_EnvelopeDesc  sysdolphin/baselib/pobj.h:68
        +0x00 joint  +0x04 weight                              (0x08 bytes)

    pobj_type(o) == o->flags & 0x3000   forward.h:123
        POBJ_SKIN 0<<12   POBJ_SHAPEANIM 1<<12   POBJ_ENVELOPE 2<<12

SKINNING. The two cases sysdolphin distinguishes (pobj.c:1204-1214):

  * POBJ_SKIN -- vertices are in the space of one joint. That joint is
    `pobj->u.joint` when set, otherwise the joint that owns the DObj. One
    matrix multiply per vertex.

  * POBJ_ENVELOPE -- the display list carries a GX_VA_PNMTXIDX per vertex.
    Melee's convention is that the matrix slot is `idx/3`, selecting an entry
    of the NULL-terminated envelope_p array. Each envelope is a list of
    (joint, weight) pairs; the vertex is transformed by every joint's
    world * inverse-bind and blended by weight. A single-entry envelope with
    weight 0 means "rigid to that joint", handled the same way.
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive

# GXAttr (GXEnum.h:92)
GX_VA_PNMTXIDX = 0
GX_VA_POS = 9
GX_VA_NRM = 10
GX_VA_NULL = 0xFF

# GXAttrType (GXEnum.h:124)
GX_NONE, GX_DIRECT, GX_INDEX8, GX_INDEX16 = 0, 1, 2, 3

# GXCompType (GXEnum.h:403)
GX_U8, GX_S8, GX_U16, GX_S16, GX_F32 = 0, 1, 2, 3, 4

# GXPrimitive (GXEnum.h:68)
GX_QUADS = 0x80
GX_TRIANGLES = 0x90
GX_TRIANGLESTRIP = 0x98
GX_TRIANGLEFAN = 0xA0

POBJ_SKIN = 0 << 12
POBJ_SHAPEANIM = 1 << 12
POBJ_ENVELOPE = 2 << 12


def _u16(b, o):
    return struct.unpack_from(">H", b, o)[0]


class VtxDesc(object):
    __slots__ = ("attr", "attr_type", "comp_cnt", "comp_type", "frac",
                 "stride", "vertex")

    def __init__(self, a, off):
        self.attr = a.d_u32(off + 0x00)
        self.attr_type = a.d_u32(off + 0x04)
        self.comp_cnt = a.d_u32(off + 0x08)
        self.comp_type = a.d_u32(off + 0x0C)
        self.frac = a.raw[a.data_off + off + 0x10]
        self.stride = _u16(a.raw, a.data_off + off + 0x12)
        self.vertex = a.ptr(off + 0x14)

    def index_size(self):
        if self.attr_type == GX_INDEX8:
            return 1
        if self.attr_type == GX_INDEX16:
            return 2
        if self.attr_type == GX_DIRECT:
            return 1          # PNMTXIDX and friends are a single direct byte
        return 0

    def read_pos(self, a, index):
        """Position at `index` in this attribute's vertex array."""
        base = self.vertex + index * self.stride
        raw = a.raw
        off = a.data_off + base
        n = 3 if self.comp_cnt == 1 else 2      # GX_POS_XY=0, GX_POS_XYZ=1
        out = []
        if self.comp_type == GX_F32:
            for i in range(n):
                out.append(struct.unpack_from(">f", raw, off + i * 4)[0])
        elif self.comp_type == GX_S16:
            scale = float(1 << self.frac)
            for i in range(n):
                out.append(struct.unpack_from(">h", raw, off + i * 2)[0] / scale)
        elif self.comp_type == GX_U16:
            scale = float(1 << self.frac)
            for i in range(n):
                out.append(struct.unpack_from(">H", raw, off + i * 2)[0] / scale)
        elif self.comp_type == GX_S8:
            scale = float(1 << self.frac)
            for i in range(n):
                out.append(struct.unpack_from(">b", raw, off + i)[0] / scale)
        elif self.comp_type == GX_U8:
            scale = float(1 << self.frac)
            for i in range(n):
                out.append(struct.unpack_from(">B", raw, off + i)[0] / scale)
        else:
            raise ValueError("unhandled comp_type %d" % self.comp_type)
        while len(out) < 3:
            out.append(0.0)
        return out


class PObj(object):
    """One mesh primitive group: its vertices and how they are skinned."""

    def __init__(self, a, off, owner_joint):
        self.flags = _u16(a.raw, a.data_off + off + 0x0C)
        self.n_display = _u16(a.raw, a.data_off + off + 0x0E)
        self.display = a.ptr(off + 0x10)
        self.union = a.ptr(off + 0x14)
        self.owner_joint = owner_joint
        self.type = self.flags & 0x3000

        self.descs = []
        vp = a.ptr(off + 0x08)
        if vp is not None:
            i = 0
            while True:
                d = VtxDesc(a, vp + i * 0x18)
                if d.attr == GX_VA_NULL:
                    break
                self.descs.append(d)
                i += 1
                if i > 32:
                    raise ValueError("runaway VtxDescList")

        # Envelope table: NULL-terminated array of HSD_EnvelopeDesc*.
        self.envelopes = []
        if self.type == POBJ_ENVELOPE and self.union is not None:
            i = 0
            while True:
                ep = a.ptr(self.union + i * 4)
                if ep is None:
                    break
                ent = []
                j = 0
                while True:
                    jp = a.ptr(ep + j * 8)
                    if jp is None:
                        break
                    w = a.d_f32(ep + j * 8 + 4)
                    ent.append((jp, w))
                    j += 1
                    if j > 16:
                        raise ValueError("runaway envelope")
                self.envelopes.append(ent)
                i += 1
                if i > 64:
                    raise ValueError("runaway envelope table")

    def primitives(self, a):
        """Yield (primitive, [vertex dicts]) from the display list."""
        if self.display is None or self.n_display == 0:
            return
        raw = a.raw
        p = a.data_off + self.display
        end = p + self.n_display * 32
        pos_desc = None
        for d in self.descs:
            if d.attr == GX_VA_POS:
                pos_desc = d
        while p < end:
            op = raw[p]
            # Display lists are padded to a 32-byte boundary; the padding is
            # not a primitive. Stop at anything that is not a GXPrimitive
            # rather than reading the filler as geometry.
            if op not in (GX_QUADS, GX_TRIANGLES, GX_TRIANGLESTRIP,
                          GX_TRIANGLEFAN):
                break
            cnt = _u16(raw, p + 1)
            p += 3
            verts = []
            for _ in range(cnt):
                v = {}
                for d in self.descs:
                    sz = d.index_size()
                    if sz == 0:
                        continue
                    if sz == 1:
                        idx = raw[p]
                    else:
                        idx = _u16(raw, p)
                    p += sz
                    v[d.attr] = idx
                verts.append(v)
            yield op, verts, pos_desc


def _read_mtx(a, off):
    """A serialized 3x4 Mtx (the joint's inverse bind, JointDesc +0x38)."""
    base = a.data_off + off
    return [list(struct.unpack_from(">4f", a.raw, base + r * 16))
            for r in range(3)]


class Mesh(object):
    """Every PObj in a costume, with the joint index that owns each."""

    def __init__(self, path, root_name, joint_offsets):
        self.a = Archive(path)
        self.root = self.a.root(root_name)
        if self.root is None:
            raise ValueError("no root %s in %s" % (root_name, path))
        # data offset of each joint -> its index in the skeleton's DFS order
        self.joint_index = {off: i for i, off in enumerate(joint_offsets)}
        # Inverse bind matrix per joint, JointDesc +0x38. Envelope skinning
        # needs it: the vertex is in bind space, so it must be pulled back
        # through the bind pose before the posed world matrix is applied.
        self.inv_bind = {}
        for off in joint_offsets:
            p = self.a.ptr(off + 0x38)
            if p is not None:
                self.inv_bind[self.joint_index[off]] = _read_mtx(self.a, p)
        self.pobjs = []
        self._walk(self.root, 0)

    def world_triangles(self, world):
        """Posed triangles in world space, topology preserved.

        The silhouette is the outline of the union of the model's faces, so
        the primitives have to be expanded rather than treated as a point
        cloud. GX strip/fan winding is per GXGeometry.
        """
        tris = []
        for verts, prim in self._posed_prims(world):
            n = len(verts)
            if prim == GX_TRIANGLES:
                for i in range(0, n - 2, 3):
                    tris.append((verts[i], verts[i + 1], verts[i + 2]))
            elif prim == GX_TRIANGLESTRIP:
                for i in range(n - 2):
                    if i & 1:
                        tris.append((verts[i + 1], verts[i], verts[i + 2]))
                    else:
                        tris.append((verts[i], verts[i + 1], verts[i + 2]))
            elif prim == GX_TRIANGLEFAN:
                for i in range(1, n - 1):
                    tris.append((verts[0], verts[i], verts[i + 1]))
            elif prim == GX_QUADS:
                for i in range(0, n - 3, 4):
                    tris.append((verts[i], verts[i + 1], verts[i + 2]))
                    tris.append((verts[i], verts[i + 2], verts[i + 3]))
        return tris

    def _posed_prims(self, world):
        """(posed vertex list, primitive) for every primitive in the model."""
        a = self.a
        for pobj in self.pobjs:
            skin_idx = pobj.owner_joint
            if pobj.type == POBJ_SKIN and pobj.union is not None:
                skin_idx = self.joint_index.get(pobj.union, skin_idx)
            for op, verts, pos_desc in pobj.primitives(a):
                if pos_desc is None:
                    continue
                posed = []
                ok = True
                for v in verts:
                    pi = v.get(GX_VA_POS)
                    if pi is None:
                        ok = False
                        break
                    posed.append(self._skin(pobj, v, pos_desc.read_pos(a, pi),
                                            skin_idx, world))
                if ok and all(q is not None for q in posed):
                    yield posed, op

    def _skin(self, pobj, v, p, skin_idx, world):
        if pobj.type == POBJ_ENVELOPE:
            slot = v.get(GX_VA_PNMTXIDX)
            if slot is None:
                return None
            k = slot // 3
            env = pobj.envelopes[k] if k < len(pobj.envelopes) else None
            if not env:
                return None
            if len(env) == 1:
                ji = self.joint_index.get(env[0][0])
                if ji is None or ji >= len(world):
                    return None
                return _xf(world[ji], p)
            acc = [0.0, 0.0, 0.0]
            for jp, w in env:
                ji = self.joint_index.get(jp)
                if ji is None or ji >= len(world):
                    continue
                ib = self.inv_bind.get(ji)
                q = _xf(ib, p) if ib else p
                q = _xf(world[ji], q)
                acc[0] += q[0] * w
                acc[1] += q[1] * w
                acc[2] += q[2] * w
            return tuple(acc)
        if skin_idx is None or skin_idx >= len(world):
            return None
        return _xf(world[skin_idx], p)

    def world_vertices(self, world):
        """Every posed vertex, in world space, for the given joint matrices.

        `world` is skeleton.pose()'s output: one 3x4 matrix per joint index.
        Returns a flat list of (x, y, z). Only positions are needed -- the
        silhouette is the outline of the posed point set.
        """
        out = []
        a = self.a
        for pobj in self.pobjs:
            # Which joint a POBJ_SKIN mesh belongs to.
            skin_idx = pobj.owner_joint
            if pobj.type == POBJ_SKIN and pobj.union is not None:
                skin_idx = self.joint_index.get(pobj.union, skin_idx)

            for op, verts, pos_desc in pobj.primitives(a):
                if pos_desc is None:
                    continue
                for v in verts:
                    pi = v.get(GX_VA_POS)
                    if pi is None:
                        continue
                    p = pos_desc.read_pos(a, pi)

                    if pobj.type == POBJ_ENVELOPE:
                        slot = v.get(GX_VA_PNMTXIDX)
                        if slot is None:
                            continue
                        env = pobj.envelopes[slot // 3] \
                            if slot // 3 < len(pobj.envelopes) else None
                        if not env:
                            continue
                        if len(env) == 1:
                            ji = self.joint_index.get(env[0][0])
                            if ji is None or ji >= len(world):
                                continue
                            # A single-entry envelope is rigid: the vertex is
                            # already in that joint's space, so no inverse
                            # bind (pobj.c:1204's POBJ_SKIN path).
                            out.append(_xf(world[ji], p))
                        else:
                            acc = [0.0, 0.0, 0.0]
                            for jp, w in env:
                                ji = self.joint_index.get(jp)
                                if ji is None or ji >= len(world):
                                    continue
                                ib = self.inv_bind.get(ji)
                                q = _xf(ib, p) if ib else p
                                q = _xf(world[ji], q)
                                acc[0] += q[0] * w
                                acc[1] += q[1] * w
                                acc[2] += q[2] * w
                            out.append(tuple(acc))
                    else:
                        if skin_idx is None or skin_idx >= len(world):
                            continue
                        out.append(_xf(world[skin_idx], p))
        return out


    def _walk(self, joint_off, depth):
        a = self.a
        idx = self.joint_index.get(joint_off)
        dobj = a.ptr(joint_off + 0x10)
        while dobj is not None:
            pobj = a.ptr(dobj + 0x0C)
            while pobj is not None:
                self.pobjs.append(PObj(a, pobj, idx))
                pobj = a.ptr(pobj + 0x04)
            dobj = a.ptr(dobj + 0x04)
        child = a.ptr(joint_off + 0x08)
        if child is not None:
            self._walk(child, depth + 1)
        nxt = a.ptr(joint_off + 0x0C)
        if nxt is not None:
            self._walk(nxt, depth)


def _xf(m, v):
    """MTXMultVec for a 3x4 matrix."""
    return (m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3])
