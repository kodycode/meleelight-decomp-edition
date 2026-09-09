# Tools

The extraction and verification pipeline. These are how the ported data in
`src/` was produced, and — more importantly — how it can be reproduced and
checked rather than trusted.

Nothing here ships with the game. None of it runs at play time.

## Before you run anything

Most tools need two things:

- **A disc.** Extract a retail Melee ISO into `tools/dat/` with
  `gcm_extract.py`. You supply your own; no game data is distributed with this
  repo.
- **The decompilation**, checked out next to this repo, for the tools that read
  Melee's own tables. Paths below assume `../melee_decomp`.

The usual invocation is `python tools/<name>.py tools/dat [../melee_decomp]`.
Anything that writes into `src/` takes `--write` and does nothing without it —
run once to read the report, again to apply.

**Generators self-check before they write.** Each one reproduces a value the
project already has and refuses to emit anything if it cannot match. That is
what makes the output trustworthy: `gen_catchdash.py` recomputes the standing
grab's offsets that meleelight already records and only proceeds when they come
back exact.

The two slowest (`gen_hurtbox.py`, `gen_ecb.py`) run one process per character.
Set `MELEELIGHT_SERIAL=1` to force single-process when you need a readable
traceback.

---

## Reading the disc

Format readers. Everything else is built on these.

| Tool | What it does |
|---|---|
| `gcm_extract.py` | Minimal GameCube (GCM/ISO) filesystem extractor |
| `hsd_archive.py` | HSD (HAL Sysdolphin) archive reader for `.dat` files |
| `figatree.py` | Animation data out of a `PlXxAJ.dat` |
| `anim.py` | Decodes HSD keyframe streams into per-frame joint channel values |
| `skeleton.py` | A fighter's skeleton, and posing it with a figatree animation |
| `model.py` | Costume model: meshes, skinning, posed world vertices |
| `silhouette.py` | Builds a 2D outline from a posed model |
| `subaction.py` | Decodes subaction ("animation event") scripts |
| `ecb.py` | Computes a fighter's ECB from the skeleton, the way Melee does |
| `hurtbox.py` | The capsules Melee actually tests hitboxes against |
| `special_attrs.py` | Character-specific attribute structs (`ftData+0x04`) |
| `item_hitboxes.py` | Item/article hitboxes out of `ItCo.dat` |
| `dol_disasm.py` | Disassembles a function out of the retail DOL, constants resolved |
| `fpscan.py` | Scans a DOL function for floating-point constants |
| `f32.py` | float32 arithmetic and Melee's trigonometry, for the tools themselves |

## Finding things

Locators, for when you know what a value should be but not where it lives.

| Tool | What it does |
|---|---|
| `find_common.py` | Locates `ftCommonData` in `PlCo.dat`, anchor-free |
| `find_attrs.py` | Locates `ftCo_DatAttrs` in `PlXx.dat`, anchor-free |
| `find_hitbox.py` | Reverse lookup: given hitbox values, names every script hitbox with them |
| `find_hardcoded.py` | Matches hardcoded decimals in the physics against named `ftCommonData` fields |
| `motion_states.py` | Melee's action-state → subaction table, read from the decomp |
| `state_map.py` | Every meleelight action state → the subaction it plays |
| `move_ids.py` | The attack ID (`FtMoveId`) of every common motion state |

## Generators

These write into `src/`. All take `--write`.

| Tool | Produces |
|---|---|
| `gen_hurtbox.py` | Per-frame hurtbox capsules (`src/characters/*/hurtbox.js`) |
| `gen_ecb.py` | Per-frame ECB tables |
| `gen_root_motion.py` | Animation-driven translation (`src/characters/*/rootMotion.js`) |
| `gen_animations.py` | Animation frames meleelight is missing, posed from the disc |
| `gen_catchdash.py` | The dash grab's hitboxes and offsets |
| `gen_catchdash_anim.py` | The dash grab's animation outlines |
| `gen_delta_frame.py` | Extends an animation by transferring the model's frame-to-frame delta |
| `gen_move_ids.py` | `src/physics/staleMoveIds.js` |
| `gen_shield.py` | Shield collision position per character, per tilt degree |
| `bake_offsets.py` | Disc-computed hitbox offsets into `setOffsets` blocks |
| `patch_catchdash.py` | Places the dash grab's hitbox data into each character's attributes |
| `fix_short_velocities.py` | Extends `setVelocities` tables shorter than their state's frame count |
| `regen_puff_damagen2.py` | Regenerates Puff's `DAMAGEN2` outright — see its header for why |

## Validators

Compare what is in `src/` against what is on the disc. These are read-only and
are the ones worth running after any data change.

| Tool | Checks |
|---|---|
| `validate_attrs.py` | Every per-character attribute (currently 212/212) |
| `validate_constants.py` | Re-derives every constant in `meleeCommon.js` from the ISO |
| `validate_frames.py` | `setFrames` tables against the animations' real lengths |
| `validate_intangibility.py` | Intangibility windows against the subaction scripts |
| `sweep_hitboxes.py` | Bulk-diffs hand-entered hitbox data against every subaction |
| `verify_provenance.py` | Proves each extracted attribute is the field we claim it is |
| `verify_silhouette.py` | Regenerates frames that already exist and scores them against the originals |
| `check_citations.py` | Verifies `Symbol (file.c:LINE)` comments against the decomp |
| `check_states.py` | The hand-written state → subaction map against Melee's table |
| `root_motion.py` | Extracts `x594_b0` root motion; `--check` diffs it against meleelight's tables |
| `smash_charge.py` | Re-extracts the smash-charge parameters and checks the port |
| `loop_lengths.py` | Figatree lengths for looping animations, which `validate_frames` skips |

## Investigation

Narrower tools, each written to answer one question. They are kept because the
question tends to come back.

| Tool | Answers |
|---|---|
| `hitbox_timeline.py` | What a subaction's hitboxes do, frame by frame |
| `compare_move.py` | One subaction's hitboxes vs one meleelight property |
| `compare_frame.py` | Renders a recorded outline and a generated one side by side, as a PNG |
| `pair_offsets.py` | Which script hitbox group an offset array came from |
| `explain_offset.py` | Why one offset property does or does not pair, track against track |
| `calib_anim.py` | Calibrates posed geometry against the baked outlines |
| `shield_blend.py` | Melee's joint-space blend for the shield's partial tilt |
| `dash_cmdvars.py` | The frame each character's Dash sets `cmd_vars[0]` |
| `falcon_speciallw.py` | Falcon Kick's traction attributes, straight from `PlCa.dat` |
| `replay_dump.py` | Decodes a meleelight replay and reports recorded positions |

## In-game measurement

Reading the decomp says what Melee does. These say what *this* build does.

`cdp.mjs` drives the running game over the Chrome DevTools Protocol: it
evaluates a script inside the page and prints whatever the script returns as
JSON. That makes behaviour measurable instead of arguable — several bugs in the
changelog were found this way after reading the source had failed to surface
them.

```
node tools/cdp.mjs "http://localhost:5000/meleelight.html" tools/probes-tapjump.js
```

The `probes-*.js` files are the scripts it runs. Each traces one behaviour
frame by frame — dash dancing, pivots, tap jump, ledge getup, input latency,
turn facing, a sweep of every action state, and a watch for non-finite values.
They are worth reading as much as running; each one's header explains what it
is testing and what the answer was.

Two cautions learned the hard way:

- **Wait for the bundle.** `window.__ml` does not exist until it loads, and the
  main bundle is ~19 MB. Poll for it before touching anything.
- **Do not teleport the fighter.** Setting `phys.pos` desyncs `posPrev` and the
  collision sweep, which produces measurements that look like dramatic physics
  bugs and are not. Drive the game with inputs instead. Battlefield's main
  platform also only spans roughly x −27..+27, so a long move started from the
  wrong place runs off the edge mid-measurement.

## One-off migrations

Kept for the record; they have already been applied.

| Tool | What it did |
|---|---|
| `triage_cvel.mjs` | Classified every `cVel` write site as grounded, airborne or ambiguous |
| `convert_cvel.mjs` | Rewrote grounded `cVel.x` assignments onto the ground velocity channel |
