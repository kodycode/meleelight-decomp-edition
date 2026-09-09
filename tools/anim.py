"""Decode HSD keyframe streams into per-frame joint channel values.

Port of the parts of src/sysdolphin/baselib/fobj.c that read a FigaTrack's
`ad_head` stream. Everything here is transcribed from the decomp rather than
inferred from byte patterns -- an earlier attempt to guess the FigaTrack field
layout from column patterns got it wrong, and fobj.c specifies the whole thing.

Stream shape (FObjLoadData, fobj.c:298):

    [header byte]  low nibble = opcode, bits 4..6 = (pack count - 1),
                   bit 7 = the count continues in following bytes
    then, per key: the value bytes for that opcode, then a WAIT

`parseOpCode` reads the header WITHOUT advancing; `parsePackInfo` re-reads the
same byte and does advance. A run of `nb_pack` keys shares one header.

Opcodes (fobj.h:11):
    0 NONE   1 CON    constant, hold p0 until the wait elapses
    2 LIN    linear from p0 to p1 across the wait
    3 SPL0   hermite with zero outgoing slope
    4 SPL    hermite, reads a slope alongside the value
    5 SLP    slope only -- updates d1, does NOT consume a key slot's value
    6 KEY    stepped

Values are LITTLE-ENDIAN inside the stream even though the surrounding archive
is big-endian (parseFloat, fobj.c:118), and are fixed point: the format lives
in the top 3 bits of frac_value/frac_slope and the fraction width in the low 5.
"""
import struct

# fobj.h:11
OP_NONE, OP_CON, OP_LIN, OP_SPL0, OP_SPL, OP_SLP, OP_KEY = range(7)

# fobj.h:19 -- top three bits of the frac byte
FRAC_FLOAT, FRAC_S16, FRAC_U16, FRAC_S8, FRAC_U8 = 0x00, 0x20, 0x40, 0x60, 0x80


def parse_float(buf, pos, frac):
    """parseFloat (fobj.c:118). Returns (value, new_pos)."""
    if frac == FRAC_FLOAT:
        v = struct.unpack("<f", buf[pos:pos + 4])[0]
        return v, pos + 4
    denom = float(1 << (frac & 0x1F))
    kind = frac & 0xE0
    if kind == FRAC_S8:
        v = struct.unpack("<b", buf[pos:pos + 1])[0]
        pos += 1
    elif kind == FRAC_U8:
        v = buf[pos]
        pos += 1
    elif kind == FRAC_S16:
        v = struct.unpack("<h", buf[pos:pos + 2])[0]
        pos += 2
    elif kind == FRAC_U16:
        v = struct.unpack("<H", buf[pos:pos + 2])[0]
        pos += 2
    else:
        return 0.0, pos
    return v / denom, pos


def parse_wait(buf, pos):
    """parseWait (fobj.c:190) -- 7 bits per byte, high bit continues."""
    wait = 0
    shift = 0
    while True:
        d = buf[pos]
        pos += 1
        wait |= (d & 0x7F) << shift
        shift += 7
        if not (d & 0x80):
            return wait, pos


def parse_pack_info(buf, pos):
    """parsePackInfo (fobj.c:159). Consumes the header byte."""
    d = buf[pos]
    pos += 1
    nb = ((d >> 4) & 7) + 1
    if not (d & 0x80):
        return nb, pos
    shift = 3
    while True:
        d = buf[pos]
        pos += 1
        nb += (d & 0x7F) << shift
        shift += 7
        if not (d & 0x80):
            return nb, pos


def spl_hermite(fterm, time, p0, p1, d0, d1):
    """splGetHelmite (spline.c:9), transcribed in its original association
    order. `fterm` here is the RECIPROCAL of the segment length, matching the
    `1.0 / fobj->fterm` the caller passes."""
    _1_T2 = time * time
    t2 = fterm * fterm
    t2_T = _1_T2 * fterm
    t3_T2 = t2 * (_1_T2 * time)
    _2t3_T3 = 2.0 * t3_T2 * fterm
    _3t2_T2 = 3.0 * _1_T2 * t2
    return (d1 * (t3_T2 - t2_T)) + ((d0 * (time + ((t3_T2 - t2_T) - t2_T)))
                                    + ((p0 * (1.0 + (_2t3_T3 - _3t2_T2)))
                                       + (p1 * (-_2t3_T3 + _3t2_T2))))


def decode_track(data, frac_value, frac_slope):
    """Decode one keyframe stream into segments.

    Returns [(op, p0, p1, d0, d1, fterm)] -- the curve from one key to the
    NEXT, lasting `fterm` frames.

    The pairing matters and is easy to get backwards. In the state machine
    (HSD_FObjInterpretAnim, fobj.c:390) the sequence per key is
    LOAD_DATA -> LOAD_WAIT, so the wait that follows key i is the span of the
    segment running from key i to key i+1 -- not the span ending at key i.
    Emitting (previous_value, this_value, this_wait) instead makes frame 0
    evaluate to the value BEFORE the first key, which is zero, and every
    animation then poses identically to a degenerate rest pose.
    """
    keys = _decode_keys(data, frac_value, frac_slope)
    out = []
    for i, (op, val, slope, wait) in enumerate(keys):
        nxt = keys[i + 1] if i + 1 < len(keys) else None
        p1 = nxt[1] if nxt else val
        d1 = nxt[2] if nxt else slope
        out.append((op, val, p1, slope, d1, wait))
    return out


def _decode_keys(data, frac_value, frac_slope):
    """[(op, value, slope, wait)] in stream order."""
    pos = 0
    n = len(data)
    op = OP_NONE
    nb_pack = 0
    p1 = d1 = 0.0
    out = []
    while pos < n:
        if nb_pack == 0:
            op = data[pos] & 0xF          # parseOpCode does not advance
            nb_pack, pos = parse_pack_info(data, pos)
            if op == OP_NONE:
                break
        nb_pack -= 1

        if op in (OP_CON, OP_LIN):
            p1, pos = parse_float(data, pos, frac_value)
            d1 = 0.0
        elif op == OP_SPL0:
            p1, pos = parse_float(data, pos, frac_value)
            d1 = 0.0
        elif op == OP_SPL:
            p1, pos = parse_float(data, pos, frac_value)
            d1, pos = parse_float(data, pos, frac_slope)
        elif op == OP_SLP:
            # Slope-only: updates the outgoing tangent of the key already
            # read. It reads no value and no wait, so it does not open a new
            # segment -- it edits the last one.
            d1, pos = parse_float(data, pos, frac_slope)
            if out:
                o, v, _s, w = out[-1]
                out[-1] = (o, v, d1, w)
            continue
        elif op == OP_KEY:
            p1, pos = parse_float(data, pos, frac_value)
        else:
            break

        if pos >= n:
            out.append((op, p1, d1, 0))
            break
        fterm, pos = parse_wait(data, pos)
        out.append((op, p1, d1, fterm))
    return out


def sample(segments, frame):
    """Value of a decoded track at `frame` (FObjUpdateAnim, fobj.c:335)."""
    if not segments:
        return 0.0
    t = float(frame)
    for op, p0, p1, d0, d1, fterm in segments:
        if fterm and t >= fterm:
            t -= fterm
            continue
        if op == OP_CON or op == OP_KEY:
            return p0                      # stepped: hold until the next key
        if op == OP_LIN:
            return ((p1 - p0) / fterm) * t + p0 if fterm else p0
        if op in (OP_SPL0, OP_SPL, OP_SLP):
            return spl_hermite(1.0 / fterm, t, p0, p1, d0, d1) if fterm else p0
        return p0
    # Past the end of the track: hold the final key.
    return segments[-1][1]
