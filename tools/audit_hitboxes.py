"""Per-move hitbox audit: every meleelight hitbox property against its own
subaction's create_hitbox group, by NAME rather than by value.

sweep_hitboxes.py matches values, which proves a number exists somewhere in a
character's script. It cannot prove the number is attached to the move we hung
it on -- it once matched Fox's rapid jab against a laser that does not exist.
compare_move.py resolves one named move properly but has to be driven by hand,
one move at a time, and there are 46 properties on Fox alone.

This runs that same name-matched comparison over every mapped property on every
character, and reports three things:

  MISMATCH    the property exists, the group exists, a field disagrees
  UNMAPPED    a meleelight property no entry here resolves (nothing checked it)
  UNCOVERED   a subaction that creates hitboxes with no property pointing at it

Group indices are the sequential create_hitbox GROUPS within a subaction, so
fair3 is the third group of AttackAirF. That convention holds throughout
meleelight and the group counts corroborate it: AttackAirF has five groups and
there are exactly fair1..fair5.

Sizes are compared with a tolerance because meleelight rounds them to three
decimals (5.156 against the disc's 5.15625). Everything else is exact.

    python tools/audit_hitboxes.py tools/dat
    python tools/audit_hitboxes.py tools/dat --verbose     also print matches
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hitbox_timeline import iter_subactions, timeline
from compare_move import CHARS, ml_entries, ML_ROOT

# meleelight property base -> subaction name. A base with numbered properties
# (fair1..fair5) indexes the subaction's create_hitbox groups in order; a bare
# base (dair) takes group 0.
MOVE_MAP = {
    "jab1":            "Attack11",
    "jab2":            "Attack12",
    "ftilt":           "AttackS3S",
    "uptilt":          "AttackHi3",
    "dtilt":           "AttackLw3",
    "fsmash":          "AttackS4",
    "upsmash":         "AttackHi4",
    "dsmash":          "AttackLw4",
    "nair":            "AttackAirN",
    "fair":            "AttackAirF",
    "bair":            "AttackAirB",
    "upair":           "AttackAirHi",
    "dair":            "AttackAirLw",
    "dashattack":      "AttackDash",
    "grab":            "Catch",
    "grabDash":        "CatchDash",
    "pummel":          "CatchAttack",
    "ledgegetupslow":  "CliffAttackSlow",
    "ledgegetupquick": "CliffAttackQuick",
    "downattack":      "DownAttackU",
}

# Where a character names the subaction differently. Falcon angles his forward
# smash (AttackS4S/Hi/Lw) where Fox has a single AttackS4, and Marth's forward
# tilt is AttackS31.
CHAR_OVERRIDES = {
    ("Falcon", "fsmash"): "AttackS4S",
    ("Marth",  "ftilt"):  "AttackS31",
}

# Characters whose move files name the groups Clean/Mid/Late instead of
# numbering them. Ranked, then assigned sequential group indices, so a
# two-group move gets Clean=0 Late=1 and a three-group move Clean=0 Mid=1
# Late=2 without hardcoding either shape.
SUFFIX_RANK = {"Clean": 0, "Mid": 1, "Late": 2}

# Specials, per character. These have no shared naming convention at all.
SPECIAL_MAP = {
    "Fox": {
        # Swapped from the obvious reading, the same trap as Raptor Boost:
        # upb1 holds the 8.203 / dmg 2 / angle 70 box, which is the CHARGE
        # (SpecialHiHold); upb2 holds 4.0 / dmg 14 / angle 80, the launch.
        "upb1":                  "SpecialHiHold",
        "upb2":                  "SpecialHi",
        "downspecial":           "SpecialLwStart",
    },
    "Falco": {
        "upspecial":             "SpecialHi",
        "downspecial":           "SpecialLwStart",
    },
    "Falcon": {
        "jab3":                  "Attack13",
        "falcondive1":           "SpecialHi",
        "falcondive2":           "SpecialAirHi",
        "falconpunchground":     "SpecialN",
        "falconpunchair":        "SpecialAirN",
        "falconkickground":      "SpecialLw",
        "falconkickair":         "SpecialAirLw",
        "falconkickland":        "SpecialAirLwEnd",
        # Raptor Boost is two subactions: SpecialSStart carries three
        # damage-0 element-11 grab boxes, SpecialS the single dmg-7 angle-90
        # hit. meleelight names them ...ground and ...groundhit, which maps the
        # other way round from the obvious reading.
        "raptorboostground":     "SpecialSStart",
        "raptorboostair":        "SpecialAirSStart",
        "raptorboostgroundhit":  "SpecialS",
        "raptorboostairhit":     "SpecialAirS",
    },
    "Marth": {
        "dbground":              "SpecialS1",
        # Dolphin Slash is one subaction with two create groups.
        "upb1":                  ("SpecialHi", 0),
        "upb2":                  ("SpecialHi", 1),
    },
}

# Properties whose meleelight shape does not correspond 1:1 to a subaction
# group, with the reason. Listed rather than silently skipped.
KNOWN_UNMAPPED = {
    "jab3_1": "rapid jab: meleelight splits Attack100Loop into five entries",
    "jab3_2": "rapid jab", "jab3_3": "rapid jab",
    "jab3_4": "rapid jab", "jab3_5": "rapid jab",
    "throwup": "throw data, not a script hitbox",
    "throwdown": "throw data, not a script hitbox",
    "throwback": "throw data, not a script hitbox",
    "throwforwardextra": "second ThrowF hitbox, modelled separately here",
    "thrown": "victim-side, not a script hitbox",
    # Dancing Blade. meleelight names the tree by stage and direction
    # (dbground3forward) where Melee names it structurally (SpecialS3S), and
    # the two do not line up by name alone: stage 2 has Hi and Lw on the disc
    # against up and forward in meleelight. Resolving it needs a per-entry
    # value cross-check, not a naming rule, so it is left unchecked rather
    # than guessed. 37 properties across dbground* and dbair*.
    "__dancing_blade__": "see note",
    "throwforward": "throw data; meleelight stores no createHitbox for it",
    "throwupextra": "throw data", "throwbackextra": "throw data",
    "reflector": "the Shine reflect bubble, not a script hitbox",
    "falcondivethrow": "grab-throw data", "falcondivethrowextra": "grab-throw data",
}

# Subactions that create hitboxes but are not a meleelight move, so having no
# property is correct rather than a gap.
IGNORE_SUBACTIONS = {
    "Swing1", "Swing3", "Swing4", "SwingDash",
    "ItemParasolOpen", "ItemScrew", "ItemScrewAir", "ItemScrewDamage",
    "DamageFlyHi", "DamageFlyN", "DamageFlyLw", "DamageFlyTop",
    "DamageFlyRoll",
    "AttackS3Hi", "AttackS3HiS", "AttackS3LwS", "AttackS3Lw",
    "Attack100Loop", "Attack100Start", "Attack100End",
}

FIELDS = [("size", 1), ("dmg", 2), ("angle", 3), ("kg", 4), ("bk", 5), ("sk", 6)]

# Differences that are understood and deliberate, or understood and not yet
# fixed. Reported in their own section so the pass/fail gate still catches
# anything new. Key: (char, property, field) -> reason.
KNOWN_DIFFS = {
    ("Falcon", "falcondive1 id0", "dmg"):
        "grab hitbox; meleelight deals Falcon Dive damage through its grab "
        "path, so 0 here is a modelling choice (see the note in attributes.js)",
    ("Falcon", "falcondive1 id1", "dmg"): "same as id0",
    ("Falcon", "falcondive2", "hitbox count"):
        "NOT a gap. SpecialAirHi creates both boxes on frame 13 and "
        "TERMINATES id1 on frame 14, so meleelight is right to split the move: "
        "falcondive1 is the one-frame both-boxes phase and falcondive2 the "
        "id0-only phase that follows. This auditor keys on create groups and "
        "cannot see a mid-group terminate, which is its own blind spot -- see "
        "the note on script_groups",
}


def script_groups(datdir, dat, root):
    """subaction name -> [ {id: hitbox} per create group, in order ]."""
    out = {}
    for a, _i, nm, sp in iter_subactions(datdir, dat, root):
        groups = []
        for frame, kind, live, touched, _gone in timeline(a, sp):
            if kind == "create" and touched:
                # The LIVE set, not just the ids written this frame. A
                # meleelight hitboxObject is the set of boxes active during a
                # phase, and Melee leaves earlier ids live when a later
                # create_hitbox group does not rewrite them -- Falcon Kick
                # keeps id2 at its clean values through the mid and late
                # groups. Comparing only the written ids would call that a
                # count mismatch when it is the behaviour being modelled.
                groups.append(dict(live))
        # BLIND SPOT, deliberately left. A group is recorded when hitboxes are
        # WRITTEN, so a frame that only TERMINATES one does not start a new
        # group -- Falcon Dive creates id0 and id1 on frame 13 and kills id1 on
        # frame 14, which meleelight correctly models as two phases and this
        # sees as one. Splitting on terminates as well would be more faithful
        # but would renumber every group index in MOVE_MAP.
        if groups:
            out.setdefault(nm, groups)
    return out


def prop_target(prop, char, all_props):
    """property name -> (subaction, group index), or None when nothing maps it.

    Three naming shapes, in order: numbered (fair3), suffixed
    (upairClean/upairMid/upairLate) and bare (dair).
    """
    m = re.match(r"^([A-Za-z_]+?)([0-9]+)$", prop)
    if m and m.group(1) in MOVE_MAP:
        return _sub(char, m.group(1)), int(m.group(2)) - 1

    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*?)(Clean|Mid|Late)$", prop)
    if m:
        base, suffix = m.group(1), m.group(2)
        table = SPECIAL_MAP.get(char, {})
        if base in MOVE_MAP or base in table:
            # Rank only the suffixes this character actually uses for this
            # base, so Clean/Late becomes 0/1 and Clean/Mid/Late becomes
            # 0/1/2 without assuming either.
            sibs = sorted(
                (p for p in all_props
                 if re.match(r"^" + re.escape(base) + r"(Clean|Mid|Late)$", p)),
                key=lambda p: SUFFIX_RANK[p[len(base):]])
            sub = table.get(base) or _sub(char, base)
            return sub, sibs.index(prop)

    if prop in SPECIAL_MAP.get(char, {}):
        v = SPECIAL_MAP[char][prop]
        return v if isinstance(v, tuple) else (v, 0)
    if prop in MOVE_MAP:
        return _sub(char, prop), 0
    return None


def _sub(char, base):
    return CHAR_OVERRIDES.get((char, base), MOVE_MAP.get(base))


def ml_props(js_path):
    """Every property name in the setHitBoxes block, in file order."""
    src = open(js_path, encoding="utf-8").read()
    i = src.index("setHitBoxes(")
    depth = 0
    j = len(src)
    for k in range(src.index("(", i), len(src)):
        if src[k] == "(":
            depth += 1
        elif src[k] == ")":
            depth -= 1
            if depth == 0:
                j = k
                break
    return re.findall(
        r"^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*:[ \t]*new[ \t]+createHitboxObject",
        src[i:j], re.M)


def main():
    if len(sys.argv) < 2:
        print("usage: python tools/audit_hitboxes.py <datdir> [--verbose]",
              file=sys.stderr)
        return 2
    datdir = sys.argv[1]
    verbose = "--verbose" in sys.argv

    checked = matched = 0
    problems, unmapped, uncovered, known = [], [], [], []

    def record(char, prop, sub, what, a_, b_):
        if (char, prop, what) in KNOWN_DIFFS:
            known.append((char, prop, what, a_, b_,
                          KNOWN_DIFFS[(char, prop, what)]))
        else:
            problems.append((char, prop, sub, what, a_, b_))

    for char, (dat, root, jsrel) in CHARS.items():
        path = os.path.join(datdir, dat)
        js = os.path.join(ML_ROOT, jsrel)
        if not (os.path.exists(path) and os.path.exists(js)):
            print("!! %s: missing %s or %s" % (char, dat, jsrel))
            continue
        groups = script_groups(datdir, dat, root)
        touched_subs = set()

        props = ml_props(js)
        for prop in props:
            tgt = prop_target(prop, char, props)
            if tgt is None or tgt[0] is None:
                if prop not in KNOWN_UNMAPPED and not prop.startswith(("dbground", "dbair")):
                    unmapped.append((char, prop))
                continue
            sub, gi = tgt
            touched_subs.add(sub)
            if sub not in groups:
                problems.append((char, prop, sub, "no hitbox groups", "", ""))
                continue
            if gi >= len(groups[sub]):
                problems.append((char, prop, sub, "group out of range",
                                 "wants %d" % (gi + 1),
                                 "has %d" % len(groups[sub])))
                continue
            group = groups[sub][gi]
            _line, entries = ml_entries(js, prop)
            if not entries:
                problems.append((char, prop, sub, "no createHitbox entries", "", ""))
                continue
            ids = sorted(group)
            if len(entries) != len(ids):
                record(char, prop, sub, "hitbox count",
                       "ml %d" % len(entries), "disc %d" % len(ids))
                continue
            for n, ent in enumerate(entries):
                h = group[ids[n]]
                disc = (h["size"], h["damage"], h["angle"],
                        h["kb_growth"], h["base_kb"], h["set_kb"])
                for k, (fname, idx) in enumerate(FIELDS):
                    a_, b_ = ent[idx], disc[k]
                    same = (abs(a_ - b_) < 0.002 if fname == "size"
                            else a_ == b_)
                    checked += 1
                    if same:
                        matched += 1
                    else:
                        record(char, "%s id%d" % (prop, ids[n]), sub,
                               fname, "ml %g" % a_, "disc %g" % b_)
            if verbose:
                print("  ok  %-7s %-18s %s group %d" % (char, prop, sub, gi + 1))

        for sub in groups:
            if sub not in touched_subs and sub not in IGNORE_SUBACTIONS:
                uncovered.append((char, sub, len(groups[sub])))

    print("")
    print("%d/%d hitbox field(s) match their own subaction group"
          % (matched, checked))
    if problems:
        print("")
        print("  %d MISMATCH(es):" % len(problems))
        for char, prop, sub, what, a_, b_ in problems:
            print("    %-7s %-22s %-18s %-20s %-12s %s"
                  % (char, prop, sub, what, a_, b_))
    if known:
        print("")
        print("  %d known difference(s), not counted as failures:" % len(known))
        for char, prop, what, a_, b_, why in known:
            print("    %-7s %-22s %-14s %-10s %s" % (char, prop, what, a_, b_))
            print("        %s" % why)
    if unmapped:
        print("")
        print("  %d property(ies) with no mapping -- NOT CHECKED:" % len(unmapped))
        for char, prop in unmapped:
            print("    %-7s %s" % (char, prop))
    if uncovered:
        print("")
        print("  %d subaction(s) create hitboxes with nothing pointing at them:"
              % len(uncovered))
        for char, sub, n in uncovered:
            print("    %-7s %-24s %d group(s)" % (char, sub, n))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
