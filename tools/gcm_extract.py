"""Minimal GameCube (GCM/ISO) filesystem extractor.

Reads the disc header + FST and pulls out named files. No deps.
"""
import struct
import sys
import os

BOOT_FST_OFFSET = 0x424
BOOT_FST_SIZE = 0x428


def u32(b, off):
    return struct.unpack_from(">I", b, off)[0]


class GCM:
    def __init__(self, path):
        self.f = open(path, "rb")
        hdr = self.f.read(0x440)
        self.game_id = hdr[0:6].decode("ascii", "replace")
        self.disc_ver = hdr[7]
        self.title = hdr[0x20:0x60].split(b"\0")[0].decode("ascii", "replace")
        self.fst_off = u32(hdr, BOOT_FST_OFFSET)
        self.fst_size = u32(hdr, BOOT_FST_SIZE)
        self._read_fst()

    def _read_fst(self):
        self.f.seek(self.fst_off)
        fst = self.f.read(self.fst_size)
        num_entries = u32(fst, 8)
        strtab = num_entries * 12
        self.entries = []
        for i in range(num_entries):
            off = i * 12
            flags = fst[off]
            name_off = int.from_bytes(fst[off + 1:off + 4], "big")
            arg1 = u32(fst, off + 4)
            arg2 = u32(fst, off + 8)
            if i == 0:
                name = ""
            else:
                end = fst.index(b"\0", strtab + name_off)
                name = fst[strtab + name_off:end].decode("ascii", "replace")
            self.entries.append(
                {"idx": i, "dir": bool(flags), "name": name,
                 "offset": arg1, "size": arg2})

    def files(self):
        return [e for e in self.entries if not e["dir"]]

    def read(self, entry):
        self.f.seek(entry["offset"])
        return self.f.read(entry["size"])


def main():
    iso, outdir = sys.argv[1], sys.argv[2]
    patterns = sys.argv[3:]
    g = GCM(iso)
    print(f"Game ID : {g.game_id}  (disc revision {g.disc_ver})")
    print(f"Title   : {g.title}")
    print(f"FST     : offset 0x{g.fst_off:X}  size 0x{g.fst_size:X}")
    print(f"Files   : {len(g.files())}")
    print()

    os.makedirs(outdir, exist_ok=True)
    hits = 0
    for e in g.files():
        if patterns and not any(p.lower() in e["name"].lower() for p in patterns):
            continue
        data = g.read(e)
        with open(os.path.join(outdir, e["name"]), "wb") as fh:
            fh.write(data)
        print(f"  extracted {e['name']:<20} {e['size']:>9} bytes  @0x{e['offset']:X}")
        hits += 1
    print(f"\n{hits} file(s) written to {outdir}")


if __name__ == "__main__":
    main()
