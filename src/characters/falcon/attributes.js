import {    offsets,
    setCharAttributes
    , CHARIDS
    , charObject
    , setChars
    , setHitBoxes
    , setIntangibility
    , setActionSounds,setFrames, setOffsets
} from "main/characters";
import {Vec2D} from "../../main/util/Vec2D";
import {Vec3D} from "../../main/util/Vec3D";
import {createHitboxObject} from "../../main/util/createHitboxObject";
import {createHitbox} from "../../main/util/createHitBox";
/* eslint-disable indent, camelcase */


setCharAttributes(CHARIDS.FALCON_ID, {
  dashFrameMin : 15,
  dInitV : 2.16,
  dMaxV : 2.299999952316284,
  dAccA : 0.15000000596046448,
  dAccB : 0.009999999776482582,
  dTInitV : 2,
  traction : 0.07999999821186066,
  maxWalk : 0.8500000238418579,
  jumpSquat : 4,
  sHopInitV : 1.899999976158142,
  fHopInitV : 3.0999999046325684,
  gravity : 0.12999999523162842,
  walkAccelMul : 0.15000000596046448,
  walkAccelBase : 0.10000000149011612,
  groundMaxHorizontalV : 3.0,
  groundToAir : 0.75,
  jumpHmaxV : 2.0999999046325684,
  jumpHinitV : 0.949999988079071,
  airMobA : 0.03999999910593033,
  airMobB : 0.019999999552965164,
  aerialHmaxV : 1.1200000047683716,
  airMaxHorizontalV : 3,
  airFriction : 0.009999999776482582,
  fastFallV : 3.5,
  terminalV : 2.9000000953674316,
  walkInitV : 0.15,
  walkAcc : 0.1,
  walkMaxV : 0.8500000238418579,
  djMultiplier : 0.8999999761581421,
  djMomentum : 0.8999999761581421,
  shieldScale : 15.0,
  modelScale : 0.9700000286102295,
  weight : 104,
  waitAnimSpeed : 1,
  walljump : true,
  hurtboxOffset : [5,17],
  // Ledge snap box, verbatim from ftData+0x44 (ftData_x44_t, ft/types.h:584).
  // Melee builds the box in mpColl_80044164 / mpColl_800443C4 (mpcoll.c:1253,
  // :1326) rather than storing corners, so the raw three values are stored here
  // and dealWithLedges() reconstructs the box the same way.
  ledgeSnapX : 9.0,
  ledgeSnapY : 17.0,
  ledgeSnapHeight : 11.0,
  // SUPERSEDED and no longer read. The shield's position now comes from
  // src/main/shieldData.js, baked from the posed Guard animation. Kept
  // only because it is a hand-measured value some UI still displays.
  shieldOffset : [5,34],
  charScale : 0.485,
  miniScale : 0.3,
  runTurnBreakPoint : 9,   // extracted: TurnRun subaction sets cmd_vars[1] at frame 9
  // ftCo_DatAttrs +0x084 standing_turn_frames, read off the disc.
  //
  // ftCo_Turn_Enter_Basic (ftCo_Turn.c:64) seeds frames_to_turn with it, and
  // ftCo_Turn_Anim_Inner (:72) counts it down one per frame and flips
  // facing_dir on the call that finds it already at zero -- so the turn lands
  // on frame standing_turn_frames + 1.
  //
  // meleelight hardcoded frame 6 for everyone. It is not the same for
  // everyone: Marth and Falcon are 6, Fox, Falco and Puff are 4, so the
  // spacies and Puff were turning two frames late.
  standingTurnFrames : 6,
  airdodgeIntangible : 25,
  // Raptor Boost's grounded end, ftcaptainspeciallw.c:243:
  //   ftCommon_ApplyFrictionGround(fp, speciallw_ground_traction * ground_friction)
  // 1.6 * 0.08 = 0.128, which is what meleelight hardcoded -- right value,
  // no provenance, and it would not have tracked a traction change.
  speciallwGroundTraction : 1.600000023841858,   // ext_attr +0x84
  // Falcon Kick's AIRBORNE variant landing on the ground,
  // ftcaptainspeciallw.c:287:
  //   ftCommon_ApplyFrictionGround(fp, speciallw_air_landing_traction
  //                                    * ground_friction)
  // 3.0 * 0.08 = 0.24, which is the value meleelight hardcoded -- the same
  // cross-check that confirmed speciallwGroundTraction above.
  speciallwAirLandingTraction : 3.0,             // ext_attr +0x88

  // Falcon Dive drift, ftCa_SpecialHi_Phys (ftcaptainspecialhi.c:101):
  //   ftCommon_8007D3A8(fp, x258,
  //                     air_drift_stick_mul * specialhi_air_friction_mul,
  //                     air_drift_max * specialhi_horz_vel)
  // meleelight had the two PRODUCTS precomputed as 0.044 and 0.952. Both were
  // numerically right; storing the factors instead keeps them tied to the
  // attributes they come from.
  diveAirFrictionMul : 1.100000023841858,   // ext_attr +0x40
  diveHorzVelMul : 0.8500000238418579,      // ext_attr +0x44
  // ftCo_SpecialS.c:45, the side-special entry:
  //   gr_vel += -(gr_vel * (1 - specials_ground_speed_retention))
  //             * ft_GetGroundFrictionMultiplier(fp)
  // which with the usual multiplier of 1 reduces to gr_vel *= retention.
  // 0.2 on every character here, but it is a per-character field.
  specialsGroundSpeedRetention : 0.20000000298023224,
  wallJumpVelX : 1.399999976158142,
  wallJumpVelY : 3.0999999046325684,
  shieldBreakVel : 2.700000047683716,
  multiJump : false,
  ecbScale : 1.45,
  walkAnimSpeed : 1,
  runAnimSpeed : 1
});

// start, length
setIntangibility(CHARIDS.FALCON_ID, {
  "ESCAPEAIR" : [5,26],
  "ESCAPEB" : [5,16],
  "ESCAPEF" : [5,16],
  "ESCAPEN" : [4,18],
  "DOWNSTANDN" : [1,23],
  "DOWNSTANDB" : [1,20],
  "DOWNSTANDF" : [1,24],
  "TECHN" : [1,20],
  "TECHB" : [1,20],
  "TECHF" : [1,20],
});

setFrames(CHARIDS.FALCON_ID, {
  "WAIT" : 60,
  "DASH" : 29,
  "RUN" : 21,
  "RUNBRAKE" : 28,
  "RUNTURN" : 22,
  "WALK" : 20,
  "JUMPF" : 35,
  "JUMPB" : 50,
  "FALL" : 8,
  "FALLAERIAL" : 8,
  "FALLSPECIAL" : 8,
  "SQUAT" : 8,
  "SQUATWAIT" : 79,
  "SQUATRV" : 10,
  "JUMPAERIALF" : 50,
  "JUMPAERIALB" : 35,
  "PASS" : 30,
  "GUARDON" : 8,
  "GUARDOFF" : 16,
  "CLIFFCATCH" : 8,
  "CLIFFWAIT" : 50,
  "DAMAGEFLYN" : 29,
  "DAMAGEFALL" : 29,
  "DAMAGEN2" : 24,
  "LANDINGATTACKAIRF" : 19,
  "LANDINGATTACKAIRB" : 18,
  "LANDINGATTACKAIRU" : 15,
  "LANDINGATTACKAIRD" : 24,
  "LANDINGATTACKAIRN" : 15,
  "ESCAPEB" : 32,
  "ESCAPEF" : 32,
  "ESCAPEN" : 33,
  "DOWNBOUND" : 26,
  "DOWNWAIT" : 69,
  "DOWNSTANDN" : 30,
  "DOWNSTANDB" : 36,
  "DOWNSTANDF" : 36,
  "TECHN" : 26,
  "TECHB" : 40,
  "TECHF" : 40,
  "SHIELDBREAKFALL" : 29,
  "SHIELDBREAKDOWNBOUND" : 26,
  "SHIELDBREAKSTAND" : 30,
  "FURAFURA" : 100,
  "CAPTUREWAIT" : 35,
  "CATCHWAIT" : 30,
  "CATCHDASH" : 40,   // ftCo_MS_CatchDash; 30 for the standing Catch
  // Melee plays the Landing subaction for both, 30 frames on the disc.
  // Neither had a setFrames entry, so render.js and hurtCapsulesWorld had
  // nothing to clamp against -- and LANDINGFALLSPECIAL advances its timer
  // in steps of landingMultiplier (3 for an airdodge), so Math.floor(timer)
  // reaches 30 either way. Falcon had no hurtbox table for it at all and
  // fell back to the flat rectangle on every wavedash landing.
  "LANDING" : 30,
  "LANDINGFALLSPECIAL" : 30,
  "CAPTURECUT" : 30,
  "CATCHCUT" : 30,
  "CAPTUREDAMAGE" : 20,
  // The animation is this long on the disc. Marth's entry already
  // matched; the other four were each one frame over.
  "WALLDAMAGE" : 50,
  "WALLTECH" : 26,
  "WALLJUMP" : 40,
  "OTTOTTO" : 8,
  "OTTOTTOWAIT" : 80,
  "THROWNMARTHUP" : 12,
  "THROWNMARTHBACK" : 7,
  "THROWNMARTHFORWARD" : 14,
  "THROWNMARTHDOWN" : 14,
  "THROWNPUFFUP" : 8,
  "THROWNPUFFBACK" : 26,
  "THROWNPUFFFORWARD" : 9,
  "THROWNPUFFDOWN" : 60,
  "THROWNFALCONUP" : 14,
  "THROWNFALCONBACK" : 19,
  "THROWNFALCONFORWARD" : 17,
  "THROWNFALCONDOWN" : 20,
  "THROWNFALCOUP" : 7,
  "THROWNFALCOBACK" : 9,
  "THROWNFALCOFORWARD" : 11,
  "THROWNFALCODOWN" : 34,
  "THROWNFOXUP" : 8,
  "THROWNFOXBACK" : 9,
  "THROWNFOXFORWARD" : 10,
  "THROWNFOXDOWN" : 32,
  "FURASLEEPSTART" : 30,
  // 110, matching FuraSleepLoop on the disc. Fox and Falco are also 110,
  // Marth 80 and Puff 76, each equal to their own animation; 20 was the
  // only one that matched nothing.
  "FURASLEEPLOOP" : 110,
  "FURASLEEPEND" : 60,
  "STOPCEIL" : 8,
  "TECHU" : 26,
  "REBOUND" : 17
});

setActionSounds(CHARIDS.FALCON_ID, {
  "JUMP" : [],
  "ESCAPEAIR" : [[4,"falconshout2"]],
  "JUMPAERIAL" : [[1,"falcondoublejump"]],
  "GUARDON" : [],
  "GUARDOFF" : [],
  "CLIFFCATCH" : [[1,"puffledgegrab"]],
  "DEAD" : [[1,"falcondeath"]],
  "FURAFURA" : [[29,"falconfura"]],
  "ESCAPEB" : [],
  "ESCAPEF" : [],
  "ESCAPEN" : [[3,"falconshout2"]],
  "OTTOTTOWAIT" : [],
  "TECH" : []
});


// HITBOX OFFSETS

setOffsets(CHARIDS.FALCON_ID, {
  ledgegetupquick : {
    id0 : [new Vec3D(7.48024,15.174034,-5.149873),new Vec3D(8.160643,12.03181,-1.2597835),new Vec3D(8.423215,11.507124,-1.6514803),new Vec3D(8.089782,10.4834795,-0.28257847),new Vec3D(8.544982,9.060858,-0.77889955),new Vec3D(8.344599,7.6063914,-0.91415584)],
    id1 : [new Vec3D(7.6065493,19.438488,-8.61163),new Vec3D(14.718176,11.608276,-0.72806406),new Vec3D(14.6315565,11.680964,-0.06750454),new Vec3D(14.228182,11.527122,-0.28089663),new Vec3D(14.350886,9.553482,-2.3824592),new Vec3D(13.909443,6.781153,-2.5556858)],
    id2 : [new Vec3D(2.1451042,7.7924395,1.1280351),new Vec3D(0.8130288,6.9957485,-0.010695934),new Vec3D(1.0699458,5.889407,-0.09145951),new Vec3D(1.1665487,4.530213,0.2767508),new Vec3D(1.252882,3.1192498,0.379004),new Vec3D(0.42368078,2.6836047,0.58294)],
  },
  ledgegetupslow : {
    id0 : [new Vec3D(3.2371647,1.548443,2.995392),new Vec3D(6.5455103,2.8503518,1.1297488),new Vec3D(10.362994,7.418228,-4.0191135),new Vec3D(16.275005,10.563632,-0.06967139)],
    id1 : [new Vec3D(4.083603,4.893049,3.207699),new Vec3D(5.532752,6.148512,1.3404238),new Vec3D(7.563942,7.978394,-2.0698972),new Vec3D(12.85635,10.258557,-0.4791003)]
  },
  jab1 : {
    id0 : [new Vec3D(10.609375,10.798828,0),new Vec3D(10.609375,10.798828,0),new Vec3D(10.609375,10.798828,0)],
    id1 : [new Vec3D(5.3046875,12.125,0),new Vec3D(5.3046875,12.125,0),new Vec3D(5.3046875,12.125,0)],
    id2 : [new Vec3D(1.8945312,10.798828,0),new Vec3D(1.8945312,10.798828,0),new Vec3D(1.8945312,10.798828,0)]
  },
  jab2 : {
    id0 : [new Vec3D(15.15625,11.177734,0),new Vec3D(15.15625,11.177734,0),new Vec3D(15.15625,11.177734,0)],
    id1 : [new Vec3D(9.472656,11.177734,0),new Vec3D(9.472656,11.177734,0),new Vec3D(9.472656,11.177734,0)],
    id2 : [new Vec3D(3.7890625,11.177734,0),new Vec3D(3.7890625,11.177734,0),new Vec3D(3.7890625,11.177734,0)]
  },
  jab3Clean : {
    id0 : [new Vec3D(7.107513,11.823334,0.724436),new Vec3D(7.21544,11.810391,1.4112328),new Vec3D(7.2543445,11.744131,2.1205473),new Vec3D(7.2309337,11.616781,2.805255)],
    id1 : [new Vec3D(-1.8503556,9.586812,1.5126767),new Vec3D(-1.7787971,9.669325,1.545821),new Vec3D(-1.7137275,9.753321,1.614845),new Vec3D(-1.6577363,9.826607,1.7184418)]
  },
  jab3Late : {
    id0 : [new Vec3D(7.2309337,11.616781,2.805255),new Vec3D(7.171338,11.373295,3.4267833),new Vec3D(7.1127243,10.913423,3.933436)],
    id1 : [new Vec3D(-1.6577363,9.826607,1.7184418),new Vec3D(-1.6139402,9.878086,1.8537394),new Vec3D(-1.5858068,9.897911,2.0170238)]
  },
  dtilt : {
    id0 : [new Vec3D(15.104377,3.0649943,4.383691),new Vec3D(19.026434,4.932667,0.51969266),new Vec3D(18.784954,6.094352,-7.8514137),new Vec3D(15.343158,7.489242,-12.258284),new Vec3D(15.002779,7.8803005,-11.846276),new Vec3D(13.980352,7.919768,-12.207863)],
    id1 : [new Vec3D(12.462906,4.38219,-1.3825666),new Vec3D(12.913447,4.4517136,-2.3936074),new Vec3D(12.602762,4.769858,-5.2559657),new Vec3D(11.313229,5.334266,-7.176366),new Vec3D(10.247569,5.510244,-7.815279),new Vec3D(9.498897,5.488197,-8.085254)],
    id2 : [new Vec3D(4.746773,2.48702,-4.619324),new Vec3D(4.3760715,2.9307826,-3.1863914),new Vec3D(4.4290667,2.9061866,-2.9586675),new Vec3D(4.600374,2.6867545,-2.8755279),new Vec3D(4.7003293,2.6651127,-2.676358),new Vec3D(4.7891793,2.6765544,-2.487522)]
  },
  uptilt : {
    id0 : [new Vec3D(3.6432645,24.3743,0.09242734),new Vec3D(12.624601,18.714512,0.44880474),new Vec3D(15.680749,10.724047,-0.6471306),new Vec3D(15.208918,4.0879803,-1.600208),new Vec3D(15.407017,1.094379,-0.13704205)],
    id1 : [new Vec3D(3.794693,16.411428,-0.24653195),new Vec3D(6.362177,13.84187,-0.31577668),new Vec3D(7.709612,10.70413,-0.7228441),new Vec3D(8.17728,7.793007,-0.9886364),new Vec3D(8.77563,5.4934545,-0.60394955)]
  },
  ftilt : {
    id0 : [new Vec3D(16.57077,12.694822,-1.4418117),new Vec3D(16.971066,13.077138,1.000645),new Vec3D(16.922863,13.301421,3.5227923)],
    id1 : [new Vec3D(9.017663,12.813443,0.3283599),new Vec3D(9.23734,12.929409,1.1765189),new Vec3D(9.304199,12.939747,1.9391706)],
    id2 : [new Vec3D(5.9595647,12.504227,0.62829703),new Vec3D(6.217363,12.552612,0.9456633),new Vec3D(6.394864,12.536526,1.2786176)]
  },
  dsmash1 : {
    id0 : [new Vec3D(17.628838,10.917541,1.9485343),new Vec3D(16.783398,12.11054,0.5762875),new Vec3D(16.025053,13.023802,-1.4579005),new Vec3D(13.795061,13.22936,-3.5063052)],
    id1 : [new Vec3D(11.126626,11.1757765,0.41209048),new Vec3D(10.646549,12.116502,0.61303484),new Vec3D(10.29342,12.150797,0.35823262),new Vec3D(9.309183,12.346284,-0.04351327)]
  },
  dsmash2 : {
    id0 : [new Vec3D(-14.699005,7.6332245,-0.1449669),new Vec3D(-15.040369,7.435134,0.95347095),new Vec3D(-15.269819,7.210456,0.7608727),new Vec3D(-15.229584,7.703491,0.17111504)],
    id1 : [new Vec3D(-8.103506,9.277071,-0.4124484),new Vec3D(-8.478635,9.237077,0.3118295),new Vec3D(-8.719303,9.110592,0.3189628),new Vec3D(-8.711792,9.362076,-0.3143664)]
  },
  upsmash1 : {
    id0 : [new Vec3D(3.2933102,15.105345,0.13797094),new Vec3D(3.3429883,15.390472,-0.20906723)],
    id1 : [new Vec3D(8.714844,7.578125,0),new Vec3D(8.714844,7.578125,0)],
    id2 : [new Vec3D(4.3286467,26.349173,1.2394121),new Vec3D(3.1678195,22.974218,-7.8574457)],
    id3 : [new Vec3D(1.5114923,19.424099,0.19723904),new Vec3D(1.1309065,18.988682,-2.2577515)]
  },
  upsmash2 : {
    id0 : [new Vec3D(1.3504577,19.86488,0.030489255),new Vec3D(1.7326218,18.370066,-2.4019232)],
    id1 : [new Vec3D(3.3132195,15.340689,-0.9366889),new Vec3D(3.0185544,14.365894,-1.3985794)],
    id2 : [new Vec3D(3.3864098,27.17734,0.18760648),new Vec3D(5.4236927,23.914867,-5.7964497)]
  },
  fsmash : {
    id0 : [new Vec3D(2.2218091,10.322108,-2.6693783),new Vec3D(3.885828,9.970047,1.5004882),new Vec3D(3.9848328,9.920288,0.5543865),new Vec3D(3.9807053,9.938849,0.52171147)],
    id1 : [new Vec3D(-0.31367755,9.953988,-4.3287106),new Vec3D(6.9005537,9.918819,1.0246768),new Vec3D(7.023512,9.909547,0.2647317),new Vec3D(7.0145397,9.995207,0.1896511)]
  },
  downattack1 : {
    id0 : [new Vec3D(-6.414585,10.328306,-1.0541337),new Vec3D(-5.8746724,10.639421,-2.57731)],
    id1 : [new Vec3D(4.7630186,10.768493,0.38437918),new Vec3D(4.450534,11.0530205,1.7353882)],
    id2 : [new Vec3D(-11.906754,10.283636,-0.914826),new Vec3D(-11.1870775,10.554801,-3.9760623)],
    id3 : [new Vec3D(10.244632,11.125635,0.28654218),new Vec3D(9.816546,11.279728,2.892847)]
  },
  downattack2 : {
    id0 : [new Vec3D(5.043075,13.540208,-0.7422176),new Vec3D(4.7255697,14.205373,2.1982512)],
    id1 : [new Vec3D(-4.8061976,14.412136,2.0855668),new Vec3D(-5.574721,13.774511,-1.3300004)],
    id2 : [new Vec3D(9.1507845,14.742015,-4.187169),new Vec3D(9.120433,16.397566,-0.26442426)],
    id3 : [new Vec3D(-7.6179314,15.550899,6.6662397),new Vec3D(-10.376994,15.089436,0.9925733)]
  },
  grab : {
    id0 : [new Vec3D(6.8203125,9.8515625,0),new Vec3D(6.8203125,9.8515625,0)],
    id1 : [new Vec3D(2.2734375,9.8515625,0),new Vec3D(2.2734375,9.8515625,0)]
  },
  grabDash : {
    id0 : [new Vec3D(8.3359375,9.09375,0),new Vec3D(8.3359375,9.09375,0)],
    id1 : [new Vec3D(2.2734375,9.09375,0),new Vec3D(2.2734375,9.09375,0)],
    id2 : [new Vec3D(-2.2734375,9.09375,0),new Vec3D(-2.2734375,9.09375,0)]
  },
  pummel : {
    id0 : [new Vec3D(11.3671875,9.472656,0)]
  },
  nair1 : {
    id0 : [new Vec3D(12.148827,8.486232,2.2874076),new Vec3D(12.313505,8.4507885,0.6429751),new Vec3D(12.266966,8.134568,-0.98838913),new Vec3D(11.994992,7.5353518,-2.594689),new Vec3D(11.48686,6.7365837,-4.0772743),new Vec3D(10.729588,5.8196564,-5.440968)],
    id1 : [new Vec3D(4.82253,7.661828,0.47246182),new Vec3D(4.808073,7.565754,-0.087435484),new Vec3D(4.7210817,7.377443,-0.62141514),new Vec3D(4.557749,7.1014056,-1.129292),new Vec3D(4.3143954,6.767121,-1.5866699),new Vec3D(3.9872806,6.4036694,-1.9988011)],
    id2 : [new Vec3D(0.8424955,7.2167664,0.34723985),new Vec3D(0.84227353,7.2192235,0.35998172),new Vec3D(0.8420151,7.221214,0.36998218),new Vec3D(0.8418692,7.221915,0.3736231),new Vec3D(0.84200096,7.220569,0.36727524),new Vec3D(0.8424955,7.2167664,0.34723985)]
  },
  nair2 : {
    id0 : [new Vec3D(11.829235,11.261512,2.6947281),new Vec3D(11.786449,11.650661,2.3009138),new Vec3D(11.542202,12.184496,2.4159536),new Vec3D(11.077974,12.98461,2.649754),new Vec3D(10.442136,13.981986,2.6469555),new Vec3D(9.78103,14.950156,2.2566538),new Vec3D(9.279827,15.6538515,1.5718724),new Vec3D(9.118434,15.94136,0.7740766),new Vec3D(9.472207,15.67248,-0.1483519),new Vec3D(10.338066,14.553667,-1.7415128)],
    id1 : [new Vec3D(4.8705354,8.782315,0.9420365),new Vec3D(4.861679,8.933757,0.78175974),new Vec3D(4.7936277,9.123609,0.76381725),new Vec3D(4.6602592,9.386151,0.7773578),new Vec3D(4.4746923,9.701367,0.7213985),new Vec3D(4.278303,10.004436,0.553216),new Vec3D(4.123785,10.228128,0.29963484),new Vec3D(4.0623627,10.329031,0.012668937),new Vec3D(4.143715,10.266682,-0.31070194),new Vec3D(4.3659225,9.956249,-0.82548046)],
    id2 : [new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274),new Vec3D(0.96416813,7.4592814,-0.15467274)]
  },
  bairClean : {
    id0 : [new Vec3D(-12.217078,5.160763,0.5258204),new Vec3D(-11.159927,6.33217,-0.33484042),new Vec3D(-11.8047905,5.892911,-0.28638285),new Vec3D(-11.301902,6.157923,-0.39912194)],
    id1 : [new Vec3D(-8.586423,7.7148094,1.0534936),new Vec3D(-8.061254,8.298937,0.6890282),new Vec3D(-8.386144,8.070112,0.6157088),new Vec3D(-8.185864,8.157762,0.5004401)],
    id2 : [new Vec3D(-5.005597,10.256483,1.6431379),new Vec3D(-5.0057607,10.263641,1.7664788),new Vec3D(-5.0213065,10.24832,1.5713184),new Vec3D(-5.117593,10.1687975,1.4483013)],

  },
  bairLate : {
    id0 : [new Vec3D(-11.323164,6.1164284,-0.074545026),new Vec3D(-11.241905,6.0803757,0.54437953),new Vec3D(-11.112345,6.1338315,1.3293432),new Vec3D(-10.932848,6.222904,2.1034932)],
    id1 : [new Vec3D(-8.17877,8.115,0.67261237),new Vec3D(-8.06701,8.0801935,1.0884694),new Vec3D(-7.887137,8.0928135,1.6231745),new Vec3D(-7.668401,8.127453,2.133347)],
    id2 : [new Vec3D(-5.0837445,10.134306,1.4626951),new Vec3D(-4.94206,10.109009,1.6691409),new Vec3D(-4.711252,10.087724,1.9471688),new Vec3D(-4.452288,10.0729265,2.1873703)]
  },
  fairClean : {
    id0 : [new Vec3D(5.1179175,6.9353123,1.079979),new Vec3D(4.95689,8.021326,1.0429531),new Vec3D(5.7003274,7.6014357,0.9092825)],
    id1 : [new Vec3D(2.5890472,9.163769,2.489914),new Vec3D(2.5087278,9.23457,2.5056193),new Vec3D(3.2149355,9.199797,2.4423218)]
  },
  fairLate : {
    id0 : [new Vec3D(6.407959,7.25791,0.7589786),new Vec3D(5.768734,7.1923013,0.74681014),new Vec3D(5.2386775,7.249333,0.6278251),new Vec3D(5.518311,7.216709,0.6098708),new Vec3D(5.7760553,7.1315145,0.60381603),new Vec3D(6.006339,7.027005,0.5980779),new Vec3D(6.205122,6.9404645,0.5810629),new Vec3D(6.376279,6.844482,0.58515835),new Vec3D(6.521325,6.7234235,0.6327847),new Vec3D(6.6369295,6.6417117,0.69784987),new Vec3D(6.7234726,6.6690097,0.7538372),new Vec3D(6.7747064,6.877906,0.7790538),new Vec3D(6.7368584,7.4657187,0.8136952),new Vec3D(6.6773615,7.736164,0.7794148)],
    id1 : [new Vec3D(4.009209,9.075792,2.3500175),new Vec3D(3.496786,8.931173,2.2683792),new Vec3D(3.0535057,8.840185,2.2241004),new Vec3D(3.3106205,8.8176,2.2958803),new Vec3D(3.5443034,8.779842,2.3792498),new Vec3D(3.752042,8.731733,2.4703918),new Vec3D(3.9313216,8.678529,2.5656557),new Vec3D(4.07973,8.625937,2.6616516),new Vec3D(4.1950207,8.580076,2.7552786),new Vec3D(4.2751102,8.547381,2.8436666),new Vec3D(4.3180285,8.534484,2.924039),new Vec3D(4.3217974,8.5480385,2.993472),new Vec3D(4.2842655,8.594524,3.0485742),new Vec3D(4.202899,8.679964,3.085067)]
  },
  upairClean : {
    id0 : [new Vec3D(5.2311506,10.609468,0.8061796),new Vec3D(4.659177,12.360725,0.9197936),new Vec3D(3.3788948,13.937282,0.8825275),new Vec3D(1.5861224,14.868718,0.82547975)],
    id1 : [new Vec3D(12.31332,8.589391,0.9399571),new Vec3D(11.74466,14.472133,1.2206719),new Vec3D(8.744296,19.016356,1.1696835),new Vec3D(4.174337,21.786413,0.9930924)]

  },
  // upairLate had NO array of its own and read upairMid's. They are different
  // frames of AttackAirHi -- Mid is the group at frame 11, Late the one at
  // frame 14 -- so the late hitbox was drawn three frames out of place for its
  // whole duration. Computed from the disc: bones 7 and 8 at frames 14-17,
  // measured from TransN in the (Z, Y) plane, same length as upairMid's arrays
  // so nothing can index past the end.
  upairLate : {
    id0 : [new Vec3D(-5.5561943,10.44215,0.9265392),new Vec3D(-5.3961287,8.8051405,0.9486408),new Vec3D(-4.942023,7.497134,1.1204122),new Vec3D(-3.8731768,6.165973,1.1991646)],
    id1 : [new Vec3D(-12.844067,9.426836,0.7489493),new Vec3D(-11.984129,5.5429907,0.7050219),new Vec3D(-10.668264,2.8893561,1.2326282),new Vec3D(-7.629558,-0.14142227,1.4757066)],
  },
  upairMid : {
    id0 : [new Vec3D(-0.64066964,15.067034,0.7343486),new Vec3D(-2.7699456,14.442873,0.752162),new Vec3D(-4.3188357,13.312029,0.8454011),new Vec3D(-5.21566,11.952448,0.89957875)],
    id1 : [new Vec3D(-1.626124,22.382408,0.6307532),new Vec3D(-7.0302715,20.4624,0.5852484),new Vec3D(-10.636016,17.109194,0.768294),new Vec3D(-12.457324,13.294337,0.8022303)]
  },
  dair : {
    id0 : [new Vec3D(-1.3296323,-3.259172,2.040385),new Vec3D(-1.0079557,-6.0448623,1.7597477),new Vec3D(-1.9471215,-4.591979,2.9875047),new Vec3D(-1.2457683,-3.5692673,2.0514073),new Vec3D(-0.48716557,-2.2990904,1.3318349)],
    id1 : [new Vec3D(-1.2844183,2.7731056,1.5698262),new Vec3D(-1.1787094,1.5093765,1.4348451),new Vec3D(-1.5182832,2.1631622,1.9647391),new Vec3D(-1.2220395,2.4646988,1.6013737),new Vec3D(0.29044297,2.2148933,0.084820226)],
    id2 : [new Vec3D(0.031775862,8.737571,1.7061341),new Vec3D(0.0429416,8.592961,1.6990926),new Vec3D(0.035294294,8.489703,1.7062786),new Vec3D(0.03012076,8.434245,1.7061784),new Vec3D(0.021471053,8.424107,1.68138)]
  },
  falconpunchair : {
    id0 : [new Vec3D(5.3785257,11.482977,-4.5960875),new Vec3D(11.591572,9.801623,2.0260963),new Vec3D(11.59503,9.81885,2.0935082),new Vec3D(11.5945,9.868373,2.279299),new Vec3D(11.563737,9.950422,2.5552797)],
    id1 : [new Vec3D(6.9250813,10.8155365,-0.37272787),new Vec3D(7.0608754,10.078582,2.2909732),new Vec3D(7.0565257,10.061462,2.2246194),new Vec3D(7.056196,10.011807,2.0399225),new Vec3D(7.0861006,9.92943,1.7650919)],
    id2 : [new Vec3D(11.964925,11.000256,-3.7504742),new Vec3D(18.795218,7.5286536,2.9838998),new Vec3D(18.784912,7.6070604,3.272439),new Vec3D(18.710121,7.834941,4.070775),new Vec3D(18.467934,8.216527,5.257495)]
  },
  falconpunchground : {
    id0 : [new Vec3D(4.495523,9.907828,-2.3009663),new Vec3D(11.716216,9.6747265,2.589968),new Vec3D(11.730099,9.660525,2.5765793),new Vec3D(11.744249,9.714544,2.5957432),new Vec3D(11.74892,9.823196,2.6422567)],
    id1 : [new Vec3D(8.691963,10.3975115,-0.6204411),new Vec3D(7.20901,9.624878,3.1871984),new Vec3D(7.2225685,9.541663,3.1614897),new Vec3D(7.2370963,9.3895855,3.0997834),new Vec3D(7.2622604,9.182301,3.0072465)],
    id2 : [new Vec3D(10.798681,9.371295,-2.0929046),new Vec3D(19.628082,9.680389,2.7161214),new Vec3D(19.64495,9.791532,2.7000651),new Vec3D(19.649319,10.170409,2.8289897),new Vec3D(19.607391,10.766305,3.0778627)]
  },
  raptorboostair : {
    id0 : [new Vec3D(3.4042263,3.0767188,0)],
    id1 : [new Vec3D(3.4042263,9.700001,0)],
    id2 : [new Vec3D(3.4042263,-4.6832814,0)]
  },
  raptorboostairhit : {
    id0 : [new Vec3D(5.931849,16.13518,-0.8299803),new Vec3D(10.871329,14.058626,3.0846205),new Vec3D(12.827836,7.6803904,5.69999),new Vec3D(11.24184,1.7167435,5.0751224),new Vec3D(7.5455647,-2.0355804,1.4035839)]
  },
  raptorboostground : {
    id0 : [new Vec3D(4.9218736,3.0767188,0)],
    id1 : [new Vec3D(4.9218736,7.76,0)],
    id2 : [new Vec3D(4.9218736,14.383282,0)]
  },
  raptorboostgroundhit : {
    id0 : [new Vec3D(9.40077,5.440889,-0.2110002),new Vec3D(11.604809,10.636779,-1.6824691),new Vec3D(6.07797,20.095932,-0.9319947),new Vec3D(4.072629,20.213259,-0.43563712),new Vec3D(3.0672843,20.2495,0.35266086)]
  },
  falconkickairClean : {
    id0 : [new Vec3D(-5.464856,6.4150906,-1.948944),new Vec3D(-3.8710766,6.3549557,-4.089841),new Vec3D(-3.890941,6.3387804,-4.0700297)],
    id1 : [new Vec3D(-1.1502662,7.993392,-0.1318027),new Vec3D(-1.1037593,7.8700323,-0.28783858),new Vec3D(-1.1225774,7.8572392,-0.2701384)]
  },
  falconkickairMid : {
    id0 : [new Vec3D(-3.9108007,6.319107,-4.050241),new Vec3D(-3.930637,6.2959766,-4.030472),new Vec3D(-3.9504282,6.269432,-4.0107174),new Vec3D(-3.9701562,6.2395153,-3.9909747),new Vec3D(-3.9898005,6.2062664,-3.9712386),new Vec3D(-4.0093403,6.169729,-3.9515069),new Vec3D(-4.028758,6.1299458,-3.931773),new Vec3D(-4.048031,6.0869617,-3.912035)],
    id1 : [new Vec3D(-1.1413887,7.8409443,-0.25246596),new Vec3D(-1.1601744,7.8211884,-0.23481746),new Vec3D(-1.1789126,7.7980146,-0.21718878),new Vec3D(-1.1975856,7.7714653,-0.19957587),new Vec3D(-1.2161722,7.74158,-0.181975),new Vec3D(-1.2346516,7.7084026,-0.16438195),new Vec3D(-1.2530079,7.671976,-0.14679274),new Vec3D(-1.2712154,7.6323433,-0.12920341)]
  },
  falconkickairLate : {
    id0 : [new Vec3D(-4.0671415,6.0408134,-3.892288),new Vec3D(-4.086068,5.9915466,-3.8725283),new Vec3D(-4.1047916,5.9392014,-3.8527522),new Vec3D(-4.123294,5.883827,-3.8329554)],
    id1 : [new Vec3D(-1.289259,7.5895443,-0.11161003),new Vec3D(-1.3071165,7.543623,-0.094008535),new Vec3D(-1.324769,7.4946175,-0.076395),new Vec3D(-1.3421974,7.442581,-0.058765367)]
  },
  falconkickland : {
    id0 : [new Vec3D(6.8203125,0,0),new Vec3D(6.8203125,0,0)],
    id1 : [new Vec3D(-6.8203125,0,0),new Vec3D(-6.8203125,0,0)],
    id2 : [new Vec3D(0,0,0),new Vec3D(0,0,0)]
  },
  falconkickgroundClean : {
    id0 : [new Vec3D(-0.5482607,6.845281,0.17615385),new Vec3D(-0.4548092,7.226661,0.035946317),new Vec3D(-0.3661461,7.1886,0.09341815)],
    id1 : [new Vec3D(-5.475113,6.954933,-0.17430817),new Vec3D(-5.3830566,6.913991,-0.1168363),new Vec3D(-5.2943926,6.87593,-0.059364464)],
    id2 : [new Vec3D(7.0086384,6.5553465,0.66316867),new Vec3D(7.112631,7.5896397,0.20938066),new Vec3D(7.201294,7.5515785,0.2668525)]
  },
  falconkickgroundMid : {
    id0 : [new Vec3D(-0.3661461,7.1886,0.09341815),new Vec3D(-0.28247643,7.1751184,0.16233255),new Vec3D(-0.19818878,7.1204166,0.2083618),new Vec3D(-0.118494034,7.089942,0.26583362),new Vec3D(-0.041389465,7.061644,0.3233055),new Vec3D(0.031526566,7.0570884,0.39229062),new Vec3D(0.10585022,7.010873,0.43824917),new Vec3D(0.17638397,6.988047,0.49572092)],
    id1 : [new Vec3D(-5.2943926,6.87593,-0.059364464),new Vec3D(-5.2089186,6.840574,-0.001892651),new Vec3D(-5.1264353,6.8077464,0.05557919),new Vec3D(-5.0467415,6.7772717,0.113051005),new Vec3D(-4.969637,6.748974,0.17052287),new Vec3D(-4.8949223,6.7226763,0.22799468),new Vec3D(-4.822397,6.6982026,0.28546655),new Vec3D(-4.7518616,6.675377,0.3429383)],
    id2 : [new Vec3D(7.201294,7.5515785,0.2668525),new Vec3D(7.282852,7.5716853,0.35334152),new Vec3D(7.3692513,7.483395,0.38179612),new Vec3D(7.448946,7.4529204,0.43926793),new Vec3D(7.5260506,7.4246225,0.4967398),new Vec3D(7.596863,7.4534516,0.583408),new Vec3D(7.6732883,7.3738513,0.6116835),new Vec3D(7.743824,7.3510256,0.66915524)]
  },
  falconkickgroundLate : {
    id0 : [new Vec3D(0.24513245,6.966693,0.5531928),new Vec3D(0.3122902,6.946635,0.6106646),new Vec3D(0.3780594,6.927696,0.6681365),new Vec3D(0.4426422,6.909701,0.72560835),new Vec3D(0.50623703,6.8924723,0.7830801),new Vec3D(0.569046,6.875835,0.840552),new Vec3D(0.6312752,6.859612,0.8980237),new Vec3D(0.6931076,6.843628,0.9554957)],
    id1 : [new Vec3D(-4.683115,6.6540227,0.40041018),new Vec3D(-4.6159554,6.6339645,0.457882),new Vec3D(-4.550186,6.615026,0.51535386),new Vec3D(-4.4856033,6.5970306,0.57282573),new Vec3D(-4.4220085,6.579802,0.6302975),new Vec3D(-4.3591995,6.5631647,0.68776935),new Vec3D(-4.2969704,6.5469418,0.7452411),new Vec3D(-4.235138,6.5309577,0.8027131)],
    id2 : [new Vec3D(7.8125725,7.3296714,0.7266271),new Vec3D(7.87973,7.309613,0.7840989),new Vec3D(7.9454994,7.2906747,0.8415708),new Vec3D(8.010082,7.2726793,0.89904267),new Vec3D(8.073677,7.2554507,0.9565144),new Vec3D(8.136486,7.2388134,1.0139863),new Vec3D(8.198715,7.2225904,1.0714581),new Vec3D(8.260548,7.2066064,1.1289301)]
  },
  falcondive1 : {
    id0 : [new Vec3D(5.82,8.3359375,0)],
    id1 : [new Vec3D(12.932071,8.3359375,0)]
  },
  // Was an EMPTY array. UPSPECIAL.js:129 swaps this hitbox in at timer 14 and
  // then indexes offset[frame], so `[]` is a crash rather than a bad position.
  //
  // Falcon Dive's grab hitbox is on bone 0 (the root) at b_offset (0, 8.594,
  // 6.0), so it does not move: the value is that offset times the model scale,
  // 0.97, giving (5.82, 8.336) for every frame. Twenty entries because
  // UPSPECIAL.js runs this hitbox from timer 14 to 33.
  //
  // Measured from the ROOT, not TransN. Falcon Dive lifts the fighter through
  // setVelocities in meleelight's own code, so subtracting the animation's root
  // motion as well would count the rise twice -- it sends the hitbox to y = -25
  // by the last frame. falcondive1's recorded values are root-referenced for
  // the same reason.
  falcondive2 : {
    id0 : [new Vec3D(5.82,8.3359375,0),new Vec3D(5.472179,5.7804084,-6.660462e-05),new Vec3D(5.120885,3.3240585,5.9204103e-05),new Vec3D(4.7662296,0.9658804,0.00015541077),new Vec3D(4.408325,-1.2951317,0),new Vec3D(4.047282,-3.4599848,-0.0002380327),new Vec3D(3.6832132,-5.529687,-0.00024654673),new Vec3D(3.3162293,-7.5052433,-3.2839776e-05),new Vec3D(2.946442,-9.387661,0.00039579038),new Vec3D(2.5739625,-11.177946,0.0010320462),new Vec3D(2.1989028,-12.877106,0.0018686295),new Vec3D(1.8213744,-14.486147,0.002898243),new Vec3D(1.4414892,-16.006077,0.004113589),new Vec3D(1.0593576,-17.437902,0.005507369),new Vec3D(0.67509174,-18.78263,0.007072286),new Vec3D(0.28880358,-20.041265,0.008801043),new Vec3D(-0.09939575,-21.214817,0.010686341),new Vec3D(-0.48939466,-22.304289,0.012720882),new Vec3D(-0.8810816,-23.31069,0.01489737),new Vec3D(-1.2743454,-24.235031,0.017208505)]
  },
  falcondivethrowextra : {
    id0 : [new Vec3D(3.638358,10.418413,-0.05748719),new Vec3D(3.6358037,10.429556,-0.05748719)]
  },
  dashattackClean : {
    id0 : [new Vec3D(2.2478695,5.954293,0.051764548),new Vec3D(2.0483236,5.9868,0.4005044),new Vec3D(1.9450598,6.0446863,0.65509653)]
  },
  dashattackLate : {
    id0 : [new Vec3D(1.858182,6.1092544,0.8693189),new Vec3D(1.7551193,6.1628666,1.0312905),new Vec3D(1.6443367,6.2037663,1.152975),new Vec3D(1.5311089,6.2333136,1.2460562),new Vec3D(1.416542,6.258458,1.3269382),new Vec3D(1.3038635,6.284471,1.4048362),new Vec3D(1.1980743,6.3120394,1.4800045)]
  },
  throwforwardextra : {
    id0 : [new Vec3D(5.709708,8.572114,1.2637705),new Vec3D(6.064824,9.23867,1.0278194),new Vec3D(5.984213,9.6337805,0.74722075),new Vec3D(5.3487277,9.646212,-0.6361511),new Vec3D(4.4856024,9.931634,-1.6847825),new Vec3D(4.18684,10.313606,-1.9515667),new Vec3D(4.58606,9.497378,-1.6145682)],
    id1 : [new Vec3D(1.5480578,10.196908,1.850786),new Vec3D(2.1003592,10.475472,2.3617775),new Vec3D(2.1801205,10.627212,2.4675663),new Vec3D(2.400929,10.454541,2.3506286),new Vec3D(2.4507017,9.966836,2.0877743),new Vec3D(2.415209,9.600599,1.9111857),new Vec3D(2.5250607,9.519974,2.181918)],
    id2 : [new Vec3D(2.2274446,12.739709,1.5228722),new Vec3D(2.678671,12.930339,1.5407329),new Vec3D(2.6053302,13.02399,1.4142003),new Vec3D(2.6225553,12.951336,1.483549),new Vec3D(2.7795935,12.595077,1.949518),new Vec3D(2.8574257,12.176569,2.3625784),new Vec3D(2.878501,12.148531,2.1555135)]
  },
  throwupextra : {
    id0 : [new Vec3D(6.5605583,10.85919,0.8147454),new Vec3D(5.9143744,9.452387,1.0487967),new Vec3D(5.194041,8.207336,1.7668221),new Vec3D(5.289404,8.058431,1.9500804),new Vec3D(6.789678,11.542425,1.3823731),new Vec3D(7.154651,16.839716,0.24621236),new Vec3D(6.8026323,17.839909,0.53635347),new Vec3D(7.1201696,17.770754,0.7640741),new Vec3D(7.036058,16.600014,0.61608934),new Vec3D(6.9911747,16.011847,0.70086384),new Vec3D(7.632929,16.669008,1.2105126),new Vec3D(8.068664,16.644258,1.5036358),new Vec3D(8.086179,15.628972,1.3314338),new Vec3D(8.110297,15.1245,1.385747),new Vec3D(8.447998,15.592614,1.780501),new Vec3D(8.257084,16.13417,1.9357661),new Vec3D(7.5440054,16.436417,1.5131226),new Vec3D(6.5242143,16.650799,0.34222263)],
    id1 : [new Vec3D(3.4304817,8.722114,2.1471975),new Vec3D(2.6149573,7.982099,2.0452719),new Vec3D(1.6306036,7.8935885,2.172707),new Vec3D(1.6500117,7.9482017,2.2245877),new Vec3D(3.7647061,8.844325,2.0291057),new Vec3D(5.9178286,12.100096,0.2271361),new Vec3D(5.620553,12.7571335,0.26582032),new Vec3D(5.662738,12.72017,0.2628458),new Vec3D(5.965514,11.976195,0.072899975),new Vec3D(6.035828,11.633867,-0.1755748),new Vec3D(6.0634675,12.100592,-0.18510261),new Vec3D(6.125537,12.176786,-0.24983133),new Vec3D(6.298666,11.595734,-0.5750803),new Vec3D(6.3513956,11.29991,-0.6044195),new Vec3D(6.3742476,11.586624,-0.2635794),new Vec3D(6.2182107,11.868313,0.026623487),new Vec3D(5.9562616,11.938835,0.12783588),new Vec3D(5.54239,12.009791,0.043636903)],
    id2 : [new Vec3D(2.72071,11.253313,1.7948037),new Vec3D(3.3117757,10.541273,2.045818),new Vec3D(3.5689154,9.658876,2.5747447),new Vec3D(3.515284,9.783822,2.656077),new Vec3D(2.565631,11.204614,1.8672934),new Vec3D(3.3588822,11.643735,-0.3005566),new Vec3D(3.3294532,11.520674,-0.24109006),new Vec3D(3.3644323,11.493995,-0.2363669),new Vec3D(3.335115,11.751404,-0.18283021),new Vec3D(3.3894618,11.806714,-0.13315852),new Vec3D(3.4796355,11.501843,-0.20069249),new Vec3D(3.6022975,11.359365,-0.2536705),new Vec3D(3.6760278,11.506956,-0.18931313),new Vec3D(3.7448492,11.588909,-0.20778245),new Vec3D(3.7238412,11.503405,-0.32144722),new Vec3D(3.62107,11.492348,-0.35865444),new Vec3D(3.3552203,11.626195,-0.28661418),new Vec3D(2.9087737,11.776311,-0.16726987)]
  },
  throwbackextra : {
    id0 : [new Vec3D(-10.078573,19.524183,1.0144346),new Vec3D(-9.697063,19.87837,1.0988202),new Vec3D(-8.692799,20.656729,1.1377861),new Vec3D(-7.385232,21.435137,0.85262704),new Vec3D(-6.220997,21.92584,0.26701847),new Vec3D(-5.5777416,22.100967,-0.3114977),new Vec3D(-5.68009,22.07973,-0.546946),new Vec3D(-6.7930155,21.808773,-0.34393358)],
    id1 : [new Vec3D(-3.700882,15.405446,1.1110114),new Vec3D(-3.5164094,15.468421,1.1102207),new Vec3D(-3.0414124,15.586787,1.0615056),new Vec3D(-2.4344778,15.678799,0.9062573),new Vec3D(-1.8909099,15.702138,0.6721864),new Vec3D(-1.5863845,15.689274,0.46794543),new Vec3D(-1.6527233,15.714781,0.41015083),new Vec3D(-2.2331605,15.803568,0.5468512)],
    id2 : [new Vec3D(-0.17588416,13.285842,1.7951183),new Vec3D(-0.06889169,13.2334175,1.7597573),new Vec3D(0.19583091,13.089082,1.6757493),new Vec3D(0.52341807,12.908481,1.5722818),new Vec3D(0.81900394,12.747256,1.4785419),new Vec3D(0.987723,12.661051,1.4237169),new Vec3D(0.9347094,12.705506,1.4369941),new Vec3D(0.56509775,12.936267,1.5475605)]
  },
  thrown : {
    id0 : [new Vec3D(-0.46221927,12.766062,-0.008885354)]
  }
});


setHitBoxes(CHARIDS.FALCON_ID, {
  fairClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].fairClean.id0,5.078,18,32,100,24,0,4,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].fairClean.id1,3.515,18,32,100,24,0,4,0,1,1)
  ),
  fairLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].fairLate.id0,5.078,6,361,80,35,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].fairLate.id1,3.515,6,361,80,35,0,0,0,1,1)
  ),
  bairClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairClean.id0,4.687,14,361,100,20,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairClean.id1,4.687,14,361,100,0,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairClean.id2,3.906,14,361,100,0,0,0,0,1,1)
  ),
  bairLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairLate.id0,4.687,8,361,100,20,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairLate.id1,4.687,8,361,100,0,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].bairLate.id2,3.906,8,361,100,0,0,0,0,1,1)
  ),
  // Third hitbox read .id1, leaving .id2 unused. Fox's identical move
  // references id2 correctly, so this is the same copy-paste class as
  // bair2's second hitbox and downattack2's fourth.
  nair1 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair1.id0,4.297,6,82,100,0,40,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair1.id1,5.468,5,78,100,0,40,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair1.id2,4.297,6,74,100,0,40,0,0,1,1)
  ),
  // Third hitbox read .id1, leaving .id2 unused. Fox's identical move
  // references id2 correctly, so this is the same copy-paste class as
  // bair2's second hitbox and downattack2's fourth.
  nair2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair2.id0,4.297,7,361,100,40,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair2.id1,4.297,7,361,100,40,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].nair2.id2,4.297,7,361,100,40,0,0,0,1,1)
  ),
  dair : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dair.id0,6.640,16,270,100,40,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dair.id1,5.859,16,270,100,40,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dair.id2,5.468,16,290,100,40,0,0,0,1,1)
  ),
  upairClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairClean.id0,3.906,13,361,100,10,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairClean.id1,4.687,12,361,100,10,0,0,0,1,1),
  ),
  upairMid : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairMid.id0,3.906,12,30,80,8,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairMid.id1,4.687,10,30,80,8,0,0,0,1,1),
  ),
  /*
  doesnt actually exist
  upairLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairLate.id0,3.906,8,0,70,6,0,0,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upairLate.id1,4.687,6,0,70,6,0,0,0,1,1),
  ),*/
  falcondive1 : new createHitboxObject(
    // Second hitbox referenced .id0's offset. The SpecialHi script places it at
    // (13.332, 8.594) and falcondive1.id1 holds exactly that (13.33, 8.60) --
    // the data was correct, the reference was not. Same copy-paste class as the
    // nair third-hitbox bug.
    //
    // NOT changed: dmg stays 0 though the script says 1. These are type 2
    // (grab) hitboxes; meleelight models Falcon Dive's damage through its grab
    // path rather than the hitbox, so 0 here is a modelling choice, not a typo.
    new createHitbox(offsets[CHARIDS.FALCON_ID].falcondive1.id0,2.734,0,361,100,0,0,2,3,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falcondive1.id1,4.297,0,361,100,0,0,2,3,1,1)
  ),
  falcondive2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falcondive2.id0,2.734,0,361,100,0,0,2,3,1,1)
  ),
  ///
  falcondivethrow : new createHitboxObject(
    new createHitbox(new Vec2D(0,0),0,12,361,82,40,0,3,0,1,1)
  ),
  falcondivethrowextra : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falcondivethrowextra.id0,7.812,6,0,50,70,0,0,0,1,1,true)
  ),
  dtilt : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dtilt.id0,3.906,12,80,75,25,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dtilt.id1,3.906,12,70,75,25,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dtilt.id2,3.906,12,60,75,25,0,0,1,1,1)
  ),
  uptilt : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].uptilt.id0,4.687,13,361,80,50,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].uptilt.id1,3.125,13,361,80,50,0,0,1,1,1)
  ),
  ftilt : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].ftilt.id0,4.297,11,361,100,10,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].ftilt.id1,3.515,11,361,100,10,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].ftilt.id2,3.515,11,361,100,10,0,0,1,1,1)
  ),
  dashattackClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dashattackClean.id0,5.859,10,361,90,22,0,0,1,1,1)
  ),
  dashattackLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dashattackLate.id0,3.125,7,361,50,10,0,0,1,1,1)
  ),
  jab1 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab1.id0,3.515,2,80,100,0,20,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab1.id1,3.515,2,80,100,0,20,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab1.id2,2.344,2,80,100,0,20,0,1,1,1)
  ),
  jab2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab2.id0,3.515,3,80,100,0,20,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab2.id1,3.515,3,80,100,0,20,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab2.id2,2.734,3,80,100,0,20,0,1,1,1)
  ),
  jab3Clean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab3Clean.id0,5.079,8,361,100,20,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab3Clean.id1,3.515,8,361,100,20,0,0,1,1,1)
  ),
  jab3Late : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab3Late.id0,3.906,6,361,100,0,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].jab3Late.id1,3.125,6,361,100,0,0,0,1,1,1)
  ),
  fsmash : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].fsmash.id0,3.515,20,361,100,24,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].fsmash.id1,3.515,20,361,100,24,0,3,1,1,1)
  ),
  upsmash1 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash1.id0,5.468,8,90,100,0,80,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash1.id1,4.687,8,100,100,0,100,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash1.id2,3.906,14,80,105,30,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash1.id3,3.906,14,90,105,30,0,0,1,1,1),
  ),
  upsmash2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash2.id0,3.906,13,90,128,30,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash2.id1,3.906,13,90,126,30,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].upsmash2.id2,3.906,12,80,110,30,0,0,1,1,1)
  ),
  dsmash1 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dsmash1.id0,3.906,18,361,100,30,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dsmash1.id1,3.906,18,361,100,30,0,0,1,1,1)
  ),
  dsmash2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].dsmash2.id0,3.515,16,361,100,20,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].dsmash2.id1,3.515,16,361,100,20,0,0,1,1,1)
  ),
  grab : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].grab.id0,3.906,0,361,100,0,0,2,3,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].grab.id1,3.906,0,361,100,0,0,2,3,1,1)
  ),
  // ftCo_MS_CatchDash -- the DASH grab. 40 frames against Catch's 30;
  // hitbox frames and sizes read off the subaction script by
  // tools/gen_catchdash.py, which self-checks against the line above.
  grabDash : new createHitboxObject(new createHitbox(offsets[CHARIDS.FALCON_ID].grabDash.id0,3.90625,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[CHARIDS.FALCON_ID].grabDash.id1,3.90625,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[CHARIDS.FALCON_ID].grabDash.id2,3.90625,0,361,100,0,0,2,3,1,1)),
  downattack1 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack1.id0,4.687,6,361,50,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack1.id1,4.687,6,361,50,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack1.id2,6.250,6,361,50,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack1.id3,6.250,6,361,50,80,0,0,1,1,1)
  ),
  downattack2 : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack2.id0,4.687,6,361,50,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack2.id1,4.687,6,361,50,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack2.id2,6.250,6,361,50,80,0,0,1,1,1),
    // Was downattack1.id3. downattack2 has its own id3 and the two groups are
    // different frames of DownAttackU (19 and 28), so borrowing the first
    // group's fourth offset put that hitbox in the wrong place for the whole
    // second hit. Same copy-paste class as Fox's bair2 second hitbox.
    new createHitbox(offsets[CHARIDS.FALCON_ID].downattack2.id3,6.250,6,361,50,80,0,0,1,1,1)
  ),
  falconkickgroundClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundClean.id0,3.906,15,361,70,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundClean.id1,2.734,15,361,70,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundClean.id2,4.297,15,361,70,50,0,3,1,1,1),
  ),
  // id2 is created ONCE, at frame 14, and is never re-created or terminated
  // until `terminate_all_hitboxes` at the end of the subaction. The SpecialLw
  // script only rewrites id0 and id1 at f17 and f25:
  //     f14  create_hitbox id0 dmg15 / id1 dmg15 / id2 dmg15 size 4.297
  //     f17  create_hitbox id0 dmg12 / id1 dmg12          (id2 untouched)
  //     f25  create_hitbox id0 dmg9  / id1 dmg9           (id2 untouched)
  //     f33  terminate_all_hitboxes
  // So through the mid and late windows id2 still carries the CLEAN values
  // (dmg 15, angle 361, kg 70, bk 50), not the weakened ones. Because both
  // Melee and meleelight resolve overlapping hitboxes by lowest id first,
  // id0/id1 still win wherever they connect; id2 only decides the outer ring.
  //
  // Caveat we cannot model: id2 sits at z = +7.812 with radius 4.297, so in
  // Melee's 3D space it only reaches targets with depth. meleelight is 2D and
  // projects it onto the same plane, which makes it reach slightly more often
  // than the real hitbox does. That is a pre-existing 2D limitation; the
  // values below are what the script actually holds.
  // THREE hitboxes in every phase, and the third keeps its clean values. Melee
  // creates ids 0, 1 and 2 at frame 14 (all 15 damage) and then creates only
  // ids 0 and 1 again at 17 and at 25. A create_hitbox writes one SLOT --
  // ftaction.c:303, `&fp->x914[create_hitbox.id]` -- so id2 is never replaced
  // and never terminated until terminate_all_hitboxes at frame 33. It stays
  // live at 4.297 / 15 / angle 361 / kg 70 for the whole move.
  //
  // These three lines were briefly deleted on the theory that each frame's
  // create_hitbox set is the whole live set. It is not, and the recorded data
  // was right.
  //starts on 4
  falconkickgroundMid : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundMid.id0,3.906,12,80,60,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundMid.id1,2.734,12,80,60,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundMid.id2,4.297,15,361,70,50,0,3,1,1,1),
  ),
  //starts on 12
  falconkickgroundLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundLate.id0,3.906,9,90,50,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundLate.id1,2.734,9,90,50,50,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickgroundLate.id2,4.297,15,361,70,50,0,3,1,1,1)
  ),
  falconkickairClean : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairClean.id0,3.906,15,361,70,40,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairClean.id1,4.687,15,361,70,40,0,3,1,1,1)
  ),
  falconkickairMid : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairMid.id0,3.906,13,361,65,40,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairMid.id1,4.687,13,361,65,40,0,3,1,1,1)
  ),
  falconkickairLate : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairLate.id0,3.906,11,361,60,40,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickairLate.id1,4.687,11,361,60,40,0,3,1,1,1)
  ),
  falconkickland : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickland.id0,3.906,9,80,20,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickland.id1,3.906,9,80,20,80,0,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconkickland.id2,3.906,9,80,20,80,0,0,1,1,1),
  ),
  falconpunchground : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchground.id0,3.906,27,361,102,30,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchground.id1,3.515,25,361,102,30,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchground.id2,4.883,23,361,102,30,0,3,1,1,1)
  ),
  falconpunchair : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchair.id0,5.273,27,361,102,40,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchair.id1,4.687,25,361,102,40,0,3,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].falconpunchair.id2,4.883,23,361,102,40,0,3,1,1,1)
  ),
  raptorboostground : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostground.id0,4.000,0,361,0,0,0,8,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostground.id1,4.000,0,361,0,0,0,8,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostground.id2,4.000,0,361,0,0,0,8,0,1,1)
  ),
  raptorboostair : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostair.id0,4.000,0,361,0,0,0,8,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostair.id1,4.000,0,361,0,0,0,8,0,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostair.id2,4.000,0,361,0,0,0,8,0,1,1)
  ),
  raptorboostgroundhit : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostgroundhit.id0,7.500,7,90,80,78,0,3,1,1,1)
  ),
  raptorboostairhit : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].raptorboostairhit.id0,7.500,7,270,70,60,0,3,0,1,1)
  ),
  ledgegetupquick : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].ledgegetupquick.id0,4.687,10,361,100,0,90,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].ledgegetupquick.id1,6.250,10,361,100,0,90,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].ledgegetupquick.id2,4.687,10,361,100,0,90,0,1,1,1)
  ),
  ledgegetupslow : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].ledgegetupslow.id0,6.250,8,361,100,0,90,0,1,1,1),
    new createHitbox(offsets[CHARIDS.FALCON_ID].ledgegetupslow.id1,4.687,8,361,100,0,90,0,1,1,1)
  ),
  pummel : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].pummel.id0,5.078,3,80,100,0,30,0,0,1,1)
  ),
  throwup : new createHitboxObject(
    new createHitbox(new Vec2D(8.63,11.15),0,3,85,105,70,0,0,0,1,1)
  ),
  throwdown : new createHitboxObject(
    new createHitbox(new Vec2D(8.58,3.25),0,7,65,34,75,0,0,0,1,1)
  ),
  throwback : new createHitboxObject(
    new createHitbox(new Vec2D(-11.36,22.23),0,4,135,130,30,0,0,0,1,1)
  ),
  throwforward : new createHitboxObject(
    new createHitbox(new Vec2D(7.54,12.51),0,4,45,105,45,0,0,0,1,1)
  ),
  // The "extra" throw hitboxes are the bystander hitboxes created by
  // create_hitbox (event 0x0B) inside the throw subaction, as distinct from
  // the throw itself, which comes from throw_hitbox (event 0x22,
  // ftAction_80071E04). Sizes and damage below were already exact; angle,
  // knockback growth and base knockback were not.
  //   ThrowF f11: 3.90625/1.95312/1.95312, dmg 5, angle 80, kg 100, bk 70
  throwforwardextra : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwforwardextra.id0,3.906,5,80,100,70,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwforwardextra.id1,1.953,5,80,100,70,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwforwardextra.id2,1.953,5,80,100,70,0,0,0,1,1,true)
  ),
  //   ThrowHi f11: 3.51562/3.125/2.73438, dmg 4, angle 80, kg 100, bk 60
  throwupextra : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwupextra.id0,3.515,4,80,100,60,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwupextra.id1,3.125,4,80,100,60,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwupextra.id2,2.734,4,80,100,60,0,0,0,1,1,true)
  ),
  //   ThrowB f12: 3.90625/3.51562/2.73438, dmg 5, angle 70, kg 100, bk 70.
  // kg was 0 here, which makes the hit do the same knockback at 0% and 999%.
  throwbackextra : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwbackextra.id0,3.906,5,70,100,70,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwbackextra.id1,3.515,5,70,100,70,0,0,0,1,1,true),
    new createHitbox(offsets[CHARIDS.FALCON_ID].throwbackextra.id2,2.734,5,70,100,70,0,0,0,1,1,true)
  ),
  // The tumble-body hitbox: a character in DamageFly* damages anyone they are
  // launched into. In Melee this is a create_hitbox at frame 0 of every
  // DamageFly subaction (DamageFlyN/Hi/Lw/Top/Roll), and it is identical in all
  // five of them and across all five characters:
  //     size 4.6875, dmg 6, angle 361, kg 100, bk 30
  // The previous values (3.906/4/361/50/20) were likewise uniform, so this is
  // one shared estimate being corrected, not five separate ones.
  thrown : new createHitboxObject(
    new createHitbox(offsets[CHARIDS.FALCON_ID].thrown.id0,4.687,6,361,100,30,0,1,0,1,1)
  )
});


setChars(CHARIDS.FALCON_ID, new charObject(CHARIDS.FALCON_ID));
