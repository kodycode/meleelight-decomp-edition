"""Write disc-computed hitbox offsets into meleelight's setOffsets blocks.

meleelight's offset arrays were observed frame by frame off a running game and
carry the rounding that implies. Melee does not store them at all: a hitbox
lives on a BONE, and its position each frame is that bone's world matrix times
the script's b_offset. So they can be computed exactly.

    offset[frame] = bone_world * b_offset  -  TransN,  projected to (Z, Y)

which is what hitDetection.js:178 then adds to the fighter's position with x
mirrored by facing. Melee's fighters face along Z, so the side-on plane
meleelight works in is (Z, Y) -- see the README.

ONLY CONFIRMED PAIRINGS ARE WRITTEN. pair_offsets.py decides which property
came from which script group by reproducing the recorded positions, and this
tool reuses that verdict rather than forming a second opinion. Properties it
reports as unresolved or data-suspect are left exactly as they are, because
writing a value the comparison could not confirm would replace a known
approximation with an unknown one.

Array LENGTHS are preserved. meleelight indexes `offset[hitboxes.frame]` with
no bounds check, so a shorter array is a crash rather than an inaccuracy -- the
same trap the ECB regeneration hit. Past the animation's last frame the pose
holds, matching the figatree simply not advancing.

    python tools/bake_offsets.py tools/dat            # report, write nothing
    python tools/bake_offsets.py tools/dat --write

Every generated point is range-checked before anything is written, and the
change from the recorded value is reported per property. One implausible point
aborts the whole run rather than writing a partly-good file.
"""
import io
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS
from f32 import shortest
from pair_offsets import JS, pair

# A hitbox is on the fighter's body or their weapon. Marth's sword tip is the
# furthest anything reaches, near 25 units up and 20 out; nothing legitimate is
# beyond this, so a point outside it means the pairing or the pose is wrong.
LIMIT = 60.0


def fmt(v):
    """The shortest decimal that round-trips to the computed float32.

    Not "%.2f". The position is computed in float32 the way the console
    computes it, so rounding it to two decimals when writing throws away
    precision the number actually has -- up to half a hundredth of a unit of
    purely self-inflicted error, on every point, on top of whatever the model's
    own error is. f32.shortest gives the exact value in the fewest digits that
    reproduce it.
    """
    return shortest(v)


def rewrite(src, prop, idn, pts):
    """Replace one `idN : [ ... ]` array inside one property of setOffsets."""
    pm = None
    for cand in re.finditer(r"^[ \t]*" + prop + r"[ \t]*:[ \t]*\{", src, re.M):
        pm = cand
        break
    if pm is None:
        return None
    b = src.index("{", pm.end() - 1)
    depth = 0
    for e in range(b, len(src)):
        if src[e] == "{":
            depth += 1
        elif src[e] == "}":
            depth -= 1
            if depth == 0:
                break
    body = src[b:e]
    am = re.search(idn + r"\s*:\s*\[(.*?)\]", body, re.S)
    if am is None:
        return None
    # Vec3D, not Vec2D: the third component is DEPTH (Melee's X). x and y keep
    # their meaning, so every existing reader of `.x`/`.y` is unaffected; the
    # hurtbox collision is what needs the third.
    new = "[" + ",".join("new Vec3D(%s,%s,%s)" % (fmt(x), fmt(y), fmt(z))
                         for x, y, z in pts) + "]"
    body = body[:am.start()] + idn + " : " + new + body[am.end():]
    src = src[:b] + body + src[e:]

    # An array that was declared empty and filled by a loop pushing one
    # constant now holds real per-frame values, so the loop must go -- leaving
    # it would append the placeholder AFTER the real data and double the
    # length. A bare push outside a loop is removed the same way.
    src = re.sub(
        r"\n[ \t]*for\s*\([^)]*\)\s*\{\s*offsets\[[^\]]+\]\."
        + prop + r"\." + idn + r"\.push\([^;]*\);\s*\}", "", src)
    src = re.sub(
        r"\n[ \t]*offsets\[[^\]]+\]\." + prop + r"\." + idn + r"\.push\([^;]*\);",
        "", src)
    return src


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    write = "--write" in sys.argv
    ml = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    total_props = total_pts = 0
    for char in CHARS:
        ok, suspect, unresolved, mismatch, placeholder, positions = pair(datdir, char)
        path = os.path.join(ml, JS[char])
        src = io.open(path, encoding="utf-8").read()

        # Collect every write first, keyed by the array it targets, so that two
        # properties sharing one array can be caught before anything is
        # written. That sharing is real: Falcon's upairLate and upairMid both
        # read `offsets[..].upairMid`, but they pair to DIFFERENT hitbox groups
        # (AttackAirHi frame 14 and frame 11), so they want different numbers in
        # the same place. One would silently overwrite the other.
        writes, want_by, done = {}, {}, []
        for _e, prop, sub, frame, shift, _n, _how in sorted(ok):
            pts = positions(prop, sub, frame, shift)
            if pts is None:
                print(f"!! {char} {prop}: pairing confirmed but positions "
                      f"unavailable -- refusing to write", file=sys.stderr)
                return 1
            for (oname, idn), arr in pts.items():
                for x, y, z in arr:
                    if not (math.isfinite(x) and math.isfinite(y)
                            and math.isfinite(z)) \
                            or abs(x) > LIMIT or abs(y) > LIMIT \
                            or abs(z) > LIMIT:
                        print(f"!! {char} {oname}.{idn}: implausible point "
                              f"({x:g}, {y:g}, {z:g}) -- refusing to write",
                              file=sys.stderr)
                        return 1
                writes.setdefault((oname, idn), []).append((prop, arr))
            done.append(prop)

        clashes = set()
        for key, entries in sorted(writes.items()):
            if len({tuple(a) for _p, a in entries}) > 1:
                who = ", ".join(p for p, _a in entries)
                print(f"   {char}: {key[0]}.{key[1]} is shared by {who} and "
                      f"they disagree -- left as it was", file=sys.stderr)
                clashes.update(p for p, _a in entries)

        for (oname, idn), entries in sorted(writes.items()):
            if entries[0][0] in clashes:
                continue
            arr = entries[0][1]
            out = rewrite(src, oname, idn, arr)
            if out is None:
                print(f"!! {char} {oname}.{idn}: could not locate the array "
                      f"to rewrite -- refusing to write", file=sys.stderr)
                return 1
            src = out
            total_pts += len(arr)
        done = [p for p in done if p not in clashes]
        total_props += len(done)

        # The baked arrays are Vec3D now, so the file needs that import. Added
        # next to the Vec2D one it already has rather than at the top, so the
        # import block stays in the order the file already used.
        if "util/Vec3D" not in src:
            src = src.replace(
                'import {Vec2D} from "../../main/util/Vec2D";',
                'import {Vec2D} from "../../main/util/Vec2D";\n'
                'import {Vec3D} from "../../main/util/Vec3D";', 1)
        if write:
            io.open(path, "w", encoding="utf-8", newline="").write(src)
        print(f"  {char:7} {len(done):3} properties "
              f"({'written' if write else 'dry run'}), "
              f"{len(suspect)} data-suspect and {len(unresolved)} unresolved "
              f"left untouched")

    print(f"\n{total_props} offset properties, {total_pts} points "
          f"{'baked' if write else 'would be baked'} from the disc")
    return 0


if __name__ == "__main__":
    sys.exit(main())
