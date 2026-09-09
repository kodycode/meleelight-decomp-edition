"""Check the hand-written state -> subaction map against Melee's own table.

tools/validate_frames.py carries a map from meleelight's action-state names to
subaction names. Most of it cannot be derived mechanically, because meleelight
names moves in English (JAB1, FORWARDSMASH, DOWNTILT) where Melee names them
structurally (Attack11, AttackS4, AttackLw3). But wherever the two names DO
correspond, the decompilation has the authoritative answer in
ftData_MotionStateList, and a guess that disagrees with it is simply wrong.

That is not hypothetical. "SHIELDBREAKFALL" was mapped to "FuraFuraFall", which
is not a subaction on any character -- so the state was silently skipped for all
five, and nobody noticed because skipping is a normal outcome for states with no
confident mapping. Melee's table says DamageFall.

This tool makes that class of error loud:

    python tools/check_states.py <decomp-root> tools/dat

It reports, per character:
  * DISAGREES  -- the map and Melee's table name different subactions. A bug.
  * confirmed  -- the map agrees with Melee's table.
  * unchecked  -- meleelight's name has no counterpart in the decomp enum, so
                  the map is the only source and cannot be verified here.
  * SPLIT      -- Melee has several states where meleelight has one
                  (CAPTUREDAMAGE is CaptureDamageHi and CaptureDamageLw, WALK is
                  WalkSlow/Middle/Fast). Not an error, but not 1:1 either, and
                  worth naming rather than hiding.

Exit status is non-zero if anything DISAGREES.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS
from motion_states import resolve
from validate_frames import SUBACTION


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    decomp, datdir = sys.argv[1], sys.argv[2]

    bad = 0
    for char, (dat, root, _ajn, _nr) in CHARS.items():
        r = resolve(decomp, datdir, dat, root)
        by_upper = {}
        for k, v in r.items():
            by_upper.setdefault(k.replace("ftCo_MS_", "").upper(), []).append(v)

        ok = unchecked = 0
        splits, wrong = [], []
        for state, sub in sorted(SUBACTION.items()):
            hits = by_upper.get(state)
            if hits is None:
                # Melee may have several states whose names all begin with
                # meleelight's single name.
                pre = sorted(u for u in by_upper if u.startswith(state))
                if len(pre) > 1:
                    splits.append((state, [by_upper[u][0] for u in pre]))
                else:
                    unchecked += 1
                continue
            if sub in hits:
                ok += 1
            else:
                wrong.append((state, sub, hits))
        print(f"  {char:7} {ok:3} confirmed, {len(splits):2} split, "
              f"{unchecked:3} unchecked, {len(wrong)} DISAGREE")
        for state, sub, hits in wrong:
            print(f"     !! {state:24} map says {sub}, Melee says {hits}")
            bad += 1
        for state, hits in splits:
            print(f"        {state:24} Melee has {len(hits)}: {', '.join(hits)}")

    print(f"\n{bad} disagreement(s) with Melee's own state table")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
