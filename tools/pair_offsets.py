"""Pair meleelight's offset arrays to the script hitbox group they came from.

meleelight's `setOffsets` properties (uptilt, jab3_4, bair1 ...) are its own
names; nothing in the game data says which subaction and which frame group each
one belongs to. Matching by hitbox VALUES alone is not enough: a move that
repeats identical hitboxes -- Fox's rapid jab is five cycles of the same size
and damage -- makes every cycle look like the first one, and four of the five
then pair to the wrong frame.

So pairing is decided by POSITION, which is self-validating. For each property:

    1. collect every script group whose hitbox values match
    2. also require the group's active length to fit the offset array
    3. compute the actual positions for each candidate and keep the one whose
       mean distance to the recorded offsets is smallest
    4. accept it only if that distance is at rounding level

A candidate that cannot reproduce the recorded positions is not the source of
those positions, whatever its values say. Pairing that the position test cannot
confirm is reported as unresolved rather than guessed.

Positions use the (Z, Y) projection -- Melee's fighters face along Z, so a
bone's world Z is meleelight's x. See the README.

    python tools/pair_offsets.py tools/dat Fox
"""
import io
import itertools
import os
import re
import statistics
import struct
import sys
from math import cos as mathcos, pi, sin as mathsin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import (decode_script, decode_create_hitbox, WAD_SIZE,
                       SUBACTION_COUNT)
from figatree import AJ, subaction_anims
from skeleton import load_skeleton, pose_cached as pose, transform
from ecb import CHARS, joint_root, model_scale

# A pairing is confirmed either by being close in absolute terms, OR by the
# declared bones explaining the data far better than any other bone could.
#
# The second test exists because absolute distance conflates two things: how
# right the pairing is, and how carefully the numbers were measured. Marth's
# hitboxes ride a long sword, so a small angular error at the hilt is a large
# positional one at the tip, and his residuals sit at 1.5-2.4 where Fox's sit
# near 0.4. Judging him by the same absolute bar rejects pairings that are
# demonstrably correct: his declared bones score 1.71-2.13 while the best
# single substitute joint scores 3.48-3.90.
#
# "This bone reproduces the recorded track and no other bone comes close" is
# evidence of a correct pairing at any noise level. Raising ACCEPT instead
# would accept everything equally, including the genuinely wrong ones.
ACCEPT = 1.5      # mean distance, in world units, for the absolute test
MARGIN = 0.65     # declared must beat the best substitute bone by this factor
MARGIN_MAX = 4.0  # ...and still be within this, so "least bad" cannot pass
SUSPECT_FIT = 0.5   # a substitute bone this close is reproducing the track
SUSPECT_MISS = 2.0  # ...while the declared bones this far off are not
# How far an offset array may outlive its group before the group is refused.
# meleelight's hitbox DURATIONS are its own -- Falcon's late up-air lives one
# frame in Melee and four in meleelight -- so this is a loose sanity bound,
# not a test. The position comparison is the test.
LENGTH_SLACK = 4

# Moves where Melee rotates the whole fighter by code, so the animation pose
# alone cannot place the hitbox: (angle, pivot joint). Only moves the
# decompilation shows rotating belong here.
#
# Fox's Firefox sets fp->mv.fx.SpecialHi.rotateModel from the stick and
# ftfoxspecialhi.c:512 defaults it to HALF_PI32 -- straight up, which is the
# case meleelight recorded. Fitting angle and pivot freely to Fox's upb2 track
# returns 90 degrees about (0.00, 7.97) with a residual of 0.002.
#
# The pivot is JOINT 2 (XRotN), which sits at exactly (0.000, 7.968) in that
# animation. Naming the joint rather than the fitted number is what makes this
# transferable: Falco reuses Fox's up-special code outright (ftfalco.c installs
# the ftFx_SpecialHi* callbacks) and his joint 2 is at (0.000, 9.130), so his
# pivot follows without a second fit.
MODEL_ROTATION = {
    ("Fox", "SpecialHi"): (pi / 2, 2),
    ("Falco", "SpecialHi"): (pi / 2, 2),
}

# Properties that are NOT script hitboxes, and the attribute struct they really
# come from. Melee installs these from the character's special attributes rather
# than from a subaction, so no amount of searching the scripts can find them --
# and the search's "nearest group" for them is noise.
#
# Layouts (ftcoll.c:3189 ftColl_CreateReflectHit, ftcoll.c:3175 for the shield
# one), as (attribute offset, offset-of-bone-id, offset-of-Vec3, offset-of-size):
#     ReflectDesc  bone u32 @0, max_damage @4, offset @8,  size @0x14
#     ShieldDesc   bone u32 @0, offset @4,     size @0x10
# Both resolve the bone through fp->parts[id].joint, unlike the ECB.
#
# Entries are (attribute offset, Vec3 offset, size offset, the subaction the
# volume is live in, label). The subaction is needed to pose the bone: the
# volume is a fixed offset on a joint, so where it ends up is whatever that
# joint is doing while the move runs.
NON_SCRIPT_VOLUMES = {
    ("Fox", "reflector"): (0xB0, 0x08, 0x14, "SpecialLwLoop",
                           "Reflector, ReflectDesc at FoxAttributes+0xB0 "
                           "(ftfoxspeciallw.c:424)"),
    ("Falco", "reflector"): (0xB0, 0x08, 0x14, "SpecialLwLoop",
                             "Reflector, ReflectDesc at FalcoAttributes+0xB0"),
    ("Marth", "downspecialground"): (0x64, 0x04, 0x10, "SpecialLw",
                                     "Counter, ShieldDesc at "
                                     "MarsAttributes+0x64 "
                                     "(ftmarsspeciallw.c:79)"),
    ("Marth", "downspecialair"): (0x64, 0x04, 0x10, "SpecialLw",
                                  "Counter, ShieldDesc at MarsAttributes+0x64"),
}

# Properties meleelight models with ONE array where Melee has several
# animations. No amount of measurement resolves these, because the thing being
# resolved does not exist in meleelight's structure -- the choice has to be
# made and named.
# Keyed by (character, property) or by property alone when it applies to every
# character.
STRUCTURAL_CHOICE = {
    "thrown": ("DamageFlyN", 0,
               "the tumble-body hitbox exists in all five DamageFly subactions"
               " with identical values on bone 4; DamageFlyN, Hi and Lw place"
               " it at exactly the same point and only Roll and Top differ, so"
               " meleelight's single array is right for three of the five"),
    ("Falcon", "falcondive2"): (
        "SpecialAirHi", 13,
        "meleelight splits Falcon Dive's grab in two -- UPSPECIAL.js:122"
        " enables both hitboxes at timer 13 and :129 keeps only the first from"
        " timer 14 -- where Melee creates both at frame 13 and leaves them live"
        " for 17 frames. So this is the FIRST hitbox of SpecialAirHi frame 13"
        " continued, and there is no second group for it to pair with"),
}

# Value differences that are NOT meleelight errors, each with the reason. A
# hitbox whose only disagreement with the script is listed here is confirmed,
# because the script value is not what the game uses.
#
# This table has to stay small and cited, or it becomes a way to make any
# disagreement disappear. Every entry names the code that overrides the value.
KNOWN_VALUE_DEVIATIONS = {
    ("Marth", "neutralspecialground"): (
        "damage: Shield Breaker overwrites it every frame, ftmarsspecialn.c:260"
        " sets x4 + cur_frame/30 * x8 and MarsAttributes x4 = 7, so the"
        " script's 28 is never used as written"),
    ("Marth", "neutralspecialair"): (
        "damage: as neutralspecialground, ftmarsspecialn.c:260"),
    ("Falcon", "falcondive1"): (
        "damage: these are grab hitboxes and meleelight applies Falcon Dive's"
        " damage through its grab path rather than the hitbox -- a deliberate"
        " modelling choice recorded in attributes.js, not a transcription slip"),
}


def script_groups(datdir, dat, root):
    """subaction -> [(frame, {id: hitbox}, active_len)]."""
    a = Archive(os.path.join(datdir, dat))
    table = a.ptr(a.root(root) + 0x0C)
    out = {}
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        sp = a.ptr(e + 0x0C)
        namep = a.ptr(e + 0x00)
        if sp is None or namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        fr = 0
        marks = []
        try:
            evs = decode_script(a, sp)
        except Exception:
            continue
        # A hitbox lives in a SLOT. `create_hitbox` writes fp->x914[id]
        # (ftaction.c:303) and touches nothing else, so creating ids 0 and 1
        # does not disturb id 2 -- that one stays live, with its original
        # values, until it is replaced, terminated individually (opcode 0x0F,
        # ftColl_8007AFC8) or cleared wholesale (0x10).
        #
        # Treating each frame's create_hitbox set as the whole live set is
        # wrong, and wrong in a way that quietly deletes hitboxes. Falcon Kick
        # creates three at frame 14 and then two at 17 and two at 25; the third
        # is live for the entire move at its frame-14 values, and the "each
        # frame is the whole set" reading says the later phases have two.
        # meleelight had all three, correctly, and they were nearly removed.
        live = {}
        byframe = {}
        order = []

        def snapshot(f):
            byframe[f] = dict(live) if live else None
            if f not in order:
                order.append(f)

        for rel, op, n, label, arg, word in evs:
            if op == 0x01:
                fr += arg
            elif op == 0x02:
                fr = arg
            elif op == 0x0B:
                h = decode_create_hitbox([a.d_u32(rel + k * 4) for k in range(5)])
                live[h["id"]] = h
                snapshot(fr)
            elif op == 0x0F:
                live.pop(arg, None)
                snapshot(fr)
            elif op == 0x10:
                live.clear()
                snapshot(fr)
        if not byframe:
            continue
        groups = []
        for k, f in enumerate(order):
            if byframe[f] is None:
                continue
            # A hitbox lives until something ends it: an explicit clear
            # (opcode 0x10 -> ftColl_8007AFF8, ftaction.c:443), a hit, or the
            # SUBACTION CHANGING (fighter.c:955, which clears on motion_id
            # change unless Ft_MF_SkipHit). It does not expire on its own.
            #
            # So the last group in a script is unbounded -- it runs to the end
            # of the animation. Giving it a length of one frame made the
            # "array outlives the group" pre-filter throw away four pairings
            # whose values matched EXACTLY (Fox upb2, Falco dashattack1/2,
            # Puff upair). None is "unbounded"; the position test still decides.
            alen = (order[k + 1] - f) if k + 1 < len(order) else None
            groups.append((f, byframe[f], None if alen is None else max(1, alen)))
        if groups:
            out[nm] = groups
    return out


def parse_offsets(js_path):
    src = io.open(js_path, encoding="utf-8").read()
    m = re.search(r"setOffsets\s*\([^,]+,\s*\{", src)
    if not m:
        return {}, {}, {}
    i = src.index("{", m.start())
    d = 0
    for j in range(i, len(src)):
        if src[j] == "{":
            d += 1
        elif src[j] == "}":
            d -= 1
            if d == 0:
                break
    blk = src[i:j]
    # Balanced braces, not a "\n  }" terminator. Marth's offsets put their
    # inner id keys at ZERO indent and do not close at two spaces, so an
    # indentation-anchored regex swallows the entire block as one property --
    # 824 positions under a single name, and nothing pairs.
    offs = {}
    # Indent is not reliable either: Marth's properties sit at zero, two and
    # four spaces in the same block. Anchor on the line start only.
    for pm in re.finditer(r"^[ 	]*(\w+)[ 	]*:[ 	]*\{", blk, re.M):
        b = blk.index("{", pm.end() - 1)
        depth = 0
        for e in range(b, len(blk)):
            if blk[e] == "{":
                depth += 1
            elif blk[e] == "}":
                depth -= 1
                if depth == 0:
                    break
        body = blk[b:e]
        arrs = {}
        for am in re.finditer(r"(id\d)\s*:\s*\[(.*?)\]", body, re.S):
            pts = []
            # Vec2D for the originally recorded arrays, Vec3D once baked --
            # the third component is depth and is ignored by the pairing, which
            # compares against the 2D numbers meleelight actually measured.
            for xa, ya in re.findall(
                    r"Vec[23]D\(([-\d.+\- ]+),\s*([-\d.+\- ]+)", am.group(2)):
                try:
                    pts.append((eval(xa), eval(ya)))
                except Exception:
                    pass
            if pts:
                arrs[am.group(1)] = pts
        if arrs:
            offs[pm.group(1)] = arrs
    # Some arrays are declared `id0 : []` and filled afterwards by a loop
    # pushing ONE CONSTANT point (Fox's bair2.id0 is `(-0.02, 8.00)` twelve
    # times). Those are placeholders, not observations: they say nothing about
    # where the hitbox is, so scoring against them would only add noise, and
    # they are excluded from `offs` on purpose.
    #
    # They still have a LENGTH, and the disc still has real positions for them,
    # so record the length separately. Baking fills them in; pairing ignores
    # them. That distinction is the whole reason this is a third return value
    # rather than more entries in `offs`.
    synth, seen = {}, []
    for lm in re.finditer(
            r"for\s*\([^)]*<\s*(\d+)[^)]*\)\s*\{\s*offsets\[[^\]]+\]"
            r"\.(\w+)\.(id\d)\.push\(", src):
        synth[(lm.group(2), lm.group(3))] = int(lm.group(1))
        seen.append(lm.span())
    for sm in re.finditer(
            r"^[ \t]*offsets\[[^\]]+\]\.(\w+)\.(id\d)\.push\(", src, re.M):
        # A push inside a loop body already counted above -- counting it again
        # here would add one phantom frame to every looped array.
        if any(a <= sm.start() < b for a, b in seen):
            continue
        key = (sm.group(1), sm.group(2))
        synth[key] = synth.get(key, 0) + 1
    # Balance parentheses rather than regexing to the closing ")". Several
    # characters put each createHitbox on its own line, so the inner ")," sits
    # at end-of-line and a non-greedy match stops at the FIRST hitbox. That
    # silently truncates the value list to one entry, which then matches no
    # script group at all -- Falcon lost 43 of 48 properties to it while Fox,
    # whose entries are single-line, was unaffected.
    vals = {}
    for hm in re.finditer(r"^[ 	]*(\w+)[ 	]*:[ 	]*new createHitboxObject\(", src, re.M):
        i = src.index("(", hm.end() - 1)
        depth = 0
        for j in range(i, len(src)):
            if src[j] == "(":
                depth += 1
            elif src[j] == ")":
                depth -= 1
                if depth == 0:
                    break
        ents = re.findall(
            r"new createHitbox\(\s*offsets\[[^\]]+\]\.(\w+)\.(id\d)\s*,\s*"
            r"([\d.]+)\s*,\s*([\d.]+)", src[i:j])
        if ents:
            vals[hm.group(1)] = ents
    return offs, vals, synth


JS = {"Fox": "src/characters/fox/attributes.js",
      "Falco": "src/characters/falco/attributes.js",
      "Falcon": "src/characters/falcon/attributes.js",
      "Marth": "src/characters/marth/marthAttributes.js",
      "Puff": "src/characters/puff/puffAttributes.js"}


def pair(datdir, char):
    """(ok, suspect, unresolved, positions) for one character.

    `positions(prop, sub, frame, shift)` recomputes the disc positions a
    confirmed pairing implies, so the bake tool writes the very same numbers
    the pairing was scored against rather than a second, independent guess.
    """
    dat, root, ajn, nr = CHARS[char]
    ml = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    offs, vals, synth = parse_offsets(os.path.join(ml, JS[char]))
    groups = script_groups(datdir, dat, root)
    costume = os.path.join(datdir, nr)
    joints = load_skeleton(costume, joint_root(costume))
    aj = AJ(os.path.join(datdir, ajn))
    anims = subaction_anims(os.path.join(datdir, dat), root)
    # The root JObj's scale, applied to every pose. See skeleton.pose.
    mscale = model_scale(datdir, dat, root)

    def score_at(sub, frame, hs, prop, ents, shift, force=None, perm=None,
                 view="transn"):
        off, size = anims[sub]
        n = int(aj.frame_count(off, size) or 1)
        errs = []
        # meleelight's `id0`, `id1`, ... are ITS OWN consecutive names. Melee's
        # create_hitbox carries an explicit id that need not start at zero:
        # Falco's AttackDash hitbox is id 1, Puff's AttackAirHi is id 1. Keying
        # by int(idn[2:]) looked up an id the group does not have, `errs` came
        # back empty, score() returned None, and the candidate disappeared
        # WITHOUT a message -- the values matched exactly and the tool still
        # said "no candidate group".
        #
        # The correspondence is positional, which is what the value test
        # already asserts (it compares `sorted(hs)` against the ents order).
        keys = perm if perm is not None else sorted(hs)
        # `_oname` is the offsets property the hitbox actually REFERENCES, and
        # it is not always this property's own name. Falcon's upairLate is
        # built from `offsets[..].upairMid.id0`, Falco's dtilt from
        # `offsets[..].downtilt.id0`, Puff's upb from `upspecial`. Looking the
        # array up under `prop` found nothing for fourteen properties across
        # the five characters, and `score()` then returned None -- so they
        # vanished from the report entirely rather than being judged.
        #
        # Worse than silent for Falcon's downattack2, which HAS its own arrays
        # but references downattack1's: looking up `prop` scored it against
        # numbers the game never uses.
        for pos, (oname, idn, _sz, _dm) in enumerate(ents):
            if pos >= len(keys) or idn not in offs.get(oname, {}):
                continue
            h = hs[keys[pos]]
            for t, ob in enumerate(offs[oname][idn]):
                f = frame + t + shift
                if f >= n:
                    break
                w = pose(joints, aj, off, size, f, root_scale=mscale)
                oz, oy = w[1][2][3], w[1][1][3]
                if view == "root":
                    # meleelight's array for this move carries the animation's
                    # ROOT MOTION instead of having it subtracted. Only one
                    # property does (Marth's fsmash), and the test is not free:
                    # of the 49 confirmed pairings whose animation moves TransN,
                    # TransN is better in all 49, most of them at exactly 0.00.
                    # So this reference never wins where the ordinary one is
                    # right, and it identifies the group where it is not:
                    # fsmash goes 3.51 -> 0.28.
                    oz = oy = 0.0
                p = transform(w[h["bone"] if force is None else force],
                              h["b_offset"])
                gx, gy = p[2] - oz, p[1] - oy
                rot = MODEL_ROTATION.get((char, sub))
                if rot is not None:
                    # Melee rotates the whole fighter by code in this move, so
                    # the pose alone cannot place the hitbox. Fox's Firefox sets
                    # fp->mv.fx.SpecialHi.rotateModel, and with no stick input
                    # it is HALF_PI32 -- exactly 90 degrees
                    # (ftfoxspecialhi.c:512), which is the case meleelight
                    # recorded. A free rotation fit would confirm anything; this
                    # is a fixed angle and pivot, named per move, from the
                    # decomp.
                    ang, pivot_j = rot
                    cx, cy = w[pivot_j][2][3] - oz, w[pivot_j][1][3] - oy
                    ca, sa = mathcos(ang), mathsin(ang)
                    dx, dy = gx - cx, gy - cy
                    gx, gy = cx + ca * dx - sa * dy, cy + sa * dx + ca * dy
                errs.append(((gx - ob[0]) ** 2 + (gy - ob[1]) ** 2) ** 0.5)
        return (statistics.mean(errs), len(errs)) if errs else None

    def score(sub, frame, hs, prop, ents, perm=None, view="transn"):
        """Best (distance, shift) for this group.

        The shift exists because one script group can serve several recorded
        cycles. A LOOPING animation creates the hitboxes once, but meleelight
        recorded each pass separately: Fox's rapid jab is five properties
        (jab3_1..jab3_5) against a single Attack100Loop group, and they sit at
        shifts +1, +8, +15, +21, +28 -- about seven frames apart. Scoring only
        at the group's own frame pairs all five to the first cycle and four of
        them come out 2-8 units wrong.

        The extra freedom is bounded by the animation's own length and still
        has to clear the same rounding-level threshold over every point in the
        property, so it buys a fit only where one genuinely exists.
        """
        off, size = anims[sub]
        n = int(aj.frame_count(off, size) or 1)
        best = None
        # A shift that pushes most of the array past the end of the animation
        # compares only the handful of points that remain, and a one-point
        # comparison is trivially perfect. Fox's upb2 scored 0.00 at shift +29
        # of a 30-frame animation on a single frame, beating the honest 0.002
        # fit at shift 0. So coverage is collected first and thin shifts are
        # refused outright, rather than being allowed to win on a technicality.
        counts = []
        for shift in range(max(-2, -frame), max(1, n - frame)):
            r = score_at(sub, frame, hs, prop, ents, shift, perm=perm, view=view)
            counts.append(r[1] if r is not None else 0)
        need = max(counts) * 0.8 if counts else 0
        # Shifts may be NEGATIVE by a frame or two. meleelight's frame numbering
        # is not always Melee's -- the intangibility windows are `disc_start + 1`
        # for the same reason -- and Falcon's upairMid is recorded from frame 10
        # of AttackAirHi although the create_hitbox is at frame 11. Searching
        # only forwards left it 3.64 out with no shift able to reach the right
        # frames; from -1 it lands at rounding level.
        #
        # Two frames is the whole allowance, and the fit still has to clear the
        # same threshold over every point, so it cannot buy a pairing that is
        # not there.
        for shift in range(max(-2, -frame), max(1, n - frame)):
            r = score_at(sub, frame, hs, prop, ents, shift, perm=perm,
                         view=view)
            if r is None or r[1] < need:
                continue
            if best is None or r[0] < best[0]:
                best = (r[0], shift)
        return best

    ok, unresolved, suspect, mismatch, placeholder = [], [], [], [], []
    for prop, ents in sorted(vals.items()):
        vol = NON_SCRIPT_VOLUMES.get((char, prop))
        if vol is not None:
            # Confirmed against the attribute struct instead of a script group.
            # The size is the check that matters: it is a float the game reads
            # straight out of the file, so a match is a match.
            at, off_v, off_s, vsub, label = vol
            a = Archive(os.path.join(datdir, dat))
            sp = a.data_off + a.ptr(a.root(root) + 0x04)
            bone_id = struct.unpack(">I", a.raw[sp + at:sp + at + 4])[0]
            v3 = struct.unpack(">3f", a.raw[sp + at + off_v:sp + at + off_v + 12])
            dsize = struct.unpack(">f", a.raw[sp + at + off_s:
                                              sp + at + off_s + 4])[0]
            msize = round(float(ents[0][2]), 2)
            if round(dsize, 2) == msize:
                ok.append((0.0, prop, vsub, 0, 0, 1,
                           f"{label}; not a script hitbox: bone {bone_id}, "
                           f"offset ({v3[0]:g}, {v3[1]:g}, {v3[2]:g}), "
                           f"size {dsize:g}"))
            else:
                unresolved.append(
                    (prop, f"{label}: disc size {dsize:g}, meleelight {msize:g}"))
            continue

        pick = STRUCTURAL_CHOICE.get((char, prop)) or STRUCTURAL_CHOICE.get(prop)
        if pick is not None and pick[0] in groups and pick[0] in anims:
            sub, frame, why = pick
            if any(f == frame for f, _h, _a in groups[sub]):
                ok.append((0.0, prop, sub, frame, 0, 1, why))
                continue

        # A property is in scope if the arrays its hitboxes reference exist,
        # under whatever name they reference.
        onames = {o for o, _i, _s, _d in ents}
        if not any(o in offs or (o, i) in synth for o, i, _s, _d in ents):
            unresolved.append(
                (prop, "no offset arrays exist under "
                       + ", ".join(sorted(onames))))
            continue
        want = [(round(float(sz), 2), int(float(dm))) for _, _, sz, dm in ents]
        maxlen = max([len(offs[o][i]) for o, i, _s, _d in ents
                      if i in offs.get(o, {})]
                     + [synth.get((o, i), 0) for o, i, _s, _d in ents] + [0])
        cands = []
        for sub, gs in groups.items():
            if sub not in anims:
                continue
            for frame, hs, alen in gs:
                got = [(round(hs[k]["size"], 2), int(hs[k]["damage"]))
                       for k in sorted(hs)]
                if got != want:
                    continue
                if alen is not None and maxlen > alen + LENGTH_SLACK:
                    continue           # array outlives a group that is ended
                r = score(sub, frame, hs, prop, ents)
                if r is not None:
                    cands.append((r[0], sub, frame, r[1]))
        if not cands and not any(i in offs.get(o, {}) for o, i, _s, _d in ents):
            # Every array this property uses is a PLACEHOLDER -- an empty
            # literal filled by a loop pushing one constant. There is no
            # recorded track, so the position test has nothing to confirm
            # against and score() returns None for every group, however
            # obviously right it is. Fox's nair1 matches AttackAirN frame 4 on
            # all three sizes and all three damages exactly, and was still
            # reported as "no group matches values".
            #
            # Values alone are enough here PROVIDED they are unique. A single
            # group with an exact match is an identification; two or more is
            # not, and stays unresolved.
            exact = []
            for sub, gs in groups.items():
                if sub not in anims:
                    continue
                for frame, hs, alen in gs:
                    got = [(round(hs[k]["size"], 2), int(hs[k]["damage"]))
                           for k in sorted(hs)]
                    if got == want:
                        exact.append((sub, frame))
            if len(exact) == 1:
                # Confirmed, by uniqueness rather than by position. Exactly one
                # group in the whole character carries this list of sizes and
                # damages, so there is nothing else it could be; the position
                # test is simply unavailable because meleelight never recorded
                # a track to compare against.
                #
                # Kept as its own `how` string rather than folded into "abs",
                # because the evidence really is weaker: it rests on the values
                # being unique, not on reproducing a measurement.
                placeholder.append((prop, exact[0][0], exact[0][1]))
                ok.append((0.0, prop, exact[0][0], exact[0][1], 0, 1,
                           "unique values, no recorded track to compare"))
                continue
            unresolved.append(
                (prop, f"only placeholder arrays, and {len(exact)} groups match "
                       f"values {want}"
                 + (": " + ", ".join(f"{s}@f{f}" for s, f in exact[:4])
                    if exact else "")))
            continue

        if not cands:
            # SECOND PASS, on SIZE alone. Size is the far more distinctive
            # fingerprint -- it is quantised to 1/256 and takes dozens of
            # values, where damage is a small integer -- so a group whose whole
            # size list matches is already nearly unique, and the position test
            # still has to confirm it independently.
            #
            # This is what separates "meleelight recorded a damage number
            # wrong" from "this is not a script hitbox". Falcon's falcondive1
            # is SpecialHi@f13 with sizes 2.73 and 4.30 exactly and damage 1
            # where meleelight wrote 0; Fox's ledgegetupquick is
            # CliffAttackQuick with three exact sizes and a third damage of 6
            # where meleelight wrote 8. Both were previously indistinguishable
            # from Marth's Counter, which really is not a script hitbox at all.
            #
            # The order is searched too. meleelight's id0..idN follow the
            # createHitbox declaration order, which need NOT be the group's id
            # order: Marth's neutralspecial sizes are the disc's list rotated
            # by one. Trying the permutations that match sizes and letting the
            # position test pick is the only way to tell a reordering from a
            # wrong pairing.
            wsz = [round(float(sz), 2) for _, _, sz, _ in ents]
            relaxed = []
            for sub, gs in groups.items():
                if sub not in anims:
                    continue
                for frame, hs, alen in gs:
                    keys = sorted(hs)
                    if len(keys) != len(wsz):
                        continue
                    if alen is not None and maxlen > alen + 1:
                        continue
                    # At most ONE size may disagree. Marth's jab is the disc's
                    # Attack11 with a single wrong size (3.91 recorded as 4.69)
                    # and his neutral special is SpecialNEnd with one off by
                    # 0.07; a second disagreement and the group stops being
                    # identifiable by size at all.
                    #
                    # Two orderings are tried, not all n! of them: the group's
                    # own id order, and the greedy assignment that lines equal
                    # sizes up. Those cover a reordering without turning the
                    # search into 24 scorings per group.
                    tries, used = [tuple(keys)], set()
                    greedy = []
                    for s in wsz:
                        pick = next((k for k in keys if k not in used
                                     and round(hs[k]["size"], 2) == s), None)
                        if pick is not None:
                            used.add(pick)
                            greedy.append(pick)
                        else:
                            greedy.append(None)
                    spare = [k for k in keys if k not in used]
                    greedy = [k if k is not None else spare.pop(0) for k in greedy]
                    if tuple(greedy) != tuple(keys):
                        tries.append(tuple(greedy))
                    for pm in tries:
                        n_bad = sum(1 for k, s in zip(pm, wsz)
                                    if round(hs[k]["size"], 2) != s)
                        # TWO sizes must still match exactly for the group to be
                        # identified by size at all. Without this floor a
                        # one-hitbox property has NO constraint left -- "at most
                        # one may differ" out of one -- and every single-hitbox
                        # group in the character matches. That is exactly what
                        # happened: Fox's reflector paired to SpecialLwStart
                        # with size 8.5->8, Falco's to the same subaction with
                        # 8.5->6, and Marth's Counter to a DamageFly tumble
                        # hitbox. None of those three is a script hitbox at all.
                        if n_bad > 1 or (n_bad and len(wsz) - n_bad < 2):
                            continue
                        r = score(sub, frame, hs, prop, ents, perm=list(pm))
                        if r is not None:
                            relaxed.append((r[0] + n_bad * 1e-6, sub, frame,
                                            r[1], list(pm)))
            relaxed.sort(key=lambda t: t[0])
            # Judged by the SAME two-part test as an exact-value pairing: close
            # in absolute terms, or explaining the track far better than any
            # other bone could. Using only the absolute bar here rejected
            # Marth's jab and neutral special, whose residuals sit where all
            # his sword hitboxes' do, and then reported them as though no
            # candidate had been found.
            r_alt = None
            if relaxed:
                e0, sub0, frame0, shift0, pm0 = relaxed[0]
                hs0 = next(h for f, h, _a in groups[sub0] if f == frame0)
                declared = set(hs0[k]["bone"] for k in hs0)
                for j in range(len(joints)):
                    if j in declared:
                        continue
                    d = score_at(sub0, frame0, hs0, prop, ents, shift0,
                                 force=j, perm=pm0)
                    if d is not None and (r_alt is None or d[0] < r_alt):
                        r_alt = d[0]
            if relaxed and (relaxed[0][0] <= ACCEPT
                            or (r_alt is not None and relaxed[0][0] < r_alt * MARGIN
                                and relaxed[0][0] <= MARGIN_MAX)):
                e, sub, frame, shift, pm = relaxed[0]
                diffs = []
                hs = next(h for f, h, _a in groups[sub] if f == frame)
                for pos, (_o, idn, sz, dm) in enumerate(ents):
                    h = hs[pm[pos]]
                    if round(float(sz), 2) != round(h["size"], 2):
                        diffs.append(f"{idn} size {float(sz):g}->{h['size']:.4g}")
                    if int(float(dm)) != int(h["damage"]):
                        diffs.append(f"{idn} dmg {int(float(dm))}->{int(h['damage'])}")
                if pm != sorted(hs):
                    diffs.append(f"id order {sorted(hs)}->{pm}")
                why = KNOWN_VALUE_DEVIATIONS.get((char, prop))
                if why is not None and all("dmg" in d for d in diffs):
                    # Every remaining disagreement is a damage the game itself
                    # overrides, so the pairing is confirmed and there is
                    # nothing to correct. Restricted to damage: a size or an id
                    # ordering is never explained by these entries, and letting
                    # one through under this exemption would hide a real error.
                    ok.append((e, prop, sub, frame, shift, 1, why))
                else:
                    mismatch.append((prop, sub, frame, shift, e, diffs))
                continue

            if relaxed:
                # Before reporting a failure: is there anywhere else it could
                # have come from? Count the groups in the WHOLE character whose
                # sizes match. If exactly one does, the property can only have
                # come from that group, whatever the recorded positions say --
                # and what they say is then that the recorded positions are
                # wrong, not that the pairing is.
                #
                # Falcon's falcondivethrowextra is the case: size 7.8125 occurs
                # once in the entire character, in SpecialHiCatch frame 2. Its
                # recorded offset is 5 units from where that bone is, so the
                # offset is what needs replacing.
                #
                # This is uniqueness, not tolerance. A second group with the
                # same sizes and the rule does not fire.
                n_size_groups = 0
                for sub2, gs2 in groups.items():
                    if sub2 not in anims:
                        continue
                    for _f2, hs2, _a2 in gs2:
                        k2 = sorted(hs2)
                        if len(k2) == len(wsz) and \
                                [round(hs2[k]["size"], 2) for k in k2] == wsz:
                            n_size_groups += 1
                if n_size_groups == 1:
                    e0, sub0, frame0, shift0, _pm0 = relaxed[0]
                    ok.append((e0, prop, sub0, frame0, shift0, 1,
                               f"only group in the character with these sizes; "
                               f"recorded offsets are {e0:.2f} out and will be "
                               f"replaced"))
                    continue
                # A size-compatible group existed and the POSITION test refused
                # it. Say so, with the number -- reporting "no group matches
                # values" here would hide that a candidate was found and
                # rejected on evidence.
                e0, sub0, frame0, shift0, _pm0 = relaxed[0]
                extra = f", best other bone {r_alt:.2f}" if r_alt is not None else ""
                unresolved.append(
                    (prop, f"size-compatible {sub0}@f{frame0}+{shift0} but "
                           f"position dist {e0:.2f}{extra}"))
                continue

            # "No group has these values" is two different findings wearing one
            # label: the property may not be a script hitbox at all, or it may
            # be one whose RECORDED VALUES are wrong. Naming the nearest group
            # separates them -- a group that differs in one damage number is a
            # data error to fix, a property that resembles nothing is not a
            # script hitbox. Going silent here hid both.
            # The COUNT is searched too, because a difference there is its own
            # finding and a same-count-only search cannot see it. Melee's
            # Falcon Kick has three hitboxes on the clean frame and two on the
            # mid and late ones; meleelight carried the third into all three.
            # Puff's Rollout is a single hitbox in Melee and three circles in
            # meleelight. Both look like "no group matches values" until the
            # counts are put side by side.
            near = None
            for sub, gs in groups.items():
                if sub not in anims:
                    continue
                for frame, hs, alen in gs:
                    got = [(round(hs[k]["size"], 2), int(hs[k]["damage"]))
                           for k in sorted(hs)]
                    d = sum(abs(a[0] - b[0]) + abs(a[1] - b[1])
                            for a, b in zip(got, want))
                    # Each missing or extra hitbox costs more than any single
                    # value disagreement can, so a same-count group still wins
                    # whenever one exists.
                    d += 100.0 * abs(len(got) - len(want))
                    if near is None or d < near[0]:
                        near = (d, sub, frame, got)
            if near is None:
                unresolved.append(
                    (prop, f"no group anywhere has {len(want)} hitbox(es)"))
            else:
                d, sub, frame, got = near
                if len(got) != len(want):
                    unresolved.append(
                        (prop, f"HITBOX COUNT DIFFERS: meleelight has "
                               f"{len(want)} {want}, nearest disc group "
                               f"{sub}@f{frame} has {len(got)} {got}"))
                else:
                    unresolved.append(
                        (prop, f"no group matches values {want}; "
                               f"nearest {sub}@f{frame} {got} (off by {d:g})"))
            continue
        cands.sort()
        best, sub, frame, shift = cands[0]

        # Baseline: how well would the BEST OTHER single bone do, substituted
        # for every hitbox in this group? Computed only for the winner, so the
        # cost is one sweep per property rather than per candidate.
        hs_win = None
        for f, hs2, _al in groups[sub]:
            if f == frame:
                hs_win = hs2
                break
        alt = None
        if hs_win is not None:
            declared = set(hs_win[k]["bone"] for k in hs_win)
            for j in range(len(joints)):
                if j in declared:
                    continue
                d = score_at(sub, frame, hs_win, prop, ents, shift, force=j)
                if d is not None and (alt is None or d[0] < alt):
                    alt = d[0]
        alt_txt = f" (of {len(cands)} candidates)" if len(cands) > 1 else ""
        by_margin = (alt is not None and best < alt * MARGIN and best <= MARGIN_MAX)
        # Last resort, tried only when the ordinary reference has failed: the
        # recorded array may carry the animation's root motion rather than
        # having it subtracted. This cannot steal a pairing from the ordinary
        # test -- it is only reached after that test has already been refused --
        # and on the 49 confirmed pairings whose animation moves TransN the
        # ordinary reference wins every time.
        root_view = None
        if not (best <= ACCEPT or by_margin):
            r = score(sub, frame, hs_win, prop, ents, view="root")
            if r is not None and r[0] <= ACCEPT:
                root_view = r
        if best <= ACCEPT or by_margin or root_view is not None:
            if best <= ACCEPT:
                how = "abs"
            elif by_margin:
                how = f"margin {best:.2f}<{alt:.2f}"
            else:
                best, shift = root_view
                how = "meleelight array includes root motion"
            ok.append((best, prop, sub, frame, shift, len(cands), how))
        elif alt is not None and alt <= SUSPECT_FIT and best > SUSPECT_MISS:
            # One substitute bone reproduces the recorded track almost exactly
            # over the whole group while the DECLARED bones do not. A wrong
            # group would fit no bone that well -- eight frames agreeing to
            # 0.01 units is not a coincidence -- so the group is right and the
            # recorded offsets were read off the wrong bone. Reported as its
            # own category so a data error is never mistaken for a pairing
            # failure, and never silently baked either.
            suspect.append((prop, sub, frame, shift, best, alt))
        else:
            extra = f", best other bone {alt:.2f}" if alt is not None else ""
            unresolved.append(
                (prop, f"best {sub}@f{frame}+{shift} dist {best:.2f}{extra}{alt_txt}"))

    def positions(prop, sub, frame, shift):
        """{(offsets_property, id_name): [(x, y), ...]} straight from the disc,
        each the same length as the recorded array.

        Melee's hitbox lives on a bone; meleelight adds `offset[frame]` to the
        fighter's position with x mirrored by facing (hitDetection.js:178), so
        the value is the bone point measured from TransN in the (Z, Y) plane --
        exactly what score_at() compares.

        The key carries the OFFSETS PROPERTY, not this property's name, because
        they are not always the same: Falcon's upairLate is drawn from
        `offsets[..].upairMid`. Writing to `upairLate.id0` would create an array
        nothing reads and leave the one the game does read untouched.
        """
        off, size = anims[sub]
        n = int(aj.frame_count(off, size) or 1)

        vol = NON_SCRIPT_VOLUMES.get((char, prop))
        if vol is not None:
            # A ReflectDesc or ShieldDesc: one fixed offset on one joint, with
            # no script group behind it. Same projection as everything else, so
            # meleelight's approximation of these gets replaced with the real
            # thing rather than merely being explained.
            at, off_v, _off_s, _vsub, _label = vol
            a = Archive(os.path.join(datdir, dat))
            sp = a.data_off + a.ptr(a.root(root) + 0x04)
            bone_id = struct.unpack(">I", a.raw[sp + at:sp + at + 4])[0]
            v3 = struct.unpack(">3f", a.raw[sp + at + off_v:sp + at + off_v + 12])
            lens = [len(offs.get(o, {}).get(i, ())) or synth.get((o, i), 0)
                    for o, i, _s, _d in vals[prop]]
            n_pts = max(lens) if lens else 1
            oname, idn = vals[prop][0][0], vals[prop][0][1]
            pts = []
            for t in range(max(1, n_pts)):
                w = pose(joints, aj, off, size, min(t, n - 1), root_scale=mscale)
                p = transform(w[bone_id], (v3[0], v3[1], v3[2]))
                # (horizontal, vertical, DEPTH) = Melee's (Z, Y, X).
                pts.append((p[2] - w[1][2][3], p[1] - w[1][1][3],
                            p[0] - w[1][0][3]))
            return {(oname, idn): pts}

        hs = None
        for f, hs2, _al in groups[sub]:
            if f == frame:
                hs = hs2
                break
        if hs is None:
            return None
        keys = sorted(hs)
        # Length comes from the recorded array, or -- for a placeholder filled
        # by a push loop -- from the loop's own count. Never from the animation:
        # meleelight indexes `offset[hitboxes.frame]` with no bounds check, so a
        # shorter array is a crash, not an inaccuracy. Same trap the ECB tables
        # hit.
        #
        # And every id of one property gets the SAME length, the longest of
        # them, because `hitboxes.frame` is a single counter shared by all the
        # ids in a hitbox set. Fox's nair1 had id0 four long and id1/id2 one
        # long; once the `frames++` typo in ATTACKAIRN.js is fixed and the
        # counter actually advances, the short ones are indexed past their end.
        lens = [len(offs.get(o, {}).get(i, ())) or synth.get((o, i), 0)
                for o, i, _s, _d in vals[prop]]
        n_pts = max(lens) if lens else 0
        if not n_pts:
            return {}
        rot = MODEL_ROTATION.get((char, sub))
        out = {}
        for pos, (oname, idn, _sz, _dm) in enumerate(vals[prop]):
            if pos >= len(keys):
                continue
            h = hs[keys[pos]]
            pts = []
            for t in range(n_pts):
                # Past the animation's last frame the pose holds, which is what
                # Melee does -- the figatree simply stops advancing.
                f = min(frame + t + shift, n - 1)
                w = pose(joints, aj, off, size, f, root_scale=mscale)
                p = transform(w[h["bone"]], h["b_offset"])
                gx, gy = p[2] - w[1][2][3], p[1] - w[1][1][3]
                gz = p[0] - w[1][0][3]
                if rot is not None:
                    # Stored PRE-ROTATED, matching what meleelight expects: its
                    # up-special sets `rotation = PI/2 - upbAngleMultiplier`,
                    # which is zero for the straight-up default, and that
                    # default is Melee's rotateModel = HALF_PI32. So the table
                    # holds the straight-up case and meleelight rotates away
                    # from it.
                    ang, pj = rot
                    cx, cy = w[pj][2][3] - w[1][2][3], w[pj][1][3] - w[1][1][3]
                    ca, sa = mathcos(ang), mathsin(ang)
                    dx, dy = gx - cx, gy - cy
                    gx, gy = cx + ca * dx - sa * dy, cy + sa * dx + ca * dy
                # Depth is NOT rotated with the other two. The Firefox model
                # rotation is about the fighter's own axis, in the plane the
                # game is played in; it does not move a hitbox in depth.
                pts.append((gx, gy, gz))
            # Two hitboxes of one property pointing at ONE array is a bug in
            # the recorded data, not something to average or pick from. It was
            # real: Falco's and Falcon's nair1/nair2 each read .id1 twice and
            # left .id2 unused, so their middle hitbox sat 6.9 units from where
            # it belonged. Assigning into the dict silently kept whichever came
            # last, which is exactly how it went unnoticed.
            if (oname, idn) in out and out[(oname, idn)] != pts:
                raise ValueError(
                    f"{char} {prop}: two hitboxes both write {oname}.{idn} "
                    f"with different positions -- fix the offset reference")
            out[(oname, idn)] = pts
        return out

    return ok, suspect, unresolved, mismatch, placeholder, positions


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    datdir, char = sys.argv[1], sys.argv[2]
    ok, suspect, unresolved, mismatch, placeholder, _pos = pair(datdir, char)

    print(f"\n{char}: {len(ok)} confirmed, {len(mismatch)} value-mismatch, "
          f"{len(suspect)} data-suspect, "
          f"{len(unresolved)} unresolved")
    for e, prop, sub, frame, shift, n, how in sorted(ok):
        at = f"f{frame + shift}" + (f" (group f{frame}+{shift})" if shift else "")
        print(f"   {prop:22} -> {sub:18} {at:24} dist {e:.2f}"
              + (f"  [from {n}]" if n > 1 else "")
              + ("" if how == "abs" else f"  [{how}]"))
    for prop, sub, frame, shift, best, alt in suspect:
        print(f"   {prop:22} DATA SUSPECT: group {sub}@f{frame}+{shift} is right "
              f"(one bone fits at {alt:.2f}) but the declared bones give {best:.2f}")
    for prop, sub, frame, shift, e, diffs in mismatch:
        at = f"f{frame + shift}" + (f" (group f{frame}+{shift})" if shift else "")
        print(f"   {prop:22} =? {sub:18} {at:24} dist {e:.2f}"
              f"  [VALUES DIFFER: {'; '.join(diffs) or 'none'}]")
    if placeholder:
        print(f"   ({len(placeholder)} of the confirmed rest on unique values "
              f"alone, having no recorded track: "
              + ", ".join(p for p, _s, _f in placeholder) + ")")
    for prop, why in unresolved:
        print(f"   {prop:22} -- {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
