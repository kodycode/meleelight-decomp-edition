
import {chars} from "./characters";
import {Vec2D} from "./util/Vec2D";
import {Box2D} from "./util/Box2D";
import {newStaleTable} from "../physics/staling";
/* eslint-disable */

export function ActiveHitbox(size, offset, dmg, angle, kg, bk, sk, type) {
  this.size = size;
  this.offset = offset;
  this.dmg = dmg;
  this.angle = angle;
  this.kg = kg;
  this.bk = bk;
  this.sk = sk;
  this.type = type;
}
export function createHitboxes() {
    this.active = [false, false, false, false];
  this.frame = 0;
  this.id = [new ActiveHitbox(0, new Vec2D(0, 0), 0, 0, 0, 0, 0, 0), new ActiveHitbox(0, new Vec2D(0, 0), 0, 0, 0, 0,
    0, 0), new ActiveHitbox(0, new Vec2D(0, 0), 0, 0, 0, 0, 0, 0), new ActiveHitbox(0, new Vec2D(0, 0), 0, 0, 0,
    0, 0, 0)];
  this.hitList = [];
}
export function physicsObject(pos, face) {
  this.cVel = new Vec2D(0, 0);
  this.kVel = new Vec2D(0, 0);
  this.kDec = new Vec2D(0, 0);
  // Melee's grounded velocity representation. While grounded these scalars are
  // the source of truth and cVel is derived from them by projection onto the
  // floor tangent. See src/physics/groundMovement.js.
  this.grVel = 0;          // fp->gr_vel                  -- self movement
  this.grKBVel = 0;        // fp->xF0_ground_kb_vel       -- knockback
  this.groundAccel1 = 0;   // fp->xE4_ground_accel_1      -- self accel, this frame
  this.groundAccel2 = 0;   // fp->xE8_ground_accel_2      -- knockback accel, this frame
  this.groundNormal = new Vec2D(0, 1);
  // fp->x98_atk_shield_kb / fp->xF4_ground_attacker_shield_kb_vel. The pushback
  // an ATTACKER takes for hitting a shield. A separate channel from cVel and
  // kVel with its own decay rate (x3E8 airborne, ground_friction * x3EC
  // grounded) -- see physics/knockback.js.
  this.shieldKBVel = new Vec2D(0, 0);
  this.grShieldKBVel = 0;
  // mv.co.dash.x0 -- pending dash impulse DELTA (ftCo_Dash.c:61). Non-zero for
  // exactly one frame, during which no stick accel is applied.
  this.dashImpulsePending = 0;
  // Melee's mv.co.dash.x4: ftCo_Dash_Enter's arg1. 1 from Dash_CheckInput,
  // 0 when the dash comes out of a turn, which is what lets a pivot dash
  // pivot again straight away (ftCo_Dash_IASA's first branch).
  this.dashCheckInputEntry = 1;
  // mv.co.turnrun.accel_mul -- facing LATCHED at TurnRun entry (ftCo_TurnRun.c:48).
  // Does not change when facing_dir flips mid-state.
  this.turnRunAccelMul = 1;
  this.turnRunFlipped = false;
  this.pos = new Vec2D(pos[0], pos[1]);
  this.posPrev = new Vec2D(0, 0);
  this.posDelta = new Vec2D(0, 0);
  this.grounded = false;
  this.airborneTimer = 0;
  this.fastfalled = false;
  this.face = face;
  this.ECBp = [new Vec2D(0, 0), new Vec2D(3, 7), new Vec2D(0, 14), new Vec2D(-3, 7)];
  this.ECB1 = [new Vec2D(0, 0), new Vec2D(3, 7), new Vec2D(0, 14), new Vec2D(-3, 7)];
  this.ECB2 = [new Vec2D(0, 0), new Vec2D(3, 7), new Vec2D(0, 14), new Vec2D(-3, 7)];
  this.onSurface = [0, 0];
  this.doubleJumped = false;
  this.shieldHP = 60;
  this.shieldSize = 0;
  this.shieldAnalog = 0;
  this.shielding = false;
  this.shieldPosition = new Vec2D(0, 0);
  this.shieldPositionReal = new Vec2D(0, 0);
  // Melee's shield tilt state (ftCo_Guard.c:130): an angle in DEGREES carrying
  // a constant +10, and a magnitude in 0..1. Each is smoothed toward the stick
  // every frame; the drawn offset is derived from the pair.
  this.shieldTiltAngle = 10;
  this.shieldTiltMag = 0;
  this.shieldStun = 0;
  this.powerShieldActive = false;
  this.powerShieldReflectActive = false;
  this.powerShielded = false;
  this.onLedge = -1;
  this.ledgeSnapBoxF = new Box2D([0, 5], [8, 10]);
  this.ledgeSnapBoxB = new Box2D([0, 5], [-8, 10]);
  this.ledgeRegrabTimeout = 0;
  this.ledgeRegrabCount = false;
  this.hurtbox = new Box2D([-4, 18], [4, 0]);
  this.hurtBoxState = 0;
  this.intangibleTimer = 0;
  this.invincibleTimer = 0;
  this.lCancel = false;
  this.lCancelTimer = 0;
  this.autoCancel = false;
  this.landingLagScaling = 1;
  this.passFastfall = false;
  this.jabCombo = false;
  this.sideBJumpFlag = true;
  this.charging = false;
  this.chargeFrames = 0;
  this.stuckTimer = 0;
  this.techTimer = 0;
  this.grabbedBy = -1;
  this.grabbing = -1;
  this.dashbuffer = false;
  this.jumpType = 0;
  this.jumpSquatType = 0;
  this.wallJumpTimer = 254;
  // mv.co.passivewall.timer / .vel_y_exponent (ftCo_PassiveWall.c:88,91). The
  // walljump launch is deferred until the countdown expires; the exponent is
  // the walljump count LATCHED at entry, before it is incremented.
  this.passiveWallTimer = 0;
  this.passiveWallExponent = 0;
  this.canWallJump = false;
  this.upbAngleMultiplier = 0;
  this.thrownHitbox = false;
  this.thrownHitboxOwner = -1;
  this.landingMultiplier = 15;
  this.wallJumpCount = 0;
  this.prevFrameHitboxes = new createHitboxes();
  this.interPolatedHitbox = [];
  this.interPolatedHitboxPhantom = [];
  this.isInterpolated = false;
  this.facePrev = 1;
  this.jumpsUsed = 0;
  this.releaseFrame = 0;
  // fp->x670_timer_lstick_tilt_x / x671_timer_lstick_tilt_y (fighter.c:1910).
  // Frames since the stick last crossed INTO the smash deadzone on that axis:
  // 0 on the crossing frame, counting up while it stays tilted, and pinned at
  // 254 whenever the stick is inside the deadzone (i.e. "not tilted at all").
  // SDI reads these; see physics.js.
  this.stickTiltTimerX = 254;
  this.stickTiltTimerY = 254;
  // fp->dmg.x18ac_time_since_hit (ft/types.h:1366). -1 means "never hit";
  // otherwise it counts frames since the last hit taken. See physics.js.
  this.timeSinceHit = -1;
  // fp->x2068_attackID / fp->x206C_attack_instance (ft_0881.c:311-320).
  // The id comes from the motion state table on every state change; the
  // instance is a global counter bumped whenever the id actually changes, and
  // it is what makes one swing stale once no matter how many hits it lands.
  this.attackId = 1;          // FtMoveId_Default
  this.attackInstance = 0;
  this.vCancelTimer = 0;
  this.shoulderLockout = 0;
  this.inShine = 0;
  this.jabReset = false;
  this.outOfCameraTimer = 0;
  this.rollOutDistance = 0;
  this.bTurnaroundTimer = 0;
  this.bTurnaroundDirection = 1;
  this.groundAngle = Math.PI/2;
  this.raptorBoost = false;
}
export function inputObject() {

  this.lsX = [0,0,0,0,0,0,0,0];
  this.lsY = [0, 0, 0, 0, 0, 0, 0, 0];
  this.rawX = [0, 0, 0, 0, 0, 0, 0, 0];
 this.rawY = [0, 0, 0, 0, 0, 0, 0, 0];
  this.csX = [0, 0, 0, 0, 0, 0, 0, 0];
  this.csY = [0, 0, 0, 0, 0, 0, 0, 0];
  this.lA = [0, 0, 0, 0, 0, 0, 0, 0];
  this.rA = [0, 0, 0, 0, 0, 0, 0, 0];
  this.s = [false, false, false, false, false, false, false, false];
  this.z = [false, false, false, false, false, false, false, false];
  this.a = [false, false, false, false, false, false, false, false];
  this.b = [false, false, false, false, false, false, false, false];
  this.x = [false, false, false, false, false, false, false, false];
  this.y = [false, false, false, false, false, false, false, false];
  this.r = [false, false, false, false, false, false, false, false];
  this.l = [false, false, false, false, false, false, false, false];
  this.dl = [false, false, false, false, false, false, false];
  this.dd = [false, false, false, false, false, false, false];
  this.dr = [false, false, false, false, false, false, false];
  this.du = [false, false, false, false, false, false, false];
}
export function playerObject(character, pos, face) {
  this.phys = new physicsObject(pos, face);
  this.actionState = "ENTRANCE";
  this.prevActionState = "";
  this.timer = 0;
  this.charAttributes = chars[character].attributes;
  this.charHitboxes = chars[character].hitboxes;
  this.showLedgeGrabBox = false;
  this.showECB = false;
  this.showHitbox = false;
  this.spawnWaitTime = 0;
  this.hitboxes = new createHitboxes();
  this.hit = {
    knockback: 0,
    hitlag: 0,
    hitstun: 0,
    angle: 0,
    hitPoint: new Vec2D(0, 0),
    powershield: false,
    shieldstun: 0
  };
  this.percent = 0;
  this.stocks = 4;
  this.miniView = false;
  this.miniViewPoint = new Vec2D(0, 0);
  this.inCSS = true;
  this.furaLoopID = 0;
  // StaleMoveTable (plstale.h). Per PLAYER, not per fighter-state: it survives
  // everything except plStale_ResetStaleMoveTableForPlayer, which runs on death
  // (ft_0D31.c:143).
  this.staleTable = newStaleTable();
  this.percentShake = new Vec2D(0, 0);
  this.shineLoop = 0;
  this.laserCombo = false;
  this.rotation = 0;
  this.rotationPoint = new Vec2D(0, 0);
  this.colourOverlay = "";
  this.colourOverlayBool = false;
  this.currentAction = "NONE";
  this.currentSubaction = "NONE";
  this.difficulty = 4;
  this.lastMash = 0;
  this.hasHit = false;
  this.shocked = 0;
  this.burning = 0;
}
