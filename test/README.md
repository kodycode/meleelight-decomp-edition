# Tests

`npm test` runs everything here in sequence. It is not a unit-test suite so
much as a set of guards against the failure modes this port actually hit —
**every check below exists because something broke in that exact way**, and
each one was negative-tested by re-injecting the bug it guards to prove it
catches it.

The bias is toward checks that are cheap, static, and impossible to argue with.
A physics port fails quietly: a table one entry short reads `undefined`,
becomes `NaN`, and the fighter stops existing without an error anywhere.

```
npm test
```

Individual checks run standalone, e.g. `node test/check-root-motion.mjs`.
Several take `--verbose` for the full ranking rather than just failures.

## Structural

| Check | Guards |
|---|---|
| `check-parse.mjs` | Every source file parses |
| `check-strip.mjs` | Flow type stripping is sound |
| `check-undefined.mjs` | No unresolved identifiers anywhere in `src/` |
| `check-stubs.mjs` | Every stubbed export the bundle needs still exists |

`check-undefined` has already caught a missing import that would otherwise
have shipped — it is the cheapest check here and the one that pays out most.

## Data integrity

| Check | Guards |
|---|---|
| `check-frame-tables.mjs` | Every per-frame table indexed by `player.timer` covers its state's frame count |
| `check-data-wired.mjs` | Generated data modules are reachable from the bundle entry |
| `check-state-durations.mjs` | A state's last frame follows from *its own* character's animation length |
| `check-hitbox-ids.mjs` | A state never assigns more hitbox ids than its hitbox object defines |

Why each exists:

- **`check-frame-tables`** — a knocked-down opponent rolled and vanished for
  the rest of the match. `setVelocities[timer-1]` ran off the end, returned
  `undefined`, multiplied into `NaN`, and a `NaN` position never lands inside a
  blastzone and never compares true against anything. Nineteen tables were
  short.
- **`check-data-wired`** — 10 MB of hurtbox capsules were generated and never
  imported. Webpack only bundles what is reachable, so the registration never
  ran and every consumer silently took its fallback path, including hit
  detection. Nothing errored. This walks the import graph from the entry rather
  than grepping for an import line.
- **`check-state-durations`** — Falco's move files are derived from Fox's, and
  four terminal frames came across with them: his up smash ended two frames
  early and both ledge jumps six frames early, against animations that are
  genuinely longer than Fox's.
- **`check-hitbox-ids`** — Jigglypuff's Rollout crashed the moment it was
  released. The state assigns `hitboxes.id[0..2]`; her grounded hitbox object
  was built with one `createHitbox`, so the other two were `undefined`.

## Physics fidelity

| Check | Guards |
|---|---|
| `physics.test.mjs` | ~370 assertions on the ported physics |
| `check-ground-friction.mjs` | States whose Melee physics is `ft_80084F3C` apply the above-walk-speed friction doubling |
| `check-root-motion.mjs` | Movement tables still match the disc's animation-driven translation |
| `check-hurtbox-alignment.mjs` | Hurtbox capsules sit on the body that is actually drawn |
| `check-music-volume.mjs` | Music volume is only ever written through `applyMusicVolume` |

Why each exists:

- **`check-ground-friction`** — `ft_80084F3C` doubles ground friction above
  walk speed, which is only observable while sliding fast. Five states passed
  `false` for it, so wavedashes, dash stops and shield slides all carried too
  far, and at rest everything looked correct.
- **`check-root-motion`** — compares totals rather than per-frame values,
  because hand-recorded tables carry ~0.1 of noise while a total that has
  drifted is a real change in distance travelled. It caught Falco's dash attack
  using Fox's numbers (32.90 units against a real 38.49) the first time it ran.
- **`check-hurtbox-alignment`** — took three attempts to get right, which is
  worth knowing before changing it. Extent overhang flags 145 states because
  capsules are fat cylinders and always bulge past a traced outline. Absolute
  centre offset flags 140 and merely ranks characters by weapon length. What
  works is centre offset measured against **each character's own spread**, so
  Marth's sword cancels out. Three residual outliers are recorded in the file
  with the evidence that they are not displacement.
- **`check-music-volume`** — muting persisted until the match ended and the
  menu music came back. Volume was being written from more than one place.

## Conventions

- Checks print a one-line summary on success and a `FAIL` line per problem,
  then exit non-zero. Keep that shape — `npm test` chains with `&&`.
- Prefer a check that fails loudly over a threshold loose enough to always
  pass. Where a heuristic is unavoidable, record known-good outliers explicitly
  by name so a *new* one still fails.
- Say **why** in the file. Every check here opens with the bug it was written
  for; that comment is the reason anyone will trust it later.
