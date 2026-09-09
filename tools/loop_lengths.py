"""Report figatree lengths for LOOPING animations, which validate_frames.py skips.

validate_frames.py deliberately ignores looping states, because for most of
them meleelight's number is a design choice about how long to idle rather than
a fact about the animation (Fox's WAIT is 464 against a 120-frame Wait1).

FURASLEEPLOOP is not like that. meleelight uses its frame count purely to LOOP
the animation -- FURASLEEPLOOP.js:45 resets `timer = 1` once it passes the
count and stays in the state, while the state's real duration is
`phys.stuckTimer`. That mirrors Melee, where ftCo_DamageSongWait_Anim
(ftCo_DamageSong.c:85) only decrements grab_timer and never consults
ftAnim_IsFramesRemaining. So the right value here IS the animation's length,
and it can be read off the disc.

Usage:
    python tools/loop_lengths.py tools/dat [SUBACTION ...]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import AJ, subaction_anims

CHARS = [
    ("Fox", "PlFx.dat", "ftDataFox", "PlFxAJ.dat"),
    ("Falco", "PlFc.dat", "ftDataFalco", "PlFcAJ.dat"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "PlCaAJ.dat"),
    ("Marth", "PlMs.dat", "ftDataMars", "PlMsAJ.dat"),
    ("Puff", "PlPr.dat", "ftDataPurin", "PlPrAJ.dat"),
]

DEFAULT_SUBS = ["FuraSleepStart", "FuraSleepLoop", "FuraSleepEnd",
                "FuraFura", "FuraSleep", "Wait1", "Run"]


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    subs = sys.argv[2:] or DEFAULT_SUBS

    for name, dat, root, ajname in CHARS:
        dp = os.path.join(datdir, dat)
        ap = os.path.join(datdir, ajname)
        if not (os.path.exists(dp) and os.path.exists(ap)):
            print("!! %s: missing %s or %s" % (name, dat, ajname))
            continue
        aj = AJ(ap)
        anims = subaction_anims(dp, root)
        print("=== %s ===" % name)
        for sub in subs:
            if sub not in anims:
                print("   %-16s (no such subaction)" % sub)
                continue
            fc = aj.frame_count(*anims[sub])
            print("   %-16s %s" % (sub, "no figatree" if fc is None else int(fc)))
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
