"""Read Captain Falcon's Falcon Kick traction attributes straight from PlCa.dat.

Both are floats in the character-specific attribute block (ftData +0x04,
"ext_attr"), laid out in ftCaptain_DatAttrs:

    src/melee/ft/kinds/ftCaptain/types.h
        /* +84 */ float speciallw_ground_traction;
        /* +88 */ float speciallw_air_landing_traction;

and both are used the same way, as a multiplier on the character's ground
friction:

    ftcaptainspeciallw.c:243   ftCommon_ApplyFrictionGround(
                                   fp, speciallw_ground_traction * ground_friction)
    ftcaptainspeciallw.c:287   ftCommon_ApplyFrictionGround(
                                   fp, speciallw_air_landing_traction * ground_friction)

The :287 call is the AIRBORNE Falcon Kick landing on the ground, which is the
path meleelight models as DOWNSPECIALAIRENDGROUND.

Usage:
    python tools/falcon_speciallw.py tools/dat
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive

EXT_ATTR = 0x04

FIELDS = [
    ("speciallw_ground_lag_mul", 0x7C),
    ("speciallw_landing_lag_mul", 0x80),
    ("speciallw_ground_traction", 0x84),
    ("speciallw_air_landing_traction", 0x88),
]


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    path = os.path.join(datdir, "PlCa.dat")
    if not os.path.exists(path):
        print("PlCa.dat missing -- run gcm_extract.py first", file=sys.stderr)
        return 2

    a = Archive(path)
    base = a.root("ftDataCaptain")
    ext = a.ptr(base + EXT_ATTR)
    if ext is None:
        print("ftDataCaptain+0x04 is not a relocation", file=sys.stderr)
        return 2

    print("ftDataCaptain -> ext_attr at data+0x%X" % ext)
    for name, off in FIELDS:
        v = a.d_f32(ext + off)
        print("  +0x%02X  %-34s %.9g" % (off, name, v))

    # The value meleelight needs, cross-checked against the number that used to
    # be hardcoded in DOWNSPECIALAIRENDGROUND.js.
    traction = 0.07999999821186066  # Falcon ground_friction, attributes.js
    air = a.d_f32(ext + 0x88)
    print()
    print("  air_landing_traction * traction = %.9g  (hardcoded value was 0.24)"
          % (air * traction))
    return 0


if __name__ == "__main__":
    sys.exit(main())
