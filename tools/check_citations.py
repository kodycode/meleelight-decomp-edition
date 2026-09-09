"""Verify `Symbol (file.c:LINE)` citations against the decomp, and say where
they moved when they drift.

The port cites the decompilation constantly -- that is the whole discipline --
but the decomp is ACTIVELY DEVELOPED. A `git pull` renames a function, an
inline gets expanded, and every line number below it shifts. The citation still
looks authoritative and now points at a closing brace.

That is exactly what happened: one pull moved `ftaction.c:1252` (cited as the
smash-charge event handler) and `fighter.c:2966` (cited as the hitlag call) off
their targets, while `fighter.c:191` and `:1198` stayed put. Nothing in the
build would ever have noticed.

HOW IT CHECKS. Only citations of the form `Symbol (file.c:LINE)` or
`Symbol (file.c:LO-HI)` are checkable, and only when `Symbol` is a function
DEFINED in that file. For those, the function's line range is recovered by
brace matching from its definition, and the cited line must fall inside it. A
citation that misses is reported together with the range it should now be, so
the fix is mechanical.

Deliberately NOT checked:
  * bare `file.c:LINE` with no symbol -- nothing to anchor against
  * `Symbol (file.c)` with no line -- nothing to drift
  * a Symbol that is not a function definition in that file (`self_vel`,
    `state`, `branch` and other ordinary words that precede a parenthesis)
These are reported as UNCHECKABLE with a count, not silently skipped, because a
checker that quietly ignores what it does not understand is worse than one that
admits the gap.

Usage:
    python tools/check_citations.py <melee-decomp-checkout>
    python tools/check_citations.py <melee-decomp-checkout> --verbose
"""
import os
import re
import sys

# `Foo_Bar (baz.c:123)` or `Foo_Bar (baz.c:123-145)`. The symbol must look like
# a C identifier; the file must have a .c or .h suffix.
CITE_RE = re.compile(
    r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([A-Za-z_0-9]+\.[ch]):(\d+)(?:-(\d+))?\)")

# A function definition at the start of a line: an optional return type, then
# the name, then an open paren. Excludes calls (which are indented) and
# prototypes (which end in `;`).
def func_ranges(text):
    """{name: (start_line, end_line)} for every function defined in `text`."""
    lines = text.split("\n")
    out = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^[A-Za-z_][A-Za-z0-9_ \*]*?\b([A-Za-z_][A-Za-z0-9_]*)\s*\(",
                     line)
        if not m or line.rstrip().endswith(";"):
            i += 1
            continue
        # Walk forward to the opening brace, then brace-match to the end.
        j = i
        depth = 0
        started = False
        while j < len(lines) and j < i + 400:
            depth += lines[j].count("{") - lines[j].count("}")
            if "{" in lines[j]:
                started = True
            if started and depth <= 0:
                break
            j += 1
        if started:
            # 1-indexed, inclusive.
            out.setdefault(m.group(1), (i + 1, j + 1))
            i = j + 1
        else:
            i += 1
    return out


def index_decomp(decomp):
    """basename -> full path, for every .c/.h under src/ and include/."""
    idx = {}
    dupes = set()
    for root in ("src", "include", "extern"):
        base = os.path.join(decomp, root)
        if not os.path.isdir(base):
            continue
        for dirpath, _dirs, files in os.walk(base):
            for f in files:
                if f.endswith((".c", ".h")):
                    if f in idx:
                        dupes.add(f)
                    idx.setdefault(f, os.path.join(dirpath, f))
    return idx, dupes


def main():
    if len(sys.argv) < 2:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    decomp = sys.argv[1]
    verbose = "--verbose" in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    idx, dupes = index_decomp(decomp)
    if not idx:
        print(f"!! no decomp sources found under {decomp}", file=sys.stderr)
        return 2

    # Cache per decomp file: text and function ranges.
    cache = {}

    def ranges_for(fname):
        if fname not in cache:
            path = idx.get(fname)
            if path is None:
                cache[fname] = None
            else:
                text = open(path, encoding="utf-8", errors="replace").read()
                cache[fname] = func_ranges(text)
        return cache[fname]

    checked = ok = 0
    drifted = []
    missing_file = []
    uncheckable = 0

    for dirpath, _dirs, files in os.walk(os.path.join(root, "src")):
        for f in sorted(files):
            if not f.endswith(".js"):
                continue
            p = os.path.join(dirpath, f)
            rel = os.path.relpath(p, root).replace("\\", "/")
            text = open(p, encoding="utf-8", errors="replace").read()
            for ln, line in enumerate(text.split("\n"), 1):
                for m in CITE_RE.finditer(line):
                    sym, fname = m.group(1), m.group(2)
                    lo = int(m.group(3))
                    hi = int(m.group(4)) if m.group(4) else lo
                    fr = ranges_for(fname)
                    if fr is None:
                        missing_file.append((rel, ln, sym, fname))
                        continue
                    if sym not in fr:
                        uncheckable += 1
                        continue
                    start, end = fr[sym]
                    checked += 1
                    # The citation may point anywhere inside the function, and
                    # a range citation often starts at its leading comment.
                    if start - 12 <= lo <= end and start - 12 <= hi <= end:
                        ok += 1
                    else:
                        drifted.append((rel, ln, sym, fname, lo, hi, start, end))

    print(f"{ok}/{checked} symbol-anchored citations resolve correctly")
    if uncheckable:
        print(f"  {uncheckable} citation(s) not checkable "
              f"(the name is not a function defined in the cited file)")
    if dupes and verbose:
        print(f"  {len(dupes)} ambiguous basename(s) in the decomp: "
              f"{', '.join(sorted(dupes)[:6])}")

    for rel, ln, sym, fname, lo, hi, start, end in missing_file:
        print(f"  MISSING FILE  {rel}:{ln}  {sym} ({fname}) -- no such file "
              f"in the decomp")

    for rel, ln, sym, fname, lo, hi, start, end in drifted:
        cited = f"{lo}" if lo == hi else f"{lo}-{hi}"
        print(f"  DRIFTED  {rel}:{ln}")
        print(f"           cites {sym} ({fname}:{cited}) but {sym} is now "
              f"{fname}:{start}-{end}")

    return 1 if (drifted or missing_file) else 0


if __name__ == "__main__":
    sys.exit(main())
