"""Reverse lookup: given hitbox values, name every script hitbox that has them.

`compare_move.py` answers "does THIS move's data match?" and `sweep_hitboxes.py`
answers "does this value exist anywhere?" -- but when the sweep says a value IS
corroborated, it does not say WHERE, and "somewhere in this character's 237
hitboxes" is not the same as "in the move meleelight attaches it to".

That distinction is not academic. Fox's `throwforwardextra` passed the sweep,
yet Fox's ThrowF script hitbox is size 4.6875 dmg 4 angle 55 setkb 140 -- the
sweep had matched the entry against an unrelated move that happened to share
all five compared fields. This tool makes that visible.

  python find_hitbox.py ./dat <char> [--size S] [--dmg D] [--angle A]
                                     [--kg K] [--bk B] [--setkb S]

Every filter is optional; those given must all match. Sizes compare with the
8.8 fixed-point tolerance (meleelight truncates, the disc stores n/256).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import (decode_script, decode_create_hitbox,
                       decode_throw_hitbox, WAD_SIZE, SUBACTION_COUNT)
from compare_move import CHARS

SIZE_TOL = 0.0025


def all_hitboxes(datdir, dat, root):
    a = Archive(os.path.join(datdir, dat))
    base = a.root(root)
    table = a.ptr(base + 0x0C)
    out = []
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        if e + WAD_SIZE > a.data_size:
            break
        sp = a.ptr(e + 0x0C)
        namep = a.ptr(e + 0x00)
        if sp is None or namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        frame = 0
        try:
            events = decode_script(a, sp)
        except Exception:
            continue
        for rel, op, n, label, arg, word in events:
            if op == 0x01:
                frame += arg
            elif op == 0x02:
                frame = arg
            elif op in (0x0B, 0x22):
                nw = 5 if op == 0x0B else 3
                try:
                    ws = [a.d_u32(rel + k * 4) for k in range(nw)]
                except Exception:
                    continue
                h = (decode_create_hitbox(ws) if op == 0x0B
                     else decode_throw_hitbox(ws))
                h["subaction"] = nm
                h["frame"] = frame
                h["event"] = op
                out.append(h)
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("  python")[1].strip(), file=sys.stderr)
        return 2
    datdir, char = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    want = {}
    for i in range(0, len(args) - 1, 2):
        want[args[i].lstrip("-")] = float(args[i + 1])

    keys = {"size": "size", "dmg": "damage", "angle": "angle",
            "kg": "kb_growth", "bk": "base_kb", "setkb": "set_kb"}
    unknown = set(want) - set(keys)
    if unknown:
        print(f"unknown filter(s): {', '.join(sorted(unknown))}", file=sys.stderr)
        return 2

    dat, root, _ = CHARS[char]
    hbs = all_hitboxes(datdir, dat, root)

    def ok(h):
        for k, v in want.items():
            field = h.get(keys[k])
            if field is None:            # throw hitboxes carry no size
                return False
            if k == "size":
                if abs(field - v) >= SIZE_TOL:
                    return False
            elif int(field) != int(v):
                return False
        return True

    hits = [h for h in hbs if ok(h)]
    crit = " ".join(f"{k}={v:g}" for k, v in want.items()) or "(no filter)"
    print(f"{char}: {len(hits)} of {len(hbs)} script hitboxes match {crit}\n")
    for h in hits:
        ev = "create_hitbox" if h["event"] == 0x0B else "throw_hitbox"
        size = "  --  " if h.get("size") is None else f"{h['size']:.5f}"
        print(f"  {h['subaction']:<22} f{h['frame']:<3} id={h['id']} "
              f"size={size} dmg={h['damage']} angle={h['angle']} "
              f"kg={h['kb_growth']} bk={h['base_kb']} setkb={h['set_kb']} "
              f"[{ev}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
