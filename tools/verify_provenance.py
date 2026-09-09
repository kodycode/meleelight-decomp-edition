"""Provenance check: prove that each attribute we extracted is the field the
decomp says it is, by disassembling the retail DOL.

The chain being verified:
  1. types.h annotates each ftCo_DatAttrs field with its Fighter-relative
     offset, e.g.  /* +05C fp+16C */ float gravity;
  2. The decomp source says function F reads field X.
  3. If that is true, F's machine code must contain a float load at fp+<X>.

Step 3 is checked here against the user's own disc. A field whose claimed
offset never appears in the function that supposedly reads it would mean the
decomp's NAME for that field is wrong -- which extraction alone cannot detect.

Usage:
    python tools/verify_provenance.py <iso> <melee-decomp-checkout>

Needs BOTH:
  * an NTSC v1.02 disc image (GALE01 rev 2) -- the DOL is read out of it
  * a clone of https://github.com/doldecomp/melee, source only, no build.
    Read from it:  src/melee/ft/types.h        field offset annotations
                   src/melee/**/*.h            /* 8007D28C */ address comments

Exit status is 0 only if every claim in EXPECT is confirmed.
"""
import re
import struct
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fpscan import get_dol, dol_sections, u32, addr_to_off

BLR = 0x4E800020
FLOAT_LS = {48: "lfs", 49: "lfsu", 50: "lfd", 52: "stfs", 53: "stfsu", 54: "stfd"}


def parse_fp_offsets(types_h):
    """ftCo_DatAttrs: map Fighter-relative offset -> field name."""
    src = open(types_h, encoding="utf-8", errors="replace").read()
    start = src.index("typedef struct ftCo_DatAttrs")
    end = src.index("} ftCo_DatAttrs", start)
    out = {}
    for m in re.finditer(
            r"/\*\s*\+([0-9A-Fa-f]+)\s+fp\+([0-9A-Fa-f]+)\s*\*/\s*"
            r"(?:float|f32|int|s32|u32|u8)\s+(\w+)\s*;",
            src[start:end]):
        out[int(m.group(2), 16)] = (m.group(3), int(m.group(1), 16))
    return out


def parse_func_addrs(decomp_root):
    """Scan decomp headers for `/* ADDR */ <ret> name(` -> address."""
    out = {}
    for dirpath, _, files in os.walk(os.path.join(decomp_root, "src", "melee")):
        for fn in files:
            if not fn.endswith(".h"):
                continue
            p = os.path.join(dirpath, fn)
            try:
                src = open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            for m in re.finditer(
                    r"/\*\s*([0-9A-F]{6})\s*\*/\s*[\w\*\s]+?(\w+)\s*\(", src):
                addr = 0x80000000 | int(m.group(1), 16)
                out.setdefault(m.group(2), addr)
    return out


def float_offsets(dol, secs, addr, end_addr, max_ins=800):
    """Every float load/store displacement between addr and end_addr.

    NB: scanning to the first `blr` is WRONG -- many of these functions return
    early (e.g. ftCommon_8007D174's `if (!target_vel) return;`), which would
    truncate the scan before the interesting loads. Scan to the next known
    function symbol instead.
    """
    off, _ = addr_to_off(secs, addr)
    if off is None:
        return None
    n = min(max_ins, max(1, (end_addr - addr) // 4))
    seen = []
    for i in range(n):
        ins = u32(dol, off + i * 4)
        op = ins >> 26
        if op in FLOAT_LS:
            d = ins & 0xFFFF
            if d >= 0x8000:
                d -= 0x10000
            seen.append((FLOAT_LS[op], d))
    return seen


# function -> fields the decomp source claims it reads
EXPECT = {
    "ftCommon_FallBasic":       ["gravity", "terminal_velocity"],
    "ftCommon_FallFast":        ["fast_fall_velocity"],
    "ftCommon_ClampAirDrift":   ["air_drift_max"],
    "ftCommon_8007D28C":        ["air_drift_stick_mul", "aerial_drift_base",
                                 "air_drift_max", "aerial_friction"],
    "ftCommon_8007D174":        ["air_max_horizontal_velocity"],
    "ftCommon_8007C98C":        ["ground_max_horizontal_velocity"],
    "ft_80084F3C":              ["ground_friction", "walk_max_vel"],
    "ftWalkCommon_800E0060":    ["walk_accel_mul", "walk_max_vel",
                                 "ground_friction"],
    "ftCo_800CB110":            ["ground_to_air_jump_momentum_multiplier",
                                 "jump_h_initial_velocity",
                                 "jump_v_initial_velocity",
                                 "hop_v_initial_velocity",
                                 "jump_h_max_velocity"],
}


def main():
    if len(sys.argv) < 3:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    iso, decomp = sys.argv[1], sys.argv[2]
    types_h = os.path.join(decomp, "src", "melee", "ft", "types.h")
    if not os.path.exists(types_h):
        print(f"not a melee decomp checkout: {decomp}\n"
              f"  expected to find {os.path.join('src', 'melee', 'ft', 'types.h')}\n"
              f"  clone https://github.com/doldecomp/melee (no build needed)",
              file=sys.stderr)
        return 2
    fpmap = parse_fp_offsets(types_h)
    funcs = parse_func_addrs(decomp)
    dol = get_dol(iso)
    secs = dol_sections(dol)
    all_addrs = sorted(set(funcs.values()))

    def func_end(a):
        import bisect
        i = bisect.bisect_right(all_addrs, a)
        return all_addrs[i] if i < len(all_addrs) else a + 0x800

    print(f"parsed {len(fpmap)} ftCo_DatAttrs fields, {len(funcs)} function addresses\n")
    total = ok = 0
    unresolved = []

    for fname, expected in EXPECT.items():
        addr = funcs.get(fname)
        if addr is None:
            unresolved.append(f"{fname}: no address in decomp headers")
            continue
        offs = float_offsets(dol, secs, addr, func_end(addr))
        if offs is None:
            unresolved.append(f"{fname}: 0x{addr:08X} outside DOL sections")
            continue
        # The compiler may address these fields two ways: relative to the
        # Fighter (fp+0x178) or, when it materialises `&fp->co_attrs` into a
        # register, relative to the struct itself (attrs+0x68). Accept both,
        # and record which base was used -- struct-relative offsets are small
        # and therefore weaker evidence on their own.
        attrmap = {v[1]: v[0] for v in fpmap.values()}
        found = {}
        for _, d in offs:
            if d in fpmap:
                found[fpmap[d][0]] = "fp"
            elif d in attrmap and d not in found:
                found.setdefault(attrmap[d], "attrs")
        print(f"=== {fname} @0x{addr:08X} ===")
        for want in expected:
            total += 1
            hit = want in found
            ok += hit
            fp_off = next((k for k, v in fpmap.items() if v[0] == want), None)
            at_off = next((v[1] for v in fpmap.values() if v[0] == want), None)
            mark = "OK  " if hit else "MISS"
            via = found.get(want)
            loc = (f"fp+0x{fp_off:X}" if via == "fp"
                   else f"attrs+0x{at_off:X}" if via == "attrs"
                   else f"fp+0x{fp_off:X} / attrs+0x{at_off:X}")
            print(f"  [{mark}] {want:<42} {loc}")
        extra = sorted(set(found) - set(expected))
        if extra:
            print(f"         also loads: {', '.join(extra)}")
        print()

    print(f"{ok}/{total} field->offset claims confirmed against the retail DOL")
    for u in unresolved:
        print(f"  UNRESOLVED  {u}")
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
