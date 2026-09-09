"""Check meleelight's setFrames tables against the animations' real lengths.

Each subaction points at a figatree in PlXxAJ.dat whose header carries the
animation's frame_count (see figatree.py). meleelight's setFrames records the
same quantity, hand-timed, and consumes it as

    if (player[p].timer > framesData[char][STATE]) { ...leave the state... }

with a 1-based timer, so an N-frame animation should store exactly N.

ONLY NON-LOOPING STATES ARE CHECKED. WAIT, SQUATWAIT, CLIFFWAIT, DOWNWAIT and
friends hold a fighter for as long as the game wants, so meleelight's number
there is a design choice about how long to idle, not a fact about the
animation -- Fox's WAIT is 464 against a 120-frame Wait1 that Melee simply
cycles. Comparing those would manufacture 40 "errors" that are not errors.

Usage:
    python tools/validate_frames.py tools/dat
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import AJ, subaction_anims

CHARS = [
    ("Fox",    "PlFx.dat", "ftDataFox",     "PlFxAJ.dat", "src/characters/fox/attributes.js"),
    ("Falco",  "PlFc.dat", "ftDataFalco",   "PlFcAJ.dat", "src/characters/falco/attributes.js"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "PlCaAJ.dat", "src/characters/falcon/attributes.js"),
    ("Marth",  "PlMs.dat", "ftDataMars",    "PlMsAJ.dat", "src/characters/marth/marthAttributes.js"),
    ("Puff",   "PlPr.dat", "ftDataPurin",   "PlPrAJ.dat", "src/characters/puff/puffAttributes.js"),
]

# meleelight action state -> Melee subaction. Non-looping states only.
SUBACTION = {
    # RUN is a LOOPING animation -- the state lasts as long as the player
    # holds it, so its length is not the animation's.
    "DASH": "Dash", "RUNBRAKE": "RunBrake", "RUNTURN": "TurnRun",
    "JUMPF": "JumpF", "JUMPB": "JumpB",
    "JUMPAERIALF": "JumpAerialF", "JUMPAERIALB": "JumpAerialB",
    "FALL": "Fall", "FALLAERIAL": "FallAerial", "FALLSPECIAL": "FallSpecial",
    "SQUAT": "Squat", "SQUATRV": "SquatRv",
    "PASS": "Pass",
    "GUARDON": "GuardOn", "GUARDOFF": "GuardOff",
    "CLIFFCATCH": "CliffCatch",
    "DAMAGEFLYN": "DamageFlyN", "DAMAGEFALL": "DamageFall",
    "DAMAGEN2": "DamageN2",
    # NOT LANDINGATTACKAIR*. Those animations are all 30 frames, but
    # meleelight's numbers there are LANDING LAG, which Melee stores as real
    # attributes (ftCo_DatAttrs landingair*_lag, +0xE8..+0xF8) and which
    # meleelight already has exactly right. validate_attrs.py checks them.
    "ESCAPEB": "EscapeB", "ESCAPEF": "EscapeF", "ESCAPEN": "EscapeN",
    "DOWNBOUND": "DownBoundU",
    "DOWNSTANDN": "DownStandU", "DOWNSTANDB": "DownBackU",
    "DOWNSTANDF": "DownFowardU",
    "TECHN": "Passive", "TECHF": "PassiveStandF", "TECHB": "PassiveStandB",
    "WALLTECH": "PassiveWall", "WALLJUMP": "PassiveWallJump",
    # NOT "FuraFuraFall" -- no such subaction exists on any character. Melee's
    # own table says DamageFall (ftData_MotionStateList, ftCo_MS_ShieldBreakFall
    # -> ftCo_SM_DamageFall). This was the one entry in this map the decomp
    # contradicted; see tools/motion_states.py, which now checks all of them.
    "SHIELDBREAKFALL": "DamageFall",
    "SHIELDBREAKDOWNBOUND": "DownBoundU",
    "STOPCEIL": "StopCeil",
    # There is no "CaptureDamage" subaction. Melee has TWO states, Hi and Lw
    # (ftCo_MS_CaptureDamageHi/Lw), and which one the victim is in was decided
    # when they were grabbed: ftCo_Damage.c:701 branches on motion_id being
    # 0xE0/0xE1 (CaptureWaitHi, CaptureDamageHi) or 0xE3/0xE4 (the Lw pair).
    #
    # Hi is the ordinary standing grab. Lw is for the special captures --
    # Yoshi's egg, DK's cargo, Kirby's swallow, Bowser's koopa klaw -- and none
    # of the five characters here has one, so Hi is the only reachable variant
    # in this project. They are not interchangeable: the two ECBs differ by a
    # mean of 2.3-3.2 units and up to 6.6.
    "CAPTUREDAMAGE": "CaptureDamageHi",

    # THE FURAFURA / FURASLEEP FAMILY IS CHECKABLE, despite two of them looping.
    #
    # These were skipped as "looping" alongside WAIT and RUN, but they are not
    # the same case. For WAIT the number is a design choice about how long to
    # idle. Here it is the animation's own length, because that is precisely
    # what meleelight uses it for: FURAFURA.js:60 and FURASLEEPLOOP.js:45 both
    # read `timer > framesData[...]` and respond with `timer = 1`, staying in
    # the state and restarting the animation. The state's real duration is
    # phys.stuckTimer, which is the counterpart of Melee's grab_timer --
    # ftCo_DamageSongWait_Anim (ftCo_DamageSong.c:85) only decrements that and
    # never consults ftAnim_IsFramesRemaining.
    #
    # Leaving them out hid a wrong number: Falcon's FURASLEEPLOOP was 20
    # against a 110-frame FuraSleepLoop, and Falco's FURAFURA was 109 against
    # 110.
    "FURASLEEPSTART": "FuraSleepStart",
    "FURASLEEPLOOP": "FuraSleepLoop",
    "FURASLEEPEND": "FuraSleepEnd",
    "FURAFURA": "FuraFura",
}

BLOCK_RE = re.compile(r"setFrames\s*\([^,]+,\s*\{")
ENTRY_RE = re.compile(r'"([A-Z0-9]+)"\s*:\s*(-?\d+)')


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
    return {k: int(v) for k, v in ENTRY_RE.findall(src[i:j])}


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    ml_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    total = ok = 0
    bad, missing = [], {}

    for name, dat, root, ajname, jsrel in CHARS:
        dp = os.path.join(datdir, dat)
        ap = os.path.join(datdir, ajname)
        js = os.path.join(ml_root, jsrel)
        if not (os.path.exists(dp) and os.path.exists(ap) and os.path.exists(js)):
            print(f"!! {name}: missing {dat}, {ajname} or {jsrel}")
            continue
        aj = AJ(ap)
        anims = subaction_anims(dp, root)
        entries = parse_js(js)

        for key, frames in sorted(entries.items()):
            sub = SUBACTION.get(key)
            if sub is None:
                continue                      # looping / unmapped by design
            if sub not in anims:
                missing.setdefault(f"{key} -> {sub}", []).append(name)
                continue
            fc = aj.frame_count(*anims[sub])
            if fc is None:
                missing.setdefault(f"{key} -> {sub} (no figatree)", []).append(name)
                continue
            want = int(fc)
            total += 1
            if frames == want:
                ok += 1
            else:
                bad.append((name, key, sub, frames, want))

    print(f"\n{ok}/{total} animation lengths match the figatree headers")
    for name, key, sub, got, want in bad:
        print(f"  {name:7} {key:22} ({sub:16}) js={got:<5} disc={want}"
              f"   {'+' if got > want else ''}{got - want}")
    if missing:
        print(f"\n  {len(missing)} not resolvable:")
        for k, who in sorted(missing.items()):
            print(f"    {k:40} ({', '.join(who)})")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
