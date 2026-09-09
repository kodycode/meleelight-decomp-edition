"""Minimal HSD (HAL Sysdolphin) archive reader for Melee .dat files.

Why this exists: every attribute base I have so far was found by scanning for
plausible values and then confirmed by disassembly. That works, but it is
inference. An archive parser resolves the SAME addresses structurally --
public symbol -> ftData -> co_attrs pointer -- so the two methods can be
cross-checked against each other.

Archive layout:
    0x00  u32 file_size
    0x04  u32 data_size        (data block length; everything after is tables)
    0x08  u32 reloc_count
    0x0C  u32 root_count
    0x10  u32 ref_count
    0x20  data block begins

    then, at 0x20 + data_size:
        reloc_count u32  -- offsets INTO the data block, each holding a
                            data-block-relative pointer that needs relocating
        root_count  {u32 data_offset, u32 name_offset}
        ref_count   {u32 data_offset, u32 name_offset}
        string table
"""
import struct
import sys

HDR = 0x20


def u32(b, o):
    return struct.unpack_from(">I", b, o)[0]


def f32(b, o):
    return struct.unpack_from(">f", b, o)[0]


class Archive:
    def __init__(self, path):
        self.raw = open(path, "rb").read()
        b = self.raw
        self.file_size = u32(b, 0x00)
        self.data_size = u32(b, 0x04)
        self.reloc_count = u32(b, 0x08)
        self.root_count = u32(b, 0x0C)
        self.ref_count = u32(b, 0x10)

        self.data_off = HDR                      # data block start in file
        tbl = HDR + self.data_size
        self.reloc_off = tbl
        self.root_off = tbl + self.reloc_count * 4
        self.ref_off = self.root_off + self.root_count * 8
        self.str_off = self.ref_off + self.ref_count * 8

        self.relocs = [u32(b, self.reloc_off + i * 4)
                       for i in range(self.reloc_count)]
        self.reloc_set = set(self.relocs)

        self.roots = []
        for i in range(self.root_count):
            d = u32(b, self.root_off + i * 8)
            n = u32(b, self.root_off + i * 8 + 4)
            self.roots.append((d, self.cstr(self.str_off + n)))

    def cstr(self, off):
        end = self.raw.index(b"\0", off)
        return self.raw[off:end].decode("ascii", "replace")

    # data-block-relative accessors ------------------------------------
    def d_u32(self, off):
        return u32(self.raw, self.data_off + off)

    def d_f32(self, off):
        return f32(self.raw, self.data_off + off)

    def ptr(self, off):
        """Read a pointer field at data-block offset `off`.

        Only meaningful if `off` is in the relocation set -- otherwise the
        word is ordinary data, not a pointer.
        """
        if off not in self.reloc_set:
            return None
        return self.d_u32(off)

    def root(self, name):
        for d, n in self.roots:
            if n == name:
                return d
        return None

    def summary(self):
        return (f"file_size=0x{self.file_size:X} data_size=0x{self.data_size:X} "
                f"relocs={self.reloc_count} roots={self.root_count} "
                f"refs={self.ref_count}")


# ftData layout, src/melee/ft/types.h:612
FTDATA_ATTRS = 0x00      # ftCo_DatAttrs*
FTDATA_EXTATTRS = 0x04
FTDATA_X8 = 0x08
FTDATA_SUBACTIONS = 0x0C  # Fighter_WaitAnimData*
FTDATA_X10 = 0x10

# Fighter_WaitAnimData, src/melee/ft/types.h:885 -- 0x18 bytes
WAD_SIZE = 0x18
WAD_NAME = 0x00
WAD_AJ_OFF = 0x04
WAD_AJ_SIZE = 0x08
WAD_SCRIPT = 0x0C
WAD_FLAGS = 0x10


def main():
    path = sys.argv[1]
    want_root = sys.argv[2] if len(sys.argv) > 2 else None
    a = Archive(path)
    print(f"{path}\n  {a.summary()}\n")
    print("  roots:")
    for d, n in a.roots[:20]:
        print(f"    0x{d:08X}  {n}")
    if a.root_count > 20:
        print(f"    ... and {a.root_count - 20} more")

    if not want_root:
        return
    base = a.root(want_root)
    if base is None:
        print(f"\n  !! root '{want_root}' not found")
        return
    print(f"\n  {want_root} -> ftData @ data+0x{base:X} "
          f"(file 0x{HDR + base:X})")

    attrs = a.ptr(base + FTDATA_ATTRS)
    subs = a.ptr(base + FTDATA_SUBACTIONS)
    print(f"    +0x00 co_attrs   -> data+0x{attrs:X} (file 0x{HDR+attrs:X})"
          if attrs is not None else "    +0x00 co_attrs   -> (not a reloc)")
    print(f"    +0x0C subactions -> data+0x{subs:X} (file 0x{HDR+subs:X})"
          if subs is not None else "    +0x0C subactions -> (not a reloc)")

    if attrs is not None:
        print("\n    sanity-check a few ftCo_DatAttrs fields:")
        for off, name in [(0x008, "walk_max_vel"), (0x018, "ground_friction"),
                          (0x05C, "gravity"), (0x060, "terminal_velocity"),
                          (0x06C, "air_drift_max"), (0x078, "air_max_h_vel"),
                          (0x088, "weight")]:
            print(f"      +0x{off:03X} {name:<20} {a.d_f32(attrs + off)!r}")


if __name__ == "__main__":
    main()
