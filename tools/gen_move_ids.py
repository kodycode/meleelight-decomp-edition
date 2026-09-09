"""Generate src/physics/staleMoveIds.js -- meleelight action state -> FtMoveId.

Staling keys on `fp->x2068_attackID`, which every motion state change copies
out of the motion state table (fighter.c:1198). So to stale anything, each
meleelight action state needs the attack id its Melee counterpart carries.

Three sources are composed here, none of them guessed:

  * move_ids.py           ftCo_MS_*/ftXx_MS_* -> FtMoveId value, parsed out of
                          the decomp's own motion state tables.
  * state_map.COMMON      meleelight state name -> Melee state name. Already
                          validated (check_states.py reports 0 disagreements).
  * state_map.SPECIAL     the per-character special moves, which the common
                          table does not contain at all.

Anything that does not resolve is left out of the table and reads as
FtMoveId_Default (1) at runtime, which `ft_80089118` treats as unstaleable --
the safe direction: a move that should stale but does not is a smaller error
than one that stales when Melee says it should not.

WHAT SHARES AN ID MATTERS. All five f-tilt angles are one move; an aerial and
its landing-lag state are one move; jab 1/2/3 are three DIFFERENT moves. Those
groupings come from the table, not from naming.

Usage:
    python tools/gen_move_ids.py <melee-decomp-checkout>
    python tools/gen_move_ids.py <melee-decomp-checkout> --check
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import move_ids
import state_map

OUT = os.path.join("src", "physics", "staleMoveIds.js")

# meleelight's per-character move directories, plus the numeric character id
# the runtime actually indexes by (CHARIDS in src/main/characters.js). Keying
# the generated table by that id avoids a name lookup on every frame.
CHAR_DIRS = {
    "Fox": "fox", "Falco": "falco", "Falcon": "falcon",
    "Marth": "marth", "Puff": "puff",
}
CHAR_IDS = {"Marth": 0, "Puff": 1, "Fox": 2, "Falco": 3, "Falcon": 4}

MS_PREFIX_RE = re.compile(r"^ft\w{0,4}_MS_")

# state_map.SPECIAL names SUBACTIONS, and a subaction name does not always
# match a motion state name -- Puff's neutral special animation is "SpecialN"
# while its states are SpecialNStartR / SpecialNStartL / SpecialNLoop / ...
# The attack id does not depend on which of those it is: every one of the five
# characters assigns SpecialN 18, SpecialS 19, SpecialHi 20 and SpecialLw 21
# (verified by `python tools/move_ids.py <decomp>`), because the id comes from
# the move GROUP. So an exact miss falls back to classifying the group.
SPECIAL_GROUP_RE = re.compile(r"^Special(?:Air)?(N|S|Hi|Lw)(?![a-z])")
SPECIAL_GROUP_ID = {"N": "FtMoveId_SpecialN", "S": "FtMoveId_SpecialS",
                    "Hi": "FtMoveId_SpecialHi", "Lw": "FtMoveId_SpecialLw"}


def strip_ms(name):
    return MS_PREFIX_RE.sub("", name)


def meleelight_states(root, char):
    """Every action state `char` actually has: its own moves plus the shared set.

    Without this the direct-name pass below happily emits AttackS3 ids for
    SwordSwing, BatSwing, ParasolSwing and the rest of the item movesets, which
    meleelight has no states for -- 132 entries per character where the real
    number is around 30. Harmless at runtime, but it hides what is actually
    covered, and coverage is the thing this tool exists to report.
    """
    names = set()
    for d in (os.path.join(root, "src", "characters", CHAR_DIRS[char], "moves"),
              os.path.join(root, "src", "characters", "shared", "moves")):
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith(".js"):
                names.add(f[:-3].upper())
    return names


def build(decomp, root):
    rows, values = move_ids.parse(decomp)
    default = values["FtMoveId_Default"]

    # Melee state name (upper, no prefix) -> move id, common table.
    common = {}
    for state, _idx, _move, mid in rows:
        common.setdefault(strip_ms(state).upper(), mid)

    # Per-character, for the specials.
    per_char = {}
    for name in move_ids.CHARS:
        d = {}
        for state, _idx, _move, mid in move_ids.parse_char(decomp, name):
            d.setdefault(strip_ms(state).upper(), mid)
        per_char[name] = d

    out = {}
    unresolved = {}
    for char in CHAR_DIRS:
        have = meleelight_states(root, char)
        m = {}
        # 1. The hand-written bridge for states whose names differ.
        for ml, melee in state_map.COMMON.items():
            if ml not in have:
                continue
            mid = common.get(melee.upper())
            if mid is not None and mid != default:
                m[ml] = mid
        # 2. Specials, from the character's own table.
        for (c, ml), melee in state_map.SPECIAL.items():
            if c != char or ml not in have:
                continue
            mid = per_char[char].get(melee.upper())
            if mid is None:
                mid = common.get(melee.upper())
            if mid is None:
                g = SPECIAL_GROUP_RE.match(melee)
                if g:
                    mid = values[SPECIAL_GROUP_ID[g.group(1)]]
            if mid is None:
                # The state name is not in ANY table -- a genuine miss.
                unresolved.setdefault(char, []).append(ml)
            elif mid != default:
                m[ml] = mid
            # mid == default is not a miss: multi-jumps and other non-attack
            # states legitimately carry FtMoveId_Default and must not stale.
        # 3. Direct name matches for anything not bridged (ATTACKAIRN etc).
        for melee_upper, mid in common.items():
            if mid == default or melee_upper not in have:
                continue
            m.setdefault(melee_upper, mid)
        out[char] = m
    return out, values, unresolved


def js(out, values):
    inv = {v: k for k, v in values.items()}
    L = []
    L.append("// GENERATED by tools/gen_move_ids.py -- do not edit by hand.")
    L.append("//")
    L.append("// meleelight action state -> Melee's FtMoveId, the value staling keys on.")
    L.append("// Sourced from the decomp's motion state tables (ftmotionstates.c and each")
    L.append("// character's own ftxxx.c), composed with tools/state_map.py.")
    L.append("//")
    L.append("// A state absent from a character's map is FtMoveId_Default (1), which")
    L.append("// ft_80089118 (ft_0881.c:344) returns 1.0 for -- i.e. it does not stale.")
    L.append("//")
    L.append("// States SHARING a value stale as one move. That is deliberate and comes")
    L.append("// from the table: every f-tilt angle is one AttackS3, an aerial and its")
    L.append("// landing state are one move, but jab 1/2/3 are three separate ids.")
    L.append("")
    L.append("export const FT_MOVE_ID_DEFAULT = %d;" % values["FtMoveId_Default"])
    L.append("")
    L.append("// Indexed by CHARIDS (src/main/characters.js): "
             + ", ".join(f"{v} {k}" for k, v in sorted(CHAR_IDS.items(), key=lambda kv: kv[1])))
    L.append("export const STALE_MOVE_IDS = {")
    for char in sorted(out, key=lambda c: CHAR_IDS[c]):
        L.append("  %d: {   // %s" % (CHAR_IDS[char], char))
        for state in sorted(out[char]):
            mid = out[char][state]
            L.append("    %s: %d,%s" % (state, mid,
                                        "".ljust(max(1, 28 - len(state) - len(str(mid))))
                                        + "// " + inv.get(mid, "?")))
        L.append("  },")
    L.append("};")
    L.append("")
    return "\n".join(L)


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    decomp = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out, values, unresolved = build(decomp, root)

    total = sum(len(v) for v in out.values())
    print(f"{total} state->attack-id entries across {len(out)} characters")
    for char in sorted(out):
        ids = sorted(set(out[char].values()))
        print(f"  {char:7} {len(out[char]):3} states, {len(ids):2} distinct attack ids")
    for char, states in sorted(unresolved.items()):
        print(f"  !! {char}: unresolved specials: {', '.join(states)}")

    text = js(out, values)
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), OUT)
    if "--check" in sys.argv:
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        if cur == text:
            print("\nstaleMoveIds.js is up to date")
            return 0
        print("\n!! staleMoveIds.js differs from what the decomp produces")
        return 1
    open(path, "w", encoding="utf-8").write(text)
    print(f"\nwrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
