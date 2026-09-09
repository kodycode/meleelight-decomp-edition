"""Anchor-free locator for ftCo_DatAttrs in Melee PlXx.dat files.

Scans for a struct base whose fields all fall in physically plausible ranges,
using the layout from the decomp (src/melee/ft/types.h). No assumed values.
"""
import struct
import sys
import os
import json

F = ">f"
I = ">i"

# offset -> (name, lo, hi) plausibility window, floats
FLOAT_CHECKS = {
    0x008: ("walk_max_vel", 0.3, 3.0),
    0x018: ("ground_friction", 0.005, 0.3),
    0x028: ("dash_max_velocity", 0.5, 4.0),
    0x038: ("jump_startup_time", 1.0, 12.0),
    0x040: ("jump_v_initial_velocity", 1.0, 5.0),
    0x05C: ("gravity", 0.01, 0.5),
    0x060: ("terminal_velocity", 0.5, 5.0),
    0x064: ("air_drift_stick_mul", 0.001, 0.3),
    0x068: ("aerial_drift_base", 0.0, 0.2),
    0x06C: ("air_drift_max", 0.1, 2.5),
    0x070: ("aerial_friction", 0.0005, 0.2),
    0x074: ("fast_fall_velocity", 1.0, 6.0),
    0x078: ("air_max_horizontal_velocity", 0.5, 5.0),
    0x088: ("weight", 30.0, 200.0),
    0x08C: ("model_scaling", 0.3, 2.0),
}
INT_CHECKS = {
    0x058: ("max_jumps", 1, 6),
}

DUMP = [
    (0x008, "f", "walk_max_vel"),
    (0x018, "f", "ground_friction"),
    (0x01C, "f", "dash_initial_velocity"),
    (0x028, "f", "dash_max_velocity"),
    (0x034, "f", "ground_max_horizontal_velocity"),
    (0x038, "f", "jump_startup_time"),
    (0x03C, "f", "jump_h_initial_velocity"),
    (0x040, "f", "jump_v_initial_velocity"),
    (0x044, "f", "ground_to_air_jump_momentum_multiplier"),
    (0x048, "f", "jump_h_max_velocity"),
    (0x04C, "f", "hop_v_initial_velocity"),
    (0x050, "f", "air_jump_v_multiplier"),
    (0x054, "f", "air_jump_h_multiplier"),
    (0x058, "i", "max_jumps"),
    (0x05C, "f", "gravity"),
    (0x060, "f", "terminal_velocity"),
    (0x064, "f", "air_drift_stick_mul"),
    (0x068, "f", "aerial_drift_base"),
    (0x06C, "f", "air_drift_max"),
    (0x070, "f", "aerial_friction"),
    (0x074, "f", "fast_fall_velocity"),
    (0x078, "f", "air_max_horizontal_velocity"),
    (0x088, "f", "weight"),
    (0x08C, "f", "model_scaling"),
    (0x090, "f", "initial_shield_size"),
    (0x094, "f", "shield_break_initial_velocity"),
]

MAXOFF = 0x190


def bef(b, o):
    return struct.unpack_from(F, b, o)[0]


def bei(b, o):
    return struct.unpack_from(I, b, o)[0]


def score(data, base):
    if base < 0 or base + MAXOFF > len(data):
        return None
    try:
        for off, (name, lo, hi) in FLOAT_CHECKS.items():
            v = bef(data, base + off)
            if not (lo <= v <= hi):
                return None
        for off, (name, lo, hi) in INT_CHECKS.items():
            v = bei(data, base + off)
            if not (lo <= v <= hi):
                return None
    except struct.error:
        return None
    # extra sanity: fast fall should exceed terminal velocity in Melee
    if bef(data, base + 0x074) <= bef(data, base + 0x060):
        return None
    # jump startup should be a whole number of frames
    js = bef(data, base + 0x038)
    if abs(js - round(js)) > 1e-6:
        return None
    return True


def scan(data):
    return [b for b in range(0, len(data) - MAXOFF, 4) if score(data, b)]


NAMES = {
    "PlFx.dat": "Fox", "PlFc.dat": "Falco", "PlCa.dat": "Falcon",
    "PlMs.dat": "Marth", "PlPr.dat": "Puff",
}


def main():
    datdir = sys.argv[1]
    out = {}
    for fn, name in NAMES.items():
        path = os.path.join(datdir, fn)
        if not os.path.exists(path):
            continue
        data = open(path, "rb").read()
        bases = scan(data)
        print(f"\n=== {name} [{fn}] -> {len(bases)} candidate(s): "
              + ", ".join(hex(b) for b in bases[:6]))
        if not bases:
            continue
        base = bases[0]
        vals = {}
        for off, kind, fname in DUMP:
            v = bef(data, base + off) if kind == "f" else bei(data, base + off)
            vals[fname] = v
            print(f"  +0x{off:03X}  {fname:<40} {v:>12.6g}")
        out[name] = {"base": base, "attrs": vals}
    with open(os.path.join(datdir, "attrs.json"), "w") as fh:
        json.dump(out, fh, indent=2)
    print(f"\nwrote {os.path.join(datdir, 'attrs.json')}")


if __name__ == "__main__":
    main()
