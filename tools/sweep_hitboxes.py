"""Bulk-diff meleelight's hand-entered hitbox data against every subaction
script in the character's own PlXx.dat.

Matching is by VALUE SIGNATURE, not by name. meleelight's property names
(nair1, nair2, fsmash...) do not map cleanly onto subaction names, and one move
can emit several hitbox groups on different frames. So for each hand-entered
hitbox we ask: does ANY hitbox anywhere in this character's scripts have the
same (size, damage, angle, knockback growth, base knockback)?

  exact match      -> the entry is corroborated by game data
  no exact match   -> report it, with the closest candidate, because that is
                      how transposed digits and wrong base-knockback values
                      show up (2.922 vs 2.992, bk 10 vs bk 0).

This cannot prove an entry is attached to the right move -- only that its
numbers exist in the data. It is a screen for typos, not a full audit.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hsd_archive import Archive, HDR
from subaction import (decode_script, decode_create_hitbox,
                       decode_throw_hitbox, WAD_SIZE, SUBACTION_COUNT)

CHARS = [
    ("Fox", "PlFx.dat", "ftDataFox", "src/characters/fox/attributes.js"),
    ("Falco", "PlFc.dat", "ftDataFalco", "src/characters/falco/attributes.js"),
    ("Falcon", "PlCa.dat", "ftDataCaptain", "src/characters/falcon/attributes.js"),
    ("Marth", "PlMs.dat", "ftDataMars", "src/characters/marth/marthAttributes.js"),
    ("Puff", "PlPr.dat", "ftDataPurin", "src/characters/puff/puffAttributes.js"),
]

# new createHitbox(offsetExpr, size, dmg, angle, kg, bk, sk, type, clank, hG, hA)
HB_RE = re.compile(
    r"new\s+createHitbox\s*\(\s*([^,]+?)\s*,\s*"
    r"(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*"
    r"(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,")



PROP_RE = re.compile(r"^[ 	]*([A-Za-z_$][\w$]*)[ 	]*:[ 	]*new\s+createHitboxObject\s*\(", re.M)


def property_spans(src):
    """[(name, start, end)] for each createHitboxObject block.

    Balances parentheses. A backwards line-scan (find the nearest preceding
    `prop :` line) misattributes every hitbox inside a MULTILINE block to the
    wrong property -- that is how Falcon's dair was reported as carrying values
    that belong to a different move entirely.
    """
    spans = []
    for m in PROP_RE.finditer(src):
        i = src.index("(", m.start())
        depth = 0
        end = len(src)
        for j in range(i, len(src)):
            if src[j] == "(":
                depth += 1
            elif src[j] == ")":
                depth -= 1
                if depth == 0:
                    end = j
                    break
        spans.append((m.group(1), i, end))
    return spans


def prop_at(spans, pos):
    for name, a, b in spans:
        if a <= pos <= b:
            return name
    return "?"


def extract_from_dat(datdir, dat, root):
    a = Archive(os.path.join(datdir, dat))
    base = a.root(root)
    table = a.ptr(base + 0x0C)
    total = SUBACTION_COUNT[root]
    out = []
    for i in range(total):
        e = table + i * WAD_SIZE
        if e + WAD_SIZE > a.data_size:
            break
        sp = a.ptr(e + 0x0C)
        if sp is None:
            continue
        namep = a.ptr(e + 0x00)
        nm = a.cstr(HDR + namep) if namep is not None else f"[{i}]"
        nm = nm.split("ACTION_")[-1].replace("_figatree", "")
        frame = 0
        try:
            events = decode_script(a, sp)
        except Exception:
            continue
        for rel, op, n, label, arg, word in events:
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
                h["subaction"] = nm
                h["frame"] = frame
                h["index"] = i
                out.append(h)
            elif op == 0x22:
                # Throw hitboxes come from a separate event (ftAction_80071E04)
                # writing fp->xDF4[]. Same HitCapsule fields, no size/offset.
                try:
                    ws = [a.d_u32(rel + k * 4) for k in range(3)]
                except Exception:
                    continue
                h = decode_throw_hitbox(ws)
                h["subaction"] = nm
                h["frame"] = frame
                h["index"] = i
                out.append(h)
    return out


# Sizes are 8.8 fixed point, so the true value has 1/256 granularity
# (900/256 = 3.515625). meleelight stores these TRUNCATED to 3 decimals
# (3.515) while rounding gives 3.516 -- comparing rounded-to-rounded turns
# every such pair into a false mismatch. Compare size with a tolerance wider
# than that discrepancy and require exact equality on the integer fields.
SIZE_TOL = 0.0025

# Entries whose values do NOT come from a subaction script, so the sweep can
# never corroborate them and the "closest candidate" it offers is noise.
# Reported separately rather than counted as failures.
#
# `reflector` is a ReflectDesc in the character's ext_attr block (ftData+0x04),
# installed by ftColl_CreateReflectHit (ftcoll.c:3189). Use special_attrs.py.
NOT_IN_SCRIPTS = {
    ("Fox", "reflector"): "ReflectDesc in ext_attr+0xB0 -- see special_attrs.py",
    ("Falco", "reflector"): "ReflectDesc in ext_attr+0xB0 -- see special_attrs.py",
    ("Marth", "downspecialground"):
        "Counter ShieldDesc in ext_attr+0x64 -- see special_attrs.py",
    ("Marth", "downspecialair"):
        "Counter ShieldDesc in ext_attr+0x64 -- see special_attrs.py",
    # Falcon Dive's grab boxes DO come from SpecialHi's script and their sizes
    # match it; only `damage` differs, and deliberately. The script says 1, but
    # these are element 2 (catch) hitboxes and meleelight routes Falcon Dive's
    # damage through its grab path instead of the hitbox, so 0 here is a
    # modelling choice. Recorded so the sweep stops re-reporting a settled call.
    ("Falcon", "falcondive1"):
        "grab boxes; dmg deliberately 0, routed through the grab path",
    ("Falcon", "falcondive2"):
        "grab boxes; dmg deliberately 0, routed through the grab path",
}


def matches(entry_size, h, dmg, angle, kg, bk, sk):
    if not (int(h["damage"]) == int(dmg)
            and int(h["angle"]) == int(angle)
            and int(h["kb_growth"]) == int(kg)
            and int(h["base_kb"]) == int(bk)
            and int(h["set_kb"]) == int(sk)):
        return False
    # Throw hitboxes (event 0x22) carry no size -- that HitCapsule field is
    # left untouched by the event, so there is nothing to compare against and
    # a size check would reject every genuine match.
    if h.get("size") is None:
        return True
    return abs(h["size"] - entry_size) < SIZE_TOL


def main():
    datdir, mlroot = sys.argv[1], sys.argv[2]
    grand_ok = grand_bad = 0

    for name, dat, root, jsrel in CHARS:
        js = os.path.join(mlroot, jsrel)
        if not os.path.exists(js):
            print(f"!! {name}: {jsrel} missing")
            continue
        hbs = extract_from_dat(datdir, dat, root)


        src = open(js, encoding="utf-8").read()
        spans = property_spans(src)
        entries = []
        for m in HB_RE.finditer(src):
            off_expr = m.group(1).strip()
            size, dmg, angle, kg, bk, sk = (float(m.group(i)) for i in range(2, 8))
            entries.append((off_expr, size, dmg, angle, kg, bk, sk,
                            prop_at(spans, m.start())))

        ok = bad = 0
        problems = []
        exempt = []
        for off_expr, size, dmg, angle, kg, bk, sk, prop in entries:
            if (name, prop) in NOT_IN_SCRIPTS:
                exempt.append((prop, NOT_IN_SCRIPTS[(name, prop)]))
                continue
            # Set-knockback entries used to be skipped outright, which left 52
            # of 597 hand-entered hitboxes unchecked -- and Fox's forward-throw
            # bystander hitbox, whose set-knockback field was wrongly 0, was one
            # of them. Compare set_kb like any other field instead.
            if any(matches(size, h, dmg, angle, kg, bk, sk) for h in hbs):
                ok += 1
                continue
            bad += 1
            # Classify by how close the best candidate is. An entry agreeing on
            # every field but ONE is likely a typo; one with no close candidate
            # is usually a different mechanism entirely (reflect boxes, command
            # grabs), whose hitboxes are not created by these events.
            #
            # NB: the "closest candidate" is only a hint. It has pointed at the
            # wrong move repeatedly -- suggesting `dmg 3 -> 5` for Fox fair5
            # when the real error was `bk 10 -> 50` in a different frame group.
            # Never edit on this alone; resolve the move by name first.
            best = None
            for h in hbs:
                diffs = 0
                if h.get("size") is not None and abs(h["size"] - size) >= SIZE_TOL:
                    diffs += 1
                if int(h["damage"]) != int(dmg): diffs += 1
                if int(h["angle"]) != int(angle): diffs += 1
                if int(h["kb_growth"]) != int(kg): diffs += 1
                if int(h["base_kb"]) != int(bk): diffs += 1
                if int(h["set_kb"]) != int(sk): diffs += 1
                if best is None or diffs < best[0]:
                    best = (diffs, h)
            problems.append((prop, off_expr, size, dmg, angle, kg, bk, sk, best))

        grand_ok += ok
        grand_bad += bad
        print(f"\n=== {name}: {len(hbs)} hitboxes in scripts, "
              f"{len(entries)} hand-entered -- {ok} corroborated, {bad} not"
              + (f", {len(exempt)} exempt" if exempt else "") + " ===")
        one_off = [p for p in problems if p[8] and p[8][0] == 1]
        vague = [p for p in problems if p not in one_off]
        print(f"  {len(one_off)} differ from a script hitbox in EXACTLY ONE field "
              f"(likely typos); {len(vague)} differ in 2+ or have no candidate "
              f"(likely a different/absent hitbox)")

        def describe(prop, off_expr, size, dmg, angle, kg, bk, sk, best):
            h = best[1]
            tag = off_expr.split(".")[-1] if "." in off_expr else off_expr
            fields = []
            if h.get("size") is not None and abs(h["size"] - size) >= SIZE_TOL:
                fields.append(f"size {size} -> {h['size']:.5f}")
            if int(h["damage"]) != int(dmg): fields.append(f"dmg {dmg:g} -> {h['damage']}")
            if int(h["angle"]) != int(angle): fields.append(f"angle {angle:g} -> {h['angle']}")
            if int(h["kb_growth"]) != int(kg): fields.append(f"kg {kg:g} -> {h['kb_growth']}")
            if int(h["base_kb"]) != int(bk): fields.append(f"bk {bk:g} -> {h['base_kb']}")
            if int(h["set_kb"]) != int(sk): fields.append(f"setkb {sk:g} -> {h['set_kb']}")
            print(f"    {prop:<18} {tag:<6} {h['subaction']}@f{h['frame']:<3} "
                  f"{'; '.join(fields)}")

        for p in one_off:
            describe(*p)
        # These used to be counted and then discarded, so 11 of 24 unmatched
        # entries were never shown. A 2+ field difference is exactly what a
        # copy-pasted entry from the WRONG CHARACTER looks like, which is what
        # Fox's and Puff's identical throwforwardextra turned out to be.
        if vague:
            print("  -- 2+ fields differ (closest candidate is usually NOT the "
                  "right move; resolve by name) --")
            for p in vague:
                if p[8] is None:
                    print(f"    {p[0]:<18} no candidate at all")
                else:
                    describe(*p)
        for prop, why in exempt:
            print(f"  [exempt] {prop:<16} {why}")

    print(f"\nTOTAL: {grand_ok} corroborated, {grand_bad} without an exact match")


if __name__ == "__main__":
    main()
