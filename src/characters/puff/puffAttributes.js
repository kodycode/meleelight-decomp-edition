import {
  offsets, charObject, setChars,
  CHARIDS
  ,
  setHitBoxes
  ,
  setCharAttributes
  ,
  setOffsets
  ,
  setIntangibility
  , setActionSounds, setFrames
} from "main/characters";
import {Vec2D} from "../../main/util/Vec2D";
import {Vec3D} from "../../main/util/Vec3D";
import {createHitboxObject} from "../../main/util/createHitboxObject";
import {createHitbox} from "../../main/util/createHitBox";
/* eslint-disable */

setCharAttributes(CHARIDS.PUFF_ID, {
  dashFrameMin: 12,
  dInitV: 1.31,
  dMaxV: 1.100000023841858,
  dAccA: 0.06499999761581421,
  dAccB: 0.019999999552965164,
  dTInitV: 1.399999976158142,
  traction: 0.09000000357627869,
  maxWalk: 0.699999988079071,
  jumpSquat: 5,
  sHopInitV: 1.0499999523162842,
  fHopInitV: 1.600000023841858,
  gravity: 0.06400000303983688,
  walkAccelMul: 0.1599999964237213,
  walkAccelBase: 0.10000000149011612,
  groundMaxHorizontalV: 3.0,
  groundToAir: 1,
  jumpHmaxV: 1.350000023841858,
  jumpHinitV: 0.699999988079071,
  airMobA: 0.09000000357627869,
  airMobB: 0.1899999976158142,
  aerialHmaxV: 1.350000023841858,
  airMaxHorizontalV: 3,
  airFriction: 0.05000000074505806,
  fastFallV: 1.600000023841858,
  terminalV: 1.2999999523162842,
  walkInitV: 0.16,
  walkAcc: 0.1,
  walkMaxV: 0.699999988079071,
  djMultiplier: 0,
  djMomentum: 0,
  shieldScale: 13.125,
  modelScale: 0.9399999976158142,
  weight: 60,
  waitAnimSpeed: 1,
  walljump: false,
  hurtboxOffset: [6, 13],
  // Ledge snap box, verbatim from ftData+0x44 (ftData_x44_t, ft/types.h:584).
  // Melee builds the box in mpColl_80044164 / mpColl_800443C4 (mpcoll.c:1253,
  // :1326) rather than storing corners, so the raw three values are stored here
  // and dealWithLedges() reconstructs the box the same way.
  ledgeSnapX : 9.0,
  ledgeSnapY : 10.0,
  ledgeSnapHeight : 9.0,
  // SUPERSEDED and no longer read. The shield's position now comes from
  // src/main/shieldData.js, baked from the posed Guard animation. Kept
  // only because it is a hand-measured value some UI still displays.
  shieldOffset: [0, 22],
  charScale: 0.24,
  miniScale: 0.168,
  runTurnBreakPoint: 15,   // extracted: TurnRun subaction sets cmd_vars[1] at frame 15
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
  standingTurnFrames : 4,
  airdodgeIntangible: 25,
  // Rollout (side special). Character-specific block at ftData+0x04, layout
  // from ftPurinAttributes (src/melee/ft/kinds/ftPurin/types.h:97-103).
  //
  // The stick-to-angle map is NOT `lsY * 20 degrees`: it has a floor and a
  // ceiling and interpolates between them, so full tilt is reached at half
  // deflection -- see calcAngleRadians, ftpurinspecials.c:78-95.
  //
  // x68 belongs to the NEUTRAL special (Rollout's turnaround,
  // ftpurinspecialn.c:751 -- `|lstick[0].x| > x68` plus a direction change),
  // and is 0.5 rather than the 0.49 meleelight had.
  rolloutTurnStickThreshold: 0.5,           // x68
  rolloutStickFloor: 0.10000000149011612,   // xDC, below this the angle is 0
  rolloutStickCeiling: 0.5,                 // xE0, at/above this it saturates
  rolloutMaxAngleDeg: 20.0,                 // xE4, degrees at saturation
  rolloutSpeed: 2.200000047683716,          // xF0
  rolloutDecay: 0.9200000166893005,         // xF4, applied every frame
  // ftCo_SpecialS.c:45, the side-special entry:
  //   gr_vel += -(gr_vel * (1 - specials_ground_speed_retention))
  //             * ft_GetGroundFrictionMultiplier(fp)
  // which with the usual multiplier of 1 reduces to gr_vel *= retention.
  // 0.2 on every character here, but it is a per-character field.
  specialsGroundSpeedRetention : 0.20000000298023224,
  wallJumpVelX: 1.2999999523162842,
  wallJumpVelY: 1.600000023841858,
  shieldBreakVel: 10,
  multiJump: true,
  //ecbscale: 2.6,
  ecbScale : 1,
  walkAnimSpeed : 1,
  runAnimSpeed : 1
});

// start, length
setIntangibility(CHARIDS.PUFF_ID, {
  "ESCAPEAIR": [5, 26],
  "ESCAPEB": [5, 16],
  "ESCAPEF": [3, 17],
  "ESCAPEN": [3, 14],
  "DOWNSTANDN": [1, 23],
  "DOWNSTANDB": [1, 21],
  "DOWNSTANDF": [1, 19],
  "TECHN": [1, 20],
  "TECHB": [1, 20],
  "TECHF": [1, 20]
});

setFrames(CHARIDS.PUFF_ID, {
  "WAIT": 464,
  "DASH": 24,
  "RUN": 16,
  "RUNBRAKE": 20,
  "RUNTURN": 25,
  "WALK": 45,
  "JUMPF": 52,
  "JUMPB": 52,
  "FALL": 8,
  "FALLAERIAL": 8,
  "FALLSPECIAL": 8,
  "SQUAT": 8,
  "SQUATWAIT": 40,
  "SQUATRV": 10,
  "JUMPAERIALF": 50,
  "JUMPAERIALB": 50,
  "PASS": 30,
  "GUARDON": 8,
  "GUARDOFF": 14,
  "CLIFFCATCH": 8,
  "CLIFFWAIT": 60,
  "DAMAGEFLYN": 60,
  "DAMAGEFALL": 30,
  "DAMAGEN2": 24,
  "LANDINGATTACKAIRF": 20,
  "LANDINGATTACKAIRB": 20,
  "LANDINGATTACKAIRU": 20,
  "LANDINGATTACKAIRD": 30,
  "LANDINGATTACKAIRN": 20,
  "ESCAPEB": 35,
  "ESCAPEF": 35,
  "ESCAPEN": 28,
  "DOWNBOUND": 26,
  "DOWNWAIT": 59,
  "DOWNSTANDN": 30,
  "DOWNSTANDB": 36,
  "DOWNSTANDF": 36,
  "TECHN": 26,
  "TECHB": 40,
  "TECHF": 40,
  // 30, not 27: ShieldBreakFall plays DamageFall (Melee's own state table,
  // ftCo_MS_ShieldBreakFall -> ftCo_SM_DamageFall) and Puff's DamageFall is 30
  // frames, as it is for every other character here. This was invisible while
  // the state was mapped to "FuraFuraFall", a subaction that exists on no
  // character, so the length check silently skipped it.
  "SHIELDBREAKFALL": 30,
  "SHIELDBREAKDOWNBOUND": 26,
  "SHIELDBREAKSTAND": 30,
  "FURAFURA": 100,
  "CAPTUREWAIT": 130,
  "CATCHWAIT": 30,
  "CATCHDASH" : 40,   // ftCo_MS_CatchDash; 30 for the standing Catch
  // Melee plays the Landing subaction for both, 30 frames on the disc.
  // Neither had a setFrames entry, so render.js and hurtCapsulesWorld had
  // nothing to clamp against -- and LANDINGFALLSPECIAL advances its timer
  // in steps of landingMultiplier (3 for an airdodge), so Math.floor(timer)
  // reaches 30 either way. Falcon had no hurtbox table for it at all and
  // fell back to the flat rectangle on every wavedash landing.
  "LANDING" : 30,
  "LANDINGFALLSPECIAL" : 30,
  "CAPTURECUT": 30,
  "CATCHCUT": 29,
  "CAPTUREDAMAGE": 20,
  // The animation is this long on the disc. Marth's entry already
  // matched; the other four were each one frame over.
  "WALLDAMAGE": 30,
  "WALLTECH": 26,
  "WALLJUMP": 40,
  "OTTOTTO": 12,
  "OTTOTTOWAIT": 63,
  "THROWNMARTHUP": 7,
  "THROWNMARTHBACK": 4,
  "THROWNMARTHFORWARD": 8,
  "THROWNMARTHDOWN": 8,
  "THROWNPUFFUP": 4,
  "THROWNPUFFBACK": 14,
  "THROWNPUFFFORWARD": 9,
  "THROWNPUFFDOWN": 60,
  "THROWNFOXUP": 4,
  "THROWNFOXBACK": 5,
  "THROWNFOXFORWARD": 10,
  "THROWNFOXDOWN": 32,
  "THROWNFALCOUP" : 4,
  "THROWNFALCOBACK" : 5,
  "THROWNFALCOFORWARD" : 6,
  "THROWNFALCODOWN" : 19,
  "THROWNFALCONUP" : 14,
  "THROWNFALCONBACK" : 19,
  "THROWNFALCONFORWARD" : 17,
  "THROWNFALCONDOWN" : 11,
  "FURASLEEPSTART": 33,
  "FURASLEEPLOOP": 76,
  "FURASLEEPEND": 76,
  "STOPCEIL": 7,
  "TECHU": 25,
  "REBOUND" : 16
});

setActionSounds(CHARIDS.PUFF_ID, {
  "JUMP": [],
  "ESCAPEAIR": [],
  "JUMPAERIAL": [],
  "GUARDON": [],
  "GUARDOFF": [],
  "CLIFFCATCH": [[1, "puffledgegrab"], [1, "puffshout5"]],
  "DEAD": [[1, "puffdeath"]],
  "FURAFURA": [],
  "ESCAPEB": [],
  "ESCAPEF": [],
  "ESCAPEN": [],
  "OTTOTTOWAIT": [],
  "TECH" : []
});

// HITBOX OFFSETS

setOffsets(CHARIDS.PUFF_ID, {
  fair1: {
    id0 : [new Vec3D(6.157562,3.801145,-2.1836896),new Vec3D(9.398221,3.6712208,-1.9230813)],
    id1 : [new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0)]
  },
  fair2: {
    id0 : [new Vec3D(6.157562,3.801145,-2.1836896),new Vec3D(9.398221,3.6712208,-1.9230813),new Vec3D(8.946785,3.7156954,-1.6662748),new Vec3D(8.283872,3.7121994,-1.557328),new Vec3D(8.402142,3.7345157,-1.4075421),new Vec3D(8.27604,3.8071556,-1.4176139),new Vec3D(8.02026,3.859204,-1.4717963),new Vec3D(7.7384276,3.8917594,-1.6526905),new Vec3D(7.5456457,3.813102,-1.7540706),new Vec3D(7.346053,3.2570248,-1.8589339),new Vec3D(6.882586,2.0923755,-1.9428498),new Vec3D(6.034448,0.7336501,-2.003778),new Vec3D(4.8745236,-0.39949208,-2.0836012),new Vec3D(3.6831074,-1.0841057,-2.1130488)],
    id1 : [new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0),new Vec3D(1.8359375,1.8359375,0)]
  },
  nair1: {
    id0 : [new Vec3D(0.4985241,4.028832,0.0015310629),new Vec3D(0.49789768,4.029009,0.0014972595)],
    id1 : [new Vec3D(8.62926,1.7511611,3.5494733),new Vec3D(7.851808,1.8828912,3.4515364)]
  },
  nair2: {
    id0 : [new Vec3D(0.4961258,4.029507,0.0014064736),new Vec3D(0.49336836,4.030279,0.0012793251),new Vec3D(0.48978442,4.031275,0.0011396586),new Vec3D(0.4855328,4.0324464,0.0010112668),new Vec3D(0.48077396,4.033745,0.0009152015),new Vec3D(0.4756696,4.035122,0.00086768134),new Vec3D(0.4703834,4.0365314,0.0008785449),new Vec3D(0.46508124,4.037928,0.0009503637),new Vec3D(0.45993084,4.0392685,0.0010781066),new Vec3D(0.45510182,4.040511,0.0012494045),new Vec3D(0.450765,4.0416155,0.0014454781),new Vec3D(0.44709256,4.042541,0.0016426033),new Vec3D(0.44425663,4.0432506,0.0018142381),new Vec3D(0.44242957,4.043705,0.0019337549),new Vec3D(0.44178268,4.0438657,0.0019777443),new Vec3D(0.44248578,4.043691,0.0019299694),new Vec3D(0.44470614,4.0431385,0.0017859093),new Vec3D(0.4486072,4.04216,0.0015578563),new Vec3D(0.45434704,4.0407043,0.0012806606),new Vec3D(0.46207628,4.038712,0.0010179728),new Vec3D(0.4719349,4.0361195,0.00086904666)],
    id1 : [new Vec3D(6.9641657,1.8541621,3.3185697),new Vec3D(7.013151,1.8033231,3.1180263),new Vec3D(7.1087594,1.8116262,2.891653),new Vec3D(7.2432346,1.8790599,2.6312895),new Vec3D(7.313875,1.7852153,2.3109584),new Vec3D(7.3918734,1.746909,1.9720627),new Vec3D(7.435473,1.6897874,1.6179926),new Vec3D(7.4723763,1.683338,1.255369),new Vec3D(7.4419208,1.6089787,0.912461),new Vec3D(7.3705544,1.5142171,0.60402465),new Vec3D(7.2789187,1.4290701,0.35542983),new Vec3D(7.2108116,1.4121743,0.17447758),new Vec3D(7.221718,1.5345297,0.024708569),new Vec3D(7.305756,1.7757859,-0.096931905),new Vec3D(7.4010496,2.0020194,-0.12974396),new Vec3D(7.5075006,2.1921651,-0.063527405),new Vec3D(7.6631284,2.442846,0.061789513),new Vec3D(7.8431506,2.7294388,0.27655733),new Vec3D(7.9678893,2.8734488,0.66026574),new Vec3D(7.9803305,2.8035445,1.218522),new Vec3D(7.843085,2.610515,1.9132583)]
  },
  dair: {
    id0 : [new Vec3D(3.1284375,-2.203125,0),new Vec3D(3.1284375,-2.203125,0)],
    id1 : [new Vec3D(1.8763281,0,0),new Vec3D(1.8763281,0,0)],
    id2 : [new Vec3D(3.1284375,-2.203125,0),new Vec3D(3.1284375,-2.203125,0)],
    id3 : [new Vec3D(1.8763281,0,0),new Vec3D(1.8763281,0,0)]
  },
  bair: {
    id0 : [new Vec3D(-9.432328,3.0696166,-5.368533),new Vec3D(-14.586501,3.5951722,-0.015627682),new Vec3D(-12.705721,3.798603,3.9455914),new Vec3D(-9.568034,3.4800825,5.7639055)],
    id1 : [new Vec3D(-6.2969513,3.2385988,-1.958143),new Vec3D(-8.008078,3.5882323,0.6232324),new Vec3D(-7.0684733,3.6957273,2.7549694),new Vec3D(-5.549819,3.539596,3.956852)],
    id2 : [new Vec3D(-4.22546,3.405577,-0.34012246),new Vec3D(-4.2823315,3.734075,0.57372487),new Vec3D(-3.9910536,3.7956514,1.6895881),new Vec3D(-3.468499,3.7197049,2.5707784)]
  },
  upair: {
    id0 : [new Vec3D(-3.8867717,10.984694,-1.3369727),new Vec3D(0.20676716,13.076402,-0.10968163),new Vec3D(1.514225,12.735067,0.09267415),new Vec3D(2.6569304,12.239996,0.23025443)]
  },
  sidespecial: {
    id0 : [new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0),new Vec3D(3.671875,4.7734375,0)],
    id1 : [new Vec3D(12.293629,1.9177139,0.30673766),new Vec3D(9.965753,2.677922,-0.47265762),new Vec3D(7.342147,3.567716,0.49947053),new Vec3D(7.4903398,3.3092127,0.83058465),new Vec3D(8.287021,2.8562388,1.183891),new Vec3D(8.189891,2.9633884,1.1291289),new Vec3D(8.196012,3.0174582,1.1430756),new Vec3D(8.20935,3.1072822,1.1355901),new Vec3D(8.228119,3.2232196,1.1180067),new Vec3D(8.250599,3.3553915,1.1019027),new Vec3D(8.275398,3.4933095,1.0992819),new Vec3D(8.289647,3.6083019,1.0781839),new Vec3D(8.287049,3.6893363,1.0151453),new Vec3D(8.279518,3.758491,0.94920766),new Vec3D(8.2812,3.8385746,0.9225163),new Vec3D(8.290487,3.924424,0.93128824)]
  },
  fsmash1: {
    id0 : [new Vec3D(3.4356508,6.1564426,0.40289432),new Vec3D(3.3961143,6.3297668,0.29566595),new Vec3D(3.3615446,6.470234,0.20208016),new Vec3D(3.3234844,6.592562,0.14434701)],
    id1 : [new Vec3D(7.7518864,6.6120667,-0.47570732),new Vec3D(7.835552,6.695185,-0.7062937),new Vec3D(7.8766174,6.705011,-0.90065396),new Vec3D(7.8862696,6.751975,-0.96013355)]
  },
  fsmash2: {
    id0 : [new Vec3D(3.2710543,6.706597,0.0876677),new Vec3D(3.262432,6.6846995,0.08478053),new Vec3D(3.257658,6.616377,0.108669534),new Vec3D(3.2856426,6.457546,0.121107206),new Vec3D(3.3204775,6.2383475,0.15619156)],
    id1 : [new Vec3D(7.8358154,6.7542953,-0.904775),new Vec3D(7.785202,6.6994433,-0.8215819),new Vec3D(7.7200356,6.665862,-0.6688502),new Vec3D(7.65337,6.462502,-0.6085012),new Vec3D(7.565997,6.271842,-0.49313956)]
  },
  dsmash: {
    id0 : [new Vec3D(-9.2389,0.87724686,1.0399019),new Vec3D(-8.903629,1.2504216,1.2624787)],
    id1 : [new Vec3D(9.610762,0.898664,0.8359847),new Vec3D(9.32086,1.0979594,0.89358974)],
    id2 : [new Vec3D(-3.7132068,1.660675,1.65691),new Vec3D(-3.6967611,1.4912847,1.5167456)],
    id3 : [new Vec3D(4.0462713,1.5114104,1.2719328),new Vec3D(4.0930605,1.4538255,1.1477916)]
  },
  upsmash: {
    id0 : [new Vec3D(-5.9458914,10.978325,0.33658543),new Vec3D(-0.33430034,14.918594,-0.5759318),new Vec3D(2.7499275,11.9963665,-0.09603821),new Vec3D(4.0214148,7.8669887,1.0363464)],
    id1 : [new Vec3D(-7.189268,10.202671,0.43458232),new Vec3D(-1.63532,15.176059,-1.2070312),new Vec3D(1.87237,12.539936,-1.1408597),new Vec3D(3.582526,9.016502,0.2343359)]
  },
  jab1: {
    id0 : [new Vec3D(4.559454,4.8480763,-0.39660716),new Vec3D(4.9700212,4.762392,-0.67046016)],
    id1 : [new Vec3D(8.098884,4.796918,-0.17050911),new Vec3D(8.201439,4.6671634,-0.6730022)],
    id2 : [new Vec3D(11.638313,4.7457595,0.055588916),new Vec3D(11.432857,4.5719347,-0.6755442)]
  },
  jab2: {
    id0 : [new Vec3D(4.879409,3.996521,-1.1079528),new Vec3D(4.9969416,3.900562,-0.37203318)],
    id1 : [new Vec3D(8.840834,4.089421,-0.49728027),new Vec3D(8.563253,3.9309826,-0.46080333)],
    id2 : [new Vec3D(12.8022585,4.1823206,0.11339232),new Vec3D(12.129565,3.9614031,-0.5495735)]
  },
  dtilt: {
    id0 : [new Vec3D(13.597387,3.3067589,1.6878829),new Vec3D(16.004967,4.185191,0.048190475),new Vec3D(15.765829,4.2883806,-0.04560645)],
    id1 : [new Vec3D(9.311202,3.4552321,0.99107856),new Vec3D(10.719506,4.1723056,0.19157802),new Vec3D(10.638969,4.2933865,0.16594923)],
    id2 : [new Vec3D(5.727565,3.668041,-0.018926859),new Vec3D(6.2016582,4.2445693,-0.10849727),new Vec3D(6.250396,4.34484,-0.08133814)]
  },
  uptilt1: {
    id0 : [new Vec3D(-1.3980322,2.866063,-1.5541708),new Vec3D(-4.3987827,6.630415,-2.1260324)],
    id1 : [new Vec3D(-0.32194126,0.5330181,-1.6278986),new Vec3D(-7.4485216,9.388336,-2.1975024)]
  },
  uptilt2: {
    id0 : [new Vec3D(-2.2210774,10.561279,-1.8762622),new Vec3D(-1.4381707,11.145849,-1.3816245),new Vec3D(-1.089853,11.317729,-1.1907847),new Vec3D(-1.2108524,11.237192,-1.3627894),new Vec3D(-1.6941011,10.946711,-1.6281009)],
    id1 : [new Vec3D(-0.6532695,15.9691515,-2.39681),new Vec3D(1.0812068,16.209637,-1.3816785),new Vec3D(2.0243127,16.01646,-0.7533102),new Vec3D(1.9104776,15.825817,-0.2869606),new Vec3D(0.8900745,15.790855,-0.27518642)]
  },
  ftilt: {
    id0 : [new Vec3D(3.189284,3.0112529,2.419311),new Vec3D(5.7863016,4.39123,-0.35634714),new Vec3D(5.107693,4.6283298,-1.951799),new Vec3D(3.339632,4.7485414,-3.0485148)],
    id1 : [new Vec3D(7.603153,3.4556818,3.9196675),new Vec3D(11.12302,4.5591283,0.20389129),new Vec3D(9.863327,4.6124015,-3.230732),new Vec3D(6.523145,4.6976285,-5.360282)]
  },
  dashattack1: {
    id0 : [new Vec3D(4.628202,8.72632,-0.87953055),new Vec3D(4.9002495,8.48913,-0.48100698),new Vec3D(4.8853397,8.471598,-0.47470286),new Vec3D(4.8644466,8.466779,-0.47041908),new Vec3D(4.848794,8.464722,-0.46795532)]
  },
  dashattack2: {
    id0 : [new Vec3D(4.8420296,8.455657,-0.46699885),new Vec3D(4.8433514,8.430379,-0.46718168),new Vec3D(4.849863,8.380041,-0.46811205),new Vec3D(4.858242,8.295875,-0.46939367),new Vec3D(4.865694,8.169003,-0.47063532),new Vec3D(4.8702545,7.990421,-0.47145644)]
  },
  downspecial: {
    id0 : [new Vec3D(0.13491952,5.2635818,-0.24543878)]
  },
  upspecial: {
    id0 : [new Vec3D(-0.35961714,5.2276373,-0.32642567)]
  },
  /*upspecial1 : {
   id0 : [new Vec2D(-0.76,4.94),
   new Vec2D(-0.92,5.06),
   new Vec2D(-1.08,5.18),
   new Vec2D(-1.25,5.29),
   new Vec2D(-1.41,5.41),
   new Vec2D(-1.58,5.52),
   new Vec2D(-1.74,5.63),
   new Vec2D(-1.90,5.74)]
   },
   upspecial2 : {
   id0 : [new Vec2D(1.22,4.91),
   new Vec2D(1.33,5.06),
   new Vec2D(1.44,5.20),
   new Vec2D(1.56,5.35),
   new Vec2D(1.67,5.50),
   new Vec2D(1.77,5.64),
   new Vec2D(1.88,5.78),
   new Vec2D(1.99,5.90)]
   },
   upspecial3 : {
   id0 : [new Vec2D(-0.10,4.25),
   new Vec2D(-0.15,4.35),
   new Vec2D(-0.19,4.46),
   new Vec2D(-0.23,4.60),
   new Vec2D(-0.27,4.74),
   new Vec2D(-0.30,4.90),
   new Vec2D(-0.33,5.06),
   new Vec2D(-0.36,5.23),
   new Vec2D(-0.39,5.39),
   new Vec2D(-0.41,5.56),
   new Vec2D(-0.43,5.71),
   new Vec2D(-0.45,5.86),
   new Vec2D(-0.46,5.99)]
   },*/
  grab: {
    id0 : [new Vec3D(10.28125,4.7734375,0),new Vec3D(10.28125,4.7734375,0)],
    id1 : [new Vec3D(4.7734375,4.7734375,0),new Vec3D(4.7734375,4.7734375,0)]
  },
  grabDash : {
    id0 : [new Vec3D(3.6526656,4.7734375,0),new Vec3D(3.0916057,4.7734375,0)],
    id1 : [new Vec3D(-1.8551469,4.7734375,0),new Vec3D(-2.4162068,4.7734375,0)],
    id2 : [new Vec3D(-6.261397,4.7734375,0),new Vec3D(-6.822457,4.7734375,0)]
  },
  downattack1: {
    id0 : [new Vec3D(-11.936926,2.4533699,-5.9721384),new Vec3D(-14.230854,2.9529119,-0.0735784)],
    id1 : [new Vec3D(-5.681451,3.3159137,-2.6047447),new Vec3D(-6.8122034,4.101249,-0.120744824)],
    id2 : [new Vec3D(-1.7756269,1.7129478,1.131865),new Vec3D(-1.9163306,2.0112536,1.6716646)],
    id3 : [new Vec3D(-2.1198921,5.455756,-1.0611324),new Vec3D(-2.82,6.0084496,-0.00086059666)]
  },
  downattack2: {
    id0 : [new Vec3D(13.055576,3.1924238,6.7198095),new Vec3D(14.103751,2.4523911,-0.74846476)],
    id1 : [new Vec3D(6.2363863,4.5173984,3.3813355),new Vec3D(6.7947893,4.070608,-0.1847813)],
    id2 : [new Vec3D(2.550628,2.0267117,-0.29464018),new Vec3D(1.8337276,1.9068849,-1.3392124)],
    id3 : [new Vec3D(2.6847892,6.151304,1.3055925),new Vec3D(2.82,6.0084496,0.00082862005)]
  },
  pummel: {
    id0 : [new Vec3D(11.75,5.5078125,0),new Vec3D(11.75,5.5078125,0)]
  },
  downspecial: {
    id0: [new Vec2D(0.13, 5.26)]
  },
  ledgegetupquick: {
    id0 : [new Vec3D(-2.4582367,12.508147,-0.06606564),new Vec3D(-1.086945,12.410809,0.0958788),new Vec3D(1.545239,11.518793,0.11669452),new Vec3D(4.266203,7.7943797,-0.016635764),new Vec3D(4.40824,5.363469,0.048262864)],
    id1 : [new Vec3D(-6.3550587,13.079638,-0.24579658),new Vec3D(-4.7740965,13.780154,0.36778295),new Vec3D(-1.256928,15.559352,0.045015596),new Vec3D(8.060021,12.265095,0.5851608),new Vec3D(10.079643,6.8828325,0.56712514)]
  },
  ledgegetupslow: {
    id0 : [new Vec3D(-7.0367994,1.550118,1.9871035),new Vec3D(-7.350559,1.0652206,-3.2450418),new Vec3D(-1.9569445,0.8738725,-8.0159),new Vec3D(6.8304586,0.8843863,-6.0091467),new Vec3D(7.4508047,0.7251905,6.901379),new Vec3D(-6.018521,0.40138152,7.8012514),new Vec3D(-8.098564,0.39161718,-5.2495003),new Vec3D(2.2587137,0.5665527,-9.257091),new Vec3D(8.820967,0.7960833,-3.3325653),new Vec3D(8.248805,1.1223743,4.2968116),new Vec3D(3.094469,1.5513519,8.532914),new Vec3D(-2.6079826,1.9438698,8.336847),new Vec3D(-6.246956,2.241619,5.4800887),new Vec3D(-7.5819144,2.4292817,2.0330186),new Vec3D(-7.35299,2.4967313,-0.82201916),new Vec3D(-6.428811,2.4407823,-2.7500849),new Vec3D(-5.410105,2.2606916,-3.8714552)],
    id1 : [new Vec3D(7.3435063,1.7507088,0.89932287),new Vec3D(5.0744095,1.8464001,6.6632752),new Vec3D(1.5953045,0.69970036,7.8777485),new Vec3D(-5.2218485,1.3663933,7.6589117),new Vec3D(-8.562836,1.1467164,-5.711296),new Vec3D(4.8545294,0.45753944,-8.723113),new Vec3D(8.897632,0.22631562,3.949446),new Vec3D(-0.59911346,0.30133322,9.547649),new Vec3D(-7.9845986,0.5622715,5.0151067),new Vec3D(-8.9467945,0.8785883,-2.3577647),new Vec3D(-5.0457416,1.1821864,-7.469896),new Vec3D(0.2061615,1.3680673,-8.7011795),new Vec3D(4.4217653,1.4292761,-7.083868),new Vec3D(6.6828156,1.4545467,-4.3366933),new Vec3D(7.378114,1.5067451,-1.6502709),new Vec3D(7.142472,1.534988,0.43410394),new Vec3D(6.5063567,1.5214508,1.9224715)]
  },
  thrown: {
    id0 : [new Vec3D(0,3.788457,0)]
  },
  throwdownextra: {
    id0 : [new Vec3D(2.9375,3.671875,0)]
  },
  throwforwardextra: {
    id0 : [new Vec3D(1.4099578,7.431875,0.28198853)]
  },
  neutralspecialair: {
    id0 : [new Vec3D(0,5.140625,0)]
  },
  // Rollout, GROUNDED -- subaction index 304, which creates THREE hitboxes on
  // frame 0 spread across the ball: id0 at the centre and id1/id2 at
  // x = -+3.90625, all at y = 5.46875. The values here were hand-measured and
  // two of them were Vec2D in a Vec3D table.
  neutralspecialground: {
    id0 : [new Vec3D(0, 5.46875, 0)],
    id1 : [new Vec3D(-3.90625, 5.46875, 0)],
    id2 : [new Vec3D(3.90625, 5.46875, 0)]
  }
});

setHitBoxes(CHARIDS.PUFF_ID, {
  fair1: new createHitboxObject(new createHitbox(offsets[1].fair1.id0, 3.515, 12, 361, 100, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].fair1.id1, 4.687, 10, 361, 100, 10, 0, 0, 0, 1, 1)),
  fair2: new createHitboxObject(new createHitbox(offsets[1].fair2.id0, 3.515, 7, 361, 80, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].fair2.id1, 4.687, 7, 361, 80, 10, 0, 0, 0, 1, 1)),
  bair: new createHitboxObject(new createHitbox(offsets[1].bair.id0, 3.906, 12, 361, 100, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].bair.id1, 3.906, 12, 361, 100, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].bair.id2, 4.297, 12, 361, 100, 10, 0, 0, 0, 1, 1)),
  nair1: new createHitboxObject(new createHitbox(offsets[1].nair1.id0, 5.078, 12, 361, 70, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].nair1.id1, 3.906, 12, 361, 70, 10, 0, 0, 0, 1, 1)),
  nair2: new createHitboxObject(new createHitbox(offsets[1].nair2.id0, 4.687, 9, 361, 80, 10, 0, 0, 0, 1, 1), new createHitbox(offsets[1].nair2.id1, 3.515, 9, 361, 80, 10, 0, 0, 0, 1, 1)),
  dair: new createHitboxObject(new createHitbox(offsets[1].dair.id0, 5.078, 2, 270, 100, 20, 0, 0, 0, 1, 0), new createHitbox(offsets[1].dair.id1, 4.297, 2, 270, 100, 20, 0, 0, 0, 1, 0), new createHitbox(offsets[1].dair.id2, 5.078, 2, 30, 100, 10, 0, 0, 0, 0, 1), new createHitbox(offsets[1].dair.id3, 4.297, 2, 30, 100, 10, 0, 0, 0, 0, 1)),
  upair: new createHitboxObject(new createHitbox(offsets[1].upair.id0, 5.468, 12, 90, 100, 30, 0, 0, 0, 1, 1)),
  upb: new createHitboxObject(new createHitbox(offsets[1].upspecial.id0, 10.937, 0, 361, 100, 0, 0, 5, 0, 1, 0)),
  /*upb1 : new hitboxObject(new hitbox(offsets[1].upspecial1.id0,10.937,0,361,100,0,0,5,0,1,0)),
   upb2 : new hitboxObject(new hitbox(offsets[1].upspecial2.id0,10.937,0,361,100,0,0,5,0,1,0)),
   upb3 : new hitboxObject(new hitbox(offsets[1].upspecial3.id0,12.890,0,361,100,0,0,5,0,1,0)),*/
  dtilt: new createHitboxObject(new createHitbox(offsets[1].dtilt.id0, 3.515, 10, 20, 30, 40, 0, 0, 1, 1, 1), new createHitbox(offsets[1].dtilt.id1, 3.515, 10, 20, 30, 40, 0, 0, 1, 1, 1), new createHitbox(offsets[1].dtilt.id2, 3.906, 10, 20, 30, 40, 0, 0, 1, 1, 1)),
  uptilt1: new createHitboxObject(new createHitbox(offsets[1].uptilt1.id0, 3.125, 9, 96, 120, 40, 0, 0, 1, 1, 1), new createHitbox(offsets[1].uptilt1.id1, 4.297, 9, 96, 120, 40, 0, 0, 1, 1, 1)),
  uptilt2: new createHitboxObject(new createHitbox(offsets[1].uptilt2.id0, 3.125, 8, 88, 120, 40, 0, 0, 1, 1, 1), new createHitbox(offsets[1].uptilt2.id1, 3.515, 8, 88, 120, 40, 0, 0, 1, 1, 1)),
  ftilt: new createHitboxObject(new createHitbox(offsets[1].ftilt.id0, 2.734, 10, 361, 100, 8, 0, 0, 1, 1, 1), new createHitbox(offsets[1].ftilt.id1, 3.125, 10, 361, 100, 8, 0, 0, 1, 1, 1)),
  dashattack1: new createHitboxObject(new createHitbox(offsets[1].dashattack1.id0, 4.687, 12, 361, 100, 16, 0, 0, 1, 1, 1)),
  dashattack2: new createHitboxObject(new createHitbox(offsets[1].dashattack2.id0, 4.687, 8, 361, 100, 8, 0, 0, 1, 1, 1)),
  jab1: new createHitboxObject(new createHitbox(offsets[1].jab1.id0, 3.515, 3, 361, 50, 8, 0, 0, 1, 1, 1), new createHitbox(offsets[1].jab1.id1, 3.515, 3, 361, 50, 8, 0, 0, 1, 1, 1), new createHitbox(offsets[1].jab1.id2, 3.515, 3, 361, 50, 8, 0, 0, 1, 1, 1)),
  jab2: new createHitboxObject(new createHitbox(offsets[1].jab2.id0, 3.515, 3, 361, 50, 16, 0, 0, 1, 1, 1), new createHitbox(offsets[1].jab2.id1, 3.515, 3, 361, 50, 16, 0, 0, 1, 1, 1), new createHitbox(offsets[1].jab2.id2, 3.515, 3, 361, 50, 16, 0, 0, 1, 1, 1)),
  sidespecial: new createHitboxObject(new createHitbox(offsets[1].sidespecial.id0, 3.515, 13, 90, 75, 52, 0, 0, 0, 1, 1), new createHitbox(offsets[1].sidespecial.id1, 3.515, 13, 120, 75, 52, 0, 0, 0, 1, 1)),
  fsmash1: new createHitboxObject(new createHitbox(offsets[1].fsmash1.id0, 4.297, 17, 361, 118, 10, 0, 0, 1, 1, 1), new createHitbox(offsets[1].fsmash1.id1, 4.297, 17, 361, 118, 10, 0, 0, 1, 1, 1)),
  fsmash2: new createHitboxObject(new createHitbox(offsets[1].fsmash2.id0, 3.515, 13, 361, 105, 6, 0, 0, 1, 1, 1), new createHitbox(offsets[1].fsmash2.id1, 3.515, 13, 361, 105, 6, 0, 0, 1, 1, 1)),
  upsmash: new createHitboxObject(new createHitbox(offsets[1].upsmash.id0, 5.859, 14, 90, 110, 20, 0, 0, 1, 1, 1), new createHitbox(offsets[1].upsmash.id1, 3.906, 15, 90, 110, 20, 0, 0, 1, 1, 1)),
  dsmash: new createHitboxObject(new createHitbox(offsets[1].dsmash.id0, 3.906, 12, 0, 66, 34, 0, 0, 1, 1, 1), new createHitbox(offsets[1].dsmash.id1, 3.906, 12, 0, 66, 34, 0, 0, 1, 1, 1), new createHitbox(offsets[1].dsmash.id2, 4.687, 12, 0, 66, 34, 0, 0, 1, 1, 1), new createHitbox(offsets[1].dsmash.id3, 4.687, 12, 0, 66, 34, 0, 0, 1, 1, 1)),
  grab : new createHitboxObject(new createHitbox(offsets[1].grab.id0, 3.906, 0, 361, 100, 0, 0, 2, 3, 1, 1),new createHitbox(offsets[1].grab.id1, 3.125, 0, 361, 100, 0, 0, 2, 3, 1, 1)),
  // ftCo_MS_CatchDash -- the DASH grab. 40 frames against Catch's 30;
  // hitbox frames and sizes read off the subaction script by
  // tools/gen_catchdash.py, which self-checks against the line above.
  grabDash : new createHitboxObject(new createHitbox(offsets[1].grabDash.id0,3.125,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[1].grabDash.id1,3.125,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[1].grabDash.id2,3.125,0,361,100,0,0,2,3,1,1)),
  downattack1: new createHitboxObject(new createHitbox(offsets[1].downattack1.id0, 4.687, 8, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack1.id1, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack1.id2, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack1.id3, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1)),
  downattack2: new createHitboxObject(new createHitbox(offsets[1].downattack2.id0, 4.687, 8, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack2.id1, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack2.id2, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1), new createHitbox(offsets[1].downattack2.id3, 2.344, 6, 361, 50, 80, 0, 0, 1, 1, 1)),
  downspecial: new createHitboxObject(new createHitbox(offsets[1].downspecial.id0, 1.953, 28, 361, 120, 78, 0, 3, 0, 1, 1)),
  ledgegetupquick: new createHitboxObject(new createHitbox(offsets[1].ledgegetupquick.id0, 3.906, 6, 361, 100, 0, 90, 0, 1, 1, 1), new createHitbox(offsets[1].ledgegetupquick.id1, 4.687, 6, 361, 100, 0, 90, 0, 1, 1, 1)),
  ledgegetupslow: new createHitboxObject(new createHitbox(offsets[1].ledgegetupslow.id0, 5.859, 6, 361, 100, 0, 90, 0, 1, 1, 1), new createHitbox(offsets[1].ledgegetupslow.id1, 5.859, 6, 361, 100, 0, 90, 0, 1, 1, 1)),
  // Rollout is ONE hitbox in Melee -- SpecialN frame 0, size 1.9531, angle 90,
  // kg 102, bk 30, on bone 0 at b_offset (0, 5.469, 0) -- and ftpurinspecialn.c
  // only ever touches fp->x914[0]. This was three circles at angle 20 and kg
  // 120, none of which is on the disc; the air version below already carried
  // the right values, so only the ground one was left behind.
  //
  // The damage is NOT 10. ftpurinspecialn.c:180 overwrites it every frame with
  //     damage = x84 * (x80 + |vel|)   clamped to a minimum of 1
  // and Puff's x80 = 2.0, x84 = 3.0. A flat 10 corresponds to |vel| ~ 1.33; the
  // real value scales with how long Rollout was charged. Left at 10 until that
  // formula is implemented, because a wrong constant is better than a constant
  // that pretends to be derived.
  // THREE hitboxes, not one, and the GROUND values rather than the air ones.
  //
  // NEUTRALSPECIALGROUND.js assigns hitboxes.id[0..2] from this object and then
  // writes .dmg to all three, so with only id0 defined id[1] and id[2] were
  // undefined and Rollout crashed the moment it was released -- "Cannot set
  // properties of undefined (setting 'dmg')", then updateHitboxes reading
  // .offset of undefined.
  //
  // The single hitbox that was here also carried the AERIAL Rollout's values
  // (angle 90, kb growth 102 -- subaction 312, which neutralspecialair uses
  // correctly). Grounded Rollout is subaction 304: angle 20, kb growth 120,
  // base 30, damage 10, sizes 1.953125 / 2.734375 / 2.734375.
  neutralspecialground: new createHitboxObject(
    new createHitbox(offsets[1].neutralspecialground.id0, 1.953125, 10, 20, 120, 30, 0, 0, 0, 1, 1),
    new createHitbox(offsets[1].neutralspecialground.id1, 2.734375, 10, 20, 120, 30, 0, 0, 0, 1, 1),
    new createHitbox(offsets[1].neutralspecialground.id2, 2.734375, 10, 20, 120, 30, 0, 0, 0, 1, 1)),
  neutralspecialair: new createHitboxObject(new createHitbox(offsets[1].neutralspecialair.id0, 1.953, 10, 90, 102, 30, 0, 0, 0, 1, 1)),
  pummel: new createHitboxObject(new createHitbox(offsets[1].pummel.id0, 4.687, 3, 361, 100, 0, 30, 0, 0, 1, 1)),
  throwup: new createHitboxObject(new createHitbox(new Vec2D(-4.44533, 0.66545), 0, 11, 90, 25, 130, 0, 0, 0, 1, 1)),
  throwdown: new createHitboxObject(new createHitbox(new Vec2D(0.56941, 0), 0, 2, 80, 45, 100, 0, 0, 0, 1, 1)),
  // ThrowLw f10: size 3.51562, dmg 1, angle 40, kg 100, bk 0, set kb 25.
  // (The script also creates a second bystander hitbox at f23 -- size 4.6875,
  // dmg 3, angle 40, kg 100, bk 10, no set knockback -- which meleelight does
  // not model. Adding it needs an offsets[] entry and a frame trigger in
  // puff/moves/THROWDOWN.js, not just a value here.)
  throwdownextra: new createHitboxObject(new createHitbox(offsets[1].throwdownextra.id0, 3.515, 1, 40, 100, 0, 25, 0, 0, 1, 1, true)),
  throwback: new createHitboxObject(new createHitbox(new Vec2D(-14.20273 + 7.52, 0), 0, 10, 135, 25, 90, 0, 0, 0, 1, 1)),
  throwforward: new createHitboxObject(new createHitbox(new Vec2D(10.8537, 0.01), 0, 5, 55, 30, 100, 0, 0, 0, 1, 1)),
  throwforwardextra: new createHitboxObject(new createHitbox(offsets[1].throwforwardextra.id0, 8.593, 7, 361, 110, 40, 0, 0, 0, 1, 1, true)),
  // The tumble-body hitbox: a character in DamageFly* damages anyone they are
  // launched into. In Melee this is a create_hitbox at frame 0 of every
  // DamageFly subaction (DamageFlyN/Hi/Lw/Top/Roll), and it is identical in all
  // five of them and across all five characters:
  //     size 4.6875, dmg 6, angle 361, kg 100, bk 30
  // The previous values (3.906/4/361/50/20) were likewise uniform, so this is
  // one shared estimate being corrected, not five separate ones.
  thrown: new createHitboxObject(new createHitbox(offsets[1].thrown.id0, 4.687, 6, 361, 100, 30, 0, 1, 0, 1, 1))
});


setChars(CHARIDS.PUFF_ID, new charObject(CHARIDS.PUFF_ID));
