"""Compute a fighter's ECB from the skeleton, the way Melee does.

The ECB (environmental collision box) drives every stage interaction --
platforms, walls, ledges. Melee does not store it: it rebuilds it every frame
from SIX joints listed in ftData+0x44, and meleelight's per-frame ecb.js tables
are a frame-by-frame observation of the result.

Algorithm, from mpcoll.c:350 (the builder) and mpColl_SetECBSource_JObj at :220
which supplies the constants:

    take the 6 joints' world positions relative to cur_pos
    left/right  = min/max x        bottom/top = min/max y
    if !(flags & CanGrabLedge):  expand every side by 2.0
    if |right-left| < max(4, x12C=10):  right = |right-left|/2; left = -right
    if |top-bottom| < max(4, x128=10):  recentre to that height about the mid
    if !(flags & 8):  right = max(right, 2);  left = min(left, -2)
    if flags & 1:  bottom = 0   else:  bottom = max(bottom, 0)

    top    = (0, top)                 bottom = (0, bottom)
    right  = (right, x124 + (bottom+top)/2)
    left   = (left,  x124 + (bottom+top)/2)

Note the two "minimum size" clamps do NOT widen the box to the minimum -- they
RECENTRE it at half its current size. That reads like a bug and is reproduced
as written.

meleelight stores [bottom, half_width, side_y, top] per frame (see the ECBp
construction in physics.js), which is the same diamond with a symmetric width.

VALIDATION STATUS.

Two corrections were needed to get here, each confirmed by the error dropping:

  * measure from TransN, not the skeleton root (mean 1.93 -> 1.57, and
    CliffCatch specifically 7.6 -> 1.2). TransN carries the animation's root
    motion, which Melee applies to the fighter's POSITION, so it is the
    reference point the ECB is measured from.
  * divide by meleelight's per-character ecbScale, which it multiplies back in
    at runtime (1.57 -> 1.27; Falcon alone 3.0+ -> 0.94).

That leaves a 1.27-unit mean difference from meleelight's observed tables, and
the residual is THEIRS, not the model's. The evidence:

  * where meleelight's data is good the agreement is at rounding level -- best
    table 0.36, 62 of 157 within 1.0 unit. A structurally wrong model would not
    match ANY table.
  * no systematic transform explains the rest. A least-squares scale fit gives
    inconsistent per-character factors (1.10, 0.98, 1.00, 1.16, 1.04) that
    match nothing and barely reduce the error, so it is not a scale. It is not
    a constant offset, and it is not frame misalignment -- restricting the
    comparison to frames the animation actually has does not change the mean.
  * meleelight's tables are 2.0x ROUGHER frame to frame, median |2nd
    difference| 0.500 against 0.197 for the generated ones. 0.500 is the
    signature of integer quantisation. The ECB of a smoothly interpolated
    animation is smooth; a table read off a display and rounded is not.

THE MODEL SCALE IS APPLIED. An earlier version of this file said the opposite
-- "not a factor, applying it makes agreement worse" -- on the strength of the
mean difference against the observed tables going up. That reasoning was wrong,
and it was wrong because it used the weaker of two available measurements.

Melee writes ftCo_DatAttrs+0x8C onto the root JObj every frame
(Fighter_UpdateModelScale, fighter.c:214), and the root's scale multiplies into
every descendant's world position. Fox 0.96, Falco 1.10, Falcon 0.97, Marth
1.15, Puff 0.94.

The proof is on the hitboxes, not here. Hitbox offsets are computed from the
same joint world positions and compared against per-frame recorded tracks, and
applying the scale takes properties from ~0.4 units out to EXACTLY zero -- Fox's
grab, upb1, downspecial and dtilt all reproduce meleelight's recorded numbers to
0.00 -- while confirmed pairings across the five characters rise from 176 to
185. An independent least-squares fit of one scale factor per character, made
before the attribute was applied, returns 0.967, 1.092, 1.003, 1.129, 0.947.

Against the ECB tables the same change is mixed (Marth 1.45 -> 1.27, Falcon and
Puff flat, Fox and Falco slightly worse). That is not evidence against it: those
tables are the integer-quantised observations this docstring already describes
as 2x rougher than the computed ones, so they cannot resolve a 4% question. A
comparison target has to be more precise than the effect being measured.

THE SIX INDICES ARE JOINT INDICES, NOT Fighter_Part INDICES -- do not "fix"
this by routing them through part_to_joint.

There is a real remap table: PlCo.dat's ftLoadCommonData[4] is a
FighterPartsTable* per FighterKind, each holding joint_to_part / part_to_joint
/ parts_num (ft/types.h:46). Fox's part_to_joint is genuinely non-identity --
only 10 of 73 entries match, with a 255 (absent part) at index 5 shifting
everything after it. So `bones[unk0].joint` in ftInit reads like it needs that
remap.

It does not, and this was checked rather than argued. Applying part_to_joint to
the ECB indices makes agreement with the observed tables WORSE on every
character measured (Fox 1.22 -> 2.46, Falco 0.90 -> 1.41, Falcon 0.94 -> 1.03),
and produces nonsense besides: Fox's part 55 maps to joint 0 (the skeleton
root) and four of Puff's six map to "absent". fp->parts[] is populated by a
depth-first walk of the JObj tree, so in this path it is indexed by joint.

Usage:
    python tools/ecb.py tools/dat Fox Wait1 [frame]
"""
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose

CHARS = {
    "Fox":    ("PlFx.dat", "ftDataFox",     "PlFxAJ.dat", "PlFxNr.dat"),
    "Falco":  ("PlFc.dat", "ftDataFalco",   "PlFcAJ.dat", "PlFcNr.dat"),
    "Falcon": ("PlCa.dat", "ftDataCaptain", "PlCaAJ.dat", "PlCaNr.dat"),
    "Marth":  ("PlMs.dat", "ftDataMars",    "PlMsAJ.dat", "PlMsNr.dat"),
    "Puff":   ("PlPr.dat", "ftDataPurin",   "PlPrAJ.dat", "PlPrNr.dat"),
}


def joint_root(costume_path):
    """The skeleton root in a costume file, resolved rather than spelled out.

    The names carry a model-revision infix (`PlyFox5K_Share_joint`,
    `PlyCaptain5K_Share_joint`) that is not derivable from the character's file
    prefix, so hardcoding them is five chances to be wrong. Pick the `_joint`
    root that is not the material animation.
    """
    a = Archive(costume_path)
    names = [n for _, n in a.roots
             if n.endswith("_joint") and "matanim" not in n]
    if len(names) != 1:
        raise KeyError(f"{costume_path}: expected one skeleton root, got {names}")
    return names[0]


def model_scale(datdir, dat, root):
    """ftCo_DatAttrs+0x8C, the fighter's model scale.

    Melee writes this onto the ROOT JObj every frame (Fighter_UpdateModelScale
    at fighter.c:214 via ftCommon_GetModelScale at ftcommon.c:1407), so it
    multiplies into every joint's world position. Fox 0.96, Falco 1.10,
    Falcon 0.97, Marth 1.15, Puff 0.94 -- not close enough to 1 to ignore.
    """
    a = Archive(os.path.join(datdir, dat))
    co = a.data_off + a.ptr(a.root(root) + 0x00)
    return struct.unpack(">f", a.raw[co + 0x8C:co + 0x90])[0]


def ecb_source(datdir, dat, root):
    """(six joint indices, x124) from ftData+0x44."""
    a = Archive(os.path.join(datdir, dat))
    off = a.data_off + a.ptr(a.root(root) + 0x44)
    bones = struct.unpack(">6h", a.raw[off:off + 12])
    x124 = struct.unpack(">f", a.raw[off + 12:off + 16])[0]
    return list(bones), x124


def build_ecb(world, bones, x124, can_grab_ledge=True,
              flag8=False, flag1=False, x128=10.0, x12C=10.0):
    """mpcoll.c:345. `world` is the posed joint matrix list.

    can_grab_ledge DEFAULTS TRUE because the ordinary entry point is
    `mpColl_LoadECB` (mpcoll.c:650), which calls this with flags = 6 --
    PlatformPassCallback | CanGrabLedge. So `!(flags & CanGrabLedge)` is false
    and the +2.0 expansion does NOT happen on the normal path.

    That is worth stating explicitly: reading only the builder, the expansion
    looks like the default case. It is the exception. Applying it puts every
    ECB 2 units too large in all four directions.
    """
    # Melee measures the joints relative to cur_pos (mpcoll.c:373), and the
    # fighter's position already carries the animation's ROOT MOTION -- which
    # lives on TransN, joint 1. So the reference point is TransN, not the
    # skeleton root.
    #
    # This is invisible on animations that keep TransN at the origin (Wait,
    # Squat, Dash all do), and enormous on the ones that do not: CliffCatch
    # hangs the fighter below a ledge and StopCeil pins them to a ceiling.
    # Measuring from the skeleton root instead put those two 7.6 and 9.2 units
    # out on average, against ~1.2 once TransN is subtracted.
    # HORIZONTAL IS Z, NOT X. Melee's fighters face along the Z axis, so the
    # side-on 2D plane meleelight works in is (Z, Y). Confirmed on hitbox
    # positions, where a bone's world Z reproduces meleelight's recorded x to
    # ~0.2 units while its world X is nearly constant and reproduces nothing.
    #
    # mpcoll.c:373 reads `vec.x` because HSD's Vec3 there is in the fighter's
    # own frame; the distinction only shows up once you pose the skeleton
    # yourself. It barely moves the ECB numbers (three of the four components
    # are Y-based and the width has a 10-unit minimum clamp) -- Fox 1.22 ->
    # 1.18 -- but it is the right axis.
    ox, oy = world[1][2][3], world[1][1][3]
    pts = [(world[b][2][3] - ox, world[b][1][3] - oy) for b in bones]
    left = right = pts[0][0]
    bottom = top = pts[0][1]
    for x, y in pts[1:]:
        left = min(left, x)
        right = max(right, x)
        bottom = min(bottom, y)
        top = max(top, y)

    if not can_grab_ledge:
        left -= 2.0
        right += 2.0
        bottom -= 2.0
        top += 2.0

    width = abs(right - left)
    if width < max(4.0, x12C):
        right = 0.5 * width
        left = -right

    height = abs(top - bottom)
    if height < max(4.0, x128):
        half = 0.5 * height
        mid = 0.5 * (top + bottom)
        top = mid + half
        bottom = mid - half

    if flag8:
        left, right = -1.0, 1.0
    else:
        right = max(right, 2.0)
        left = min(left, -2.0)

    if flag1:
        bottom = 0.0
    elif bottom < 0.0:
        bottom = 0.0

    side_y = x124 + 0.5 * (bottom + top)
    return {"bottom": bottom, "top": top, "left": left, "right": right,
            "side_y": side_y}


def main():
    if len(sys.argv) < 4:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir, char, sub = sys.argv[1], sys.argv[2], sys.argv[3]
    frames = [int(sys.argv[4])] if len(sys.argv) > 4 else None
    dat, root, ajn, nr = CHARS[char]
    bones, x124 = ecb_source(datdir, dat, root)
    mscale = model_scale(datdir, dat, root)
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    if sub not in anims:
        print(f"no subaction {sub} for {char}", file=sys.stderr)
        return 1
    off, size = anims[sub]
    n = int(aj.frame_count(off, size) or 1)
    print(f"{char} {sub}: {n} frames, ECB joints {bones}, x124={x124:g}")
    for f in (frames or range(n)):
        e = build_ecb(pose(joints, aj, off, size, f, root_scale=mscale),
                      bones, x124)
        print(f"  f{f:<4} bottom {e['bottom']:6.2f}  half-width {e['right']:5.2f}"
              f"  side {e['side_y']:6.2f}  top {e['top']:6.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
