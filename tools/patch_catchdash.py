"""Write the dash grab's hitbox offsets and hitbox object into each character's
attributes file, from the disc.

Companion to gen_catchdash.py, which computes the numbers and self-checks
itself against the standing grab meleelight already records. This one only
places them, next to the standing grab's own blocks so the two read together.

    python tools/patch_catchdash.py tools/dat            # report
    python tools/patch_catchdash.py tools/dat --write
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from f32 import shortest
from gen_catchdash import offsets_for

# char -> (attributes file, how that file indexes `offsets`, indent style)
TARGETS = {
    "Marth": ("src/characters/marth/marthAttributes.js", "0"),
    "Puff": ("src/characters/puff/puffAttributes.js", "1"),
    "Fox": ("src/characters/fox/attributes.js", "2"),
    "Falco": ("src/characters/falco/attributes.js", "3"),
    "Falcon": ("src/characters/falcon/attributes.js", "CHARIDS.FALCON_ID"),
}


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    write = "--write" in sys.argv

    for char, (path, idx) in TARGETS.items():
        got, nframes = offsets_for(datdir, char, "CatchDash")
        if got is None:
            print("%-8s no CatchDash hitbox group -- skipped" % char)
            continue
        frame, active, hs, pts = got
        s = io.open(path, encoding="utf8").read()
        if "grabDash" in s:
            print("%-8s already patched" % char)
            continue

        # ---- 1. the offsets block, right after `grab : { ... },`
        m = re.search(r"^(\s*)grab\s*:\s*\{.*?\n\1\},", s, re.M | re.S)
        if not m:
            print("%-8s could not find the `grab : {` offsets block" % char)
            continue
        ind = m.group(1)
        lines = ["%sgrabDash : {" % ind]
        for k, hid in enumerate(sorted(hs)):
            vs = ",".join("new Vec3D(%s,%s,%s)"
                          % (shortest(p[1][hid][0]), shortest(p[1][hid][1]),
                             shortest(p[1][hid][2])) for p in pts)
            lines.append("%s  id%d : [%s]%s"
                         % (ind, hid, vs, "," if k < len(hs) - 1 else ""))
        lines.append("%s}," % ind)
        block = "\n" + "\n".join(lines)
        s = s[:m.end()] + block + s[m.end():]

        # ---- 2. the hitbox object, right after the `grab : new ...` one
        m2 = re.search(r"^(\s*)grab\s*:\s*new createHitboxObject\(.*?\n?\s*\),",
                       s, re.M | re.S)
        if not m2:
            print("%-8s could not find the `grab : new createHitboxObject` line"
                  % char)
            continue
        ind2 = m2.group(1)
        args = ",".join(
            "new createHitbox(offsets[%s].grabDash.id%d,%s,0,361,100,0,0,2,3,1,1)"
            % (idx, hid, shortest(hs[hid]["size"])) for hid in sorted(hs))
        obj = ("\n%s// ftCo_MS_CatchDash. %d frames against Catch's 30, hitboxes\n"
               "%s// live f%d..f%d -- read off the subaction script, not guessed.\n"
               "%sgrabDash : new createHitboxObject(%s),"
               % (ind2, nframes, ind2, frame, frame + active - 1, ind2, args))
        s = s[:m2.end()] + obj + s[m2.end():]

        print("%-8s grabDash: %d hitboxes, f%d..f%d, %d frames"
              % (char, len(hs), frame, frame + active - 1, nframes))
        if write:
            io.open(path, "w", encoding="utf8", newline="").write(s)

    if not write:
        print("\n  report only -- pass --write to apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
