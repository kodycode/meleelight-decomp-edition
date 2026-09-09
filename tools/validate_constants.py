"""Re-derive every constant in meleeCommon.js from the user's ISO and compare.

The constants in src/physics/meleeCommon.js were transcribed by hand from
extraction output. Transcription is exactly the kind of step that silently
introduces a wrong digit, and no amount of decomp-citation catches it.

This closes that loop: parse the committed values and their documented struct
offsets straight out of the JS, resolve ftCommonData STRUCTURALLY through the
archive (ftLoadCommonData +0x00), and assert every committed value equals what
the disc actually holds.

Constants annotated with an offset comment (// xNNN) are checked. Anything
without one is reported as UNVERIFIED rather than silently passing.
"""
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR

# NB: [ 	]* not \s* before the comment group. \s matches newlines, which lets
# the "trailing comment" capture a comment belonging to a LATER constant --
# producing confident, entirely bogus mismatches.
CONST_RE = re.compile(
    r"^export const (\w+)[ 	]*=[ 	]*(-?[0-9][0-9eE.+-]*)[ 	]*;[ 	]*(?://[ 	]*(.*))?$",
    re.M)
OFF_RE = re.compile(r"\bx([0-9A-Fa-f]{2,3})\b")


def main():
    js_path, dat_path = sys.argv[1], sys.argv[2]
    src = open(js_path, encoding="utf-8").read()

    a = Archive(dat_path)
    root = a.root("ftLoadCommonData")
    base = a.ptr(root + 0x00)
    if base is None:
        print("!! could not resolve ftCommonData from ftLoadCommonData+0x00")
        return 1
    print(f"ftCommonData resolved structurally -> data+0x{base:X} "
          f"(file 0x{base + HDR:X})\n")

    checked = ok = 0
    mismatches = []
    unverified = []

    for m in CONST_RE.finditer(src):
        name, val_s, comment = m.group(1), m.group(2), (m.group(3) or "")
        committed = float(val_s)
        om = OFF_RE.search(comment)
        if not om:
            unverified.append(name)
            continue
        off = int(om.group(1), 16)
        checked += 1

        as_f = struct.unpack_from(">f", a.raw, HDR + base + off)[0]
        as_i = struct.unpack_from(">i", a.raw, HDR + base + off)[0]

        if as_f == committed:
            ok += 1
            kind = "f32"
        elif as_i == committed:
            ok += 1
            kind = "int"
        else:
            mismatches.append((name, off, committed, as_f, as_i))
            continue
        print(f"  OK   {name:<38} +0x{off:03X}  {kind}  {committed!r}")

    print()
    if mismatches:
        print(f"{len(mismatches)} MISMATCH(ES):")
        for name, off, committed, as_f, as_i in mismatches:
            print(f"  {name}  +0x{off:03X}")
            print(f"     committed : {committed!r}")
            print(f"     disc f32  : {as_f!r}")
            print(f"     disc int  : {as_i}")
    print(f"{ok}/{checked} annotated constants match the disc")
    if unverified:
        print(f"\n{len(unverified)} constant(s) carry no offset annotation "
              f"and were NOT checked:")
        for n in unverified:
            print(f"    {n}")
    return 0 if not mismatches else 1


if __name__ == "__main__":
    sys.exit(main())
