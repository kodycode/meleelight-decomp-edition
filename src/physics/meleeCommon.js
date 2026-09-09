//
// struct ftCommonData -- global fighter constants.
//
// SOURCE OF TRUTH
// ---------------
// These are NOT hand-tuned. Every value below was read out of PlCo.dat from a
// retail v1.02 (GALE01) disc, at the offsets given by the decomp's struct
// definition in src/melee/ft/types.h (struct ftCommonData, line 24). The
// struct was located by range-checking the deadzone/threshold block at its head;
// exactly one candidate matched.
//
// Values are written as the exact decimal expansion of the float32 the game
// loads, so they are bit-identical to the console's `lfs` result. Do not
// "tidy" them to round numbers -- 0.2800000011920929 is the real deadzone and
// 0.28 is not the same number.
//
// Semantic cross-check that the struct is correctly located: x20_radians reads
// 0.8726646304130554, which is exactly 50 degrees in radians (50 * pi / 180).

// --- input deadzones (types.h +0x00 .. +0x18) -------------------------------

// The stick deadzone Melee applies before movement code ever sees the value.
// meleelight historically hardcoded 0.3 for this; the real value is 0.28.
export const HORIZONTAL_STICK_DEADZONE = 0.2800000011920929;  // x000
export const VERTICAL_STICK_DEADZONE = 0.2800000011920929;  // x004
export const HORIZONTAL_STICK_SMASH_DEADZONE = 0.25;  // x008
export const VERTICAL_STICK_SMASH_DEADZONE = 0.25;  // x00C
export const ANALOG_SHOULDER_DEADZONE = 0.30000001192092896;  // x010
export const Z_PRESS_ANALOG_VALUE = 0.3499999940395355;  // x014
export const SHIELD_PRESS_THRESHOLD = 0.25;  // x018

// --- walk / dash thresholds (types.h +0x20 .. +0x3C) ------------------------

export const X20_RADIANS = 0.8726646304130554;  // x020 -- 50 degrees
export const WALK_STICK_THRESHOLD = 0.18000000715255737;  // x024
export const WALK_MIDDLE_ANIMATION_STICK_THRESHOLD = 0.4000000059604645;  // x028
export const WALK_FAST_STICK_THRESHOLD = 0.800000011920929;  // x02C
export const WALK_ACCEL_TAPER_GAIN = 0.5;  // x030
export const DASH_SMASH_STICK_THRESHOLD = 0.800000011920929;  // x03C

// --- friction multipliers ---------------------------------------------------

// Applied to ground_friction when ABS(gr_vel) > walk_max_vel.
// See ft_80084F3C (ft_084E.c:42). meleelight's hardcoded `traction * 2` was
// correct -- this confirms it from game data rather than assumption.
export const FRICTION_WHEN_ABOVE_WALK_SPEED = 2.0;  // x06C

// x200: multiplies ground_friction when decaying KNOCKBACK velocity
// (fighter.c:2226). Distinct from the self-movement friction path.
export const KNOCKBACK_GROUND_FRICTION_MULTIPLIER = 1.0;  // x200

// x3EC: same idea for the attacker's shield-knockback decay (fighter.c:2280).
export const SHIELD_GROUND_FRICTION_MULTIPLIER = 1.100000023841858;  // x3EC

// The attacker's pushback when their attack hits a shield (fighter.c:3011):
//     eval = (shielder_lightshield * int_damage) * x3E0 + x3E4
// x3E4 is the same 0.02 floor meleelight already had; x3E0 replaces its
// float64 0.1 coefficient once the lightshield reparametrisation is undone.
export const ATTACKER_SHIELD_PUSHBACK_SLOPE = 0.07000000029802322;  // x3E0
export const ATTACKER_SHIELD_PUSHBACK_BASE = 0.019999999552965164;  // x3E4

// x46C: the downward velocity given when dropping through a platform. Melee
// assigns it in ftCo_8009A228 (ordinary PASS) and ftCo_8009A184 (the drop out
// of a special, e.g. shine platform drop) -- ftCo_Pass.c:83 and :95, both
// `fp->self_vel.y = p_ftCommonData->x46C`. The fighter is airborne from that
// instant, so this is a self_vel write and belongs on cVel, not gr_vel.
export const PLATFORM_DROP_VELOCITY = -0.5;  // x46C

// x164: cap on the scalar seeded into xF0_ground_kb_vel when knockback is
// transferred to the ground (ftCommon_8007CCE8, ftcommon.c:191). Clamped
// symmetrically, so grounded knockback cannot start faster than this however
// hard the hit was.
export const GROUND_KB_SEED_CAP = 8.300000190734863;  // x164

// x3E8: per-frame decay of the ATTACKER's shield knockback while airborne
// (fighter.c:2240). Note it is not the same value as x204, the ordinary
// knockback decay -- 0.05 against 0.051.
export const SHIELD_KB_FRAME_DECAY = 0.05000000074505806;  // x3E8

// --- ground locomotion ------------------------------------------------------
//
// Accel taper gains. Applied as `accel *= (1 - gr_vel/target_vel) * gain`, but
// only when that ratio is strictly between 0 and 1 -- so the taper does NOT
// engage when velocity opposes the target, or when already past it.
// WALK uses WALK_ACCEL_TAPER_GAIN, declared above (ftwalkcommon.c:203).
// RUN:   ftCo_Run_Phys         (ftCo_Run.c:139)
export const RUN_ACCEL_TAPER_GAIN = 0.4000000059604645;  // x05C

// Friction multiplier for dash / run / turnrun / runbrake. WALK is the only
// ground state that passes raw ground_friction instead (ftwalkcommon.c:208).
// It is 1.0 in retail, so it changes nothing numerically -- but it is in the
// original and would matter against a modified PlCo.dat.
export const RUN_DASH_TURN_FRICTION_MULTIPLIER = 1.0;  // x060

// Stick thresholds. meleelight hardcoded 0.62 and -0.3 for these; the real
// values are 0.625 and -0.375.
export const X58_STICK_THRESHOLD = 0.625;  // x058 -- dash->run entry, run->runbrake exit
export const X38_STICK_THRESHOLD = -0.375;  // x038 -- run->runturn entry

// Dash entry gate: |lsX| >= DASH_SMASH_STICK_THRESHOLD (declared above)
// AND x670_timer_lstick_tilt_x < this window.
// ftCo_Dash_CheckInput (ftCo_Dash.c:27)
export const DASH_SMASH_WINDOW = 2;  // x040

// Escaping TUMBLE (ftCo_MS_DamageFall) by wiggling, ftCo_DamageFall_IASA
// (ftCo_DamageFall.c:124):
//
//   ABS(lstick[0].x) >= x210 && x670_timer_lstick_tilt_x < x214
//
// X AXIS ONLY -- up and down do not escape tumble in Melee -- and the window
// is x214 = 1, an INT, so only the frame the stick crossed the smash deadzone
// counts. That single frame is why wiggling out is famously controller
// dependent, and it is why UCF ships a `tumble` module alongside dashback:
// both apply the same tilt-intent test to rescue a genuine flick.
export const TUMBLE_WIGGLE_STICK_THRESHOLD = 0.800000011920929;  // x210
export const TUMBLE_WIGGLE_WINDOW = 1;                           // x214, an INT

// ftCo_Dash_IASA's FIRST branch (ftCo_Dash.c:84):
//
//   if ((fp->mv.co.dash.x4 != 0) && (fp->cur_anim_frame <= x44)) { ... }
//
// which falls through to block_42 and skips ftCo_Dash_CheckInput entirely --
// so a dash entered from Dash_CheckInput (x4 == 1) cannot smash turn or
// re-dash while it is this young. A dash entered out of a turn carries x4 == 0
// and is not gated at all.
//
// meleelight already tested `timer > 4` here; this names the number and puts
// it under validate_constants.py so it is checked against the disc rather than
// being an unsourced literal.
export const DASH_SMASH_BLOCK_FRAME = 4;  // x044

// ftCo_Dash_IASA's branch boundary (ftCo_Dash.c:101), read off the disc.
//
// Up to and including this animation frame the dash only answers a flick that
// OPPOSES the facing -- the pivot -- because branch 2 short-circuits
// ftCo_Dash_CheckInput unless `lstick[0].x * facing_dir < 0`. Past it, branch 3
// calls ftCo_Dash_CheckInput unconditionally, so a SAME-direction flick
// re-dashes and extends the dance.
//
// This is GLOBAL. meleelight had a per-character `dashFrameMax` set to
// framesData.DASH - 1, which only ever opened the re-dash on the dash's final
// frame: frame 22 for Fox but frame 29 for Falcon, against 21 for everyone in
// Melee. The per-character spread people feel here comes from the DASH
// animation being different lengths, not from this number.
export const DASH_REDASH_FRAME = 20;  // x04C

// Multiplicative gr_vel decay applied every Dash IASA frame:
//   gr_vel += -(gr_vel * x54) * groundFrictionMultiplier
// Applied DIRECTLY to gr_vel, not through the accel channels.
// ftCo_Dash_IASA (ftCo_Dash.c:138)
export const X54_DASH_GRVEL_DECAY = 0.75;  // x054

// Frames of run that cannot be interrupted by TurnRun/RunBrake, granted only
// on the TurnRun -> Run transition. ftCo_Run.c:44 via fn_800CA644.
export const X430_RUN_HOLD_FRAMES = 10.0;  // x430

// RunBrake animation freeze threshold on |gr_vel|. ftCo_RunBrake.c:53
export const X42C_RUNBRAKE_ANIM_FREEZE = 0.0;  // x42C

// Teeter gate on walk entry. ftCo_Walk_CheckInput_Ottotto (ftCo_Walk.c:46)
export const TEETER_WALK_THRESHOLD = 0.75;  // x474

// --- knockback --------------------------------------------------------------
//
// The KNOCKBACK macro, ftColl_80079AB0 (ftcoll.c:2377/2387):
//
//   inner_expr = x11C * ((xF8 - (w*xF8)/(1+w)) * inner) + x120
//   term       = 0.01 * kb_growth * inner_expr + base_kb
//   result     = defense * (attack * (stage * term))
//   where w = weight * xF4
//
// x11C and x120 are the 1.4 and 18 of the community-known formula.
export const WEIGHT_PRESCALE = 0.009999999776482582;  // xF4
export const WEIGHT_CURVE_NUM = 2.0;                  // xF8
export const LAUNCH_SPEED_MUL = 0.029999999329447746; // x100, kb -> velocity
export const KB_MIN = 0.0;                            // x104
export const KB_CAP = 2500.0;                         // x108
export const PERCENT_LINEAR = 0.10000000149011612;    // x110
export const PERCENT_X_DAMAGE = 0.05000000074505806;  // x114
export const SETKB_PSEUDO_PERCENT = 10.0;             // x118
export const KB_OUTER_MUL = 1.399999976158142;        // x11C
export const KB_OUTER_ADD = 18.0;                     // x120
export const KB_SQUAT_MUL = 0.6666666865348816;       // x124, crouch cancel

// Knockback stacking window, ftCo_Damage_CalcVel (ftCo_Damage.c:216).
// NB: this field is an INT (10), not a float. Reading it as a float yields a
// denormal (1.4e-44) -- a useful tell that a field has been mistyped.
export const KB_STACK_WINDOW = 10;                    // xFC

// Sakurai angle (361). ftCo_Damage_CalcAngle (ftCo_Damage.c:79).
// Airborne is a fixed 45 degrees; grounded is a linear ramp between
// SAKURAI_LO and SAKURAI_HI, clamped to SAKURAI_MAX_DEG.
export const SAKURAI_AIR_RADIANS = 0.7853981852531433; // x144 == PI/4
export const SAKURAI_MAX_DEG = 44.0;                   // x148
export const SAKURAI_LO = 32.0;                        // x14C
export const SAKURAI_HI = 32.099998474121094;          // x150

export const HITSTUN_MUL = 0.4000000059604645;         // x154
export const AIRBORNE_KB_RESCALE = 0.949999988079071;  // x190

// Launch ("reaction") level, ftCo_Damage.c:298-316. The thresholds are applied
// to knockback * x154 -- which is the hitstun frame count -- so the levels are
// really hitstun bands: <10, <21, <32, else 3. Level 3 is tumble, and it is the
// level that keeps a grounded victim airborne instead of sliding them.
export const LAUNCH_LEVEL_1 = 10.0;                    // x158
export const LAUNCH_LEVEL_2 = 21.0;                    // x15C
export const LAUNCH_LEVEL_3 = 32.0;                    // x160

// Grounded launch geometry, ftCo_Damage.c:372-379. x1E8 is 10 degrees in
// radians: past 90+10 degrees from the floor normal, a level-3 launch bounces
// off the ground with its Y component reflected and scaled by x1EC.
export const GROUND_LAUNCH_BOUNCE_RADIANS = 0.1745329201221466;  // x1E8
export const GROUND_LAUNCH_BOUNCE_YMUL = 0.800000011920929;      // x1EC

// Hitlag. ftCommon_CalcHitlag (ftcommon.c:640): int tmp = dmg*x198 + x19C,
// then (int)(tmp * mul). Note the DOUBLE integer truncation.
export const HITLAG_CAP = 20.0;                        // x194
export const HITLAG_SLOPE = 0.3333333432674408;        // x198
export const HITLAG_ADD = 3.0;                         // x19C
export const HITLAG_CROUCH_MUL = 0.6666666865348816;   // x1A0
export const HITLAG_ELECTRIC_MUL = 1.5;                // x1A4

// DI. ftCo_8008E5A4 (ftCo_Damage.c:591). Max angle swing in DEGREES.
// Applied ONCE, on the frame hitlag ends -- not every frame.
export const MAX_DI_DEGREES = 18.0;                    // x1A8

// Shield-button knockback scale, applied to the VELOCITY on hitlag exit
// (ftCo_Damage.c:655). It is 1.0 in retail -- i.e. a no-op. meleelight's
// `vCancel *= 0.95` used the right number in the wrong place: the real 0.95 is
// AIRBORNE_KB_RESCALE above, applied to velocity magnitude in a different path.
export const LR_KB_SCALE = 1.0;                        // x1AC

// Per-frame knockback decay, Fighter_procUpdate (fighter.c:2200). The angle is
// RECOMPUTED from the current kb vector every frame, and both axes are zeroed
// once |kb| falls below this. meleelight froze the decay at launch instead.
export const KB_FRAME_DECAY = 0.050999999046325684;    // x204

// Horizontal air decay for a fighter travelling FASTER than its air drift max.
// ftCommon_8007CF58 (ftcommon.c:283) picks between this and the character's own
// aerial_friction depending on which side of air_drift_max the speed is on --
// so a fighter flung past its own drift cap is reined in at a fixed rate that
// does not depend on the character.
export const OVER_MAX_AIR_DECAY = 0.029999999329447746;  // x1FC

// --- jump and crouch input --------------------------------------------------
//
// Tap jump is ONE rule everywhere in Melee (ftCo_Jump_GetInput, ftCo_Jump.c:30;
// ft_did_jump, ftCo_JumpAerial.c:46):
//
//   lstick[0].y >= tap_jump_threshold && x671_timer_lstick_tilt_y < tap_jump_window
//
// i.e. the stick is at or past the threshold NOW and entered the smash deadzone
// within the last few frames. It reuses the same tilt timer SDI does, so a
// slow upward roll still registers.
//
// meleelight had three different tests with three different thresholds (0.66,
// 0.69, 0.7) and three different recency proxies -- "three frames ago below
// 0.2", "crossed this frame", and no recency at all.
export const TAP_JUMP_THRESHOLD = 0.6625000238418579;   // x070
export const TAP_JUMP_WINDOW = 4;                       // x074, INT
export const TAP_JUMP_RELEASE_THRESHOLD = 0.30000001192092896; // x07C
export const RELAXED_TAP_JUMP_THRESHOLD = 0.5625;       // x080

// Fastfall, ftCommon_CheckFallFast (ftcommon.c:495):
//
//   !fall_fast && self_vel.y < 0 && lsY <= -x88 && tiltTimerY < x8C
//
// then it PINS tiltTimerY to 254, the same refractory lock SDI uses -- one
// downward flick gives one fastfall. meleelight used 0.65 with "three frames
// ago above -0.1" and no lock.
export const FASTFALL_STICK_THRESHOLD = 0.6625000238418579;  // x088
export const FASTFALL_WINDOW = 4;                            // x08C, INT

// Dropping through a platform, ftCo_80099F1C (ftCo_Pass.c:28):
//
//   lsY <= -x464 && tiltTimerY < x468 && mpColl_IsOnPlatform(...)
//
// A SIX frame window, the longest of the lot, and a threshold of 0.66 that is
// deliberately NOT the 0.6625 fastfall uses -- pressing down through a platform
// is slightly easier than fastfalling.
export const PLATFORM_DROP_STICK_THRESHOLD = 0.6600000262260437;  // x464
export const PLATFORM_DROP_WINDOW = 6.0;                          // x468, a FLOAT

// Jump by C-STICK, ftCo_800DF644 (ft_0DF1.c:109): `cstick[1].y < x7F4 &&
// cstick[0].y >= x7F4`. Same value as the ledge-attack c-stick gate and as
// tap_jump_threshold, but a separate field.
export const CSTICK_JUMP_THRESHOLD = 0.6625000238418579;  // x7F4

// Ledge attack by C-STICK, ftCo_800DF6F8 (ft_0DF1.c:130): a crossing test on
// the c-stick's Y, `cstick[1].y < x7F8 && cstick[0].y >= x7F8`. The c-stick has
// no tilt timer of its own, so this one really is a frame-to-frame crossing.
export const LEDGE_ATTACK_CSTICK_THRESHOLD = 0.6625000238418579;  // x7F8

// --- smash and dash input ---------------------------------------------------
//
// Every one of these is the same shape as tap jump: a threshold on the stick
// NOW, plus the tilt timer being inside a window. Melee reuses x670/x671 for
// all of them, which is why the timers are worth having.
//
//   dash / smash turn  ftCo_Dash.c:35      |lsX| >= x3C  && tiltX < x40 (2)
//   forward smash      ftCo_AttackS4.c:53  |lsX| >= x3C  && tiltX < x40 (2)
//   up smash           ftCo_AttackHi4.c:24  lsY  >= xCC  && tiltY < xD0 (4)
//   down smash         ftCo_AttackLw4.c:25  lsY  <= xD4  && tiltY < xD8 (4)
//
// meleelight used 0.79 and 0.66 with an "input two frames ago was below 0.3"
// proxy for the window. The windows are also NOT the same: 2 frames for the
// horizontal, 4 for the vertical.
// DASH_SMASH_STICK_THRESHOLD and DASH_SMASH_WINDOW are declared further up --
// they were already extracted for the dash-entry gate. Like the SDI constants,
// they had never been wired into checkForDash/checkForSmashTurn, which were
// still comparing against 0.79 with a frame-lookback of their own.
export const UP_SMASH_STICK_THRESHOLD = 0.6625000238418579;   // x0CC
export const UP_SMASH_WINDOW = 4.0;                           // x0D0, a FLOAT
export const DOWN_SMASH_STICK_THRESHOLD = -0.6625000238418579; // x0D4
export const DOWN_SMASH_WINDOW = 4.0;                         // x0D8, a FLOAT

// Which special a B press selects. Four independent predicates, evaluated per
// frame into the x687/x688/x689 timers (fighter.c:1729-1744):
//
//   side     ftCo_SpecialS.c:15    B && |lsX| >= x218
//   up       ftCo_Attack100.c:80   B &&  lsY  >= x21C
//   down     ftCo_Attack100.c:57   B &&  lsY  <  -x21C
//   neutral  ftCo_0D67.c:4         B && |lsX| < x218 && |lsY| < x21C
//
// so the horizontal and vertical gates are DIFFERENT constants: 0.6 and 0.55.
// meleelight used 0.59 and 0.54.
export const SPECIAL_STICK_X_THRESHOLD = 0.6000000238418579;  // x218

// x21C is the vertical half of the above AND Marth's Dancing Blade direction
// split (ftmarsspecials.c:294/434/569) -- one field serving both, which is why
// it is named for the quantity rather than for either call site. meleelight
// had 0.54 in the special select and 0.56 in fourteen Dancing Blade files,
// neither matching the other nor the game.
export const SPECIAL_STICK_Y_THRESHOLD = 0.550000011920929;  // x21C

// Crouch is a HYSTERESIS band, which meleelight had as two unrelated numbers:
//
//   enter    ftCo_Squat.c:38     lstick[0].y <  -x90 (0.6875)
//   release  ftCo_SquatRv.c:34   lstick[0].y >  -x94 (0.625)
//
// so between 0.625 and 0.6875 the crouch is sticky -- pushing down that far
// does not start a crouch, but easing back that far does not end one either.
// meleelight used 0.69 and 0.61, a band 25% wider on the release side.
//
// Note also there is no tilt-timer term on either: holding down keeps you
// crouching, where holding up does NOT keep you jumping.
export const SQUAT_STICK_THRESHOLD = 0.6875;            // x090
export const SQUAT_RELEASE_STICK_THRESHOLD = 0.625;     // x094

// --- air dodge --------------------------------------------------------------
//
// ftCo_EscapeAir.c:36-52 (enter) and :97-105 (per-frame decay).
//
//   if (|lstick.x| < dz.x && |lstick.y| < dz.y) { self_vel = 0; }
//   else { a = atan2f(lstick.y, lstick.x);
//          self_vel.x = force * cosf(a); self_vel.y = force * sinf(a); }
//
// The deadzone is the correction that matters: meleelight's test was
// `|x| > 0 || |y| > 0`, so any stick drift at all launched a full-speed dodge
// in that direction. Melee needs a quarter deflection on at least one axis.
export const ESCAPEAIR_DEADZONE_X = 0.25;              // x32C
export const ESCAPEAIR_DEADZONE_Y = 0.25;              // x330
export const ESCAPEAIR_FORCE = 3.0999999046325684;     // x338
export const ESCAPEAIR_DECAY = 0.8999999761581421;     // x33C

// --- walljump ---------------------------------------------------------------
//
// ftCo_800C1E64 / ftCo_PassiveWall_Anim (ftCo_PassiveWall.c:63, 128-148).
//
// Entering a walljump zeroes EVERY velocity channel (ftCommon_8007E2FC ->
// ftcommon.c:911) and sets a countdown. The launch velocity is not applied
// until that countdown reaches zero, and ftCo_PassiveWall_Phys is gated on
// `if (!timer)` -- so for those frames the fighter hangs on the wall with no
// gravity, no fastfall and no drift at all.
export const PASSIVE_WALL_JUMP_TIMER = 5;              // x774, INT

// Repeated walljumps lose height: vel_y *= powf(base, walljumps_already_used).
// meleelight used 0.97; the disc says 0.975. The exponent is an int but powf
// has no integer path (DOL 0x8000CEE0) -- it goes through exp(y*log(x)) like
// any other exponent, so this is not the same as repeated multiplication.
export const PASSIVE_WALL_VEL_Y_BASE = 0.9750000238418579;  // x778

// SDI. ftCo_Damage_OnEveryHitlag (ftCo_Damage.c:569).
export const SDI_MIN_STICK_MAG = 0.699999988079071;    // x4B0
export const SDI_STICK_WINDOW = 4;                     // x4B4, INT not float
export const SDI_POS_SCALE = 6.0;                      // x4B8
export const ASDI_SCALE = 3.0;                         // x4BC

// --- shield -----------------------------------------------------------------
//
// Shieldstun. ftCo_80092F2C (ftCo_Guard.c:661):
//
//   f = x28C * (dmg * (1 - ((lightshield_amount * (x2E8 - x2E4)) + x2E4))) + x290
//
// f is the stun DURATION IN FRAMES. Melee never stores it in a counter -- it
// sets the GuardSetOff animation rate so the animation lasts exactly f frames:
//   ftAnim_SetAnimRate(gobj, (0.1f + animEndFrame) / f)
// which is why the state's Phys callback contains no stun logic at all.
//
// The same expression appears standalone as ftCo_80092ED8 (ftCo_Guard.c:652),
// called by Link and Young Link.
export const SHIELDSTUN_SLOPE = 1.5;              // x28C
export const SHIELDSTUN_OFFSET = 2.0;             // x290

// Shield TILT, from ftCo_80091BC4 (ftCo_Guard.c:130). Both the tilt angle and
// its magnitude are smoothed toward the stick by the same factor each frame:
//
//   guard.x8 = 10 + wrap(delta * x44C + guard_deg)   // angle, in DEGREES
//   guard.x4 += x44C * (min(|stick|, 1) - guard.x4)  // magnitude, 0..1
//
// A half-life of one frame, not meleelight's `/5 + 0.01`.
export const SHIELD_TILT_SMOOTHING = 0.5;         // x44C

// Shield SIZE, from the inline at ftCo_Guard.c:177:
//   n1 = (health / x260) * (lightshield * (x2D8 - x2D4) + x2D4)
//   size = ((1 - x264) * n1 + x264) * initial_shield_size
// so a shield at zero health is still x264 of its full size, and a fully light
// shield is x2D8 of a hard one. x260 is SHIELD_START_HEALTH, declared below
// with the rest of the shield HP constants.
export const SHIELD_SIZE_FLOOR = 0.15000000596046448;   // x264
export const SHIELD_SIZE_HARD = 1.0;              // x2D4
export const SHIELD_SIZE_LIGHT = 0.5;             // x2D8
export const LIGHTSHIELD_STUN_LO = 0.05000000074505806;  // x2E4, hard shield
export const LIGHTSHIELD_STUN_HI = 0.699999988079071;    // x2E8, full light shield

// Defender shield pushback, derived FROM the stun frames (ftCo_Guard.c:688):
//   guard_vel = f * x294;
//   if (!powershielding) guard_vel *= x2BC;
//   if (guard_vel > x298) guard_vel = x298;
//   fp->gr_vel = specialn_facing_dir < 0 ? guard_vel : -guard_vel;
// Note it is written to gr_vel -- the along-ground scalar -- not to a 2D vector.
export const SHIELD_PUSHBACK_PER_FRAME = 0.20000000298023224;  // x294
export const SHIELD_PUSHBACK_CAP = 2.0;                        // x298
export const SHIELD_PUSHBACK_NONPOWERSHIELD_MUL = 0.6000000238418579; // x2BC

// Shield HP. fighter.c:2817-2842. Same lerp shape as stun but its own constants.
export const SHIELD_START_HEALTH = 60.0;          // x260
export const SHIELD_REGEN_PER_FRAME = 0.07000000029802322; // x27C
export const SHIELD_HP_SLOPE = 1.0;               // x284
export const SHIELD_HP_OFFSET = 0.0;              // x288
export const LIGHTSHIELD_HP_LO = 0.10000000149011612;   // x2DC
export const LIGHTSHIELD_HP_HI = 0.30000001192092896;   // x2E0

// --- jump -------------------------------------------------------------------

// x438: fp->self_vel.y *= this, on leaving the ground for a jump.
// See ftCo_800CB110 (ftCo_Jump.c:110).
export const JUMP_YVEL_MULTIPLIER = 0.30000001192092896;  // x438

// x440: scales the walk target velocity stored in mv.co.walk.x0
// (ftwalkcommon.c:207).
export const WALK_TARGET_VEL_SCALE = 1.2999999523162842;  // x440
