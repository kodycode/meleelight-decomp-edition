# Outstanding root-motion work

Everything here is *known and measured*, not suspected. Each item names the
Melee function, the disc numbers, and what meleelight currently does. None of
it changes how the game plays in a way a player would notice — the items that
did have been fixed.

Background: `src/physics/rootMotion.js` and `tools/root_motion.py`.

## Deliberately not done

**PIN — the ledge states.** `rootPin()` data is generated and checked in but
nothing calls it. `ftCo_CliffClimb_Phys` (ftCo_CliffClimb.c:96) positions the
fighter absolutely from the ledge corner rather than by velocity, and
meleelight already reproduces that by hand: Fox's `offset` table matches the
disc to four decimals (frame 15 is (-3.47907, -11.55) there against
(-3.4791, -11.55) on the disc). Rewriting thirty working files to change
nothing in the fourth decimal is not worth the regression risk in the ledge
path, which is where the getup-pushes-you-back-down bug lived. The full
reasoning, and the three conditions that would make it worth wiring, are in the
doc comment on `rootPin`.

## Cosmetic / no gameplay effect

| state | what | size |
|---|---|---|
| Fox, Falco `APPEALSR` | taunt slide; total matches to 0.01, curve is ~2.5x too steep early (disc f2-6 `-0.157,-0.267,-0.359,-0.433,-0.490` vs ml `-0.381,-0.418,-0.446,-0.466,-0.477`) | 5.76 per half, it's a taunt |
| Falcon `SIDESPECIALGROUND` | the 4-frame backstep before the lunge: disc `-1.85651,-3.2965,-3.145,-1.402` vs ml `-1.79163,-3.1017,-3.08,-1.72663`. Identical total (-9.700); the lunge half is already exact | shape only |
| Falcon `DOWNSPECIALAIR` | first 16 frames are hand values within ~0.06-0.44 of the disc; the tail (frames 18-30) is already exact | ~1.5 units |
| Puff `THROWBACK` | shape off by up to 2.37/frame, net displacement 0 either way | net 0 |

## Verified correct — do not "fix"

- **Falcon `UPSPECIALTHROW`.** Its y column sums +2.39 against the disc's
  +29.67 and that is right. `ftCa_SpecialHiThrow0_Phys`
  (ftcaptainspecialhi.c:270) has two regimes: pure root motion until a
  SET_CMD_VAR event flips `x2_b0`, then `ftCa_SpecialHi_Phys` plus
  `ftCommon_Fall(specialhi_catch_grav, terminal_velocity)`. Frames 0-44 match
  the disc to five decimals; from 45 the table falls at ~0.317/frame and clamps
  at -2.9, which is Falcon's `terminalV`. There is a comment on the table
  saying so.
- **Double jump** carries no root motion for any of these five.
  `ftCo_JumpAerial_Phys` is `ft_80084DB0`, which never reads `transNOffset`;
  the `ft_800851D0` path only exists for Ness/Yoshi/Peach/Mewtwo.
- **Marth's aerial Dancing Blade** travels 0.010-0.014 units on the disc, so
  the blunt `cVel.x = 0` in `SIDESPECIALAIR3FORWARD.js` is correct.

## Flagged on the disc but meleelight has no such state

`DownFowardD`/`DownBackD` (face-down getup rolls -- meleelight has one
`DOWNSTAND*` set for both lie directions), Falcon `AttackS4Hi`/`AttackS4Lw`
(no angled f-smash state), and the item-carry states (`SwingDash`,
`LightThrowDash`, `LiftWalk1/2`).

## Not surveyed

Five more `_Phys` families position from `x68C_transNPos` absolutely, the
`CliffClimb` way rather than as velocity, and were out of scope:
`ftCo_PassiveCeil.c:53`, `ftCo_PassiveWall.c:103`, `ftCo_StopWall.c:52`,
`ftCo_StopCeil.c:39`, `ftcliffcommon.c:121`. They map to meleelight's `TECHU`,
`WALLTECH`, `STOPCEIL` and `CLIFFCATCH`.

---

# Unrelated, noticed while fixing the laser direction

**Fox's laser knockback reading.** While verifying the direction fix I measured
the CPU victim taking 53.79 knockback and drifting 13.38 units from Fox's
laser, against 22.8 / 3.82 from Falco's. That is backwards: Fox's laser is
built with `kg = 0, sk = 0` (article.js LASER, `isFox ? 0 : ...`) and his
NEUTRALSPECIALGROUND passes no `isFox`, so it correctly defaults to the
zero-knockback hitbox. With kg and bk both zero the knockback formula returns
0, so the number cannot have come from the laser.

Most likely my probe latched onto a different hit -- the opponent was a live
CPU and I sampled the first frame its `hit.knockback` went positive. Not
confirmed either way. Worth a clean re-measure with the AI disabled before
concluding anything; do NOT change the laser hitbox on the strength of that
number alone.
