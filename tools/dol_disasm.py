"""Disassemble a function out of the retail DOL, with its constants resolved.

Some things the decompilation does not have, the SHIPPED BINARY does. The MSL
math functions are the case that prompted this: `src/MSL/math.h` declares
atan2f, acosf, asinf and atanf, no definition appears anywhere in the decomp's
sources, and the decomp ships no assembly for them either -- so they were
written off as permanently unavailable.

They are in the DOL, and the decomp's own symbol map says exactly where:

    grep -E '^(atan2f|acosf|asinf|atanf) = ' config/GALE01/symbols.txt
    atan2f = .text:0x80022C30; // type:function size:0xEC scope:global

That is enough to read them out. This tool does that, and resolves the two
things that make raw PowerPC unreadable:

  * SDA2-relative loads. `lfs f0, -0x7c30(r2)` means nothing until you know r2.
    __init_registers (0x80005340) sets it, and this tool reads it from there
    rather than hardcoding it, so it stays right if the binary changes.
  * Gekko paired-single opcodes, which are not standard PowerPC and stop
    capstone dead. Unknown words are printed as data and skipped rather than
    ending the listing -- capstone gave up 12 instructions into a 125
    instruction function without this.

    python tools/dol_disasm.py <iso> 0x80022C30 0xEC
    python tools/dol_disasm.py <iso> atan2f --symbols <decomp>/config/GALE01/symbols.txt
    python tools/dol_disasm.py <iso> --floats 0x804D7DB0 40

Needs `capstone` (pip install capstone). Everything else in tools/ has no
third-party dependencies; this one does, which is why it is a separate tool
rather than part of fpscan.py.
"""
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fpscan import get_dol, dol_sections, addr_to_off

# fcmpu/fcmpo are X-form under primary opcode 63 and capstone declines some of
# the Gekko encodings, so they are decoded here by hand.
CMP_XO = {0: "fcmpu", 32: "fcmpo"}


def sda2_base(dol, secs):
    """r2, read out of __init_registers rather than assumed.

    The sequence is `lis r2, hi` / `ori r2, r2, lo` at 0x80005348, so the base
    is recovered from those two immediates.
    """
    off, _ = addr_to_off(secs, 0x80005340)
    if off is None:
        return None
    words = struct.unpack(">7I", dol[off:off + 28])
    hi = lo = None
    for w in words:
        op = w >> 26
        rt = (w >> 21) & 0x1F
        if op == 15 and rt == 2:                 # lis r2, imm
            hi = w & 0xFFFF
        elif op == 24 and ((w >> 21) & 0x1F) == 2:   # ori r2, r2, imm
            lo = w & 0xFFFF
    if hi is None or lo is None:
        return None
    return ((hi << 16) | lo) & 0xFFFFFFFF


def read_f32(dol, secs, addr):
    off, _ = addr_to_off(secs, addr)
    if off is None:
        return None
    return struct.unpack(">f", dol[off:off + 4])[0]


def disassemble(dol, secs, addr, size, sda2=None):
    import capstone
    md = capstone.Cs(capstone.CS_ARCH_PPC,
                     capstone.CS_MODE_32 | capstone.CS_MODE_BIG_ENDIAN)
    off, sec = addr_to_off(secs, addr)
    if off is None:
        raise KeyError(f"{addr:#x} is not in any DOL section")
    code = dol[off:off + size]
    out = []
    i = 0
    while i < size:
        word = code[i:i + 4]
        got = list(md.disasm(word, addr + i))
        if not got:
            w = struct.unpack(">I", word)[0]
            xo = (w >> 1) & 0x3FF
            if (w >> 26) == 63 and xo in CMP_XO:
                frA, frB = (w >> 16) & 0x1F, (w >> 11) & 0x1F
                text = f"{CMP_XO[xo]:<9} cr{(w >> 23) & 7}, f{frA}, f{frB}"
            else:
                text = f"{'.4byte':<9} {w:#010x}   ; undecoded, primary op {w >> 26}"
            out.append((addr + i, text))
            i += 4
            continue
        ins = got[0]
        text = f"{ins.mnemonic:<9} {ins.op_str}"
        if sda2 is not None and "(r2)" in ins.op_str:
            m = re.search(r"(-?(?:0x)?[0-9a-fA-F]+)\(r2\)", ins.op_str)
            if m:
                disp = int(m.group(1), 16) if "x" in m.group(1) else int(m.group(1))
                a = (sda2 + disp) & 0xFFFFFFFF
                v = read_f32(dol, secs, a)
                if v is not None:
                    text += f"      ; {a:#x} = {v!r}"
        out.append((ins.address, text))
        i += ins.size
    return sec, out


def lookup(symbols, name):
    src = open(symbols, encoding="utf-8", errors="replace").read()
    m = re.search(r"^" + re.escape(name) + r"\s*=\s*\.\w+:(0x[0-9A-Fa-f]+);"
                  r"[^\n]*size:(0x[0-9A-Fa-f]+)", src, re.M)
    if not m:
        return None
    return int(m.group(1), 16), int(m.group(2), 16)


def main():
    args = [a for a in sys.argv[1:]]
    if len(args) < 2:
        print(__doc__.split("    python")[1].strip(), file=sys.stderr)
        return 2
    iso = args.pop(0)
    dol = get_dol(iso)
    secs = dol_sections(dol)
    sda2 = sda2_base(dol, secs)

    if args[0] == "--floats":
        addr = int(args[1], 0)
        count = int(args[2]) if len(args) > 2 else 16
        for k in range(count):
            a = addr + k * 4
            off, sec = addr_to_off(secs, a)
            if off is None:
                print(f"  {a:#x}  <not in DOL>")
                continue
            raw = dol[off:off + 4]
            print(f"  {a:#x} ({sec})  bits {struct.unpack('>I', raw)[0]:#010x}"
                  f"  = {struct.unpack('>f', raw)[0]!r}")
        return 0

    target = args.pop(0)
    if target.startswith("0x"):
        addr = int(target, 16)
        size = int(args.pop(0), 0) if args else 0x100
    else:
        if "--symbols" not in args:
            print("a function NAME needs --symbols <symbols.txt>", file=sys.stderr)
            return 2
        found = lookup(args[args.index("--symbols") + 1], target)
        if found is None:
            print(f"{target} not in the symbol map", file=sys.stderr)
            return 1
        addr, size = found

    sec, lines = disassemble(dol, secs, addr, size, sda2)
    print(f"{target} @ {addr:#x}  ({sec}, {size} bytes, r2 = {sda2:#x})")
    for a, text in lines:
        print(f"  {a:08x}  {text}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
