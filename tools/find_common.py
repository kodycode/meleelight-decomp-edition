"""Locate struct ftCommonData inside PlCo.dat and dump the fields the physics
port needs. Layout from the decomp: src/melee/ft/types.h (struct ftCommonData).

Anchor-free: found by range-checking the deadzone/threshold block at the head of
the struct, plus the documented ordering of the three walk stick thresholds.
"""
import struct
import sys
import json

FIELDS = [
    (0x000, "horizontal_stick_deadzone"),
    (0x004, "vertical_stick_deadzone"),
    (0x008, "horizontal_stick_smash_deadzone"),
    (0x00C, "vertical_stick_smash_deadzone"),
    (0x010, "analog_shoulder_deadzone"),
    (0x014, "z_press_analog_value"),
    (0x018, "shield_press_threshold"),
    (0x020, "x20_radians"),
    (0x024, "walk_stick_threshold"),
    (0x028, "walk_middle_animation_stick_threshold"),
    (0x02C, "walk_fast_stick_threshold"),
    (0x030, "walk_accel_taper_gain"),
    (0x034, "x34"),
    (0x038, "x38_someLStickXThreshold"),
    (0x03C, "dash_smash_stick_threshold"),
    (0x200, "x200"),
    (0x420, "x420"),
    (0x438, "x438"),
    (0x440, "x440"),
]

SPAN = 0x450


def bef(b, o):
    return struct.unpack_from(">f", b, o)[0]


def plausible(d, base):
    if base < 0 or base + SPAN > len(d):
        return False
    try:
        hd = bef(d, base + 0x00)   # horizontal stick deadzone
        vd = bef(d, base + 0x04)
        hsd = bef(d, base + 0x08)
        vsd = bef(d, base + 0x0C)
        w1 = bef(d, base + 0x24)
        w2 = bef(d, base + 0x28)
        w3 = bef(d, base + 0x2C)
        taper = bef(d, base + 0x30)
    except struct.error:
        return False
    if not (0.05 <= hd <= 0.6 and 0.05 <= vd <= 0.6):
        return False
    if not (0.05 <= hsd <= 1.0 and 0.05 <= vsd <= 1.0):
        return False
    # the three walk stick thresholds partition [0,1] in ascending order
    if not (0.0 < w1 < w2 < w3 < 1.0):
        return False
    if not (0.1 <= taper <= 10.0):
        return False
    return True


def main():
    path = sys.argv[1]
    d = open(path, "rb").read()
    bases = [b for b in range(0, len(d) - SPAN, 4) if plausible(d, b)]
    print(f"{path}: {len(d)} bytes, {len(bases)} candidate(s): "
          + ", ".join(hex(b) for b in bases[:8]))
    if not bases:
        return
    base = bases[0]
    print(f"\n=== ftCommonData @ file offset 0x{base:X} ===")
    out = {}
    for off, name in FIELDS:
        v = bef(d, base + off)
        out[name] = v
        print(f"  +0x{off:03X}  {name:<42} {v!r}")
    json.dump({"base": base, "fields": out}, open("dat/common.json", "w"), indent=2)
    print("\nwrote dat/common.json")


if __name__ == "__main__":
    main()
