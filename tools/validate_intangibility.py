"""Check meleelight's setIntangibility windows against the subaction scripts.

Melee does not store intangibility as a table. Each subaction script raises and
lowers the body state itself, with event 0x1A (ftAction_80071A14 ->
ftColl_8007B62C, ftcoll.c:3292):

    body_state 2   intangible
    body_state 0   normal

so a window is the span between a `2` and the next `0` in the same script:

    EscapeAir:  f4 -> state 2,  f30 -> state 0     =>  [start 4, length 26]

meleelight stores [start, length], which is exactly (first_2, next_0 - first_2).

Event 0x1B (all_hurtbox_state) sets the hurt CAPSULES instead of the body state
and is reported separately -- it is a different mechanism, and conflating the
two would invent windows that meleelight never modelled.

Usage:
    python tools/validate_intangibility.py tools/dat
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import decode_script, WAD_SIZE, SUBACTION_COUNT
from compare_move import CHARS as MOVE_CHARS

BODY_STATE = 0x1A
INTANGIBLE = 2
NORMAL = 0

CHARS = [
    ("Fox",    "PlFx.dat", "ftDataFox",     "src/characters/fox/attributes.js"),
    ("Falco",  "PlFc.dat", "ftDataFalco",   "src/characters/falco/attributes.js"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "src/characters/falcon/attributes.js"),
    ("Marth",  "PlMs.dat", "ftDataMars",    "src/characters/marth/marthAttributes.js"),
    ("Puff",   "PlPr.dat", "ftDataPurin",   "src/characters/puff/puffAttributes.js"),
]

# meleelight action-state name -> Melee subaction name.
SUBACTION = {
    "ESCAPEAIR":   "EscapeAir",
    "ESCAPEN":     "EscapeN",
    "ESCAPEF":     "EscapeF",
    "ESCAPEB":     "EscapeB",
    "DOWNSTANDN":  "DownStandU",
    "DOWNSTANDF":  "DownFowardU",   # sic -- the symbol is spelled "Foward"
    "DOWNSTANDB":  "DownBackU",
    "TECHN":       "Passive",
    "TECHF":       "PassiveStandF",
    "TECHB":       "PassiveStandB",
}


def windows(a, script_ptr):
    """[(start, length)] spans of body_state 2 .. next body_state 0."""
    frame = 0
    events = []
    for rel, op, n, label, arg, word in decode_script(a, script_ptr):
        if op == 0x01:
            frame += arg
        elif op == 0x02:
            frame = arg
        elif op == BODY_STATE:
            events.append((frame, word & 0x03FFFFFF))
    out = []
    start = None
    for frame, state in events:
        if state == INTANGIBLE and start is None:
            start = frame
        elif state == NORMAL and start is not None:
            out.append((start, frame - start))
            start = None
    return out


def scripts_by_name(datdir, dat, root):
    a = Archive(os.path.join(datdir, dat))
    table = a.ptr(a.root(root) + 0x0C)
    found = {}
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        sp = a.ptr(e + 0x0C)
        namep = a.ptr(e + 0x00)
        if sp is None or namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        found.setdefault(nm, sp)
    return a, found


BLOCK_RE = re.compile(r"setIntangibility\s*\([^,]+,\s*\{")
ENTRY_RE = re.compile(r'"([A-Z0-9]+)"\s*:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]')


def parse_js(path):
    src = open(path, encoding="utf-8").read()
    m = BLOCK_RE.search(src)
    if not m:
        return {}
    i = src.index("{", m.start())
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
    return {k: (int(s), int(l)) for k, s, l in ENTRY_RE.findall(src[i:j])}


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    ml_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    total = ok = 0
    bad, skipped = [], {}

    for name, dat, root, jsrel in CHARS:
        js = os.path.join(ml_root, jsrel)
        if not os.path.exists(os.path.join(datdir, dat)) or not os.path.exists(js):
            print(f"!! {name}: missing {dat} or {jsrel}")
            continue
        a, found = scripts_by_name(datdir, dat, root)
        entries = parse_js(js)

        for key, (start, length) in sorted(entries.items()):
            sub = SUBACTION.get(key)
            if sub is None or sub not in found:
                skipped.setdefault(key, []).append(name)
                continue
            try:
                w = windows(a, found[sub])
            except Exception as e:
                skipped.setdefault(key, []).append(name)
                continue
            if len(w) != 1:
                # 0 windows means the script never touches the body state; 2+
                # means meleelight's single [start, length] cannot express it.
                skipped.setdefault(f"{key} ({len(w)} windows)", []).append(name)
                continue
            # Convention: meleelight's move files all `init` with timer = 0 and
            # then `timer++` at the TOP of main, so the first executed frame has
            # timer == 1 and corresponds to ANIMATION FRAME 0. executeIntangibility
            # fires on `timer == start`. The expected entry is therefore
            #     [disc_start + 1, disc_length]
            # not [disc_start, disc_length].
            #
            # Getting this backwards makes the correct entries look broken and
            # the broken ones look correct, so it is asserted here rather than
            # inferred from which way the numbers happen to lean.
            want = (w[0][0] + 1, w[0][1])
            total += 1
            if (start, length) == want:
                ok += 1
            else:
                bad.append((name, key, sub, (start, length), want))

    # With the +1 convention applied, a remaining mismatch is either a wrong
    # START (fires on the wrong frame) or a wrong DURATION (intangible for the
    # wrong number of frames). Duration errors are the ones that change how
    # long a fighter is actually invulnerable, so they are listed first.
    dur = [b for b in bad if b[3][1] != b[4][1]]
    startonly = [b for b in bad if b not in dur]

    print("")
    print(f"{ok}/{total} intangibility windows match the subaction scripts")
    if dur:
        print(f"\n  {len(dur)} with a wrong DURATION:")
        for name, key, sub, got, want in dur:
            extra = "" if got[0] == want[0] else f"  (start {got[0]} -> {want[0]} too)"
            print(f"    {name:7} {key:12} ({sub:14}) length {got[1]} -> {want[1]}{extra}")
    if startonly:
        print(f"\n  {len(startonly)} with the right duration but a wrong START:")
        for name, key, sub, got, want in startonly:
            print(f"    {name:7} {key:12} ({sub:14}) start {got[0]} -> {want[0]}")

    if skipped:
        print(f"\n  not checked ({len(skipped)}):")
        for k, who in sorted(skipped.items()):
            print(f"    {k:28} ({', '.join(who)})")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
