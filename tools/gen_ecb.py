"""Regenerate meleelight's per-frame ECB tables from the disc.

meleelight's ecb.js tables were observed frame by frame. Melee does not store
an ECB at all -- it rebuilds one every frame from six joints (see ecb.py), so
the tables can be computed exactly instead.

Two things this fixes at once:

  * ACCURACY. The observed tables are integers, so they carry up to half a unit
    of rounding on every side of every frame.
  * LENGTH. They were captured against the old setFrames counts, several of
    which were one frame short of the real animation. Correcting setFrames made
    `frame` reach one row past the end of those tables. Generating the table at
    the correct length removes the mismatch at the source rather than clamping
    around it.

Only states with a confident action-state -> subaction mapping are emitted;
everything else is left exactly as it is and reported. A looping animation is
sampled with `frame % anim_frames`, matching Melee replaying it; a one-shot
animation holds its final frame.

    python tools/gen_ecb.py tools/dat <decomp>            # report, write nothing
    python tools/gen_ecb.py tools/dat <decomp> --write

Every generated row is sanity-checked before anything is written (bottom <= top,
a positive finite half-width, plausible magnitudes). One bad row aborts the
whole run rather than writing a partly-good file.
"""
import math
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose
from ecb import CHARS, ecb_source, build_ecb, joint_root, model_scale
from validate_frames import parse_js as parse_frames
from state_map import build as build_state_map

# meleelight multiplies every table entry by this at runtime
# (physics.js, the ecbOffset construction), so the stored table is the real
# ECB DIVIDED by it. Only Falcon differs from 1.
ECB_SCALE = {"Fox": 1.0, "Falco": 1.0, "Falcon": 1.45, "Marth": 1.0, "Puff": 1.0}

# Animations Melee replays for as long as the state lasts. Sampling these past
# their length must wrap, not hold.
LOOPING = {"Wait1", "Wait2", "Wait3", "Run", "SquatWait", "CliffWait",
           "DownWaitU", "DownWaitD", "OttottoWait", "FuraFura", "CaptureWait",
           "CatchWait", "Walk", "WalkSlow", "WalkMiddle", "WalkFast"}

JS = {
    "Fox":    ("src/characters/fox/ecb.js",    "src/characters/fox/attributes.js"),
    "Falco":  ("src/characters/falco/ecb.js",  "src/characters/falco/attributes.js"),
    "Falcon": ("src/characters/falcon/ecb.js", "src/characters/falcon/attributes.js"),
    "Marth":  ("src/characters/marth/ecbmarth.js", "src/characters/marth/marthAttributes.js"),
    "Puff":   ("src/characters/puff/ecbpuff.js",   "src/characters/puff/puffAttributes.js"),
}


def table_re(state):
    return re.compile(r"(\b" + state + r"\s*:\s*)\[(\[[^A-Za-z]*?\])\](?=\s*,\s*[A-Z0-9_]+\s*:|\s*\}\))",
                      re.S)


def fmt(rows):
    return "[" + ",".join(
        "[%s]" % ",".join(("%.3f" % v).rstrip("0").rstrip(".") or "0" for v in r)
        for r in rows) + "]"


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    write = "--write" in sys.argv
    ml = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    decomp = next((a for a in sys.argv[2:] if not a.startswith("--")), None)
    if decomp is None:
        print("needs the decomp checkout as the second argument, for the "
              "action-state table", file=sys.stderr)
        return 2
    # ONE SUBPROCESS PER CHARACTER. Each character reads its own DAT and
    # writes its own ecb.js, so there is nothing to coordinate. Rather than
    # restructure the generation loop -- which is the part that must not
    # change -- this re-invokes the script once per character with --only and
    # collects the results. gen_hurtbox.py went 102s -> 38s on the same trick.
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    if only is None and not os.environ.get("MELEELIGHT_SERIAL") and len(CHARS) > 1:
        base = [sys.executable, os.path.abspath(__file__), datdir, decomp]
        if write:
            base.append("--write")
        procs = [(c, subprocess.Popen(base + ["--only", c],
                                      stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE))
                 for c in CHARS]
        bad = 0
        for c, pr in procs:
            out, err = pr.communicate()
            sys.stdout.write(out.decode(errors="replace"))
            if err:
                sys.stderr.write(err.decode(errors="replace"))
            if pr.returncode != 0:
                bad += 1
        return 1 if bad else 0

    state_maps = build_state_map(decomp, datdir)

    total = skipped = 0
    for char, (dat, root, ajn, nr) in CHARS.items():
        if only is not None and char != only:
            continue
        ecbjs, attrjs = JS[char]
        ecbjs = os.path.join(ml, ecbjs)
        if not os.path.exists(ecbjs):
            print(f"!! {char}: no {ecbjs}")
            continue
        bones, x124 = ecb_source(datdir, dat, root)
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        # The ECB is built from the SAME joint world positions the
        # hitboxes use (mpcoll.c:373), so it carries the same root
        # model scale. See skeleton.pose.
        mscale = model_scale(datdir, dat, root)
        frames = parse_frames(os.path.join(ml, attrjs))
        src = open(ecbjs, encoding="utf-8").read()
        smap = state_maps[char]
        # How many rows each state's table already has. Used as the duration
        # for states setFrames does not list, which is most of them: 80 of the
        # 135 mapped states have a setFrames entry.
        existing_rows = {}
        for em in re.finditer(r"\b([A-Z][A-Z0-9_]{2,})\s*:\s*\[(\[[^A-Za-z]*?\])\]",
                              src, re.S):
            existing_rows[em.group(1)] = len(re.findall(r"\[[^\[\]]+\]", em.group(2)))

        done = []
        for state, sub in sorted(smap.items()):
            if sub not in anims:
                skipped += 1
                continue
            # The state's DURATION, which is meleelight's own and not the
            # animation's length. setFrames is authoritative where it has an
            # entry; otherwise the table already in ecb.js says how many frames
            # meleelight runs this state for, and matching it is what keeps
            # `ecb[state][frame - 1]` in bounds.
            # The state's DURATION. setFrames is that, and is now checked
            # against the disc for every state it lists, so it wins where it
            # has an entry; the existing table's length covers the rest.
            #
            # A table SHORTER than the old one is fine and often right: the
            # runtime reads ecb[state][frame - 1] with frame clamped to the
            # table length, so the table only has to cover the duration. Where
            # setFrames and an old table disagreed it was usually the table
            # carrying a spare row.
            n_rows = frames.get(state) or existing_rows.get(state) or 0
            if not n_rows:
                skipped += 1
                continue
            # A state reaches ecb.js in one of three forms, and each needs
            # different treatment.
            m = table_re(state).search(src)
            alias = None
            if m is None:
                # (2) An ALIAS to another state's table, at the foot of the
                # file: `ecb[X].SHIELDBREAKFALL = ecb[X].SHIELDBREAKFLY;`. An
                # alias is right only when both states play the SAME animation.
                # Four do not -- Marth's ESCAPEF borrows ESCAPEB, and Puff's
                # DAMAGEFLYN, DAMAGEN2 and SHIELDBREAKFALL borrow DAMAGEFLYHI,
                # DAMAGEHI1 and SHIELDBREAKFLY -- so those carry the wrong
                # shape entirely. Aliases that agree are left alone: they are
                # correct, and shorter.
                alias = re.search(
                    r"\n[ \t]*ecb\[[^\]]+\]\." + state + r"\s*=\s*"
                    r"ecb\[[^\]]+\]\.(\w+)\s*;", src)
                if alias is not None:
                    if smap.get(alias.group(1)) == sub:
                        skipped += 1
                        continue
                # (3) alias is None: absent from this character's ecb.js
                # altogether, which is not harmless. physics.js:1254 indexes
                # ecb[char][state][frame - 1] with no existence check, so a
                # reachable state with no table is a CRASH, not a degradation
                # -- and Puff's FALLAERIAL is reachable, being a shared move
                # every character can enter. Generate one.
                #
                # Nothing is invented: a state only gets this far if Melee's
                # own table names an animation this character actually has.
            off, size = anims[sub]
            n_anim = int(aj.frame_count(off, size) or 1)
            rows = []
            for f in range(n_rows):
                fr = (f % n_anim) if sub in LOOPING else min(f, n_anim - 1)
                e = build_ecb(pose(joints, aj, off, size, fr,
                                  root_scale=mscale), bones, x124)
                k = ECB_SCALE[char]
                rows.append((e["bottom"] / k, e["right"] / k,
                             e["side_y"] / k, e["top"] / k))
            for f, r in enumerate(rows):
                bottom, half, side, top = r
                bad = (not all(map(math.isfinite, r))
                       or bottom > top or half <= 0.0
                       or abs(top) > 100.0 or half > 50.0
                       or not (bottom - 0.01 <= side <= top + 0.01))
                if bad:
                    print(f"!! {char} {state} frame {f}: implausible ECB {r} "
                          f"-- refusing to write", file=sys.stderr)
                    return 1
            if m is not None:
                src = src[:m.start()] + m.group(1) + fmt(rows) + src[m.end():]
            else:
                # Drop the wrong alias, if there was one, and add a real entry.
                # It goes right after the opening `setEcbData(..., {` so it
                # cannot land inside another state's array.
                if alias is not None:
                    src = src[:alias.start()] + src[alias.end():]
                open_m = re.search(r"setEcbData\s*\([^,]+,\s*\{", src)
                if open_m is None:
                    print(f"!! {char}: no setEcbData call to add {state} to "
                          f"-- refusing to write", file=sys.stderr)
                    return 1
                at = open_m.end()
                src = (src[:at] + "\n    " + state + ":" + fmt(rows) + ","
                       + src[at:])
            done.append((state, len(rows)))
            total += 1

        if write:
            open(ecbjs, "w", encoding="utf-8", newline="").write(src)
        print(f"  {char:7} {len(done):3} tables "
              f"({'written' if write else 'dry run'}): "
              + ", ".join(f"{s}[{n}]" for s, n in done[:6])
              + (" ..." if len(done) > 6 else ""))

    # Only the parent prints a grand total; a --only worker handles one
    # character and its "151 of 364" would read as a whole-run figure.
    if only is None:
        print(f"\n{total} ECB tables "
              f"{'regenerated' if write else 'would be regenerated'}"
              f"; {skipped} state(s) left untouched (no confident mapping)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
