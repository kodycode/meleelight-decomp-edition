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

![Starting Scene](https://raw.githubusercontent.com/amilajack/meleelight/master/screenshots/starting.png)
![Gameplay Scene](https://raw.githubusercontent.com/amilajack/meleelight/master/screenshots/scene.png)

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

## Gameplay differences

How this fork plays differently from base Melee Light. Each entry is what the
game does now, against what it did before.

- **Dash dancing.** Pivot momentum now fully reverses and the redash and
  smash-turn windows come from `ftCo_Dash_IASA`. Previously a pivot stalled the
  dash rather than carrying it through.
- **Tap jump gives one jump.** Holding up off the ground used to spend the
  grounded jump and the double jump together. Pressing X on the takeoff frame
  still gives an instant double jump, as it does in Melee.
- **Getting up from a ledge works.** Rolling or attacking off the ledge used to
  push the fighter back down onto it.
- **Sliding stops at the right distance.** Melee doubles ground friction above
  walk speed, so wavedashes, dash stops, shield slides out of a run and
  knockdown slides all carried noticeably too far before. Grabs are the
  exception and use plain traction.
- **The dash grab exists.** Melee has two grabs — a 30-frame standing grab from
  jumpsquat and a 40-frame dash grab from dash and run. Base Melee Light had
  only the standing one, which meant every run grab was already the fast one
  and jump-cancel grabbing bought nothing. Both now exist, with the dash grab's
  animation, hitboxes, hurtboxes and frame data generated from the disc, and
  grab beats shield out of a dash so the tech is reachable.
- **Hurtboxes follow the character.** They are capsules riding bones now, per
  frame, rather than one fixed rectangle around the fighter — visible with the
  hurtbox display toggle, and used for hit detection.
- **Fox and Falco's Illusion travels flat.** It used to slope downward and lose
  height, which cost it distance off a ledge.
- **Falco's Phantasm has its own knockback**, including the downward aerial
  angle that defines the move. It previously used Fox's Illusion values.
- **Falcon Kick's air recovery, Falcon Punch's windup slide and Marth's
  Dolphin Slash ground slide** all move the fighter. None of them did.
- **Jigglypuff's Rollout is playable.** Releasing it used to crash the game,
  and its grounded hitboxes now carry the grounded values rather than the
  aerial ones.
- **Projectiles knock you the way they are travelling.** A laser that crossed
  your centre within a single frame used to knock you backwards into the shot.
- **Character data is no longer shared where Melee differs.** Several values
  had been duplicated between characters — Falco's dash-attack travel and his
  up-smash and ledge-jump durations from Fox, Jigglypuff's ledge-jump duration
  from her own quick variant, Fox's dash-attack table from Jigglypuff.

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

## Known gaps

`TODO-rootmotion.md` tracks what is measured but not yet ported, what was
checked and found already correct, and what should *not* be "fixed" — including
several cases where the disc data looks wrong at a glance and is not.
