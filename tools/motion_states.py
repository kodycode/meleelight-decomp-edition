"""Melee's own action-state -> subaction table, read from the decompilation.

Every tool that needs "which animation does this state play" was using a
hand-written mapping, and a hand-written mapping is a list of guesses that
happen to be mostly right. It is not: `CaptureDamage` is really
`CaptureDamageHi` and `CaptureDamageLw`, `FuraFuraFall` does not exist at all,
and Puff's aerial jumps are `JumpAerialF1`..`F5` rather than `JumpAerialF` and
`JumpAerialB`. Each of those silently dropped a state from ECB regeneration.

The game has the answer in a table, and the decomp has the table in source:

    ftData_MotionStateList[ftCo_MS_Count]   ftmotionstates.c:133
    typedef enum ftCo_Submotion             ftCommon/forward.h:633
    typedef enum ftCommon_MotionState       ftCommon/forward.h (above it)

Each MotionState's first field is its `anim_id`, an `ftCo_SM_*` value, and that
value is an INDEX into the character's own subaction table (ftData+0x0C). So
the state's animation is `subactions[anim_id]`, per character, exactly.

The enum ordinals were checked against the disc rather than assumed: Fox's
subaction table agrees with the enum on 223 of 296 entries by name, and every
disagreement is a naming difference between the decomp's enum and the FigaTree
asset (`ftCo_SM_SwordSwing1` vs `Swing1`, `LightThrowF4` vs `LightThrowF`) or a
submotion that reuses another animation, never an off-by-one. Indices line up.

    python tools/motion_states.py <decomp-root>          # print the table
    python tools/motion_states.py <decomp-root> Fox      # resolve per character
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import WAD_SIZE, SUBACTION_COUNT

FORWARD = os.path.join("src", "melee", "ft", "kinds", "ftCommon", "forward.h")
STATES = os.path.join("src", "melee", "ft", "ftmotionstates.c")


def _enum(src, name):
    """Ordinal -> entry name for a plain C enum with no explicit values."""
    m = re.search(r"typedef enum " + name + r" \{(.*?)\}", src, re.S)
    if not m:
        raise KeyError(name + " not found")
    out = []
    for line in m.group(1).splitlines():
        line = line.split("//")[0].strip().rstrip(",").strip()
        if not line or line.endswith("_Count"):
            continue
        if "=" in line:
            # `ftCo_SM_None = -1` is the only one, and it precedes ordinal 0.
            continue
        out.append(line)
    return out


def submotion_names(decomp):
    return _enum(open(os.path.join(decomp, FORWARD), encoding="utf-8").read(),
                 "ftCo_Submotion")


def motion_state_names(decomp):
    return _enum(open(os.path.join(decomp, FORWARD), encoding="utf-8").read(),
                 "ftCommon_MotionState")


def state_anim(decomp):
    """ftCo_MS_* name -> ftCo_SM_* name, from ftData_MotionStateList.

    The initialiser is read positionally: entries appear in enum order and each
    one's FIRST field is the anim_id. The `// ftCo_MS_Name = N` comment the
    decomp puts on each entry is used to key the result, so a mis-count cannot
    silently shift the whole table.
    """
    src = open(os.path.join(decomp, STATES), encoding="utf-8").read()
    m = re.search(r"MotionState ftData_MotionStateList\[[^\]]*\] = \{(.*)\n\};",
                  src, re.S)
    if not m:
        raise KeyError("ftData_MotionStateList not found")
    out = {}
    for em in re.finditer(r"//\s*(ftCo_MS_\w+)\s*=\s*(\d+)\s*,?\s*\n\s*"
                          r"(ftCo_SM_\w+)", m.group(1)):
        out[em.group(1)] = em.group(3)
    return out


def subactions(datdir, dat, root):
    """Index -> animation name, in the character's own subaction table order."""
    a = Archive(os.path.join(datdir, dat))
    table = a.ptr(a.root(root) + 0x0C)
    names = []
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        p = a.ptr(e + 0x00)
        names.append(a.cstr(HDR + p).split("ACTION_")[-1].replace("_figatree", "")
                     if p else None)
    return names


def resolve(decomp, datdir, dat, root):
    """ftCo_MS_* name -> the animation that character plays for it.

    A state whose anim_id is ftCo_SM_None, or whose index the character's table
    does not reach, or whose entry is empty, is absent from the result. Those
    are states the character genuinely has no animation for, and they must not
    be papered over with a nearby one.
    """
    sm = submotion_names(decomp)
    idx = {n: i for i, n in enumerate(sm)}
    subs = subactions(datdir, dat, root)
    out = {}
    for state, anim in state_anim(decomp).items():
        if anim == "ftCo_SM_None":
            continue
        i = idx.get(anim)
        if i is None or i >= len(subs) or not subs[i]:
            continue
        out[state] = subs[i]
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    decomp = sys.argv[1]
    if len(sys.argv) < 3:
        mapping = state_anim(decomp)
        print(f"{len(mapping)} motion states")
        for k, v in sorted(mapping.items()):
            print(f"   {k:40} {v}")
        return 0
    from ecb import CHARS
    char = sys.argv[2]
    dat, root, _ajn, _nr = CHARS[char]
    r = resolve(decomp, "tools/dat", dat, root)
    print(f"{char}: {len(r)} states resolve to an animation")
    for k, v in sorted(r.items()):
        print(f"   {k:40} {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
