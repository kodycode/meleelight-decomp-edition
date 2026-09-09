"""Name-matched comparison: one subaction's hitboxes vs one meleelight property.

The bulk sweep matches by VALUE, which is fine as a screen but cannot justify an
edit -- a "closest candidate" can be coincidental (it matched Fox's rapid jab
against a laser that does not exist, and grab boxes against the Shine). This
resolves a specific named move on both sides.

  python compare_move.py ./dat <char> <SubactionName> <mlPropertyName>
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import (decode_script, decode_create_hitbox, WAD_SIZE,
                       SUBACTION_COUNT)

CHARS = {
    "Fox": ("PlFx.dat", "ftDataFox", "src/characters/fox/attributes.js"),
    "Falco": ("PlFc.dat", "ftDataFalco", "src/characters/falco/attributes.js"),
    "Falcon": ("PlCa.dat", "ftDataCaptain", "src/characters/falcon/attributes.js"),
    "Marth": ("PlMs.dat", "ftDataMars", "src/characters/marth/marthAttributes.js"),
    "Puff": ("PlPr.dat", "ftDataPurin", "src/characters/puff/puffAttributes.js"),
}
ML_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HB_RE = re.compile(
    r"new\s+createHitbox\s*\(\s*([^,]+?)\s*,\s*"
    r"(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*"
    r"(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,")


def script_hitboxes(datdir, dat, root, want_name):
    a = Archive(os.path.join(datdir, dat))
    base = a.root(root)
    table = a.ptr(base + 0x0C)
    found = []
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        if e + WAD_SIZE > a.data_size:
            break
        sp = a.ptr(e + 0x0C)
        namep = a.ptr(e + 0x00)
        if sp is None or namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        if nm != want_name:
            continue
        frame = 0
        for rel, op, n, label, arg, word in decode_script(a, sp):
            if op == 0x01:
                frame += arg
            elif op == 0x02:
                frame = arg
            elif op == 0x0B:
                ws = [a.d_u32(rel + k * 4) for k in range(5)]
                h = decode_create_hitbox(ws)
                h["frame"] = frame
                h["subaction_index"] = i
                found.append(h)
    return found


def ml_entries(js_path, prop):
    """Extract one property's createHitbox calls.

    Balances parentheses rather than reading to end-of-line: several entries
    (Falcon jab1/jab2, Falcon dair) put each createHitbox on its own line, and a
    line-scoped regex silently reports "0 hitboxes" for those -- which reads as
    a missing property rather than a tool limitation, and hides real data.
    """
    src = open(js_path, encoding="utf-8").read()
    m = re.search(r"^[ \t]*" + re.escape(prop) + r"[ \t]*:[ \t]*new\s+createHitboxObject\s*\(",
                  src, re.M)
    if not m:
        return None, None
    line_no = src.count("\n", 0, m.start()) + 1
    i = src.index("(", m.start())
    depth = 0
    end = len(src)
    for j in range(i, len(src)):
        if src[j] == "(":
            depth += 1
        elif src[j] == ")":
            depth -= 1
            if depth == 0:
                end = j
                break
    block = src[i:end]
    return line_no, [
        (g.group(1).strip(),) + tuple(float(g.group(k)) for k in range(2, 8))
        for g in HB_RE.finditer(block)
    ]


def main():
    datdir, char, sub, prop = sys.argv[1:5]
    dat, root, jsrel = CHARS[char]
    js = os.path.join(ML_ROOT, jsrel)

    hbs = script_hitboxes(datdir, dat, root, sub)
    print(f"=== {char} {sub} (script) -- {len(hbs)} hitbox events ===")
    for h in hbs:
        print(f"  f{h['frame']:<3} id={h['id']} size={h['size']:.5f} "
              f"dmg={h['damage']} angle={h['angle']} kg={h['kb_growth']} "
              f"bk={h['base_kb']} setkb={h['set_kb']} elem={h['element']}")

    line, entries = ml_entries(js, prop)
    if entries is None:
        print(f"\n!! meleelight property '{prop}' not found in {jsrel}")
        return 1
    print(f"\n=== meleelight {prop} (line {line}) -- {len(entries)} hitboxes ===")
    for off, size, dmg, angle, kg, bk, sk in entries:
        print(f"  {off.split('.')[-1]:<8} size={size} dmg={dmg:g} angle={angle:g} "
              f"kg={kg:g} bk={bk:g} sk={sk:g}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
