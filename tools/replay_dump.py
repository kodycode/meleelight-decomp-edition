"""Decode a meleelight replay and report each player's recorded position.

Replays are pako-deflated JSON (replay.js: compressObject -> pako.deflate).
The outer array is [stageSelect, playerTypes, characterSelections, packages],
each of the first three separately deflated, and `packages` a list of deflated
per-frame snapshots (replay.js:90 `snapShot.push(compressObject(...))`).

Each snapshot records `playerData[i] = player[i].phys.pos` for all four slots
(replay.js:84). JSON.stringify turns NaN into null, so a slot that reads
{"x": null, "y": null} is a fighter whose position went NaN -- which renders
nothing, never lands inside the blastzone (so it never dies) and makes the
AI's nearest-enemy distance compare false forever.

Usage:
    python tools/replay_dump.py "<replay .json>"
"""
import json
import math
import sys
import zlib


def to_bytes(blob):
    if isinstance(blob, dict):
        return bytes(blob[str(k)] for k in range(len(blob)))
    return bytes(blob)


def unz(blob):
    return json.loads(zlib.decompress(to_bytes(blob)).decode("utf8"))


def finite(v):
    return isinstance(v, (int, float)) and math.isfinite(v)


def main():
    path = sys.argv[1]
    raw = open(path, "rb").read()
    top = json.loads(zlib.decompress(raw).decode("utf8"))

    stage = unz(top[0])
    ptypes = unz(top[1])
    csel = unz(top[2])
    packages = top[3]

    print("stage           :", stage)
    print("playerTypes     :", ptypes, "  (0=human 1=cpu 2=net -1=empty)")
    print("charSelections  :", csel)
    print("frames          :", len(packages))
    print()

    frames = [unz(p)["fullGameState"]["playerData"] for p in packages]

    for p in range(4):
        if p >= len(ptypes) or ptypes[p] == -1:
            continue
        first_bad = None
        last_good = None
        nbad = 0
        for f, fr in enumerate(frames):
            e = fr[p] if p < len(fr) else None
            ok = e is not None and finite(e.get("x")) and finite(e.get("y"))
            if ok:
                last_good = f
            else:
                nbad += 1
                if first_bad is None:
                    first_bad = f
        print("player %d (type %d): %d/%d frames non-finite" % (p, ptypes[p], nbad, len(frames)))
        print("    first non-finite frame : %s" % first_bad)
        print("    last finite frame      : %s" % last_good)
        if last_good is not None and first_bad is not None and last_good < len(frames) - 1:
            lo = max(0, last_good - 8)
            print("    positions leading up to it:")
            for f in range(lo, min(len(frames), last_good + 3)):
                e = frames[f][p]
                x = e.get("x") if e else None
                y = e.get("y") if e else None
                sx = ("%.3f" % x) if finite(x) else str(x)
                sy = ("%.3f" % y) if finite(y) else str(y)
                print("      f%-6d x=%-14s y=%s" % (f, sx, sy))
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
