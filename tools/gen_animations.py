"""Generate the animation frames meleelight is missing, from the disc.

meleelight's src/animations/<char>/<STATE>.js is one traced vector outline per
frame. Correcting the frame counts against the figatree headers
(validate_frames.py, 193/193) made a number of states longer than their
recorded outlines, and render.js then had no pose to draw -- the character
blinked out. 48 character/state pairs are short, three of them badly:

    Falcon FURASLEEPLOOP   110 frames, 20 outlines
    Puff   DAMAGEN2         24 frames, 11 outlines
    Puff   SHIELDBREAKFALL  30 frames, 27 outlines

This poses the costume model at the missing frames and traces the silhouette
the same shape the recorded frames describe. RECORDED FRAMES ARE NEVER
TOUCHED: only frames past the end of the existing array are appended, so every
hand-traced outline in the project is preserved exactly.

BEFORE WRITING ANYTHING it re-generates frames that already exist and measures
intersection-over-union against them. A state whose existing frames cannot be
reproduced is skipped rather than extended, because a generator that cannot
match the neighbours has no business inventing what comes next.

    python tools/gen_animations.py tools/dat            # report only
    python tools/gen_animations.py tools/dat --write
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ecb import CHARS, joint_root, model_scale
from figatree import AJ, subaction_anims
from model import Mesh
from skeleton import load_skeleton, pose
import silhouette as S

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_STAGE_SCALE = 4.5      # render.js:247

# Trace at a finer grid than the output units, so the contour is not blocky.
TRACE_RES = 3.0
# RDP tolerance in path units. Recorded outlines carry roughly 50-60 vertices;
# this lands in the same range rather than emitting every boundary cell.
SIMPLIFY_TOL = 1.1
# A state whose existing frames cannot be reproduced this well is left alone.
MIN_IOU = 0.70

ATTR_FILE = {"Marth": "marth/marthAttributes.js", "Puff": "puff/puffAttributes.js"}

# meleelight state -> Melee subaction, for the states that need extending.
SUBACTION = {
    "FURASLEEPLOOP": "FuraSleepLoop", "FURAFURA": "FuraFura",
    "DAMAGEN2": "DamageN2", "SHIELDBREAKFALL": "DamageFall",
    "SQUAT": "Squat", "DASH": "Dash",
    "ESCAPEF": "EscapeF", "ESCAPEB": "EscapeB", "ESCAPEN": "EscapeN",
    "DOWNSTANDF": "DownFowardU", "DOWNSTANDB": "DownBackU",
    "DOWNSTANDN": "DownStandU", "CLIFFCATCH": "CliffCatch",
}


def char_scale(char):
    path = os.path.join(ROOT, "src", "characters",
                        ATTR_FILE.get(char, char.lower() + "/attributes.js"))
    m = re.search(r"charScale\s*:\s*([0-9.]+)", open(path, encoding="utf8").read())
    return float(m.group(1))


def frame_counts(char):
    path = os.path.join(ROOT, "src", "characters",
                        ATTR_FILE.get(char, char.lower() + "/attributes.js"))
    txt = open(path, encoding="utf8").read()
    out = {}
    for m in re.finditer(r'"([A-Z0-9_]+)"\s*:\s*(\d+)\s*,', txt):
        out.setdefault(m.group(1), int(m.group(2)))
    return out


def anim_path(char, state):
    return os.path.join(ROOT, "src", "animations", char.lower(), state + ".js")


def load_frames(char, state):
    p = anim_path(char, state)
    if not os.path.exists(p):
        return None
    js = ("const a=require(%s);"
          "console.log(JSON.stringify(a.map(f=>f.map(q=>Array.from(q)))));"
          % json.dumps(p.replace("\\", "/")))
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True,
                         cwd=ROOT)
    out.check_returncode()
    return json.loads(out.stdout)


def write_frames(char, state, frames):
    body = ",".join(
        "[" + ",".join("new Int16Array([" + ",".join(str(int(v)) for v in poly)
                       + "])" for poly in fr) + "]"
        for fr in frames)
    with open(anim_path(char, state), "w", encoding="utf8", newline="") as f:
        f.write("module.exports = [" + body + "];")


# FtPart_TransN (ft/forward.h Fighter_Part): TopN is 0, TransN is 1.
TRANS_N = 1


def build_frame(mesh, joints, aj, off, size, frame, mscale, scale):
    """One silhouette, as meleelight's path format.

    Vertices are taken RELATIVE TO TransN, not to the world origin. Melee's
    animations carry the character's own translation in the root joints, but
    meleelight moves the fighter itself (setVelocities and the state's own
    position code) and draws the outline at that position -- so leaving the
    root translation in the geometry counts it twice. bake_offsets.py takes
    the same subtraction for hitboxes: "bone_world * b_offset - TransN".
    """
    world = pose(joints, aj, off, size, frame, root_scale=mscale)
    tris = mesh.world_triangles(world)
    if TRANS_N < len(world):
        o = (world[TRANS_N][0][3], world[TRANS_N][1][3], world[TRANS_N][2][3])
        tris = [tuple((p[0] - o[0], p[1] - o[1], p[2] - o[2]) for p in t)
                for t in tris]
    tris2d = S.project(tris, scale)
    if not tris2d:
        return None, None
    mask, w, h, ox, oy, res = S.rasterize(tris2d, TRACE_RES)
    mask = S.fill_holes(mask, w, h)
    mask = S.largest_component(mask, w, h)
    contour = S.trace_contour(mask, w, h)
    if len(contour) < 8:
        return None, (mask, w, h, ox, oy, res)
    pts = [(ox + cx / res, oy + cy / res) for cx, cy in contour]
    pts = S.simplify(pts, SIMPLIFY_TOL)
    return S.to_path(pts), (mask, w, h, ox, oy, res)


def main():
    datdir = sys.argv[1] if len(sys.argv) > 1 else "tools/dat"
    write = "--write" in sys.argv
    only = [a for a in sys.argv[2:] if not a.startswith("--")]

    total_added = 0
    for char in ["Marth", "Puff", "Fox", "Falco", "Falcon"]:
        if only and char not in only:
            continue
        dat, root, ajn, nr = CHARS[char]
        costume = os.path.join(datdir, nr)
        joints = load_skeleton(costume, joint_root(costume))
        mesh = Mesh(costume, joint_root(costume), [j.off for j in joints])
        aj = AJ(os.path.join(datdir, ajn))
        anims = subaction_anims(os.path.join(datdir, dat), root)
        mscale = model_scale(datdir, dat, root)
        declared_scale = REF_STAGE_SCALE / char_scale(char)
        counts = frame_counts(char)

        for state, sub in sorted(SUBACTION.items()):
            want = counts.get(state)
            if want is None or sub not in anims:
                continue
            rec = load_frames(char, state)
            if rec is None or len(rec) >= want:
                continue
            off, size = anims[sub]

            # CALIBRATE THE SCALE AGAINST THIS STATE'S OWN RECORDED FRAMES.
            #
            # render.js:247 gives scale = stage.scale / charScale, and for
            # four of the five characters that matches the recorded art to
            # within 1.5% (Fox 1.004, Falcon 1.012, Falco 0.986, Marth 0.969).
            # Puff is the exception at 1.199: her outlines were traced at an
            # implied charScale of 0.20, not the 0.240 her attributes carry.
            #
            # New frames have to sit alongside the recorded ones, so the
            # trace's own scale is what matters, not the declared one. Fitted
            # from bounding-box HEIGHT, which is stable -- width is thrown off
            # by a cape hanging differently from frame to frame.
            scale = declared_scale
            fits = []
            for f in range(max(1, len(rec) - 3), len(rec) + 1):
                p, _ = build_frame(mesh, joints, aj, off, size, f, mscale, 1.0)
                if p is None:
                    continue
                gp = S.flatten_path(p)
                rp = []
                for q in rec[f - 1]:
                    rp += S.flatten_path(q)
                gh = max(y for _, y in gp) - min(y for _, y in gp)
                rh = max(y for _, y in rp) - min(y for _, y in rp)
                if gh > 1e-6:
                    fits.append(rh / gh)
            # Keep the fit only if it actually REPRODUCES BETTER than the
            # declared scale. That settles Puff and Marth without a hand-picked
            # rule: Puff's declared scale is genuinely 20% wrong, so her fit
            # wins outright; Marth's is already good and his cape (19 of his 90
            # joints carry no animation tracks, so it is runtime-driven) only
            # adds noise to a height fit, so his declared scale wins.
            # MEASURE THE TAIL, NOT THE OPENING. Melee blends into a motion
            # state from whatever pose preceded it (Fighter_ChangeMotionState
            # takes a blend count), so an animation's first frames depend on
            # where the fighter came from and cannot be reproduced from the
            # figatree alone. DamageN2 shows it plainly: frame 1 reproduces at
            # 0.33 and frame 2 at 0.44, while frames 3-6 sit at 0.70-0.76 on a
            # clean diagonal.
            #
            # Frames are only ever appended to the END, so the end is what a
            # new frame has to match.
            lo = max(1, len(rec) - 3)

            def reproduce(sc):
                vals = []
                for f in range(lo, len(rec) + 1):
                    path, _ = build_frame(mesh, joints, aj, off, size, f,
                                          mscale, sc)
                    if path is None:
                        continue
                    recpts = []
                    for p in rec[f - 1]:
                        recpts += S.flatten_path(p)
                    genpts = S.flatten_path(path)
                    allp = recpts + genpts
                    b = (min(p[0] for p in allp), max(p[0] for p in allp),
                         min(p[1] for p in allp), max(p[1] for p in allp))
                    _, w, h, ox, oy, res = S.rasterize([], 1.0, b)
                    vals.append(S.iou(
                        S.polygon_mask(genpts, w, h, ox, oy, res),
                        S.polygon_mask(recpts, w, h, ox, oy, res)))
                return (sum(vals) / len(vals)) if vals else 0.0

            mean_iou = reproduce(declared_scale)
            if fits:
                fits.sort()
                cand = fits[len(fits) // 2]
                cand_iou = reproduce(cand)
                if cand_iou > mean_iou:
                    scale, mean_iou = cand, cand_iou

            missing = want - len(rec)
            status = "ok" if mean_iou >= MIN_IOU else "SKIPPED (low IoU)"
            print("  %-7s %-16s %3d -> %3d  (+%2d)  reproduce IoU=%.3f  %s"
                  % (char, state, len(rec), want, missing, mean_iou, status))
            if mean_iou < MIN_IOU:
                continue

            new = list(rec)
            for f in range(len(rec) + 1, want + 1):
                path, _ = build_frame(mesh, joints, aj, off, size, f, mscale, scale)
                if path is None:
                    new.append(list(rec[-1]))
                else:
                    new.append([path])
            if write:
                write_frames(char, state, new)
            total_added += missing

    print()
    print("  %d frames %s" % (total_added, "written" if write else "to add"))
    if total_added and not write:
        print("  (report only -- pass --write to apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
