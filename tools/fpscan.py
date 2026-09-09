"""Extract the DOL from a GameCube ISO and scan a function for floating-point
instructions -- specifically the ones that make bit-exact reimplementation hard:
fused multiply-add, Gekko estimate instructions, and paired-singles.
"""
import struct
import sys

# opcode 59 (float single) extended opcodes, bits 26-30
OP59 = {
    18: "fdivs", 20: "fsubs", 21: "fadds", 22: "fsqrts", 24: "fres",
    25: "fmuls", 28: "fmsubs", 29: "fmadds", 30: "fnmsubs", 31: "fnmadds",
}
# opcode 63 (float double / misc)
OP63 = {
    18: "fdiv", 20: "fsub", 21: "fadd", 22: "fsqrt", 23: "fsel", 25: "fmul",
    26: "frsqrte", 28: "fmsub", 29: "fmadd", 30: "fnmsub", 31: "fnmadd",
}
OP63_X = {0: "fcmpu", 12: "frsp", 14: "fctiw", 15: "fctiwz", 32: "fcmpo",
          72: "fmr", 40: "fneg", 264: "fabs", 136: "fnabs"}
LOADSTORE = {48: "lfs", 49: "lfsu", 50: "lfd", 51: "lfdu",
             52: "stfs", 53: "stfsu", 54: "stfd", 55: "stfdu"}

# instructions that break naive float32 emulation
HARD = {"fmadds", "fmsubs", "fnmadds", "fnmsubs",
        "fmadd", "fmsub", "fnmadd", "fnmsub",
        "fres", "frsqrte"}

BLR = 0x4E800020


def u32(b, o):
    return struct.unpack_from(">I", b, o)[0]


def get_dol(iso_path):
    f = open(iso_path, "rb")
    hdr = f.read(0x440)
    dol_off = u32(hdr, 0x420)
    fst_off = u32(hdr, 0x424)
    f.seek(dol_off)
    return f.read(fst_off - dol_off)


def dol_sections(dol):
    secs = []
    for i in range(7):   # text
        off, addr, size = u32(dol, 0x00 + i * 4), u32(dol, 0x48 + i * 4), u32(dol, 0x90 + i * 4)
        if size:
            secs.append(("text%d" % i, off, addr, size))
    for i in range(11):  # data
        off, addr, size = u32(dol, 0x1C + i * 4), u32(dol, 0x64 + i * 4), u32(dol, 0xAC + i * 4)
        if size:
            secs.append(("data%d" % i, off, addr, size))
    return secs


def addr_to_off(secs, addr):
    for name, off, base, size in secs:
        if base <= addr < base + size:
            return off + (addr - base), name
    return None, None


def decode(ins):
    op = ins >> 26
    if op == 4:
        return "ps_* (paired single)", True
    if op == 59:
        xo = (ins >> 1) & 0x1F
        m = OP59.get(xo)
        return (m or "op59.xo=%d" % xo), (m in HARD)
    if op == 63:
        xo5 = (ins >> 1) & 0x1F
        if xo5 in OP63 and xo5 >= 18:
            m = OP63[xo5]
            return m, (m in HARD)
        xo10 = (ins >> 1) & 0x3FF
        m = OP63_X.get(xo10)
        return (m or "op63.xo=%d" % xo10), (m in HARD)
    if op in LOADSTORE:
        return LOADSTORE[op], False
    return None, False


def scan(dol, secs, addr, label, max_ins=200):
    off, sec = addr_to_off(secs, addr)
    if off is None:
        print(f"  !! 0x{addr:08X} not in any section")
        return
    print(f"\n=== {label}  @0x{addr:08X}  ({sec}, file off 0x{off:X}) ===")
    counts, hard_hits, n = {}, [], 0
    for i in range(max_ins):
        ins = u32(dol, off + i * 4)
        n += 1
        m, is_hard = decode(ins)
        if m:
            counts[m] = counts.get(m, 0) + 1
            if is_hard:
                hard_hits.append((addr + i * 4, m))
        if ins == BLR:
            break
    print(f"  {n} instructions (to blr)")
    if counts:
        print("  float ops: " + ", ".join(f"{k}x{v}" for k, v in sorted(counts.items())))
    else:
        print("  float ops: none")
    if hard_hits:
        print("  !! precision-hostile:")
        for a, m in hard_hits:
            print(f"       0x{a:08X}  {m}")
    else:
        print("  -> no FMA / estimate / paired-single ops")


TARGETS = [
    (0x8007D174, "ftCommon_8007D174 (air drift core)"),
    (0x8007D28C, "ftCommon_8007D28C (drift accel setup)"),
    (0x8007D494, "ftCommon_Fall (gravity)"),
    (0x8007D140, "ftCommon_8007D140"),
    (0x8007D0EC, "ftCommon_ApplyFrictionAir (approx)"),
]


def main():
    iso = sys.argv[1]
    dol = get_dol(iso)
    secs = dol_sections(dol)
    print(f"DOL: {len(dol)} bytes, {len(secs)} sections")
    for name, off, base, size in secs:
        print(f"  {name:<7} file 0x{off:07X}  addr 0x{base:08X}  size 0x{size:X}")
    for addr, label in TARGETS:
        scan(dol, secs, addr, label)


if __name__ == "__main__":
    main()
