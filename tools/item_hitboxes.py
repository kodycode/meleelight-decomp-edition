"""Decode item/article hitboxes out of ItCo.dat.

Chain, from the decomp:
    root "itPublicData" -> it_804D6D20_t   (src/melee/it/it_3F14.h:22)
        +0x00 ItemCommonData*
        +0x04 Article**      three article tables
        +0x08 Article**
        +0x0C Article**
    Article               (src/melee/it/types.h:189)
        +0x00 ItemAttr*     physics only -- NO hitbox fields
        +0x0C ItemStateArray*
    ItemStateArray        (types.h:155) = ItemStateDesc[8]
    ItemStateDesc         (types.h:141), 0x10 bytes
        +0x0C script pointer

The script uses the SAME bytecode as fighter subactions, so the existing
decoder applies -- create_hitbox is event 0x0B either way.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import decode_script, decode_create_hitbox

STATE_DESC_SIZE = 0x10
N_STATES = 8


def article_hitboxes(a, art_ptr):
    """All hitboxes across an Article's item-state scripts."""
    out = []
    states = a.ptr(art_ptr + 0x0C)
    if states is None:
        return out
    for si in range(N_STATES):
        sp = a.ptr(states + si * STATE_DESC_SIZE + 0x0C)
        if sp is None:
            continue
        frame = 0
        try:
            evs = decode_script(a, sp)
        except Exception:
            continue
        for rel, op, n, label, arg, word in evs:
            if op == 0x01:
                frame += arg
            elif op == 0x02:
                frame = arg
            elif op == 0x0B:
                try:
                    ws = [a.d_u32(rel + k * 4) for k in range(5)]
                except Exception:
                    continue
                h = decode_create_hitbox(ws)
                h["state"] = si
                h["frame"] = frame
                out.append(h)
    return out


def main():
    path = sys.argv[1]
    want_dmg = int(sys.argv[2]) if len(sys.argv) > 2 else None
    want_angle = int(sys.argv[3]) if len(sys.argv) > 3 else None

    a = Archive(path)
    base = a.root("itPublicData")
    print(f"itPublicData -> data+0x{base:X}\n")

    hits = []
    for ti, toff in enumerate((0x04, 0x08, 0x0C)):
        tbl = a.ptr(base + toff)
        if tbl is None:
            print(f"  table +0x{toff:02X}: not a relocation")
            continue
        n = 0
        for idx in range(0, 128):
            art = a.ptr(tbl + idx * 4)
            if art is None:
                continue
            n += 1
            for h in article_hitboxes(a, art):
                h["table"] = toff
                h["index"] = idx
                hits.append(h)
        print(f"  table +0x{toff:02X} at data+0x{tbl:X}: {n} article pointers")

    print(f"\n{len(hits)} item hitboxes decoded")
    if want_dmg is None:
        return 0

    match = [h for h in hits
             if int(h["damage"]) == want_dmg
             and (want_angle is None or int(h["angle"]) == want_angle)]
    print(f"\nhitboxes with damage={want_dmg}"
          + (f" angle={want_angle}" if want_angle is not None else "")
          + f": {len(match)}")
    for h in match[:20]:
        print(f"  table+0x{h['table']:02X} article[{h['index']}] state{h['state']} "
              f"f{h['frame']}: size={h['size']:.5f} dmg={h['damage']} "
              f"angle={h['angle']} kg={h['kb_growth']} bk={h['base_kb']} "
              f"setkb={h['set_kb']} elem={h['element']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
