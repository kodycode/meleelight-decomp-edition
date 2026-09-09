"""Decode character-specific attribute structs (ftData +0x04, "ext_attr").

Most of a character's hitboxes live in subaction scripts and are found by
`subaction.py`. A few mechanisms do NOT: reflect bubbles, absorb bubbles and
shields are described by structs in the per-character attribute block and
installed by C code, not by an animation event. `sweep_hitboxes.py` therefore
cannot corroborate them -- it reports them as unmatched, and the "closest
candidate" it offers is meaningless (an all-zero grab box happens to agree on
damage/angle/knockback with an all-zero reflect box).

Provenance:
    ftData                        src/melee/ft/types.h:612
        /* +0 */ ftCo_DatAttrs* x0          shared attributes
        /* +4 */ void*          ext_attr    character-specific attributes
    ftFox_DatAttrs                src/melee/ft/kinds/ftFox/types.h
        /* +B0 */ ReflectDesc xB0_FOX_REFLECTOR_REFLECTION
    ReflectDesc                   src/melee/lb/types.h:115
        +00 u32   bone_id
        +04 s32   max_damage
        +08 Vec3  offset
        +14 float size
        +18 float damage_mul
        +1C float speed_mul
        +20 u8    behavior

The +B0 offset is confirmed by the call site:
    ftColl_CreateReflectHit(gobj, &da->xB0_FOX_REFLECTOR_REFLECTION, ...)
    src/melee/ft/kinds/ftFox/ftfoxspeciallw.c:424

Usage:
    python tools/special_attrs.py tools/dat
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive

EXT_ATTR = 0x04  # ftData +0x04

# Structs that describe a collision bubble installed by C code rather than by
# a subaction event. Each entry: (label, offset into ext_attr, layout).
REFLECT_DESC = [
    ("bone_id", "u32"), ("max_damage", "s32"),
    ("offset_x", "f32"), ("offset_y", "f32"), ("offset_z", "f32"),
    ("size", "f32"), ("damage_mul", "f32"), ("speed_mul", "f32"),
    ("behavior", "u8"),
]

# ShieldDesc (src/melee/lb/types.h:134). Marth's Counter volume is declared in
# MarsAttributes as `AbsorbDesc x64` but ftMars_SpecialLw passes `(ShieldDesc*)
# &da->x64` (ftmarsspeciallw.c:79). The two layouts agree up to radius/size.
#
# Stop at radius on purpose. ShieldDesc declares dmg_mul and vel_mul after it,
# but ftColl_8007B1B8 (ftcoll.c:3175) copies only three fields:
#     fp->shield_hit.bone   = fp->parts[shield->bone].joint;
#     fp->shield_hit.size   = shield->radius;
#     fp->shield_hit.offset = shield->pos;
# so nothing past radius is read here. The words that follow belong to
# `struct SwordAttrs x78` in MarsAttributes; printing them as "damage_mul 0.2"
# would present an unrelated sword attribute as a counter parameter.
SHIELD_DESC = [
    ("bone_id", "u32"),
    ("offset_x", "f32"), ("offset_y", "f32"), ("offset_z", "f32"),
    ("radius", "f32"),
]

CHARS = [
    # name, dat, root, [(what, offset, layout)]
    ("Fox",   "PlFx.dat", "ftDataFox",   [("reflector", 0xB0, REFLECT_DESC)]),
    ("Falco", "PlFc.dat", "ftDataFalco", [("reflector", 0xB0, REFLECT_DESC)]),
    ("Marth", "PlMs.dat", "ftDataMars",  [("counter", 0x64, SHIELD_DESC)]),
]


def read_struct(a, base, layout):
    """Read a struct at data-block offset `base`. Offsets are data-relative,
    so go through the Archive's accessors rather than indexing the raw file."""
    out = {}
    off = base
    for name, kind in layout:
        if kind == "f32":
            out[name] = a.d_f32(off)
            off += 4
        elif kind == "u32":
            out[name] = a.d_u32(off)
            off += 4
        elif kind == "s32":
            v = a.d_u32(off)
            out[name] = v - 0x100000000 if v >= 0x80000000 else v
            off += 4
        elif kind == "u8":
            out[name] = a.raw[a.data_off + off]
            off += 1
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]

    for name, dat, root, items in CHARS:
        path = os.path.join(datdir, dat)
        if not os.path.exists(path):
            print(f"!! {name}: {dat} missing -- run gcm_extract.py first")
            continue
        a = Archive(path)
        base = a.root(root)
        ext = a.ptr(base + EXT_ATTR)
        if ext is None:
            print(f"!! {name}: {root}+0x{EXT_ATTR:02X} is not a relocation")
            continue
        print(f"=== {name}: {root} -> ext_attr at data+0x{ext:X} ===")
        for what, off, layout in items:
            f = read_struct(a, ext + off, layout)
            print(f"  {what} (ext_attr+0x{off:X})")
            for k, v in f.items():
                v = f"{v:.6f}" if isinstance(v, float) else v
                print(f"    {k:<12} {v}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
