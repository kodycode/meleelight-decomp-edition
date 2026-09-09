# MeleeLight Decomp Edition

**This project was vibe coded with Claude Opus 5.** The whole effort was an
attempt to replicate *Super Smash Bros. Melee*'s physics engine inside
[Melee Light](https://github.com/schmooblidon/meleelight) — taking the
behaviour that the original project reproduced by eye and by hand, and
rebuilding it from the decompiled source and the game's own data.

The rule throughout: **the decompilation is the source of truth for logic, and
a retail disc is the source of truth for data.** Nothing is guessed. Where a
constant or a per-frame table appears in this fork it was read out of the game,
and the port that uses it cites the decomp function it came from — file and
line — in a comment next to the code.

<img width="2552" height="1226" alt="image" src="https://github.com/user-attachments/assets/bd56cb10-e11a-4de0-84f3-34e783fdc1d8" />

## Credits

This fork exists on top of other people's work and is not a replacement for
any of it.

- **[Melee Light](https://github.com/schmooblidon/meleelight)** — the entire
  game this is built on: the renderer, the state machine, the menus, the
  stages, the hand-traced animation art, and the years of work that made a
  browser Melee possible at all. Head developers **Schmoo**, **Tatatat0**,
  **Bites**, **BonesMalones**, **Nehgromancer**, **shf** and **ShortFuse**,
  **WwwWario** for controller support, and everyone who contributed art and bug
  reports. Original Discord: https://discord.gg/qagFayt
- **[doldecomp/melee](https://github.com/doldecomp/melee)** — the Melee
  decompilation, and every contributor to it. Essentially every physics fix in
  the changelog below is a direct reading of their work; without a decompiled
  `ftCommon_Fall`, `ftCo_Dash_IASA` or `ftColl_*` to point at, none of this
  would be verifiable and most of it would be guesswork.
- **[UCF](https://github.com/AltimorTASDK/ucf)** — the Universal Controller
  Fix, by **Altimor** and contributors, and **tauKhan** for the tilt-intent
  test at the heart of it. The optional UCF toggle in this fork is ported from
  that source rather than reverse-engineered from the distributed Gecko codes.
  UCF is a community mod, not vanilla Melee, and is off by default here.

Nintendo owns Super Smash Bros. Melee. This project ships no Nintendo assets —
the extraction tools in `tools/` read from a disc image you supply yourself.

## Getting Started

You need **Node 18 or newer** (`node -v` to check). The project moved from
yarn to npm during a webpack 5 migration, so `npm install` is the supported
path.

```
npm install
npm run animations   # once, before the first run -- compiles the animation data
npm run build
npm run serve        # then open http://localhost:5000/meleelight.html
```

`npm run start` chains animations, build and serve together.

## Development

Melee Light is a JavaScript project that renders to canvas — no Flash, no
Unity, no engine. Webpack 5 bundles it and Babel strips Flow types; nothing
else is transpiled, deliberately, because the physics depends on evaluation
order and float rounding that a transform could quietly change.

### Commands

All run as `npm run <name>` from the project root.

| Name         | Description                                                       |
|--------------|-------------------------------------------------------------------|
| `dev`        | Webpack build with `--watch`                                       |
| `build`      | One webpack build into `dist/js`                                   |
| `animations` | Compiles the animation bundle; run once before playing             |
| `serve`      | Serves the game at `localhost:5000` (override with `PORT`)         |
| `start`      | `animations` + `build` + `serve`                                   |
| `test`       | The full check suite — see [Tests](#tests)                         |

### Tests

`npm test` is a set of guards against the failure modes this port hit, not a
unit-test suite. Every check exists because something broke in that exact way,
and each was negative-tested by re-injecting the bug to prove it catches it.

**See [`test/README.md`](test/README.md)** for what each check guards and why.

### Project Layout

```
├── bin                      # Offline dev scripts
│   └── webpack              # Webpack config
├── dist                     # Compiled output, served to the browser
├── test                     # The check suite run by `npm test` (see test/README.md)
├── tools                    # Disc extraction and verification (see tools/README.md)
└── src
    ├── index.js             # Loader entry point
    ├── main.js              # Main entry point
    ├── main                 # Core files, rendering, VFX, menus glue
    ├── animations           # Per-character, per-frame outline data
    ├── characters           # Attributes, moves, and generated per-character data
    │   └── shared           # Moves shared between characters
    ├── menus                # Menus, character select, stage select
    ├── physics              # The ported physics
    ├── stages               # Stage geometry and rendering
    └── target               # Break the Targets
```

### Tools

`tools/` holds the extraction and verification pipeline — 57 Python tools that
read a disc image you supply, plus a Chrome DevTools Protocol harness and the
probes it runs to measure the game's actual behaviour.

They are how the data in `src/` was produced, and how it can be regenerated and
diffed rather than trusted. Generators self-check before writing; validators
compare what is in `src/` against what is on the disc.

**See [`tools/README.md`](tools/README.md)** for what each one does and how to
run them.

---

# Changelog

Everything below is a difference from upstream Melee Light. Items are grouped
by what they touch rather than chronologically.

## Foundations

- **float32 arithmetic** (`src/physics/f32.js`). Melee is a 32-bit float
  engine; JavaScript is 64-bit. Helpers wrap every arithmetic step in
  `Math.fround` so ported code rounds where the GameCube rounds.
- **Melee's own trigonometry** (`src/physics/trig.js`). `atan2f`, `sinf`,
  `cosf` as the game implements them, not `Math.*` — the results differ enough
  to move a knockback angle.
- **Gekko float instructions** (`src/physics/gekko.js`) that have no
  JavaScript equivalent, and the MSL library functions built on them.
- **`ftCommonData`** (`src/physics/meleeCommon.js`). The global fighter
  constants, read structurally out of the disc rather than transcribed.
- **212/212 character attributes** verified against the disc.

## Physics ported from the decompilation

- **Ground movement rebuilt around `gr_vel`** (`src/physics/groundMovement.js`).
  Melee keeps a single along-ground scalar and derives `self_vel` from it via
  the floor normal; the original approximated this with a horizontal velocity.
- **Knockback, hitstun, hitlag and DI** (`src/physics/knockback.js`).
- **Move staling** (`src/physics/staling.js`, `staleMoveIds.js`), including
  projectiles staling against the move that fired them rather than whatever
  the owner is doing when they land.
- **Smash-charge damage scaling** (`src/physics/smashCharge.js`).
- **Shield** size, tilt, stun and pushback (`src/main/shieldData.js`).
- **Hurtboxes are capsules riding bones** (`src/main/hurtboxData.js`,
  `src/physics/hurtboxCollision.js`, `src/physics/capsule.js`), per character
  per state per frame, replacing a single fixed rectangle. The depth axis is
  kept because limbs swing further through it than a hitbox's own radius.
- **Animation-driven translation — root motion** (`src/physics/rootMotion.js`).
  Melee lets an animation move the fighter; ported for the states whose physics
  callback actually reads it.
- **Universal Controller Fix** (`src/physics/ucf.js`) behind a toggle, off by
  default — it is a community mod, not vanilla, and is marked as such.

## Gameplay

Base Melee Light already reproduced Melee by eye and by hand, well enough that
it plays like Melee. What this fork changes is **where the numbers come from** —
hand-tuned approximations replaced with values read out of the game, and
hand-written logic replaced with the decompiled routine. Below is what that
gives you.

- **Dash dancing** driven by `ftCo_Dash_IASA` and the disc's own constants:
  pivot momentum, the redash window and the smash-turn condition.
- **Ground friction** that doubles above walk speed the way Melee's does, so
  wavedashes, dash stops, shield slides and knockdown slides travel the
  distances they travel in Melee. Grabs use plain traction, as Melee does.
- **Hurtboxes as per-frame capsules riding the bones** — the volumes Melee
  actually tests hitboxes against, moving with every frame of every animation,
  in place of a single fixed rectangle. Depth is kept, because limbs swing
  further through it than a hitbox's own radius.
- **Tap jump on Melee's own rule** — threshold plus the stick-tilt timer, with
  the timer stamped expired on takeoff, so one flick gives one jump while a
  pressed X on the same frame still gives a double jump.
- **Both grabs.** Melee has a 30-frame standing grab from jumpsquat and a
  40-frame dash grab from dash and run; base had only the standing one, so
  every run grab was already the fast one. Both exist here, with the dash
  grab's animation, hitboxes, hurtboxes and frame data generated from the disc,
  and grab beats shield out of a dash — which is what makes jump-cancel
  grabbing worth doing.
- **Ledge states on Melee's ledge-specific collision** rather than the general
  ground/wall resolver.
- **Character-accurate specials** — Falco's Phantasm carries its own knockback
  including the downward aerial angle, Fox and Falco's Illusion travels flat,
  and Falcon Kick's air recovery, Falcon Punch's windup and Marth's Dolphin
  Slash all carry the fighter the distance the animation says.
- **Projectile knockback along the direction of travel**, so a laser sends you
  the way it was fired regardless of how fast it crossed you — the same rule
  applied to shield pushback.
- **Per-character values derived per character.** Where Melee gives two
  characters different numbers, they now have different numbers.

## Additions

Things this fork adds that base Melee Light does not have at all.

- **Hitbox and hurtbox display.** A toggle that draws the real collision
  volumes: hurtboxes as the capsules Melee actually tests against — riding the
  bones, moving every frame — in Melee's own colours, including the different
  colouring for intangible and invulnerable states, and hitboxes alongside
  them. Useful for verifying the port, and for learning spacing.
- **Universal Controller Fix**, behind a toggle and **off by default**, ported
  from [AltimorTASDK/ucf](https://github.com/AltimorTASDK/ucf) — the source the
  distributed Gecko codes are generated from — rather than from the codes
  themselves. UCF is a community mod rather than vanilla behaviour, so it is
  kept separate and labelled as such: turning it on is an explicit choice, and
  leaving it off gives you unmodified Melee behaviour.
- **Stage VFX** split out from effect VFX as its own toggle, off by default,
  so background effects can be disabled without losing hit effects.
- **Music mute**, muted by default and remembered between sessions.
- **Debug overlay** with live frame timings for game logic and rendering.
- **A replay dump tool** (`tools/replay_dump.py`) that decodes a recorded
  replay and reports each player's position frame by frame.

---

## Build, tooling and infrastructure

- **Webpack 5 / Babel 7 migration.** The old webpack 1 setup could no longer be
  installed — `deepstream.io` depended on `uws`, which was unpublished. Babel
  now does exactly one thing: strip Flow types.
- **A frame loop driven by `requestAnimationFrame`**, at most one logic frame
  per video frame and no catch-up, matching how Melee behaves rather than
  accumulating a backlog.
- **`tools/`** — the extraction and verification pipeline: 57 tools that read
  the disc, plus a Chrome DevTools Protocol harness and its probes, which drive
  the running game so behaviour can be measured rather than argued about.
- **`test/`** — a guard suite wired into `npm test`, each check written against
  a specific failure this port hit.
- **0 npm vulnerabilities**, with the shipped bundle containing only `howler`,
  `jquery`, `localforage` and `pako`.

## Known issues

This is a work in progress and is not a finished, faithful Melee. What is
listed here is what is known to be incomplete — it is not exhaustive, and
anything not covered by a check in `npm test` should be assumed unverified.

**Many attacks still need polish.** The port went depth-first through movement,
collision and the shared systems. Individual moves were only touched where they
came up, so a great deal of per-move behaviour is still base Melee Light's
hand-tuned version: IASA windows, autocancel points, landing lag, hitbox
timings on moves nobody has checked, and the shape of the velocity curves
inside specials. Hitbox *values* are corroborated in bulk against the disc, but
a move's feel is more than its hitbox. Expect rough edges, especially on
character-specific specials.

**Coverage is partial by construction.**

- Roughly 210-230 action states per character have no generated hurtbox data —
  they fall back to the old rectangle. The generator only emits a state it can
  map to a subaction *and* give a frame count.
- 159 character/state pairs are skipped by the hurtbox alignment check because
  they have no animation art.
- Marth's cape is simulated at runtime rather than animated, and a handful of
  his poses are still generated rather than traced.

**Open questions.**

- **Gravity "feels floaty" to some players.** Gravity itself is ruled out: all
  212 character attributes match the disc, the fall routine is a faithful
  `ftCommon_Fall`, and measured jump arcs are exact per frame. If something is
  off it is more likely aerial friction, fastfall engagement, or a state
  applying gravity where it should not.
- One knockback measurement on Fox's laser could not be explained and could not
  be reproduced cleanly; see `TODO-rootmotion.md` before changing anything
  there.

**Not ported.**

- **Environmental collision** (`mpcoll.c`) is still Melee Light's own. This is
  the largest single gap — it underpins ledges, walls, ceilings and platform
  edges, and validating it properly needs a Dolphin TAS replay to compare
  against.
- **Netplay** is disabled and untouched. It predates all of this and has not
  been tested against any of the changes.
- The frame loop is driven by `requestAnimationFrame`, so a backgrounded tab
  stops advancing entirely.
- Several root-motion states are measured but deliberately not wired, and a few
  `_Phys` families were never surveyed.

**`TODO-rootmotion.md`** carries the detailed list: what is measured and not
yet ported, what was checked and found already correct, and what should *not*
be changed — including several cases where the disc data looks wrong at a
glance and is not.
