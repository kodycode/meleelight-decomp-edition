"""Read animation data out of a PlXxAJ.dat.

Each subaction entry in PlXx.dat carries an offset and size into the AJ file
(ftData+0x0C -> Fighter_WaitAnimData, +0x04 offset, +0x08 size). That region is
a self-contained HAL archive holding one `..._figatree` root:

Both structs are in the decomp, at src/melee/lb/lbanim.h:9 --

    struct FigaTree {                   struct FigaTrack {
        +0x00 int    type;                  +0x00 u16 length;      bytes of keyframe data
        +0x04 u32    flags;                 +0x02 u16 startframe;
        +0x08 f32    frames;   <- length    +0x04 u8  obj_type;    which channel
        +0x0C s8*    nodes;    <- per-joint +0x05 u8  frac_value;  fixed-point format
        +0x10 FigaTrack* tracks;   counts   +0x06 u8  frac_slope;
    };                                      +0x08 u8* ad_head;     the keyframe stream
                                        };

`nodes` is NOT the `HSD_AnimJoint**` tree that the generic sysdolphin aobj.h
struct suggests -- figatree uses the compact form above, one COUNT BYTE per
joint in skeleton order. Walking it as a child/next tree runs straight off the
end of the chunk.

Verified on Fox's EscapeAir: 73 count bytes (exactly the joint count of the
skeleton in PlFxNr.dat, so animation and skeleton line up index for index)
summing to 169, against a track region of 2028 bytes = 169 * 0x0C; and every
track's `length` matches the gap to the next `ad_head`, modulo padding.
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import WAD_SIZE, SUBACTION_COUNT


class AJ:
    """The AJ file is a concatenation of independent archives, one per
    animation, addressed by the (offset, size) in the subaction table."""

    def __init__(self, path):
        self.raw = open(path, "rb").read()

    def chunk_roots(self, off, size):
        """[(data_offset, name)] for one animation archive."""
        c = self.raw[off:off + size]
        if len(c) < 0x20:
            return []
        _fs, ds, rc, rtc, refc = struct.unpack(">5I", c[:20])
        tbl = HDR + ds
        root_tbl = tbl + rc * 4
        str_tbl = root_tbl + rtc * 8 + refc * 8
        out = []
        for i in range(rtc):
            d, n = struct.unpack(">2I", c[root_tbl + i * 8: root_tbl + i * 8 + 8])
            end = c.index(b"\0", str_tbl + n)
            out.append((d, c[str_tbl + n:end].decode("ascii", "replace")))
        return out

    # FigaTrack.obj_type -- which joint channel the track drives.
    # HSD_A_J_* from src/sysdolphin/baselib/jobj.h:21.
    #
    # NODE and BRANCH are not transform channels and must not be fed into a
    # joint matrix; 8 tracks across the five fighters use NODE.
    OBJ_TYPE = {
        1: "rot_x", 2: "rot_y", 3: "rot_z",
        4: "path",
        5: "tra_x", 6: "tra_y", 7: "tra_z",
        8: "sca_x", 9: "sca_y", 10: "sca_z",
        11: "node", 12: "branch",
    }
    # The subset that actually drives a joint's local transform.
    TRANSFORM_CHANNELS = frozenset(range(1, 4)) | frozenset(range(5, 11))

    def tracks(self, off, size):
        """[(joint_index, FigaTrack fields)] for one animation.

        `nodes` gives a track count per joint in skeleton order, so the flat
        track array is sliced back out to joints by running that count.
        """
        c = self.raw[off:off + size]
        roots = self.chunk_roots(off, size)
        if not roots:
            return []
        d, name = roots[0]
        if "figatree" not in name:
            return []

        def u32(o):
            return struct.unpack(">I", c[HDR + o: HDR + o + 4])[0]

        nodes = u32(d + 0x0C)
        tracks = u32(d + 0x10)
        out = []
        ti = 0
        j = 0
        while True:
            n = c[HDR + nodes + j]
            # The count array is terminated by walking past the track array;
            # stop once the tracks are exhausted.
            if ti >= self._track_total(c, nodes, tracks):
                break
            for _ in range(n):
                b = c[HDR + tracks + ti * 0x0C: HDR + tracks + ti * 0x0C + 0x0C]
                length, startframe = struct.unpack(">HH", b[0:4])
                out.append((j, {
                    "length": length,
                    "startframe": startframe,
                    "obj_type": b[4],
                    "channel": self.OBJ_TYPE.get(b[4], f"type{b[4]}"),
                    "frac_value": b[5],
                    "frac_slope": b[6],
                    "ad_head": struct.unpack(">I", b[8:12])[0],
                }))
                ti += 1
            j += 1
        return out

    @staticmethod
    def _track_total(c, nodes, tracks):
        # The track array sits between `tracks` and `nodes` in every fighter
        # animation observed, so its element count follows from the gap.
        return (nodes - tracks) // 0x0C

    def frame_count(self, off, size):
        """The figatree's frame_count, or None if this chunk has no figatree."""
        roots = self.chunk_roots(off, size)
        if not roots:
            return None
        c = self.raw[off:off + size]
        d, name = roots[0]
        if "figatree" not in name:
            return None
        return struct.unpack(">f", c[HDR + d + 0x08: HDR + d + 0x0C])[0]


def subaction_anims(dat_path, root):
    """subaction name -> (aj_offset, aj_size)."""
    a = Archive(dat_path)
    table = a.ptr(a.root(root) + 0x0C)
    out = {}
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        namep = a.ptr(e + 0x00)
        if namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        off = a.d_u32(e + 0x04)
        size = a.d_u32(e + 0x08)
        if size:
            out.setdefault(nm, (off, size))
    return out


def main():
    if len(sys.argv) < 4:
        print("usage: python tools/figatree.py <PlXx.dat> <ftDataXxx> <PlXxAJ.dat> [name]",
              file=sys.stderr)
        return 2
    dat, root, ajp = sys.argv[1], sys.argv[2], sys.argv[3]
    want = sys.argv[4] if len(sys.argv) > 4 else None
    aj = AJ(ajp)
    anims = subaction_anims(dat, root)
    for nm, (off, size) in sorted(anims.items()):
        if want and nm != want:
            continue
        fc = aj.frame_count(off, size)
        print(f"  {nm:34} AJ 0x{off:06X}+0x{size:05X}  frames="
              f"{'-' if fc is None else format(fc, 'g')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
