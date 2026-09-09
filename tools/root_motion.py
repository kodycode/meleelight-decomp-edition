"""Extract Melee's ANIMATION-DRIVEN TRANSLATION -- the x594_b0 root motion.

Melee lets an animation move the fighter. Each frame, ftAnim_8006E054
(ftanim.c:174-192) reads the animated TransN joint, scales it by the model
scale, takes the delta against last frame, and then ZEROES the joint:

    fp->x698           = fp->x68C_transNPos;                 // last frame
    HSD_JObjGetTranslation(jobj, &fp->x68C_transNPos);       // this frame
    fp->x68C_transNPos *= ftCommon_GetModelScale(fp);
    lbVector_Diff(&x68C_transNPos, &x698, &x6A4_transNOffset);   // cur - prev
    HSD_JObjSetTranslate(jobj, &zero);                       // model draws in place

so the MODEL renders stationary and the FIGHTER is given the motion as
velocity:

    ftcommon.c:549   self_vel.x = x6A4_transNOffset.z * facing_dir
    ft_084E.c:113    gr_vel     = x6A4_transNOffset.z * arg9
    ft_084E.c:82     ground_accel_1 = x6A4_transNOffset.z * facing_dir - gr_vel
    fighter.c:1321   on state entry, self_vel.x = gr_vel = transNOffset.z * facing_dir

It is gated per SUBACTION, not in code: Fighter_ChangeMotionState does

    fp->x594_s32 = unk_struct_x18->x10_animCurrFlags;        // fighter.c:1254

and x594_b0 is bit 0 of that word. `x24` is the Fighter_WaitAnimData table at
ftData+0x0C -- the same subaction table tools/subaction.py already reads, whose
+0x10 field it already labels "anim flags".

meleelight has no equivalent, which is why its capsules and its drawn body
disagree on every state that slides: the art was traced on screen (where Melee
had already moved the fighter) and the capsules are TransN-relative (where it
had not). It DOES have eight hand-recorded `setVelocities` tables for rolls and
getups -- which are hand measurements of exactly this quantity. That overlap is
the check: if the extracted deltas reproduce those tables, the extraction is
right and the remaining ~90 states per character can be generated the same way.

    python tools/root_motion.py tools/dat <decomp>            # which states, and how far
    python tools/root_motion.py tools/dat <decomp> --check    # vs meleelight's own tables
"""
import io
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import WAD_SIZE, SUBACTION_COUNT
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose_cached as pose
from ecb import CHARS, joint_root, model_scale
from state_map import build as build_state_map

# x594_b0 is bit 0 of the BYTE at fp+594 (types.h:1201). On big-endian PPC
# that is the most significant bit of the s32 at +0x10, not bit 0 -- the low
# bits are constant per character and are something else entirely.
ROOT_MOTION_FLAG = 0x80000000

INDEX_JS = {"Fox": "fox", "Falco": "falco", "Falcon": "falcon",
            "Marth": "marth", "Puff": "puff"}


def anim_flags(datdir, dat, root):
    """subaction name -> the s32 at entry+0x10 (Fighter_WaitAnimData.x10)."""
    a = Archive(os.path.join(datdir, dat))
    table = a.ptr(a.root(root) + 0x0C)
    out = {}
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        namep = a.ptr(e + 0x00)
        if namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        out[nm] = struct.unpack(">i", a.raw[HDR + e + 0x10:HDR + e + 0x14])[0]
    return out


def trans_deltas(joints, aj, off, size, mscale, n):
    """x6A4_transNOffset.z per frame -- cur minus prev, frame 0 being zero.

    Melee clears the offset on state entry (fighter.c:1277) and the first
    frame's delta is against that, so frame 0 contributes nothing.
    """
    prev = None
    out = []
    for f in range(n):
        z = pose(joints, aj, off, size, f, root_scale=mscale)[1][2][3]
        out.append(0.0 if prev is None else z - prev)
        prev = z
    return out


def ml_tables(cdir):
    """meleelight's own hand-recorded per-frame velocities, by state."""
    s = io.open("src/characters/%s/index.js" % cdir, encoding="utf8").read()
    out = {}
    for m in re.finditer(
            r"actionStates\[[^\]]+\]\.([A-Z0-9]+)\.setVelocities\s*=\s*\[([^\]]*)\]", s):
        try:
            out[m.group(1)] = [float(x) for x in m.group(2).split(",")]
        except ValueError:
            pass
    return out


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    decomp = next((a for a in sys.argv[2:] if not a.startswith("--")), None)
    check = "--check" in sys.argv
    if decomp is None:
        print("needs the decomp checkout as the second argument", file=sys.stderr)
        return 2
    smap = build_state_map(decomp, datdir)

    for char, (dat, root, ajn, nr) in CHARS.items():
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        ms = model_scale(datdir, dat, root)
        flags = anim_flags(datdir, dat, root)
        cdir = INDEX_JS[char]
        tables = ml_tables(cdir)

        flagged = [s for s, f in flags.items() if f & ROOT_MOTION_FLAG]
        states = {st: sub for st, sub in smap[char].items()
                  if sub in anims and (flags.get(sub, 0) & ROOT_MOTION_FLAG)}
        print("\n=== %s: %d of %d subactions carry x594_b0; %d map to a "
              "meleelight state" % (char, len(flagged), len(flags), len(states)))

        if not check:
            rows = []
            for st, sub in states.items():
                off, size = anims[sub]
                n = int(aj.frame_count(off, size) or 1)
                d = trans_deltas(joints, aj, off, size, ms, n)
                rows.append((sum(d), st, max(d), min(d), n))
            rows.sort(key=lambda r: -abs(r[0]))
            print("    %-22s %8s %8s %8s %6s  %s"
                  % ("state", "total", "max/f", "min/f", "frames", "meleelight"))
            for tot, st, mx, mn, n in rows[:12]:
                print("    %-22s %8.2f %8.3f %8.3f %6d  %s"
                      % (st, tot, mx, mn, n,
                         "has table" if st in tables else "NOTHING"))
            continue

        # --check: does the extraction reproduce the hand-recorded tables?
        print("    %-16s %6s %6s %9s %9s  %s"
              % ("state", "disc", "ml", "disc sum", "ml sum", "mean |diff|"))
        for st in sorted(tables):
            sub = smap[char].get(st)
            if sub not in anims:
                print("    %-16s  (no subaction mapping)" % st)
                continue
            off, size = anims[sub]
            n = int(aj.frame_count(off, size) or 1)
            d = trans_deltas(joints, aj, off, size, ms, n)
            t = tables[st]
            m = min(len(d), len(t))
            diff = sum(abs(d[i] - t[i]) for i in range(m)) / m if m else 0
            print("    %-16s %6d %6d %9.2f %9.2f  %.4f%s"
                  % (st, len(d), len(t), sum(d), sum(t), diff,
                     "   <-- match" if diff < 0.15 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
