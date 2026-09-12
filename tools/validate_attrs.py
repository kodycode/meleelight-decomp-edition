"""Check every per-character attribute in meleelight against the disc.

`validate_constants.py` covers ftCommonData -- the values shared by all
fighters. The PER-CHARACTER attributes had no standing check at all: they were
corrected once by hand and nothing re-verified them, so a regression there was
invisible.

Resolution is structural, not a search:
    archive root "ftDataXxx"  -> struct ftData        (ft/types.h:612)
    ftData + 0x00             -> struct ftCo_DatAttrs
Field offsets come from the decomp's own `/* +05C fp+16C */ gravity`
annotations, so the layout is the matching build's, not a guess.

ALIASES IS DELIBERATELY INCOMPLETE. meleelight's attribute names are its own,
and several have no decomp counterpart -- `walkAcc` in particular is NOT
`walk_accel_mul`; it is a coefficient in meleelight's own ad-hoc walk formula,
and mapping the two was a real mistake that had to be reverted. Anything not
listed here is reported as UNMAPPED rather than quietly passing, because a
validator that silently skips what it does not understand is worse than one
that admits it.

Usage:
    python tools/validate_attrs.py tools/dat <path-to-melee-decomp>
"""
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive

CO_ATTRS = 0x00  # ftData +0x00
EXT_ATTR = 0x04  # ftData +0x04, the character-specific attribute block

# meleelight key -> (offset into ext_attr, kind, decomp field name).
#
# Unlike ftCo_DatAttrs these structs are per-character, so the offsets are
# transcribed from each character's own types.h rather than parsed. Fox and
# Falco share ftFox_DatAttrs (ft/kinds/ftFox/types.h:107-132).
EXT_ATTRS = {
    "Fox": {
        "firefoxFallAccel":           (0x60, "f32", "x60_FOX_FIREFOX_FALL_ACCEL"),
        "firefoxStickRangeMin":       (0x64, "f32", "x64_FOX_FIREFOX_DIRECTION_STICK_RANGE_MIN"),
        "firefoxSpeed":               (0x74, "f32", "x74_FOX_FIREFOX_SPEED"),
        "firefoxReverseAccel":        (0x78, "f32", "x78_FOX_FIREFOX_REVERSE_ACCEL"),
        "firefoxFacingStickRangeMin": (0x88, "f32", "x88_FOX_FIREFOX_FACING_STICK_RANGE_MIN"),
    },
}
EXT_ATTRS["Falco"] = EXT_ATTRS["Fox"]
EXT_ATTRS["Falcon"] = {
    # ftCaptain_DatAttrs (ft/kinds/ftCaptain/types.h:34-35), Falcon Dive drift.
    "speciallwGroundTraction": (0x84, "f32", "speciallw_ground_traction"),
    "speciallwAirLandingTraction": (0x88, "f32", "speciallw_air_landing_traction"),
    "diveAirFrictionMul": (0x40, "f32", "specialhi_air_friction_mul"),
    "diveHorzVelMul":     (0x44, "f32", "specialhi_horz_vel"),
}
EXT_ATTRS["Marth"] = {
    # MarsAttributes (ft/kinds/ftMars/types.h:33-34), Shield Breaker.
    "specialNFriction":            (0x0C, "f32", "specialn_friction"),
    "specialNStartFriction":       (0x10, "f32", "specialn_start_friction"),
    # MarsAttributes (ft/kinds/ftMars/types.h:46-52), used by Dolphin Slash.
    "dolphinFacingStickThreshold": (0x30, "f32", "x30"),
    "dolphinAngleStickThreshold":  (0x34, "f32", "x34"),
    "dolphinMaxAngleDeg":          (0x38, "f32", "x38"),
    "dolphinGroundVelXMul":        (0x3C, "f32", "x3C"),
    "dolphinAirVelMul":            (0x40, "f32", "x40"),
}
EXT_ATTRS["Puff"] = {
    # ftPurinAttributes (ft/kinds/ftPurin/types.h:97-103), used by Rollout.
    "rolloutTurnStickThreshold": (0x68, "f32", "x68"),
    "rolloutStickFloor":   (0xDC, "f32", "xDC"),
    "rolloutStickCeiling": (0xE0, "f32", "xE0"),
    "rolloutMaxAngleDeg":  (0xE4, "f32", "xE4"),
    "rolloutSpeed":        (0xF0, "f32", "xF0"),
    "rolloutDecay":        (0xF4, "f32", "xF4"),
}

CHARS = [
    ("Fox",    "PlFx.dat", "ftDataFox",     "src/characters/fox/attributes.js",     "FOX_ID"),
    ("Falco",  "PlFc.dat", "ftDataFalco",   "src/characters/falco/attributes.js",   "FALCO_ID"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "src/characters/falcon/attributes.js",  "FALCON_ID"),
    ("Marth",  "PlMs.dat", "ftDataMars",    "src/characters/marth/marthAttributes.js", "MARTH_ID"),
    ("Puff",   "PlPr.dat", "ftDataPurin",   "src/characters/puff/puffAttributes.js",   "PUFF_ID"),
]

# meleelight attribute name -> ftCo_DatAttrs field name.
ALIASES = {
    "walkAccelMul":         "walk_accel_mul",
    "walkAccelBase":        "walk_accel_base",
    "maxWalk":              "walk_max_vel",
    "walkMaxV":             "walk_max_vel",
    "traction":             "ground_friction",
    # The frame count ftCo_Turn_Enter_Basic seeds frames_to_turn with
    # (ftCo_Turn.c:64). meleelight hardcoded 6 for every character; it is 6 for
    # Marth and Falcon but 4 for Fox, Falco and Puff.
    "standingTurnFrames":   "standing_turn_frames",
    # NB: dash_initial_velocity is meleelight's dTInitV, NOT dInitV. Mapping
    # dInitV here produced five confident-looking mismatches on values that
    # were already correct -- the alias was wrong, not the data.
    "dTInitV":              "dash_initial_velocity",
    "dAccA":                "dash_accel_mul",
    "dAccB":                "dash_accel_base",
    "dMaxV":                "dash_max_velocity",
    "groundMaxHorizontalV": "ground_max_horizontal_velocity",
    "maxJumps":             "max_jumps",
    "jumpSquat":            "jump_startup_time",
    "jumpHinitV":           "jump_h_initial_velocity",
    "fHopInitV":            "jump_v_initial_velocity",
    "groundToAir":          "ground_to_air_jump_momentum_multiplier",
    "jumpHmaxV":            "jump_h_max_velocity",
    "sHopInitV":            "hop_v_initial_velocity",
    "djMultiplier":         "air_jump_v_multiplier",
    "djMomentum":           "air_jump_h_multiplier",
    "gravity":              "gravity",
    "terminalV":            "terminal_velocity",
    "airMobA":              "air_drift_stick_mul",
    "airMobB":              "aerial_drift_base",
    "aerialHmaxV":          "air_drift_max",
    "airFriction":          "aerial_friction",
    "fastFallV":            "fast_fall_velocity",
    "airMaxHorizontalV":    "air_max_horizontal_velocity",
    "weight":               "weight",
    "modelScale":           "model_scaling",
    "shieldScale":          "initial_shield_size",
    "shieldBreakVel":       "shield_break_initial_velocity",
    "wallJumpVelX":         "wall_jump_horizontal_velocity",
    "wallJumpVelY":         "wall_jump_vertical_velocity",
    "specialsGroundSpeedRetention": "specials_ground_speed_retention",
}

# Names that are meleelight's own and have no ftCo_DatAttrs counterpart, so
# "unmapped" is the correct answer rather than missing work.
KNOWN_LOCAL = {
    "walkAcc",          # coefficient in meleelight's own walk formula
    "walkInitV",
    "dashFrameMin", "dashFrameMax",
    "runTurnBreakPoint",   # read from the TurnRun subaction, not the attrs
    "airdodgeIntangible",
    "charScale", "miniScale", "ecbScale",
    "walkAnimSpeed", "runAnimSpeed", "waitAnimSpeed",
    "hurtboxOffset", "shieldOffset",
    # Checked below against ftData+0x44 rather than ftCo_DatAttrs, so they are
    # covered -- just not by the generic loop.
    "ledgeSnapX", "ledgeSnapY", "ledgeSnapHeight",
    "walljump", "multiJump",
    "dInitV",           # legacy: defined in the attribute files, read by
                        # nothing. Superseded by dTInitV when dashEnterImpulse
                        # was ported; kept only so old saves/UI do not break.
}


def parse_layout(decomp):
    """field name -> (offset, kind) from ftCo_DatAttrs' own annotations."""
    p = os.path.join(decomp, "src", "melee", "ft", "types.h")
    src = open(p, encoding="utf-8", errors="replace").read()
    a = src.index("typedef struct ftCo_DatAttrs")
    b = src.index("} ftCo_DatAttrs", a)
    out = {}
    for off, fp, kind, name in re.findall(
            r"/\*\s*\+([0-9A-Fa-f]+)\s+fp\+([0-9A-Fa-f]+)\s*\*/\s*"
            r"(float|f32|int|s32|u32|u8)\s+(\w+)\s*;", src[a:b]):
        out[name] = (int(off, 16), kind)
    return out


ATTR_RE = re.compile(
    r"^[ \t]*([A-Za-z_$][\w$]*)[ \t]*:[ \t]*(-?[\d.]+)[ \t]*,?[ \t]*(?://.*)?$", re.M)

LEDGE_RE = re.compile(r"ledgeSnapBoxOffset[ \t]*:[ \t]*\[([^\]]*)\]")


def parse_js(path):
    """meleelight attribute name -> numeric literal, from the setCharAttributes
    block only. Reading the whole file would also pick up hitbox and offset
    tables, which are not attributes."""
    src = open(path, encoding="utf-8").read()
    m = re.search(r"setCharAttributes\s*\([^,]+,\s*\{", src)
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
    block = src[i:j]
    return {k: float(v) for k, v in ATTR_RE.findall(block)}


# Attributes meleelight stores as an ACTION STATE LENGTH rather than as an
# attribute. The alias map cannot reach these -- they live in the same file's
# frames table, keyed by meleelight state name -- but they are per-character
# disc values like any other and had no standing check.
#
#   ftCo_Landing_IASA (ftCo_Landing.c:122) gates every interrupt on
#       cur_anim_frame < normal_landing_lag
#   and each LandingAir* state's length is the matching landingair*_lag.
FRAMES_FROM_ATTRS = {
    "LANDINGATTACKAIRN":  "landingairn_lag",
    "LANDINGATTACKAIRF":  "landingairf_lag",
    "LANDINGATTACKAIRB":  "landingairb_lag",
    "LANDINGATTACKAIRU":  "landingairhi_lag",
    "LANDINGATTACKAIRD":  "landingairlw_lag",
}

FRAMES_RE = re.compile(r'"?([A-Z][A-Z0-9]*)"?\s*:\s*(\d+)\s*,?')


def parse_frames(path):
    """meleelight state name -> frame count, from the setFrames block."""
    src = open(path, encoding="utf-8").read()
    m = re.search(r"setFrames\s*\([^,]+,\s*\{", src)
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
    return {k: int(v) for k, v in FRAMES_RE.findall(src[i:j])}


# Disc fields nothing checks, and why. Anything NOT listed here and not in
# ALIASES or FRAMES_FROM_ATTRS is reported as an unchecked gap, so the coverage
# number cannot quietly rot as the struct grows.
UNCHECKED_REASON = {
    "normal_landing_lag":   "hardcoded 4 in LANDING.js; it is 4.0 on all five",
    "max_run_brake_frames": "30 on all five; RUNBRAKE ends on its animation first",
    "slow_walk_max":        "walk animation tier, meleelight has no walk blend",
    "mid_walk_point":       "walk animation tier",
    "fast_walk_min":        "walk animation tier",
    "run_animation_scaling": "animation rate only",
    "jab_2_input_window":   "jab combo window, hardcoded in the JAB move files",
    "jab_3_input_window":   "jab combo window, hardcoded in the JAB move files",
    "rapid_jab_window":     "rapid jab, hardcoded",
    "ledge_jump_horizontal_velocity": "CLIFFJUMP uses a setVelocities table",
    "ledge_jump_vertical_velocity":   "CLIFFJUMP uses a setVelocities table",
    "wall_jump_min_approach_speed":   "not gated; meleelight has a walljump bool",
    "passivewall_vel_x":    "wall tech velocity, not ported",
    "passiveceil_vel_x":    "ceiling tech velocity, not ported",
    "item_throw_velocity_multiplier": "items not ported",
    "heavy_throw_velocity_multiplier": "items not ported",
    "damageice_ice_size":   "freezing not ported",
    "x150_damageice_unk":   "freezing not ported",
    "x154_damageice_unk":   "freezing not ported",
    "damageicejump_vel_y":  "freezing not ported",
    "damageicejump_vel_x_mult": "freezing not ported",
    "screw_attack_launch_velocity": "Samus item, no such character here",
    "kirby_b_star_damage":  "Kirby, not present",
    "warp_star_hitbox_scale": "item, not ported",
    "clank_animation_length": "clank not ported",
    "hit_spark_variant":    "cosmetic",
    "name_tag_height":      "cosmetic",
    "trophy_scale":         "cosmetic, not in game",
    "respawn_platform_scale": "cosmetic",
    "camera_zoom_target_bone": "camera, and meleelight has no camera",
    "weight_independent_throws_mask": "throws not weight-adjusted here",
    "unused_0":             "unused on the disc",
    "xDC": "unnamed in the decomp", "x12C": "unnamed in the decomp",
    "x13C": "unnamed in the decomp", "x144": "unnamed in the decomp",
    "x168": "unnamed in the decomp", "x17C": "unnamed in the decomp",
}


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir, decomp = sys.argv[1], sys.argv[2]
    ml_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    layout = parse_layout(decomp)

    total = ok = 0
    mismatches = []
    unmapped = {}

    for name, dat, root, jsrel, _cid in CHARS:
        path = os.path.join(datdir, dat)
        js = os.path.join(ml_root, jsrel)
        if not os.path.exists(path) or not os.path.exists(js):
            print(f"!! {name}: missing {dat} or {jsrel}")
            continue
        a = Archive(path)
        base = a.ptr(a.root(root) + CO_ATTRS)
        if base is None:
            print(f"!! {name}: {root}+0x00 is not a relocation")
            continue
        attrs = parse_js(js)

        for key, val in sorted(attrs.items()):
            field = ALIASES.get(key)
            if field is None:
                # Not in ftCo_DatAttrs, but it may live in this character's
                # ext_attr block instead -- that pass checks it further down.
                if key in EXT_ATTRS.get(name, {}):
                    continue
                if key not in KNOWN_LOCAL:
                    unmapped.setdefault(key, []).append(name)
                continue
            if field not in layout:
                mismatches.append((name, key, field, "field not in decomp layout", ""))
                continue
            off, kind = layout[field]
            raw = a.d_u32(base + off)
            if kind in ("int", "s32", "u32", "u8"):
                disc = raw - 0x100000000 if raw >= 0x80000000 else raw
            else:
                disc = struct.unpack(">f", struct.pack(">I", raw))[0]
            total += 1
            if float(disc) == float(val):
                ok += 1
            else:
                mismatches.append((name, key, field, val, disc))

    # --- ledge snap box (ftData+0x44, NOT ftCo_DatAttrs) --------------------
    # All three raw values are stored verbatim now, and dealWithLedges()
    # reconstructs the box the way mpColl_80044164 / mpColl_800443C4 do -- so
    # this compares the values themselves rather than anything derived, and
    # ledge_snap_x is checked like the others.
    for name, dat, root, jsrel, _cid in CHARS:
        path = os.path.join(datdir, dat)
        js = os.path.join(ml_root, jsrel)
        if not (os.path.exists(path) and os.path.exists(js)):
            continue
        a = Archive(path)
        p44 = a.ptr(a.root(root) + 0x44)
        if p44 is None:
            continue
        off = a.data_off + p44
        disc3 = struct.unpack(">3f", a.raw[off + 16:off + 28])
        src = open(js, encoding="utf-8").read()
        for key, want in zip(("ledgeSnapX", "ledgeSnapY", "ledgeSnapHeight"),
                             disc3):
            m = re.search(r"\b" + key + r"[ \t]*:[ \t]*(-?[\d.]+)", src)
            if not m:
                mismatches.append((name, key, None, "absent", want))
                continue
            total += 1
            if float(m.group(1)) == float(want):
                ok += 1
            else:
                mismatches.append((name, key, None, float(m.group(1)), want))

    # --- character-specific attributes (ftData+0x04, "ext_attr") -----------
    # A DIFFERENT struct per character, so there is no shared layout to parse
    # out of the decomp the way ftCo_DatAttrs is done above. Offsets are named
    # in EXT_ATTRS against the decomp's own field names.
    #
    # This block is why Falco's firefox fall accel was found to be 0.016 while
    # meleelight had Fox's 0.015 in both files: the shared-attribute pass above
    # cannot see these fields at all, so nothing had ever checked them.
    for name, dat, root, jsrel, _cid in CHARS:
        fields = EXT_ATTRS.get(name)
        if not fields:
            continue
        path = os.path.join(datdir, dat)
        js = os.path.join(ml_root, jsrel)
        if not (os.path.exists(path) and os.path.exists(js)):
            continue
        a = Archive(path)
        ext = a.ptr(a.root(root) + EXT_ATTR)
        if ext is None:
            mismatches.append((name, "(ext_attr)", None,
                               "ftData+0x04 is not a relocation", ""))
            continue
        attrs = parse_js(js)
        for key, (off, kind, decomp_name) in sorted(fields.items()):
            if key not in attrs:
                mismatches.append((name, key, decomp_name, "absent", ""))
                continue
            raw = a.d_u32(ext + off)
            if kind == "int":
                disc = raw - 0x100000000 if raw >= 0x80000000 else raw
            else:
                disc = struct.unpack(">f", struct.pack(">I", raw))[0]
            total += 1
            if float(disc) == float(attrs[key]):
                ok += 1
            else:
                mismatches.append((name, key, decomp_name, attrs[key], disc))

    # --- attributes meleelight stores as an action state length -----------
    # The five LandingAir* states ARE the landingair*_lag values. Checked
    # here rather than in the alias pass because they live in the frames
    # table, keyed by meleelight state name, not in setCharAttributes.
    for name, dat, root, jsrel, _cid in CHARS:
        path = os.path.join(datdir, dat)
        js = os.path.join(ml_root, jsrel)
        if not (os.path.exists(path) and os.path.exists(js)):
            continue
        a = Archive(path)
        base = a.ptr(a.root(root) + CO_ATTRS)
        if base is None:
            continue
        frames = parse_frames(js)
        for state, field in sorted(FRAMES_FROM_ATTRS.items()):
            off, _kind = layout[field]
            disc = struct.unpack(">f", struct.pack(">I", a.d_u32(base + off)))[0]
            if state not in frames:
                mismatches.append((name, state, field,
                                   "absent from setFrames", disc))
                continue
            total += 1
            if float(frames[state]) == float(disc):
                ok += 1
            else:
                mismatches.append((name, state, field, frames[state], disc))

    print(f"\n{ok}/{total} character attributes match the disc")
    for name, key, field, got, want in mismatches:
        ext = EXT_ATTRS.get(name, {}).get(key)
        if ext is not None:
            where = f"({field} ext_attr+0x{ext[0]:02X})"
        elif field:
            where = f"({field} +0x{layout.get(field, (0,))[0]:03X})"
        else:
            where = "(ftData+0x44)"
        print(f"  MISMATCH  {name:7} {key:22} {where}"
              f"  js={got!r}  disc={want!r}")
    if unmapped:
        print(f"\n  {len(unmapped)} attribute name(s) not in ALIASES and not "
              f"declared meleelight-local -- NOT CHECKED:")
        for k, who in sorted(unmapped.items()):
            print(f"    {k:24} ({', '.join(who)})")
    # --- coverage: disc fields nothing checks -----------------------------
    checked = set(ALIASES.values()) | set(FRAMES_FROM_ATTRS.values())
    gaps = [n for n in layout
            if n not in checked and n not in UNCHECKED_REASON]
    accounted = [n for n in layout if n in UNCHECKED_REASON]
    print("")
    print("  coverage: %d of %d ftCo_DatAttrs fields checked, %d"
          " deliberately not (reasons in UNCHECKED_REASON)"
          % (len(checked & set(layout)), len(layout), len(accounted)))
    if gaps:
        print("  %d field(s) neither checked nor accounted for:" % len(gaps))
        for n in sorted(gaps, key=lambda n: layout[n][0]):
            print("    +0x%03X  %s" % (layout[n][0], n))

    return 0 if not mismatches else 1


if __name__ == "__main__":
    sys.exit(main())
