"""Match hardcoded decimals in the physics core against named ftCommonData fields.

Melee keeps its input thresholds, deadzones and tuning scalars in ftCommonData,
where each one has a NAME. meleelight inherited a pile of bare decimals in the
same roles. Several have turned out to be subtly wrong -- the movement deadzone
was 0.3 against a real 0.28, tap jump was 0.66/0.69/0.7 across three functions
against a single real 0.6625, crouch was 0.69 against 0.6875 -- and each was
found by hand, one at a time.

This does the search mechanically: every bare decimal literal in the physics
sources is looked up against every float field in ftCommonData, and exact or
near matches are reported with the field's name.

READ THE OUTPUT AS LEADS, NOT VERDICTS. A match is a coincidence until the
decompiled call site says the two are the same quantity. 0.5 matches half a
dozen unrelated fields; 2.0 matches more. The signal is in the NEAR misses --
a literal that is close to a named threshold but not equal to it is either a
rounded copy of that threshold or unrelated, and the decomp settles which.

Fields are resolved structurally through ftLoadCommonData, and names come from
the decomp's own `/* +NNN */ name;` annotations, so this stays correct as the
struct is renamed.

Usage:
    python tools/find_hardcoded.py <datdir> <melee-decomp-checkout>
    python tools/find_hardcoded.py <datdir> <decomp> --near      include near misses
"""
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive

SOURCES = [
    os.path.join("src", "physics"),
    os.path.join("src", "characters"),
]

# Generated data files. hurtbox.js alone holds 1.67 MILLION numbers extracted
# from the disc; ecb.js and the attribute tables are the same kind of thing.
# Scanning them produced 1.78m literals and ~990k "near" hits -- pure noise
# that buried the handful of real leads. They are disc data and are already
# checked by validate_attrs.py / gen_hurtbox.py, not hand-written thresholds.
SKIP_FILES = ("hurtbox.js", "ecb.js", "attributes.js", "marthAttributes.js",
              "puffAttributes.js", "index.js")

# The signal is INPUT THRESHOLDS -- a literal compared against a stick or
# trigger reading. That is where every real bug in this class has been (the
# 0.3 deadzone, tap jump, crouch). A bare decimal anywhere else is almost
# always animation data or a rendering scalar.
# been mangled into a literal backspace twice now (see tools/README.md).
# NB: written via chr(92) on purpose. Spelling the escape inline here has
WORD = chr(92) + "b"   # a word boundary, built from chr(92)
INPUT_RE = re.compile(WORD + "(?:lsX|lsY|rawX|rawY|csX|csY|lA|rA)" + WORD)

# `/*  +70 */ float tap_jump_threshold;` inside struct ftCommonData.
FIELD_RE = re.compile(r"/\*\s*\+([0-9A-Fa-f]+)\s*\*/\s+(?:float|int|s32|u32)\s+(\w+)\s*;")

# A decimal literal that is not part of an identifier, a version string, or an
# array index. Integers are excluded: they match far too much to be useful.
NUM_RE = re.compile(r"(?<![\w.])(\d+\.\d+)(?![\w.])")

# Literals so common they are noise in any codebase.
IGNORE = {0.0, 1.0, 0.5, 2.0, 100.0, 10.0, 0.1, 0.01, 360.0, 180.0, 90.0}


def common_fields(datdir, decomp):
    """{name: value} for every float field of ftCommonData, read off the disc."""
    types_h = os.path.join(decomp, "src", "melee", "ft", "types.h")
    text = open(types_h, encoding="utf-8", errors="replace").read()
    m = re.search(r"struct ftCommonData\s*\{(.*?)\n\};", text, re.S)
    if not m:
        raise SystemExit("!! could not find `struct ftCommonData` in ft/types.h")
    body = m.group(1)

    a = Archive(os.path.join(datdir, "PlCo.dat"))
    root = a.root("ftLoadCommonData")
    base = a.ptr(root + 0x00)
    if base is None:
        raise SystemExit("!! ftLoadCommonData+0x00 is not a relocation")

    out = {}
    for fm in FIELD_RE.finditer(body):
        off = int(fm.group(1), 16)
        name = fm.group(2)
        if base + off + 4 > a.data_size:
            continue
        raw = a.d_u32(base + off)
        val = struct.unpack(">f", struct.pack(">I", raw))[0]
        # Plausible tuning scalars only; a garbage reinterpretation of an int
        # field shows up as a denormal or an enormous number.
        if val != val or abs(val) > 1e6 or (val != 0 and abs(val) < 1e-6):
            continue
        out[name] = (off, val)
    return out


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir, decomp = sys.argv[1], sys.argv[2]
    near = "--near" in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    fields = common_fields(datdir, decomp)
    print(f"{len(fields)} named float fields in ftCommonData\n")

    exact = {}
    close = {}
    total = 0
    f32_cache = {}
    field_list = [(n, o, fv) for n, (o, fv) in fields.items()]
    for sub in SOURCES:
        for dirpath, _d, files in os.walk(os.path.join(root, sub)):
            for f in sorted(files):
                if not f.endswith(".js") or f in SKIP_FILES:
                    continue
                p = os.path.join(dirpath, f)
                rel = os.path.relpath(p, root).replace("\\", "/")
                for ln, line in enumerate(open(p, encoding="utf-8",
                                               errors="replace"), 1):
                    if line.lstrip().startswith(("//", "*", "/*")):
                        continue
                    if not INPUT_RE.search(line):
                        continue
                    for nm in NUM_RE.finditer(line):
                        v = float(nm.group(1))
                        if v in IGNORE:
                            continue
                        total += 1
                        # Convert to float32 ONCE per literal, not once per
                        # field -- the naive nesting is ~450 struct calls per
                        # literal and takes minutes.
                        if v not in f32_cache:
                            f32_cache[v] = struct.unpack(">f", struct.pack(">f", v))[0]
                        f32v = f32_cache[v]
                        for name, off, fv in field_list:
                            if f32v == fv:
                                exact.setdefault((rel, ln, v), []).append((name, off, fv))
                            elif abs(v - fv) <= 0.03 and abs(v) <= 1.5:
                                close.setdefault((rel, ln, v), []).append((name, off, fv))

    print(f"scanned {total} decimal literal(s) in the physics sources\n")

    # A literal that is CLOSE to a named field but not equal is the interesting
    # case: either a rounded copy of it, or a coincidence. Report these first.
    only_close = {k: v for k, v in close.items() if k not in exact}
    print(f"=== {len(only_close)} literal(s) NEAR a named field but not equal "
          f"-- the lead worth chasing:")
    for (rel, ln, v), hits in sorted(only_close.items()):
        names = ", ".join(f"{n} (+0x{o:03X}) = {fv!r}" for n, o, fv in hits[:3])
        print(f"  {rel}:{ln}  {v}  ~  {names}")

    if near:
        print(f"\n=== {len(exact)} literal(s) matching a named field EXACTLY "
              f"(mostly coincidence -- verify at the call site):")
        for (rel, ln, v), hits in sorted(exact.items()):
            names = ", ".join(n for n, _o, _f in hits[:4])
            print(f"  {rel}:{ln}  {v}  =  {names}")
    else:
        print(f"\n{len(exact)} literal(s) match a field exactly; pass --near to list them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
