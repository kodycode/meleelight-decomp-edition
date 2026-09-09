"""Report the frame each character's Dash subaction sets cmd_vars[0].

ftCo_Dash_Enter (ftCo_Dash.c:55) zeroes cmd_vars[0] on entry, and
ftCo_Dash_IASA's branch 3 gates the run transition behind it:

    RETURN_IF(!fp->cmd_vars[0]);
    RETURN_IF(fn_800CA5F0(gobj));      // lstick.x * facing_dir >= x58 -> Run

so the frame the Dash script raises cmd_vars[0] is the frame a dash may first
become a run. That is the per-character number -- it is NOT in ftCo_DatAttrs,
it lives in the animation script, the same way runTurnBreakPoint does.

meleelight stores it as `dashFrameMin` and tests `timer > dashFrameMin`, so the
committed value should be one less than the frame reported here.

    python tools/dash_cmdvars.py tools/dat
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

CHARS = [
    ("Fox", "PlFx.dat", "ftDataFox", "fox/attributes.js"),
    ("Falco", "PlFc.dat", "ftDataFalco", "falco/attributes.js"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "falcon/attributes.js"),
    ("Marth", "PlMs.dat", "ftDataMars", "marth/marthAttributes.js"),
    ("Puff", "PlPr.dat", "ftDataPurin", "puff/puffAttributes.js"),
]


def dump(dat, root, index=None):
    cmd = [sys.executable, os.path.join(HERE, "subaction.py"), dat, root]
    if index is not None:
        cmd.append(str(index))
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    print("%-8s %-14s %-16s %s" % ("char", "cmd_vars[0]=1", "dashFrameMin", "agrees"))
    bad = 0
    for name, dat, root, js in CHARS:
        path = os.path.join(datdir, dat)
        if not os.path.exists(path):
            print("  %-8s missing %s" % (name, dat))
            continue
        listing = dump(path, root)
        m = re.search(r"\[\s*(\d+)\]\s+\S*ACTION_Dash_figatree", listing)
        if not m:
            print("  %-8s no Dash subaction found" % name)
            continue
        script = dump(path, root, int(m.group(1)))

        frame = None
        cur = 0
        for line in script.splitlines():
            w = re.search(r"wait_until\s+frames=(\d+)", line)
            if w:
                cur = int(w.group(1))
            if "SET_CMD_VAR" in line and "cmd_vars[0] = 1" in line:
                frame = cur
                break

        src = open(os.path.join(ROOT, "src", "characters", js), encoding="utf8").read()
        mm = re.search(r"dashFrameMin\s*:\s*(\d+)", src)
        have = int(mm.group(1)) if mm else None

        ok = (have is not None and frame is not None and have + 1 == frame)
        if not ok:
            bad += 1
        print("  %-8s %-14s %-16s %s"
              % (name, frame, have, "yes" if ok else "NO"))
    print()
    print("  dashFrameMin is compared as `timer > dashFrameMin`, so it should")
    print("  be exactly one less than the scripted frame.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
