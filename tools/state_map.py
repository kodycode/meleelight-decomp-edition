"""Every meleelight action state -> the subaction it plays.

The generators (ECB, hurtboxes) need this, and the map they were using covered
35 of 139 states -- all movement and defensive, no attacks at all. So Fox's
crouch had regenerated data and his forward smash did not.

Three sources, in order of authority:

  1. Melee's own table. `ftData_MotionStateList` maps every action state to a
     submotion and the submotion indexes the character's subaction table, so
     wherever meleelight's state name matches Melee's, the answer is read
     rather than guessed. See motion_states.py. 51 of 139 match outright.

  2. COMMON below. meleelight names moves in English (FORWARDSMASH, JAB1)
     where Melee names them structurally (AttackS4S, Attack11). This bridges
     the name only -- the animation still comes from Melee's table, so it stays
     correct per character even where characters differ.

  3. SPECIAL below. Special moves are character-specific and are not in the
     common table at all, so these name a subaction directly.

Everything is CHECKED: `verify()` confirms each mapping resolves to a subaction
the character actually has, and reports what is still unmapped. A guess that
does not resolve is reported, not silently dropped -- that failure mode is what
let "SHIELDBREAKFALL -> FuraFuraFall" survive, a subaction on no character.

    python tools/state_map.py <decomp> tools/dat
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import subaction_anims
from ecb import CHARS
from motion_states import resolve

# meleelight's name -> Melee's action-state name. Resolved through Melee's own
# table, so the animation is still per character.
COMMON = {
    # --- attacks
    "JAB1": "Attack11",
    "JAB2": "Attack12",
    "JAB3": "Attack13",                 # rapid-jab characters fall back below
    "DOWNTILT": "AttackLw3",
    "UPTILT": "AttackHi3",
    "FORWARDTILT": "AttackS3S",
    "DOWNSMASH": "AttackLw4",
    "UPSMASH": "AttackHi4",
    "FORWARDSMASH": "AttackS4S",
    "ATTACKAIRU": "AttackAirHi",
    "ATTACKAIRD": "AttackAirLw",
    "LANDINGATTACKAIRN": "LandingAirN",
    "LANDINGATTACKAIRF": "LandingAirF",
    "LANDINGATTACKAIRB": "LandingAirB",
    "LANDINGATTACKAIRU": "LandingAirHi",
    "LANDINGATTACKAIRD": "LandingAirLw",
    "GRAB": "Catch",
    # --- knocked down. meleelight splits by ROLL DIRECTION (neutral, forward,
    # back); Melee splits by which way the fighter is LYING (up, down) and has
    # separate states for the rolls. The "U" (face-up) variants are the ones
    # meleelight's single set corresponds to.
    "DOWNATTACK": "DownAttackU",
    "DOWNBOUND": "DownBoundU",
    "DOWNDAMAGE": "DownDamageU",
    "DOWNWAIT": "DownWaitU",
    "DOWNSTANDN": "DownStandU",
    "DOWNSTANDF": "DownFowardU",        # Melee's own spelling
    "DOWNSTANDB": "DownBackU",
    "SHIELDBREAKSTAND": "ShieldBreakStandU",
    "SHIELDBREAKDOWNBOUND": "ShieldBreakDownU",
    # --- grabbed. Hi/Lw is fixed when the grab happens; Hi is the ordinary
    # standing grab (see validate_frames.py).
    "CAPTUREDAMAGE": "CaptureDamageHi",
    "CAPTUREWAIT": "CaptureWaitHi",
    "CAPTUREPULLED": "CapturePulledHi",
    # --- ledge
    "CLIFFGETUPQUICK": "CliffClimbQuick",
    "CLIFFGETUPSLOW": "CliffClimbSlow",
    "CLIFFJUMPQUICK": "CliffJumpQuick1",
    "CLIFFJUMPSLOW": "CliffJumpSlow1",
    # --- throws
    "THROWFORWARD": "ThrowF",
    "THROWBACK": "ThrowB",
    "THROWUP": "ThrowHi",
    "THROWDOWN": "ThrowLw",
    # --- teching. Melee calls these Passive.
    "TECHN": "Passive",
    "TECHF": "PassiveStandF",
    "TECHB": "PassiveStandB",
    "TECHU": "PassiveCeil",
    "WALLTECH": "PassiveWall",
    "WALLTECHJUMP": "PassiveWallJump",
    "WALLJUMP": "PassiveWallJump",
    # --- movement and misc
    "WALK": "WalkMiddle",
    "RUNTURN": "TurnRun",
    "SMASHTURN": "Turn",
    "TILTTURN": "Turn",
    "APPEAL": "AppealSR",
    "ENTRANCE": "EntryStart",
}

# The victim's state does not depend on who threw them -- Melee has four
# ThrownF/B/Hi/Lw states. meleelight splits them per thrower because it
# positions the victim from the thrower's animation.
for _thrower in ("FOX", "FALCO", "FALCON", "MARTH", "PUFF", "DOC", "SHEIK"):
    COMMON["THROWN" + _thrower + "FORWARD"] = "ThrownF"
    COMMON["THROWN" + _thrower + "BACK"] = "ThrownB"
    COMMON["THROWN" + _thrower + "UP"] = "ThrownHi"
    COMMON["THROWN" + _thrower + "DOWN"] = "ThrownLw"

# Characters with a rapid jab have no Attack13; they have Attack100*.
JAB3_FALLBACK = "Attack100Start"

# States every character has whose SUBACTION exists but which Melee's common
# table does not name -- so they are given directly. FuraSleep is the sleep a
# broken shield leaves you in; WallDamage is being slammed into a wall.
UNIVERSAL = {
    "FURASLEEPSTART": "FuraSleepStart",
    "FURASLEEPLOOP": "FuraSleepLoop",
    "FURASLEEPEND": "FuraSleepEnd",
    "SLEEP": "FuraSleepLoop",
    "WALLDAMAGE": "WallDamage",
}

# Special moves, named as SUBACTIONS because they are not in the common table.
SPECIAL = {
    # Fox and Falco share a move set structurally.
    ("Fox", "NEUTRALSPECIALGROUND"): "SpecialNStart",
    ("Fox", "NEUTRALSPECIALAIR"): "SpecialAirNStart",
    ("Fox", "SIDESPECIALGROUND"): "SpecialS",
    ("Fox", "SIDESPECIALAIR"): "SpecialAirS",
    ("Fox", "UPSPECIALCHARGE"): "SpecialHiHold",
    ("Fox", "UPSPECIALLAUNCH"): "SpecialHi",
    ("Fox", "FIREFOXBOUNCE"): "SpecialHiBound",
    ("Fox", "DOWNSPECIALGROUNDSTART"): "SpecialLwStart",
    ("Fox", "DOWNSPECIALGROUNDLOOP"): "SpecialLwLoop",
    ("Fox", "DOWNSPECIALGROUNDEND"): "SpecialLwEnd",
    ("Fox", "DOWNSPECIALGROUNDREFLECT"): "SpecialLwHit",
    ("Fox", "DOWNSPECIALAIRSTART"): "SpecialAirLwStart",
    ("Fox", "DOWNSPECIALAIRLOOP"): "SpecialAirLwLoop",
    ("Fox", "DOWNSPECIALAIREND"): "SpecialAirLwEnd",
    ("Fox", "DOWNSPECIALAIRREFLECT"): "SpecialAirLwHit",
    ("Fox", "DOWNSPECIALGROUND"): "SpecialLwStart",
    ("Fox", "DOWNSPECIALAIR"): "SpecialAirLwStart",
    # Turning inside the reflector does not change the animation; Melee has no
    # separate subaction for it and the loop keeps playing.
    ("Fox", "DOWNSPECIALGROUNDTURN"): "SpecialLwLoop",
    ("Fox", "DOWNSPECIALAIRTURN"): "SpecialAirLwLoop",

    ("Falcon", "NEUTRALSPECIALGROUND"): "SpecialN",
    ("Falcon", "NEUTRALSPECIALAIR"): "SpecialAirN",
    # SpecialSStart carries the three 4.0 grab-boxes at damage 0 -- the Raptor
    # Boost lunge, and where meleelight's raptorboost offsets paired. SpecialS
    # carries a single 7.5 hitbox at 7 damage, the uppercut that follows a
    # connect. So "Start" is the move and the unsuffixed one is the followup,
    # which is the opposite of what the names suggest.
    ("Falcon", "SIDESPECIALGROUND"): "SpecialSStart",
    ("Falcon", "SIDESPECIALGROUNDHIT"): "SpecialS",
    ("Falcon", "SIDESPECIALAIR"): "SpecialAirSStart",
    ("Falcon", "SIDESPECIALAIRHIT"): "SpecialAirS",
    ("Falcon", "UPSPECIAL"): "SpecialHi",
    ("Falcon", "UPSPECIALCATCH"): "SpecialHiCatch",
    ("Falcon", "UPSPECIALTHROW"): "SpecialHiThrow",
    ("Falcon", "DOWNSPECIALGROUND"): "SpecialLw",
    ("Falcon", "DOWNSPECIALAIR"): "SpecialAirLw",
    ("Falcon", "DOWNSPECIALGROUNDENDGROUND"): "SpecialLwEnd",
    ("Falcon", "DOWNSPECIALGROUNDENDAIR"): "SpecialLwEndAir",
    ("Falcon", "DOWNSPECIALAIRENDGROUND"): "SpecialAirLwEnd",
    ("Falcon", "DOWNSPECIALAIRENDAIR"): "SpecialAirLwEndAir",

    ("Marth", "NEUTRALSPECIALGROUND"): "SpecialNStart",
    ("Marth", "NEUTRALSPECIALAIR"): "SpecialAirNStart",
    ("Marth", "DOWNSPECIALGROUND"): "SpecialLw",
    ("Marth", "DOWNSPECIALAIR"): "SpecialAirLw",
    ("Marth", "DOWNSPECIALGROUND2"): "SpecialLwHit",
    ("Marth", "DOWNSPECIALAIR2"): "SpecialAirLwHit",
    ("Marth", "UPSPECIAL"): "SpecialHi",
    # Dancing Blade. meleelight has no "2DOWN" because Melee's second hit only
    # branches high and low.
    ("Marth", "SIDESPECIALGROUND"): "SpecialS1",
    ("Marth", "SIDESPECIALAIR"): "SpecialAirS1",
    ("Marth", "SIDESPECIALGROUND2UP"): "SpecialS2Hi",
    ("Marth", "SIDESPECIALGROUND2FORWARD"): "SpecialS2Lw",
    ("Marth", "SIDESPECIALGROUND3UP"): "SpecialS3Hi",
    ("Marth", "SIDESPECIALGROUND3FORWARD"): "SpecialS3S",
    ("Marth", "SIDESPECIALGROUND3DOWN"): "SpecialS3Lw",
    ("Marth", "SIDESPECIALGROUND4UP"): "SpecialS4Hi",
    ("Marth", "SIDESPECIALGROUND4FORWARD"): "SpecialS4S",
    ("Marth", "SIDESPECIALGROUND4DOWN"): "SpecialS4Lw",
    ("Marth", "SIDESPECIALAIR2UP"): "SpecialAirS2Hi",
    ("Marth", "SIDESPECIALAIR2FORWARD"): "SpecialAirS2Lw",
    ("Marth", "SIDESPECIALAIR3UP"): "SpecialAirS3Hi",
    ("Marth", "SIDESPECIALAIR3FORWARD"): "SpecialAirS3S",
    ("Marth", "SIDESPECIALAIR3DOWN"): "SpecialAirS3Lw",
    ("Marth", "SIDESPECIALAIR4UP"): "SpecialAirS4Hi",
    ("Marth", "SIDESPECIALAIR4FORWARD"): "SpecialAirS4S",
    ("Marth", "SIDESPECIALAIR4DOWN"): "SpecialAirS4Lw",

    # Puff's specials come in L/R pairs -- the animation mirrors rather than the
    # fighter turning -- and L is taken as the representative.
    ("Puff", "NEUTRALSPECIALGROUND"): "SpecialN",
    ("Puff", "NEUTRALSPECIALAIR"): "SpecialAirNStartL",
    ("Puff", "SIDESPECIALGROUND"): "SpecialS",
    ("Puff", "SIDESPECIALAIR"): "SpecialAirS",
    ("Puff", "UPSPECIAL"): "SpecialHiL",
    ("Puff", "DOWNSPECIALGROUND"): "SpecialLwL",
    ("Puff", "DOWNSPECIALAIR"): "SpecialAirLwL",
    ("Puff", "JUMPAERIAL1"): "JumpAerialF1",
    ("Puff", "JUMPAERIAL2"): "JumpAerialF2",
    ("Puff", "JUMPAERIAL3"): "JumpAerialF3",
    ("Puff", "JUMPAERIAL4"): "JumpAerialF4",
    ("Puff", "JUMPAERIAL5"): "JumpAerialF5",
}
# Falco's move set matches Fox's; copy rather than restate.
for (_c, _s), _v in list(SPECIAL.items()):
    if _c == "Fox":
        SPECIAL[("Falco", _s)] = _v


def build(decomp, datdir):
    """{character: {meleelight state: subaction}} for every state we can map."""
    out = {}
    for char, (dat, root, ajn, nr) in CHARS.items():
        anims = subaction_anims(os.path.join(datdir, dat), root)
        melee = resolve(decomp, datdir, dat, root)
        by_upper = {}
        for k, v in melee.items():
            by_upper.setdefault(k.replace("ftCo_MS_", "").upper(), v)
        m = {}

        def take(state, ms_name):
            anim = by_upper.get(ms_name.upper())
            if anim and anim in anims:
                m[state] = anim
                return True
            return False

        # 1. Melee's table, by name.
        for upper, anim in by_upper.items():
            if anim in anims:
                m[upper] = anim
        # 2. The English-name bridge.
        for state, ms_name in COMMON.items():
            if state in m:
                continue
            if not take(state, ms_name) and state == "JAB3":
                take(state, JAB3_FALLBACK)
        # 3. States whose subaction exists but which the common table does
        #    not name.
        for state, sub in UNIVERSAL.items():
            if state not in m and sub in anims:
                m[state] = sub
        # 4. Character-specific specials, named directly.
        for (c, state), sub in SPECIAL.items():
            if c == char and sub in anims:
                m[state] = sub
        out[char] = m
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    decomp, datdir = sys.argv[1], sys.argv[2]
    import re
    from gen_ecb import JS

    built = build(decomp, datdir)
    bad = 0
    for char, (ecbjs, _a) in JS.items():
        src = open(ecbjs, encoding="utf-8").read()
        states = sorted(set(re.findall(r"\b([A-Z][A-Z0-9_]{2,})\s*:\s*\[\[", src)))
        m = built[char]
        have = [s for s in states if s in m]
        miss = [s for s in states if s not in m]
        print(f"  {char:7} {len(have):3}/{len(states)} states mapped, "
              f"{len(miss)} unmapped")
        if miss:
            print("        " + ", ".join(miss))
        bad += len(miss)
    # Mappings that name something the character does not have.
    for char, (dat, root, ajn, nr) in CHARS.items():
        anims = subaction_anims(os.path.join(datdir, dat), root)
        for (c, state), sub in SPECIAL.items():
            if c == char and sub not in anims:
                print(f"  !! {char} {state} -> {sub}: no such subaction")
                bad += 1
    print(f"\n{bad} states still unmapped or misnamed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
