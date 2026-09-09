"""Extract the attack ID (FtMoveId) of every common motion state.

Staling keys on `fp->x2068_attackID`, and that value comes from the motion
state table: `ft_800890D0(fp, new_motion_state->move_id)` on every state change
(fighter.c:1198). The move_id lives in the third field of each table entry,
packed into the top byte:

    {
        // ftCo_MS_AttackS3Hi = 51
        ftCo_SM_AttackS3Hi,
        ftCo_MF_AttackS3,
        (FtMoveId_AttackS3 << 24) | (1 << 23),      <-- this
        ftCo_AttackS3_Anim, ..., ftCamera_UpdateCameraBox,
    },

Two states can share a move_id -- every AttackS3 angle is one move for staling
purposes, which is why an angled f-tilt stales the flat one. Jab 1/2/3 are
SEPARATE ids (Attack11/12/13), so a jab combo stales three different entries.

Why parse the C rather than read the disc: unlike ftData and ftCommonData, the
motion state table is CODE, compiled into the DOL as a relocated array of
function pointers. The move_id byte is in there, but the entry stride and the
state->index correspondence are far easier to recover from the decomp's own
source, which carries the `ftCo_MS_* = N` index in a comment on every entry.

Usage:
    python tools/move_ids.py <melee-decomp-checkout>
    python tools/move_ids.py <melee-decomp-checkout> --json
"""
import json
import os
import re
import sys

MOTION_STATES = os.path.join("src", "melee", "ft", "ftmotionstates.c")
FORWARD = os.path.join("src", "melee", "ft", "kinds", "ftCommon", "forward.h")
FT_FORWARD = os.path.join("src", "melee", "ft", "forward.h")

# One table entry. The state name and index come from the leading comment, the
# move_id from the `(FtMoveId_Xxx << 24)` expression two lines down.
ENTRY_RE = re.compile(
    r"//\s*(ftCo_MS_\w+)\s*=\s*(\d+)\s*\n"      # // ftCo_MS_AttackS3Hi = 51
    r"\s*[\w]+,\s*\n"                            # submotion
    r"\s*[\w]+,\s*\n"                            # flags
    r"\s*\(?FtMoveId_(\w+)\s*<<\s*24\)?",        # move id
    re.M)

ENUM_RE = re.compile(r"typedef enum FtMoveId \{(.*?)\}", re.S)


def move_id_values(decomp):
    """FtMoveId_Xxx -> its integer value, from the enum's declaration order."""
    src = open(os.path.join(decomp, FT_FORWARD), encoding="utf-8").read()
    m = ENUM_RE.search(src)
    if not m:
        raise SystemExit("!! could not find `typedef enum FtMoveId` in ft/forward.h")
    out = {}
    n = 0
    for line in m.group(1).split("\n"):
        line = line.split("//")[0].strip().rstrip(",")
        if not line.startswith("FtMoveId_"):
            continue
        # No explicit `= N` initialisers appear in this enum; assert that, so a
        # future one is caught rather than silently shifting every value.
        if "=" in line:
            raise SystemExit(f"!! FtMoveId has an explicit initialiser: {line!r}")
        out[line] = n
        n += 1
    return out


# Per-character tables use the same entry shape but name their states
# ftFx_MS_*, ftMs_MS_* etc. rather than ftCo_MS_*. Specials live only here --
# the common table has no SpecialN/S/Hi/Lw at all.
CHAR_ENTRY_RE = re.compile(
    r"//\s*(ft\w+_MS_\w+)\s*=\s*(\d+)\s*\n"
    r"\s*[\w]+,\s*\n"
    r"\s*[\w]+,\s*\n"
    r"\s*\(?FtMoveId_(\w+)\s*<<\s*24\)?",
    re.M)

# meleelight's roster, decomp directory -> the file holding its motion table.
CHARS = {
    "Fox":    ("ftFox", "ftfox.c"),
    "Falco":  ("ftFalco", "ftfalco.c"),
    "Falcon": ("ftCaptain", "ftcaptain.c"),
    "Marth":  ("ftMars", "ftmars.c"),
    "Puff":   ("ftPurin", "ftpurin.c"),
}


def parse(decomp):
    src = open(os.path.join(decomp, MOTION_STATES), encoding="utf-8").read()
    values = move_id_values(decomp)
    rows = []
    for m in ENTRY_RE.finditer(src):
        state, idx, move = m.group(1), int(m.group(2)), "FtMoveId_" + m.group(3)
        if move not in values:
            raise SystemExit(f"!! {state}: unknown {move}")
        rows.append((state, idx, move, values[move]))
    return rows, values


def parse_char(decomp, name):
    """(state, index, FtMoveId_name, value) for one character's own table."""
    d, f = CHARS[name]
    path = os.path.join(decomp, "src", "melee", "ft", "kinds", d, f)
    if not os.path.exists(path):
        return []
    src = open(path, encoding="utf-8").read()
    values = move_id_values(decomp)
    out = []
    for m in CHAR_ENTRY_RE.finditer(src):
        state, idx, move = m.group(1), int(m.group(2)), "FtMoveId_" + m.group(3)
        if move not in values:
            raise SystemExit(f"!! {name} {state}: unknown {move}")
        out.append((state, idx, move, values[move]))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    decomp = sys.argv[1]
    rows, values = parse(decomp)
    if not rows:
        print("!! parsed 0 entries -- the table's shape changed", file=sys.stderr)
        return 1

    default = values["FtMoveId_Default"]
    attacks = [r for r in rows if r[3] != default]

    if "--json" in sys.argv:
        out = {"common": {state: mid for state, _i, _m, mid in rows}}
        for name in CHARS:
            cr = parse_char(decomp, name)
            out[name] = {state: mid for state, _i, _m, mid in cr if mid != default}
        json.dump(out, sys.stdout, indent=2, sort_keys=True)
        print()
        return 0

    print(f"{len(rows)} common motion states parsed, "
          f"{len(attacks)} carry an attack id "
          f"({len(rows) - len(attacks)} are FtMoveId_Default = {default})\n")

    # Group by move id: states that share one stale together.
    by_move = {}
    for state, idx, move, mid in attacks:
        by_move.setdefault((mid, move), []).append(state)
    for (mid, move), states in sorted(by_move.items()):
        head = f"  {mid:3}  {move:<26}"
        print(head + states[0])
        for s in states[1:]:
            print(" " * len(head) + s)

    # Specials are absent from the common table entirely -- each character
    # declares its own SpecialN/S/Hi/Lw states with the shared FtMoveId.
    for name in CHARS:
        cr = [r for r in parse_char(decomp, name) if r[3] != default]
        if not cr:
            print(f"\n  {name}: no per-character attack states parsed")
            continue
        seen = {}
        for state, _i, move, mid in cr:
            seen.setdefault((mid, move), []).append(state)
        print(f"\n  {name} ({len(cr)} states, {len(seen)} distinct ids):")
        for (mid, move), states in sorted(seen.items()):
            print(f"    {mid:3}  {move:<22} {', '.join(states)}")


if __name__ == "__main__":
    sys.exit(main())
