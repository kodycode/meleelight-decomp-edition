"""Decode Melee subaction ("animation event") scripts out of a PlXx.dat.

Path, per the decomp:
    archive root "ftDataXxx"      -> struct ftData
    ftData + 0x0C                 -> Fighter_WaitAnimData[]   (0x18 bytes each)
    entry + 0x00 -> char* name (animation symbol in PlXxAJ.dat)
    entry + 0x04 -> s32 AJ file offset
    entry + 0x08 -> s32 AJ chunk size
    entry + 0x0C -> union CmdUnion*  <-- the subaction script
    entry + 0x10 -> s32 anim flags

Script encoding (src/melee/lb/lbcommand.c, src/melee/ft/ftaction.c):
    opcode = word0 >> 26
    opcodes 0-9  : base commands (timers, loops, goto, subroutine)
    opcodes 10+  : fighter events, length in words from ftAction_803C0870

The entry COUNT is not stored in the file -- the DOL supplies it. Here the
table is walked while entries still look structurally valid (name and script
fields are genuine relocation targets), which is enough to enumerate them.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR

WAD_SIZE = 0x18

# Subaction entry counts, read from ftData_Table_Unk0[kind].count in the DOL
# (0x803C0FC8, 8-byte entries indexed by FighterKind). The count is NOT stored
# in the .dat, so walking the table until it "looks wrong" overruns the end --
# it found 339 entries for Fox against an actual 327.
SUBACTION_COUNT = {
    "ftDataFox": 327, "ftDataFalco": 327, "ftDataCaptain": 318,
    "ftDataMars": 327, "ftDataPurin": 327,
}


def _s16(v):
    return v - 0x10000 if v & 0x8000 else v


def decode_create_hitbox(words):
    """spawn_hitbox_0..4 (src/melee/lb/types.h:765). Big-endian PPC bitfields:
    the FIRST declared field occupies the MOST significant bits.
    16-bit sizes and offsets are 8.8 fixed point, hence /256."""
    w0, w1, w2, w3, w4 = words[:5]
    return {
        "id": (w0 >> 23) & 0x7,
        "hit_group": (w0 >> 20) & 0x7,
        "only_hit_grabbed": (w0 >> 19) & 1,
        "bone": (w0 >> 11) & 0xFF,
        "damage": w0 & 0x3FF,
        "size": ((w1 >> 16) & 0xFFFF) / 256.0,
        # Raw fields, named as the decomp's spawn_hitbox_1/2 bitfields name
        # them. These are NOT the bone-local axes -- see b_offset below.
        "z_off": _s16(w1 & 0xFFFF) / 256.0,
        "y_off": _s16((w2 >> 16) & 0xFFFF) / 256.0,
        "x_off": _s16(w2 & 0xFFFF) / 256.0,
        # THE BONE-LOCAL OFFSET, with X AND Z SWAPPED. This is not a guess and
        # not a correction of the decomp's field names -- Melee itself swaps
        # them when it loads the command (ftAction_8007121C, ftaction.c):
        #
        #     hitbox->b_offset.x = 0.003906f * create_hitbox_1.z_offset;
        #     hitbox->b_offset.y = 0.003906f * create_hitbox_2.y_offset;
        #     hitbox->b_offset.z = 0.003906f * create_hitbox_2.x_offset;
        #
        # Use b_offset for anything positional. Feeding (x_off, y_off, z_off)
        # to a joint matrix puts the hitbox on the wrong axis entirely -- Fox's
        # dtilt lands 6.0 units out that way and 0.5 the right way.
        "b_offset": (_s16(w1 & 0xFFFF) / 256.0,
                     _s16((w2 >> 16) & 0xFFFF) / 256.0,
                     _s16(w2 & 0xFFFF) / 256.0),
        "angle": (w3 >> 23) & 0x1FF,
        "kb_growth": (w3 >> 14) & 0x1FF,
        "set_kb": (w3 >> 5) & 0x1FF,
        "clank": (w3 >> 1) & 1,
        "rebound": w3 & 1,
        "base_kb": (w4 >> 23) & 0x1FF,
        "element": (w4 >> 18) & 0x1F,
        "shield_damage": (w4 >> 10) & 0xFF,
        "sfx_severity": (w4 >> 7) & 0x7,
        "sfx_kind": (w4 >> 2) & 0x1F,
        "hit_grounded": (w4 >> 1) & 1,
        "hit_aerial": w4 & 1,
    }

def decode_throw_hitbox(words):
    """Event 0x22, ftAction_80071E04 (ftaction.c:702) -- 3 words.

    Throw hitboxes are written to fp->xDF4[] by a DIFFERENT event from
    create_hitbox (0x0B), which is why throwupextra / throwbackextra /
    throwforwardextra never matched anything in the create_hitbox sweep.
    They land in the same HitCapsule fields, so the values are comparable.

    Layouts (src/melee/lb/types.h:691). Big-endian: first field = high bits.
    Note words 1 and 2 do NOT fill 32 bits -- 27 and 20 used respectively,
    with the remainder unused at the LOW end, so the shifts are not simply
    packed from bit 0.
        w0: opcode:6 idx:3 damage:23
        w1: unk0:9 (angle)  hit_x24:9 (kb growth)  hit_x28:9 (set kb)
        w2: hit_x2C:9 (base kb)  element:4  sfx_severity:3  sfx_kind:4
    """
    w0, w1, w2 = words[:3]
    return {
        "id": (w0 >> 23) & 0x7,
        "damage": w0 & 0x7FFFFF,
        "angle": (w1 >> 23) & 0x1FF,
        "kb_growth": (w1 >> 14) & 0x1FF,
        "set_kb": (w1 >> 5) & 0x1FF,
        "base_kb": (w2 >> 23) & 0x1FF,
        "element": (w2 >> 19) & 0xF,
        "sfx_severity": (w2 >> 16) & 0x7,
        "sfx_kind": (w2 >> 12) & 0xF,
        # throw hitboxes carry no size/offset -- those fields are untouched
        "size": None,
        "is_throw": True,
    }


# ftAction_803C0870 -- length in 32-bit words of fighter event (opcode-10).
EVENT_WORDS = [
    5, 5, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 7, 4, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 2, 1, 4,
]

BASE_NAMES = {
    0x00: "end",            0x01: "wait",           0x02: "wait_until",
    0x03: "set_loop",       0x04: "exec_loop",      0x05: "subroutine",
    0x06: "return",         0x07: "goto",           0x08: "wait_anim_loop",
    0x09: "bg_flash",
}

EVENT_NAMES = {
    0x0A: "create_gfx",         0x0B: "create_hitbox",
    0x0C: "hitbox_damage",      0x0D: "hitbox_size",
    0x0E: "hitbox_flags",       0x0F: "terminate_hitbox",
    0x10: "terminate_all_hitboxes", 0x11: "sfx",
    0x12: "smash_charge_sfx",   0x13: "SET_CMD_VAR",
    0x14: "throw_flags_b3/b4",  0x15: "throw_flags_b1",
    0x16: "throw_flags_b2",     0x17: "ALLOW_INTERRUPT",
    0x18: "throw_flags_b0",     0x19: "SET_AIR_GROUND",
    0x1A: "body_state",         0x1B: "all_hurtbox_state",
    0x1C: "bone_hurtbox_state", 0x1D: "enable_jab_followup",
    0x1E: "rapid_jab_flag",     0x1F: "model_part_display",
    0x22: "throw_data",         0x26: "random_sfx",
    0x27: "positional_sfx",     0x33: "self_damage",
    0x36: "footstep_fx",        0x37: "landing_fx",
    0x38: "smash_charge",       0x3A: "wind_fx",
}


# subroutine (0x05) and goto (0x07) are TWO words: the opcode word carries no
# operand, and the FOLLOWING word is the target pointer.
#
# This was determined from the disc, not from the decomp headers, which suggest
# the pointer occupies the opcode word itself. Observed in Fox Attack100Loop:
#
#   +0x0004  0x14000000   op 0x05, operand empty, NOT a relocation
#   +0x0008  0x000045F4   the target, and it IS a relocation target
#
# Treating these as one word makes the decoder read the pointer as the next
# instruction -- 0x000045F4 >> 26 == 0 == "end" -- so any move whose hitboxes
# live in a subroutine silently decodes as having none. Fox's rapid jab is
# exactly that shape.
TWO_WORD_PTR_OPS = (0x05, 0x07)


def decode_script(a, off, max_words=4096, _depth=0, _seen=None):
    """Decode a script at data-block offset `off`, following subroutines.

    Returns tuples of (ABSOLUTE data offset, op, words, name, arg, word).
    The offset is absolute so operands stay readable across a subroutine jump.
    """
    if _seen is None:
        _seen = set()
    if _depth > 8 or off in _seen:
        return []
    _seen.add(off)

    out = []
    w = 0
    while w < max_words:
        addr = off + w * 4
        word = a.d_u32(addr)
        op = word >> 26

        if op in TWO_WORD_PTR_OPS:
            target = a.d_u32(addr + 4)
            name = BASE_NAMES.get(op, f"base_{op:02X}")
            out.append((addr, op, 2, name, target, word))
            if target and target < a.data_size:
                out.extend(decode_script(a, target, max_words, _depth + 1, _seen))
            if op == 0x07:      # goto does not return
                break
            w += 2
            continue

        if op < 10:
            name = BASE_NAMES.get(op, f"base_{op:02X}")
            out.append((addr, op, 1, name, word & 0x03FFFFFF, word))
            w += 1
            if op in (0x00, 0x06):   # end / return
                break
        else:
            idx = op - 10
            if idx >= len(EVENT_WORDS):
                out.append((addr, op, 1, f"UNKNOWN_{op:02X}", 0, word))
                break
            n = EVENT_WORDS[idx]
            name = EVENT_NAMES.get(op, f"event_{op:02X}")
            out.append((addr, op, n, name, word & 0x03FFFFFF, word))
            w += n
    return out


def main():
    dat, root_name = sys.argv[1], sys.argv[2]
    want = int(sys.argv[3]) if len(sys.argv) > 3 else None

    a = Archive(dat)
    base = a.root(root_name)
    if base is None:
        print(f"!! root {root_name} not found; roots: {[n for _, n in a.roots]}")
        return 1
    table = a.ptr(base + 0x0C)
    print(f"{root_name} -> ftData data+0x{base:X}; subaction table data+0x{table:X} "
          f"(file 0x{table + HDR:X})\n")

    total = SUBACTION_COUNT.get(root_name)
    if total is None:
        print(f"  !! no DOL-derived count for {root_name}; refusing to guess")
        return 1

    i = 0
    blank = 0
    while i < total:
        e = table + i * WAD_SIZE
        if e + WAD_SIZE > a.data_size:
            break
        name_p = a.ptr(e + 0x00)
        script_p = a.ptr(e + 0x0C)
        # Entries may legitimately have a null name or a null script, so do not
        # stop on the first gap -- only after a run of entries with neither
        # field being a relocation target, which means we have walked off the
        # end of the table. (The true count lives in the DOL, not the file.)
        if name_p is None and script_p is None:
            blank += 1
            if blank >= 4:
                break
            i += 1
            continue
        blank = 0
        nm = a.cstr(HDR + name_p) if name_p is not None else "(none)"
        aj_off = a.d_u32(e + 0x04)
        aj_size = a.d_u32(e + 0x08)
        if want is None:
            print(f"  [{i:3}] {nm:<34} AJ 0x{aj_off:06X}+0x{aj_size:05X}  "
                  f"script {'data+0x%X' % script_p if script_p is not None else '-'}")
        elif i == want:
            print(f"  subaction [{i}] {nm}")
            print(f"  AJ chunk 0x{aj_off:X} size 0x{aj_size:X}")
            if script_p is None:
                print("  (no script)")
                return 0
            print(f"  script at data+0x{script_p:X} (file 0x{script_p + HDR:X})\n")
            for rel, op, n, name, arg, word in decode_script(a, script_p):
                extra = ""
                if op == 0x13:      # set_cmd_var
                    idx = (word >> 24) & 0x3
                    val = word & 0x00FFFFFF
                    extra = f"   cmd_vars[{idx}] = {val}"
                elif op in (0x01, 0x02):
                    extra = f"   frames={arg}"
                print(f"    @0x{rel:05X}  op 0x{op:02X} ({n}w)  {name}{extra}")
                if op == 0x0B:
                    ws = [a.d_u32(rel + k * 4) for k in range(5)]
                    h = decode_create_hitbox(ws)
                    print(f"           id={h['id']} bone={h['bone']} dmg={h['damage']} "
                          f"size={h['size']:.3f} off=({h['x_off']:.3f},{h['y_off']:.3f},{h['z_off']:.3f})")
                    print(f"           angle={h['angle']} kbg={h['kb_growth']} "
                          f"bk={h['base_kb']} setkb={h['set_kb']} element={h['element']} "
                          f"shieldDmg={h['shield_damage']}")
            return 0
        i += 1
        if i > 400:
            break
    if want is None:
        print(f"\n{i} subaction entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
