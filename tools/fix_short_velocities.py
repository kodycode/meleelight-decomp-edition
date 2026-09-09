"""Extend setVelocities tables that are shorter than their action state's frame count.

meleelight reads these as `setVelocities[player.timer - 1]`. `timer` runs to
framesData[char][state], so a table with fewer entries than that returns
`undefined` on the last frame, and `undefined * face` is NaN. That NaN goes
straight into gr_vel -> cVel -> pos, and a NaN position renders nothing, never
lands inside the blastzone (so the fighter never dies) and makes the AI's
nearest-enemy distance compare false forever. In play: roll off a knockdown and
the fighter vanishes permanently.

The frame counts are correct -- validate_frames.py checks all 173 against the
figatree headers on the disc. It is the tables that are one frame short,
having been recorded against the older, one-frame-shy counts.

THE APPENDED VALUE IS 0, and that is the held-pose rule this codebase already
uses (bake_offsets.py: "Past the animation's last frame the pose holds,
matching the figatree simply not advancing"). setVelocities holds a per-frame
TRANSLATION taken from the animation, so a pose that does not advance
contributes no movement -- zero, not a repeat of the last delta. It also
agrees with what the states do one frame later: every roll's interrupt() calls
setGroundVelocity(p, 0) on the way out.

    python tools/fix_short_velocities.py             # report only
    python tools/fix_short_velocities.py --write
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "characters")

# meleelight char id -> (index.js, attributes file)
CHARS = [
    ("MARTH_ID", "marth", "marthAttributes.js"),
    ("PUFF_ID", "puff", "puffAttributes.js"),
    ("FOX_ID", "fox", "attributes.js"),
    ("FALCO_ID", "falco", "attributes.js"),
    ("FALCON_ID", "falcon", "attributes.js"),
]


def frame_counts(path):
    """setFrames table: `"STATE" : N,` pairs."""
    txt = open(path, encoding="utf8").read()
    return {m.group(1): int(m.group(2))
            for m in re.finditer(r'"([A-Z0-9_]+)"\s*:\s*(\d+)\s*,', txt)}


def main():
    write = "--write" in sys.argv
    total = 0
    changed = 0

    for cid, cdir, attrfile in CHARS:
        idx = os.path.join(SRC, cdir, "index.js")
        att = os.path.join(SRC, cdir, attrfile)
        if not (os.path.exists(idx) and os.path.exists(att)):
            print("!! %s: missing index.js or %s" % (cdir, attrfile))
            continue

        frames = frame_counts(att)
        txt = open(idx, encoding="utf8").read()
        out = txt

        for table in ("setVelocities", "posOffset"):
            head = re.compile(
                r"actionStates\[CHARIDS\." + re.escape(cid) +
                r"\]\.([A-Z0-9_]+)\." + table + r"\s*=\s*\[")
            for m in head.finditer(txt):
                state = m.group(1)
                want = frames.get(state)
                if want is None:
                    continue

                # Walk the literal honouring nesting, so a posOffset row [x, y]
                # is one entry rather than two.
                i = m.end()
                depth = 1
                start = i
                rows = []
                rowstart = i
                while i < len(txt) and depth > 0:
                    ch = txt[i]
                    if ch == "[":
                        depth += 1
                    elif ch == "]":
                        depth -= 1
                        if depth == 0:
                            seg = txt[rowstart:i].strip()
                            if seg:
                                rows.append(seg)
                    elif ch == "," and depth == 1:
                        rows.append(txt[rowstart:i].strip())
                        rowstart = i + 1
                    i += 1
                body = txt[start:i - 1]

                # A posOffset that is a bare [x, y] pair is a fixed offset, not
                # a per-frame table (CLIFFWAIT.posOffset = [-70.6, -16.5]).
                if table == "posOffset" and "[" not in body:
                    continue

                total += 1
                if len(rows) >= want:
                    continue
                deficit = want - len(rows)

                if table == "setVelocities":
                    # A per-frame TRANSLATION: a pose that does not advance
                    # contributes no movement.
                    filler = [" 0"] * deficit
                    what = "zero"
                else:
                    # A per-frame POSITION offset: the held pose keeps the same
                    # offset, so repeat the final row.
                    filler = [" " + rows[-1]] * deficit
                    what = "repeat of the last row"

                newbody = body.rstrip()
                if not newbody.endswith(","):
                    newbody += ","
                newbody += ",".join(filler)

                old = txt[m.start():i]
                new = txt[m.start():start] + newbody + "]"
                print("  %-7s %-14s %-14s %d -> %d  (appended %d x %s)"
                      % (cdir, state, table, len(rows), want, deficit, what))
                out = out.replace(old, new, 1)
                changed += 1

        if write and out != txt:
            open(idx, "w", encoding="utf8", newline="").write(out)

    print()
    print("  %d setVelocities tables inspected, %d short" % (total, changed))
    if changed and not write:
        print("  (report only -- pass --write to apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
