"""Generate meleelight's per-frame hurtbox capsules from the disc.

meleelight collides against ONE axis-aligned box built from a two-number
`hurtboxOffset` attribute, and that box never changes -- a crouching Fox has
the same hurtbox as a standing one (physics.js:1372). Melee has a list of
CAPSULES riding bones, and they move with every frame of every animation.

This writes the real thing: for each action state, for each frame, both 3D
endpoints of every capsule, measured from TransN with the fighter's model scale
applied -- the same reference and the same scale the hitbox offsets use.

THE DEPTH AXIS IS KEPT. Everything else positional in this project is projected
to (Z, Y), because meleelight is 2D. Hurtboxes are the exception, and it is not
a stylistic one: the axis that projection discards is the one fighters use to
dodge. Marth's forearm travels 8.4 units in X during his forward smash and
Fox's 7.4 during up-tilt, against hitbox radii of 2 to 5 -- so the depth offset
is routinely bigger than the hitbox, and flattening it would make this engine
land hits that Melee misses. Both fighters sit at z = 0, so all of that depth
comes from the animation and is fully determined by a 2D game state.

Layout, per character:

    setHurtboxData(CHARIDS.FOX_ID, {
      radii: [ ... one per capsule ... ],
      bones: [ ... one per capsule, for reference ... ],
      height: [ ... 0 low, 1 mid, 2 high ... ],
      grabbable: [ ... ],
      frames: { WAIT: [ ... ], DASH: [ ... ] },
    });

Each state's array is FLAT: six numbers per capsule (ax, ay, az, bx, by, bz),
capsules in order, frames concatenated. Flat because the nesting would cost
more in brackets than the numbers do -- this is the largest data in the
project.

    python tools/gen_hurtbox.py tools/dat <decomp>            # report only
    python tools/gen_hurtbox.py tools/dat <decomp> --write
"""
import io
import math
import multiprocessing
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hurtbox import hurt_inits
from figatree import AJ, subaction_anims
from skeleton import load_skeleton
from ecb import CHARS, joint_root, model_scale
from validate_frames import parse_js as parse_frames
from state_map import build as build_state_map
from root_motion import anim_flags, ROOT_MOTION_FLAG
from gen_ecb import JS, LOOPING

# Three decimals, matching the ECB tables. The collision compares a squared
# distance against the squared sum of two radii, and the radii run from 0.84 to
# 5.6, so a thousandth of a unit moves the boundary by at most 0.1% of the
# smallest capsule. Full float32 would be another 1.2 MB for no reachable
# difference in outcome.
def fmt(v):
    s = "%.3f" % v
    if s == "-0.000":
        s = "0"
    s = s.rstrip("0").rstrip(".")
    return s or "0"


OUT = {
    "Fox": "src/characters/fox/hurtbox.js",
    "Falco": "src/characters/falco/hurtbox.js",
    "Falcon": "src/characters/falcon/hurtbox.js",
    "Marth": "src/characters/marth/hurtbox.js",
    "Puff": "src/characters/puff/hurtbox.js",
}
CHARID = {"Fox": "FOX_ID", "Falco": "FALCO_ID", "Falcon": "FALCON_ID",
          "Marth": "MARTH_ID", "Puff": "PUFF_ID"}

# A capsule endpoint further than this from TransN is not a fighter's limb.
LIMIT = 60.0

# Set MELEELIGHT_SERIAL=1 to run in one process when debugging a traceback.
PARALLEL = not os.environ.get("MELEELIGHT_SERIAL")

# One state's table in ecb.js, and one row inside it. Named constants rather
# than inline literals because these are the only backslash-heavy strings in
# the file, and an earlier edit turned a "\b" into a literal backspace -- which
# is not a syntax error, just a pattern that silently matches nothing. The
# state count quietly fell from 135 to 80 and nothing complained.
TABLE_RE = re.compile(r"\b([A-Z][A-Z0-9_]{2,})\s*:\s*\[(\[[^A-Za-z]*?\])\]", re.S)
ROW_RE = re.compile(r"\[[^\[\]]+\]")


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
    state_maps = build_state_map(decomp, datdir)

    # ONE PROCESS PER CHARACTER. The characters share nothing -- each loads its
    # own DAT, skeleton and animation bank -- so this is embarrassingly
    # parallel and the run takes as long as the slowest character rather than
    # the sum of all five. The pose cache is per-process, which is fine because
    # it was never shared across characters anyway.
    args = [(char, datdir, ml, state_maps[char], write) for char in CHARS]
    if PARALLEL and len(args) > 1:
        with multiprocessing.Pool(min(len(args), os.cpu_count() or 1)) as pool:
            results = pool.map(_build_one, args)
    else:
        results = [_build_one(a) for a in args]

    total_states = total_nums = total_bytes = 0
    for char, ok, msg, nstates, nnums, nbytes in results:
        print(msg)
        if not ok:
            return 1
        total_states += nstates
        total_nums += nnums
        total_bytes += nbytes

    print(f"\n{total_states} states, {total_nums:,} numbers, "
          f"{total_bytes/1e6:.2f} MB total "
          f"{'written' if write else '(dry run)'}")
    return 0


def _build_one(a):
    """One character, in its own process. Returns (char, ok, message, ...)."""
    char, datdir, ml, smap, write = a
    dat, root, ajn, nr = CHARS[char]
    if True:   # keeps the original body's indentation
        caps = hurt_inits(datdir, dat, root)
        if not caps:
            return (char, False, f"!! {char}: no hurtbox inits at ftData+0x30", 0, 0, 0)
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        ms = model_scale(datdir, dat, root)
        frames = parse_frames(os.path.join(ml, JS[char][1]))
        # Durations come from the ECB tables where setFrames is silent, so the
        # hurtbox table for a state has exactly as many frames as its ECB table
        # and the two stay indexable by the same counter.
        ecbsrc = io.open(os.path.join(ml, JS[char][0]), encoding="utf-8").read()
        existing_rows = {}
        for em in TABLE_RE.finditer(ecbsrc):
            existing_rows[em.group(1)] = len(ROW_RE.findall(em.group(2)))

        # Melee's own per-subaction root-motion flag, x594_b0 -- bit 0 of the
        # BYTE at fp+594, which is bit 31 of the s32 read from the subaction
        # table's +0x10 (fighter.c:1254). See tools/root_motion.py.
        aflags = anim_flags(datdir, dat, root)

        skipped = 0
        state_out = []
        for state, sub in sorted(smap.items()):
            if sub not in anims:
                skipped += 1
                continue
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
            off, size = anims[sub]
            n_anim = int(aj.frame_count(off, size) or 1)
            # Store the ANIMATION, not the state's duration, and let the
            # runtime wrap or hold. A state that outlives its animation is
            # otherwise storing the same frames over and over: Puff's WAIT runs
            # 464 frames over a much shorter loop, and states like APPEAL and
            # CAPTUREWAIT are similarly padded. Writing the duration out in
            # full cost 11.5 MB, most of it repeats.
            loops = sub in LOOPING
            n_store = n_anim if loops else min(n_rows, n_anim)
            nums = []
            for f in range(n_store):
                for (p, q) in posed3(joints, aj, off, size, f, caps, ms,
                                     not (aflags.get(sub, 0)
                                          & ROOT_MOTION_FLAG)):
                    nums.extend(p)
                    nums.extend(q)
            for v in nums:
                if not math.isfinite(v) or abs(v) > LIMIT:
                    return (char, False,
                            f"!! {char} {state}: implausible capsule "
                            f"coordinate {v:g} -- refusing to write", 0, 0, 0)
            state_out.append((state, nums, loops))

        body = ["import {CHARIDS} from \"../../main/characters\";",
                "import {setHurtboxData} from \"../../main/hurtboxData\";",
                "/* eslint-disable */",
                "",
                "// GENERATED by tools/gen_hurtbox.py from the disc. Do not edit by hand.",
                "//",
                "// Six numbers per capsule per frame: ax, ay, az, bx, by, bz, measured",
                "// from TransN with the model scale applied. x is Melee's X (depth), z is",
                "// Melee's Z, which is meleelight's horizontal. Radii are constant per",
                "// capsule and listed once.",
                "",
                f"setHurtboxData(CHARIDS.{CHARID[char]}, {{",
                "  radii: [" + ",".join(fmt(c["radius"]) for c in caps) + "],",
                "  bones: [" + ",".join(str(c["bone"]) for c in caps) + "],",
                "  height: [" + ",".join(str(c["height"]) for c in caps) + "],",
                "  grabbable: [" + ",".join("1" if c["grabbable"] else "0"
                                            for c in caps) + "],",
                "  // Each table holds ONE PASS of the animation, not the whole",
                "  // state. `looping` below lists the states whose animation",
                "  // replays while the state lasts; the runtime wraps the frame",
                "  // index for those and holds the last frame for the rest.",
                "  frames: {"]
        for state, nums, _lp in state_out:
            body.append(f"    {state}: [" + ",".join(fmt(v) for v in nums) + "],")
        body.append("  },")
        body.append("  looping: [" + ",".join(
            '"%s"' % st for st, _n, lp in state_out if lp) + "],")
        body.append("});")
        text = "\n".join(body) + "\n"

        path = os.path.join(ml, OUT[char])
        if write:
            io.open(path, "w", encoding="utf-8", newline="").write(text)
        return (char, True,
                f"  {char:7} {len(caps):2} capsules, {len(state_out):3} states, "
                f"{len(text)/1e6:.2f} MB "
                f"({'written' if write else 'dry run'}), {skipped} skipped",
                len(state_out), sum(len(n) for _s, n, _l in state_out), len(text))



def posed3(joints, aj, off, size, frame, caps, mscale, compensate=True):
    """Both capsule endpoints in full 3D, measured from TransN.

    From TransN at THIS frame or at FRAME 0, and which one is decided by the
    subaction's x594_b0 flag -- the caller passes `compensate` as "the flag is
    clear". See tools/root_motion.py for the flag; it is bit 31 of the s32 at
    the subaction table's +0x10, not bit 0.

    An animation can carry a slide in its TransN joint. What the flag decides
    is whether ftAnim_8006E054 (ftanim.c:174-192) ZEROES that joint after
    reading it:

      * FLAG SET. The joint is zeroed, so the MODEL draws in place and the
        slide is gone from the bone matrices. Capsules measured from the
        animated TransN are exactly what Melee collides against, and meleelight
        moves the fighter itself for these states (its setVelocities tables are
        hand measurements of the very same quantity -- see
        test/check-root-motion.mjs). No compensation.

      * FLAG CLEAR. The joint keeps its translation, so the model genuinely
        slides on screen relative to the fighter's position, and meleelight's
        traced art -- captured on screen -- carries that slide too. Subtracting
        the ANIMATED TransN would cancel it out of the capsules only, leaving
        them trailing the drawn body. Marth's up smash is the visible case: his
        AttackHi4 slides TransN +4.111 units and is NOT flagged, which put his
        hurtbox 4.1 units behind him.

    So for the unflagged case, subtract TransN at frame 0 instead, which keeps
    the slide in the capsules and reproduces Melee's world positions:

        Melee:  pos0 + (TransN(f) - TransN(0))*face + (bone - TransN(f))
             =  pos0 + bone - TransN(0)

    HORIZONTAL ONLY. z is Melee's Z, meleelight's left-right axis and the one a
    fighter's position travels along; x is depth and y is height. Vertical root
    motion belongs to moves that rise -- Falcon's up-B climbs ~50 units -- and
    re-baking that would both double the move and push capsules past LIMIT,
    which is how the check below caught the first version of this.
    """
    from skeleton import pose_cached as pose, transform
    w = pose(joints, aj, off, size, frame, root_scale=mscale)
    ox, oy, oz = w[1][0][3], w[1][1][3], w[1][2][3]
    # oz only -- the horizontal axis. See the docstring.
    if compensate:
        oz = pose(joints, aj, off, size, 0, root_scale=mscale)[1][2][3]
    out = []
    for c in caps:
        m = w[c["bone"]]
        pa = transform(m, c["a"])
        pb = transform(m, c["b"])
        out.append(((pa[0] - ox, pa[1] - oy, pa[2] - oz),
                    (pb[0] - ox, pb[1] - oy, pb[2] - oz)))
    return out


if __name__ == "__main__":
    sys.exit(main())
