"""Write Melee's animation-driven translation into meleelight, from the disc.

See tools/root_motion.py for the mechanism. The short version: an animation can
carry a TransN slide, ftAnim_8006E054 (ftanim.c:174) zeroes the joint so the
MODEL draws in place, and the FIGHTER is moved instead.

TWO THINGS ARE NEEDED, not one, and conflating them is how this looked like a
90-state job when it is not:

  * the per-subaction flag x594_b0 decides whether the joint is zeroed. ~40-59
    subactions per character carry it.
  * the state's PHYS CALLBACK decides whether the fighter moves. Most flagged
    states never read x6A4_transNOffset at all -- Dash and AttackS4 are flagged
    and their Phys is ft_80084F3C, plain friction -- so the flag alone changes
    nothing but the drawing.

Only where BOTH hold does the fighter move, and there are two distinct forms:

  VEL  gr_vel = x6A4_transNOffset.z * facing_dir            (ft_084E.c:83, 113)
       a per-frame DELTA, applied as ground velocity.
         ftCo_AttackDash_Phys, ftCo_CatchDash_Phys  -> ft_80085030
         ftCo_Escape_Phys                           -> ft_80085004

  PIN  cur_pos.x = x68C_transNPos.z * facing_dir + ledge.x   (ftCo_CliffClimb.c:109)
       cur_pos.y = x68C_transNPos.y + ledge.y
       an ABSOLUTE position each frame, measured from the ledge corner rather
       than integrated. Melee hands control back to normal physics once
       transNPos.z and .y are both >= 0, i.e. once the animation has carried
       the fighter onto the stage.
         ftCo_CliffClimb_Phys, and ftCo_CliffEscape_Phys / ftCo_CliffAttack_Phys
         which both delegate to it.

meleelight already had six hand-recorded VEL tables -- ESCAPEF/B, TECHF/B,
DOWNSTANDF/B -- measured off a screen. root_motion.py --check shows they
reproduce the disc totals to two decimals, which is what says this extraction
is right; the per-frame values carry 0.1-0.5 of hand noise that this removes.

    python tools/gen_root_motion.py tools/dat <decomp>            # report
    python tools/gen_root_motion.py tools/dat <decomp> --write
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose_cached as pose
from ecb import CHARS, joint_root, model_scale
from state_map import build as build_state_map
from root_motion import anim_flags, ROOT_MOTION_FLAG, trans_deltas

OUT = {"Fox": ("src/characters/fox/rootMotion.js", "FOX_ID"),
       "Falco": ("src/characters/falco/rootMotion.js", "FALCO_ID"),
       "Falcon": ("src/characters/falcon/rootMotion.js", "FALCON_ID"),
       "Marth": ("src/characters/marth/rootMotion.js", "MARTH_ID"),
       "Puff": ("src/characters/puff/rootMotion.js", "PUFF_ID")}

# States whose Phys callback reads x6A4_transNOffset as a per-frame velocity.
VEL_STATES = ["ATTACKDASH", "CATCHDASH", "ESCAPEF", "ESCAPEB", "ESCAPEN",
              # Tech rolls. ftCo_PassiveStand_Phys (ftCo_PassiveStand.c:58) is
              # ft_80084FA8 -> ft_80085030, so these read transNOffset. NOT to
              # be confused with ftCo_Passive_Phys, the neutral tech, which is
              # plain ft_80084F3C and does not.
              "TECHF", "TECHB",
              # Getup rolls from a knockdown, same reader.
              "DOWNSTANDF", "DOWNSTANDB",
              # ftCa_SpecialN_Phys (ftcaptainspecialn.c:174) -> ft_80084FA8.
              # The windup slides -7.37 then +7.37 back before the punch.
              "NEUTRALSPECIALGROUND"]

# States whose Phys reads BOTH axes -- ft_80085134 (ft_084E.c:119):
#
#     self_vel.x = x6A4_transNOffset.z * facing_dir;
#     self_vel.y = x6A4_transNOffset.y;
#
# and therefore replaces gravity outright for as long as the state lasts.
VELXY_STATES = [
    # ftCa_SpecialLwEndAir_Phys (ftcaptainspeciallw.c:256), the air recovery
    # off Falcon Kick. dz +30.95, dy +0.06.
    "DOWNSPECIALGROUNDENDAIR",
    # ftCa_SpecialHiThrow0/1_Phys (ftcaptainspecialhi.c:270). dz -19.39 with
    # dy +29.67 -- the throw carries Falcon UP, and that is the axis
    # meleelight was missing.
    "UPSPECIALTHROW",
]

# States whose Phys is ftCo_CliffClimb_Phys, directly or by delegation.
PIN_STATES = ["CLIFFCLIMBQUICK", "CLIFFCLIMBSLOW",
              "CLIFFESCAPEQUICK", "CLIFFESCAPESLOW",
              "CLIFFATTACKQUICK", "CLIFFATTACKSLOW",
              "CLIFFGETUPQUICK", "CLIFFGETUPSLOW"]


def fmt(v):
    s = "%.4f" % v
    if s in ("-0.0000", "0.0000"):
        return "0"
    return s.rstrip("0").rstrip(".")


def trans_abs(joints, aj, off, size, mscale, n):
    """x68C_transNPos per frame as (z, y) -- the ABSOLUTE animated TransN.

    Model scale is already applied by pose(root_scale=...), matching
    ftanim.c:178 which multiplies by ftCommon_GetModelScale before use.
    """
    out = []
    for f in range(n):
        w = pose(joints, aj, off, size, f, root_scale=mscale)
        out.append((w[1][2][3], w[1][1][3]))
    return out


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    decomp = next((a for a in sys.argv[2:] if not a.startswith("--")), None)
    write = "--write" in sys.argv
    if decomp is None:
        print("needs the decomp checkout as the second argument", file=sys.stderr)
        return 2
    smap = build_state_map(decomp, datdir)

    for char, (path, cid) in OUT.items():
        dat, root, ajn, nr = CHARS[char]
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        ms = model_scale(datdir, dat, root)
        flags = anim_flags(datdir, dat, root)

        vel, velxy, pin, notes = {}, {}, {}, []
        for st in VEL_STATES:
            sub = smap[char].get(st)
            if sub is None or sub not in anims:
                notes.append("%s: no subaction" % st)
                continue
            if not (flags.get(sub, 0) & ROOT_MOTION_FLAG):
                # The flag is what zeroes the joint; without it the model keeps
                # the slide and the fighter must NOT also be moved.
                notes.append("%s (%s): no x594_b0, fighter does not move" % (st, sub))
                continue
            off, size = anims[sub]
            n = int(aj.frame_count(off, size) or 1)
            vel[st] = trans_deltas(joints, aj, off, size, ms, n)

        for st in VELXY_STATES:
            sub = smap[char].get(st)
            if sub is None or sub not in anims:
                notes.append("%s: no subaction" % st)
                continue
            if not (flags.get(sub, 0) & ROOT_MOTION_FLAG):
                notes.append("%s (%s): no x594_b0" % (st, sub))
                continue
            off, size = anims[sub]
            n = int(aj.frame_count(off, size) or 1)
            dz = trans_deltas(joints, aj, off, size, ms, n)
            prev = None
            dy = []
            for f in range(n):
                y = pose(joints, aj, off, size, f, root_scale=ms)[1][1][3]
                dy.append(0.0 if prev is None else y - prev)
                prev = y
            velxy[st] = list(zip(dz, dy))

        for st in PIN_STATES:
            sub = smap[char].get(st)
            if sub is None or sub not in anims:
                notes.append("%s: no subaction" % st)
                continue
            off, size = anims[sub]
            n = int(aj.frame_count(off, size) or 1)
            pin[st] = trans_abs(joints, aj, off, size, ms, n)

        print("\n%-7s VEL %d states, PIN %d states" % (char, len(vel), len(pin)))
        for st in sorted(vel):
            print("    VEL %-18s %3d frames, total %+7.2f"
                  % (st, len(vel[st]), sum(vel[st])))
        for st in sorted(velxy):
            print("    VELXY %-16s %3d frames, dz %+7.2f  dy %+7.2f"
                  % (st, len(velxy[st]), sum(a for a, _b in velxy[st]),
                     sum(b for _a, b in velxy[st])))
        for st in sorted(pin):
            z = [p[0] for p in pin[st]]
            y = [p[1] for p in pin[st]]
            print("    PIN %-18s %3d frames, z %+6.2f..%+6.2f  y %+6.2f..%+6.2f"
                  % (st, len(pin[st]), min(z), max(z), min(y), max(y)))
        for nt in notes:
            print("    --  %s" % nt)

        if not write:
            continue

        lines = ['import {CHARIDS} from "../../main/characters";',
                 'import {setRootMotion} from "../../physics/rootMotion";',
                 "/* eslint-disable */",
                 "",
                 "// GENERATED by tools/gen_root_motion.py from the disc.",
                 "//",
                 "// vel: x6A4_transNOffset.z per frame -- ground velocity, applied as",
                 "//      gr_vel = vel[frame] * facing_dir  (ft_084E.c:83, 113).",
                 "// velxy: [dz, dy] per frame -- BOTH axes of self_vel,",
                 "//        replacing gravity for the state (ft_084E.c:119).",
                 "// pin: x68C_transNPos as [z, y] per frame -- an ABSOLUTE position from",
                 "//      the grabbed ledge's corner (ftCo_CliffClimb.c:109).",
                 "",
                 "setRootMotion(CHARIDS.%s, {" % cid,
                 "  vel: {"]
        for st in sorted(vel):
            lines.append("    %s: [%s],"
                         % (st, ",".join(fmt(v) for v in vel[st])))
        lines.append("  },")
        lines.append("  velxy: {")
        for st in sorted(velxy):
            lines.append("    %s: [%s]," % (st, ",".join(
                "[%s,%s]" % (fmt(a), fmt(b)) for a, b in velxy[st])))
        lines.append("  },")
        lines.append("  pin: {")
        for st in sorted(pin):
            lines.append("    %s: [%s],"
                         % (st, ",".join("[%s,%s]" % (fmt(z), fmt(y))
                                         for z, y in pin[st])))
        lines.append("  },")
        lines.append("});")
        io.open(path, "w", encoding="utf8", newline="").write("\n".join(lines) + "\n")
        print("    wrote %s" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
