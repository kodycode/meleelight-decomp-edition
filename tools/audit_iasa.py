"""Interruptible-as-soon-as windows: the disc's ALLOW_INTERRUPT against what
meleelight actually lets you act out of.

Melee grants interruptibility from inside the subaction script, with event
0x17 ALLOW_INTERRUPT (ftaction.c, dispatched through ftAction_803C06E8 at
index opcode-0x0A). Everything before it is locked; from that frame the
state's IASA chain runs and the move can be cancelled into anything it lists.

TWO THINGS MAKE A NAIVE READING WRONG.

First, an ALLOW_INTERRUPT past the end of the ANIMATION never executes. Fox's
forward smash sets it at frame 46 on a 40-frame animation, so the move simply
ends when the animation does and there is no early window at all. Reporting 46
as an IASA frame there would invent a mechanic.

Second, the frame bases differ. Script frames are 0-based; meleelight's
`player[p].timer` starts at 1 on the state's first frame and its move files end
with `if (player[p].timer > N)`, so a move with ml_end N occupies timers 1..N
and its last animation frame is N-1.

What this reports is the moves where Melee has a REACHABLE window and
meleelight runs the animation out instead -- the frames of lockout we add.

    python tools/audit_iasa.py tools/dat
    python tools/audit_iasa.py tools/dat --all      every mapped move
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hitbox_timeline import iter_subactions
from subaction import decode_script
from figatree import AJ, subaction_anims
from compare_move import CHARS

ALLOW_INTERRUPT = 0x17

AJ_DAT = {"Fox": "PlFxAJ.dat", "Falco": "PlFcAJ.dat", "Falcon": "PlCaAJ.dat",
          "Marth": "PlMsAJ.dat", "Puff": "PlPrAJ.dat"}
MOVE_DIR = {"Fox": "fox", "Falco": "falco", "Falcon": "falcon",
            "Marth": "marth", "Puff": "puff"}

# meleelight move file -> subaction. Only moves whose file ends with a single
# `timer > N` guard; anything with a branchier ending is left out rather than
# guessed at.
MOVES = {
    "JAB1": "Attack11", "JAB2": "Attack12",
    "FORWARDTILT": "AttackS3S", "UPTILT": "AttackHi3", "DOWNTILT": "AttackLw3",
    "FORWARDSMASH": "AttackS4", "UPSMASH": "AttackHi4", "DOWNSMASH": "AttackLw4",
    "ATTACKAIRN": "AttackAirN", "ATTACKAIRF": "AttackAirF",
    "ATTACKAIRB": "AttackAirB", "ATTACKAIRU": "AttackAirHi",
    "ATTACKAIRD": "AttackAirLw", "ATTACKDASH": "AttackDash",
}
CHAR_OVERRIDES = {("Falcon", "FORWARDSMASH"): "AttackS4S",
                  ("Marth", "FORWARDTILT"): "AttackS31"}


def iasa_frames(datdir, dat, root):
    """subaction -> frame of its first ALLOW_INTERRUPT, if it has one."""
    out = {}
    for a, _i, nm, sp in iter_subactions(datdir, dat, root):
        if nm in out:
            continue
        frame = 0
        for _rel, op, _n, _label, arg, _word in decode_script(a, sp):
            if op == 0x01:
                frame += arg
            elif op == 0x02:
                frame = arg
            elif op == ALLOW_INTERRUPT:
                out[nm] = frame
                break
    return out


def ml_end(path):
    """The N in the move file's terminal `if (player[p].timer > N)`."""
    if not os.path.exists(path):
        return None
    src = open(path, encoding="utf-8").read()
    m = re.search(
        r"interrupt\s*:\s*function[^{]*\{\s*if\s*\(player\[p\]\.timer\s*>\s*([0-9]+)",
        src)
    return int(m.group(1)) if m else None


def ml_iasa(path):
    """`player[p].IASATimer = N`, where the move already implements a window.

    Fifteen aerials do -- five each on Fox, Falco and Falcon -- through
    checkForIASA, which tests `timer > IASATimer`. Reading only the terminal
    guard calls those moves uninterruptible when they are not, which is exactly
    the mistake this function exists to stop.
    """
    if not os.path.exists(path):
        return None
    m = re.search(r"IASATimer\s*=\s*([0-9]+)",
                  open(path, encoding="utf-8").read())
    return int(m.group(1)) if m else None


def main():
    if len(sys.argv) < 2:
        print("usage: python tools/audit_iasa.py <datdir> [--all]",
              file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    show_all = "--all" in sys.argv

    rows = []
    for char, (dat, root, _js) in CHARS.items():
        if not os.path.exists(os.path.join(datdir, dat)):
            continue
        iasa = iasa_frames(datdir, dat, root)
        anims = subaction_anims(os.path.join(datdir, dat), root)
        aj = AJ(os.path.join(datdir, AJ_DAT[char]))
        for ml, sub in MOVES.items():
            sub = CHAR_OVERRIDES.get((char, ml), sub)
            if sub not in anims:
                continue
            last = int(aj.frame_count(*anims[sub]) or 0) - 1
            path = "src/characters/%s/moves/%s.js" % (MOVE_DIR[char], ml)
            end = ml_end(path)
            have = ml_iasa(path)
            f = iasa.get(sub)
            if f is None:
                state = "no ALLOW_INTERRUPT"
            elif f > last:
                state = "unreachable (past frame %d)" % last
            else:
                state = "IASA f%d" % f
            rows.append((char, ml, sub, f, last, end, state, have))

    implemented = [r for r in rows if r[7] is not None]
    missing = [r for r in rows
               if r[7] is None and r[3] is not None and r[3] <= r[4]
               and r[5] is not None and r[3] < r[5] - 1]
    print("")
    print("%-7s %-14s %-14s %6s %6s %6s  %s"
          % ("char", "move", "subaction", "IASA", "last", "ml_end", "lockout"))
    for char, ml, sub, f, last, end, state, have in (rows if show_all else missing):
        extra = ""
        if f is not None and end is not None and f <= last:
            extra = "+%d frames" % ((end - 1) - f)
        print("%-7s %-14s %-14s %6s %6s %6s  %s"
              % (char, ml, sub, f if f is not None else "-", last,
                 end if end is not None else "-", extra or state))

    reachable = [r for r in rows if r[3] is not None and r[3] <= r[4]]
    unreachable = [r for r in rows if r[3] is not None and r[3] > r[4]]
    print("")
    print("  %d move(s) mapped: %d have a reachable ALLOW_INTERRUPT, "
          "%d set it past the animation (so it never fires), %d have none"
          % (len(rows), len(reachable), len(unreachable),
             len(rows) - len(reachable) - len(unreachable)))
    print("  %d move(s) already implement a window through IASATimer"
          % len(implemented))
    print("  %d of the reachable ones are locked out longer in meleelight"
          % len(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
