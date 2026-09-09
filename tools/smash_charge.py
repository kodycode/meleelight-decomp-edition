"""Re-extract the smash-charge parameters from the disc and check the port.

Smash charging is not driven by ftCommonData -- it is a SUBACTION EVENT, so the
values live once per chargeable move inside each character's scripts:

    ftAction_80073008 (ftaction.c:1252)
        charge_rate   = cmd->u->smash_charge_0.charge_rate;
        charge_frames = cmd->u->smash_charge_0.charge_frames;
        dmg_mult      = 0.003906f * charge_rate;

    struct smash_charge_0 (lb/types.h:893)
        u32 opcode        : 6
        u32 charge_frames : 10
        u32 charge_rate   : 16

    ftCo_800DEEB8 (ft_0DF0.c:32), applied to damage at hit time
        dmg * ((dmg_mult - 1) * (frames / hold_frames) + 1)

That means neither `validate_constants.py` (ftCommonData) nor
`validate_attrs.py` (ftData +0x00 / +0x04) can see them -- which is why the
0.3671 in meleelight's damage formula sat unsourced for as long as it did.

It turns out to be uniform: every smash_charge event on every one of the five
characters is charge_frames = 60, charge_rate = 350, and 0.003906 * 350 is
1.3671 exactly. This tool asserts that uniformity rather than assuming it, so
a character whose data disagrees is reported instead of silently taking the
shared constant.

Usage:
    python tools/smash_charge.py <datdir>
"""
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from subaction import decode_script, SUBACTION_COUNT, WAD_SIZE
from state_map import CHARS

SMASH_CHARGE_OP = 0x38   # index 46 in ftAction_803C06E8, so opcode 46 + 10

JS = os.path.join("src", "physics", "smashCharge.js")
JS_RE = re.compile(r"^export const (SMASH_CHARGE_RATE|SMASH_CHARGE_FRAMES)"
                   r"[ \t]*=[ \t]*(\d+)[ \t]*;", re.M)


def events(datdir):
    """(character, subaction label, charge_frames, charge_rate) for every 0x38."""
    out = []
    for name, (dat, root, _ajn, _nr) in CHARS.items():
        path = os.path.join(datdir, dat)
        if not os.path.exists(path):
            continue
        a = Archive(path)
        base = a.root(root)
        if base is None:
            continue
        table = a.ptr(base + 0x0C)
        total = SUBACTION_COUNT.get(root)
        if table is None or total is None:
            print(f"!! {name}: no subaction table or no DOL-derived count")
            continue
        for i in range(total):
            e = table + i * WAD_SIZE
            if e + WAD_SIZE > a.data_size:
                break
            name_p = a.ptr(e + 0x00)
            script_p = a.ptr(e + 0x0C)
            if script_p is None:
                continue
            label = a.cstr(name_p) if name_p is not None else "?"
            try:
                evs = decode_script(a, script_p)
            except Exception:
                continue
            for _off, op, _w, _n, _arg, word in evs:
                if op == SMASH_CHARGE_OP:
                    # opcode:6 | charge_frames:10 | charge_rate:16, MSB first
                    out.append((name, label,
                                (word >> 16) & 0x3FF, word & 0xFFFF))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    rows = events(datdir)
    if not rows:
        print("!! no smash_charge events found -- the opcode or the table walk "
              "is wrong, not the data")
        return 1

    combos = sorted({(f, r) for _c, _l, f, r in rows})
    per_char = {}
    for c, _l, f, r in rows:
        per_char.setdefault(c, set()).add((f, r))

    print(f"{len(rows)} smash_charge events across {len(per_char)} characters")
    for c in sorted(per_char):
        vals = ", ".join(f"frames={f} rate={r}" for f, r in sorted(per_char[c]))
        print(f"  {c:7} {vals}")

    if len(combos) != 1:
        print(f"\n!! NOT uniform: {len(combos)} distinct (frames, rate) pairs "
              f"{combos}. smashCharge.js hardcodes one pair and would be wrong "
              f"for some moves; it needs to become per-move data.")
        return 1

    frames, rate = combos[0]
    scale = struct.unpack(">f", struct.pack(">f", 0.003906))[0]
    dmg_mul = struct.unpack(">f", struct.pack(">f", scale * rate))[0]
    print(f"\nuniform: charge_frames = {frames}, charge_rate = {rate}")
    print(f"  dmg_mult = f32(0.003906f * {rate}) = {dmg_mul!r}")
    print(f"  full charge multiplies damage by {dmg_mul:.6f}")

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(os.path.join(root, JS), encoding="utf-8").read()
    got = {m.group(1): int(m.group(2)) for m in JS_RE.finditer(src)}
    want = {"SMASH_CHARGE_RATE": rate, "SMASH_CHARGE_FRAMES": frames}
    bad = [k for k in want if got.get(k) != want[k]]
    for k in sorted(want):
        status = "OK  " if got.get(k) == want[k] else "BAD "
        print(f"  [{status}] {k:22} js={got.get(k)} disc={want[k]}")
    if bad:
        return 1
    print("\nsmashCharge.js matches the disc")
    return 0


if __name__ == "__main__":
    sys.exit(main())
