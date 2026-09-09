"""Simulate a subaction's hitbox state frame by frame.

`create_hitbox` writes ONE slot of fp->x914[]. It does not clear the others.
So a hitbox created on an early frame stays live, with its original values,
across every later group until something explicitly terminates it. Reading the
script as a list of independent "hitbox groups" gets this wrong, and it is a
mistake that survives into hand-entered data: meleelight had Falcon Kick's id2
carrying the mid (dmg 12) and late (dmg 9) values, when the script never
re-creates id2 after frame 14 and it still holds the clean dmg 15.

    f14  create_hitbox id0 dmg15 / id1 dmg15 / id2 dmg15
    f17  create_hitbox id0 dmg12 / id1 dmg12          <- id2 untouched
    f25  create_hitbox id0 dmg9  / id1 dmg9           <- id2 untouched
    f33  terminate_all_hitboxes

Events that mutate the state (handlers in src/melee/ft/ftaction.c, dispatched
through ftAction_803C06E8 at index opcode-0x0A):
    0x0B create_hitbox            writes x914[id] outright
    0x0C set_hitbox_damage        ftAction_8007162C -> x914[idx].damage
    0x0D set_hitbox_scale         ftAction_8007169C -> scale = value/256
    0x0F terminate_hitbox         ftAction_80071784 -> ftColl_8007AFC8(idx)
    0x10 terminate_all_hitboxes   ftAction_800717D8 -> ftColl_8007AFF8

Usage:
    python tools/hitbox_timeline.py tools/dat <Char> <SubactionName>
    python tools/hitbox_timeline.py tools/dat <Char> --persisting
        list every subaction where a hitbox outlives a later create_hitbox
        group, i.e. exactly the situation above
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import (decode_script, decode_create_hitbox, WAD_SIZE,
                       SUBACTION_COUNT)
from compare_move import CHARS


def iter_subactions(datdir, dat, root):
    a = Archive(os.path.join(datdir, dat))
    base = a.root(root)
    table = a.ptr(base + 0x0C)
    for i in range(SUBACTION_COUNT[root]):
        e = table + i * WAD_SIZE
        if e + WAD_SIZE > a.data_size:
            break
        sp = a.ptr(e + 0x0C)
        namep = a.ptr(e + 0x00)
        if sp is None or namep is None:
            continue
        nm = a.cstr(HDR + namep).split("ACTION_")[-1].replace("_figatree", "")
        yield a, i, nm, sp


def timeline(a, sp):
    """[(frame, event, {id: hitbox}, [ids touched this frame])] -- one entry per
    frame on which the live hitbox set changes."""
    live = {}
    frame = 0
    out = []
    pending = []          # ids written on the current frame
    killed = []           # ids terminated on the current frame
    try:
        events = decode_script(a, sp)
    except Exception:
        return out

    def flush(kind):
        if pending or killed:
            out.append((frame, kind, dict(live), sorted(set(pending)),
                        sorted(set(killed))))
            pending.clear()
            killed.clear()

    for rel, op, n, label, arg, word in events:
        if op in (0x01, 0x02):
            flush("create")
            frame = frame + arg if op == 0x01 else arg
        elif op == 0x0B:
            try:
                ws = [a.d_u32(rel + k * 4) for k in range(5)]
            except Exception:
                continue
            h = decode_create_hitbox(ws)
            live[h["id"]] = h
            pending.append(h["id"])
        elif op == 0x0C:                       # set_hitbox_damage
            idx, val = (word >> 23) & 0x7, word & 0x7FFFFF
            if idx in live:
                live[idx] = dict(live[idx], damage=val)
                pending.append(idx)
        elif op == 0x0D:                       # set_hitbox_scale
            idx, val = (word >> 23) & 0x7, word & 0x7FFFFF
            if idx in live:
                live[idx] = dict(live[idx], scale=val / 256.0)
                pending.append(idx)
        elif op == 0x0F:                       # terminate one
            idx = word & 0x03FFFFFF
            if idx in live:
                del live[idx]
                killed.append(idx)
        elif op == 0x10:                       # terminate all
            if live:
                live.clear()
                out.append((frame, "terminate_all", {}, [], []))
            pending.clear()
            killed.clear()
    flush("create")
    return out


def show(a, nm, sp):
    tl = timeline(a, sp)
    if not tl:
        print(f"{nm}: no hitbox events")
        return
    print(f"=== {nm} ===")
    for frame, kind, live, touched, gone in tl:
        if kind == "terminate_all":
            print(f"  f{frame:<3} terminate_all_hitboxes")
            continue
        what = []
        if touched:
            what.append(f"wrote id {', '.join(map(str, touched))}")
        if gone:
            what.append(f"terminated id {', '.join(map(str, gone))}")
        print(f"  f{frame:<3} {'; '.join(what)}  -- live set:")
        if not live:
            print("       (none)")
        for i in sorted(live):
            h = live[i]
            mark = " " if i in touched else "*"   # * = carried over
            print(f"      {mark}id{i} size={h['size']:.5f} dmg={h['damage']} "
                  f"angle={h['angle']} kg={h['kb_growth']} bk={h['base_kb']} "
                  f"setkb={h['set_kb']} z={h['z_off']:.3f}")
    print("  (* = carried over from an earlier frame, NOT re-created here)")


def persisting(datdir, dat, root, char):
    """Report every subaction where a create_hitbox group leaves an older
    hitbox live alongside it -- the shape that produces wrong hand-entered
    data, because the stale hitbox keeps its ORIGINAL values.

    Known false positive: `SwingDash` (the shared item-swing animation) reports
    five groups on one frame with a different stale id3 each time. Those are
    five ALTERNATIVE branches -- one per item -- and this decoder follows every
    subroutine target in sequence rather than modelling the branch, so it
    concatenates paths that never run together. Real frame-by-frame state is
    only meaningful for straight-line scripts, which every fighter attack is."""
    hits = 0
    for a, i, nm, sp in iter_subactions(datdir, dat, root):
        tl = [t for t in timeline(a, sp) if t[1] == "create"]
        for frame, kind, live, touched, gone in tl[1:]:
            # Only a frame that CREATES hitboxes can leave a stale one beside
            # them. A frame that merely terminates one is the script tightening
            # its own hitbox set, which is not the error shape.
            if not touched:
                continue
            stale = sorted(set(live) - set(touched))
            if not stale:
                continue
            hits += 1
            desc = ", ".join(
                f"id{s} (dmg {live[s]['damage']}, angle {live[s]['angle']},"
                f" kg {live[s]['kb_growth']}, bk {live[s]['base_kb']})"
                for s in stale)
            print(f"  {nm:<28} f{frame:<3} rewrites id "
                  f"{','.join(map(str, touched))}; still live: {desc}")
    print(f"\n{char}: {hits} frame(s) where a stale hitbox survives a new group")


def main():
    if len(sys.argv) < 4:
        print(__doc__.split("Usage:")[1].strip(), file=sys.stderr)
        return 2
    datdir, char, what = sys.argv[1], sys.argv[2], sys.argv[3]
    dat, root, _ = CHARS[char]
    if what == "--persisting":
        persisting(datdir, dat, root, char)
        return 0
    found = False
    for a, i, nm, sp in iter_subactions(datdir, dat, root):
        if nm == what:
            show(a, nm, sp)
            found = True
    if not found:
        print(f"no subaction named {what} for {char}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
