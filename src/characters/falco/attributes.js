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


setCharAttributes(CHARIDS.FALCO_ID, {
  dashFrameMin : 11,
  dInitV : 1.82,
  dMaxV : 1.5,
  dAccA : 0.10000000149011612,
  dAccB : 0.019999999552965164,
  dTInitV : 1.899999976158142,
  traction : 0.07999999821186066,
  maxWalk : 1.399999976158142,
  jumpSquat : 5,
  sHopInitV : 1.899999976158142,
  fHopInitV : 4.099999904632568,
  gravity : 0.17000000178813934,
  walkAccelMul : 0.20000000298023224,
  walkAccelBase : 0.10000000149011612,
  groundMaxHorizontalV : 3.0,
  groundToAir : 1,
  jumpHmaxV : 1.7000000476837158,
  jumpHinitV : 0.699999988079071,
  airMobA : 0.05000000074505806,
  airMobB : 0.019999999552965164,
  aerialHmaxV : 0.8299999833106995,
  airMaxHorizontalV : 4.0,
  airFriction : 0.019999999552965164,
  fastFallV : 3.5,
  terminalV : 3.0999999046325684,
  walkInitV : 0.2,
  walkAcc : 0.1,
  walkMaxV : 1.399999976158142,
  djMultiplier : 0.9399999976158142,
  djMomentum : 0.9399999976158142,
  shieldScale : 12.5,
  modelScale : 1.100000023841858,
  weight : 80,
  waitAnimSpeed : 1,
  walljump : true,
  hurtboxOffset : [4,18],
  // Ledge snap box, verbatim from ftData+0x44 (ftData_x44_t, ft/types.h:584).
  // Melee builds the box in mpColl_80044164 / mpColl_800443C4 (mpcoll.c:1253,
  // :1326) rather than storing corners, so the raw three values are stored here
  // and dealWithLedges() reconstructs the box the same way.
  ledgeSnapX : 11.0,
  ledgeSnapY : 13.0,
  ledgeSnapHeight : 9.0,
  // SUPERSEDED and no longer read. The shield's position now comes from
  // src/main/shieldData.js, baked from the posed Guard animation. Kept
  // only because it is a hand-measured value some UI still displays.
  shieldOffset : [10,40],
  charScale : 0.47,
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
  standingTurnFrames : 4,
  airdodgeIntangible : 26,
  // Up special (Firebird). Character-specific block at ftData+0x04; layout from
  // ftFox_DatAttrs (src/melee/ft/kinds/ftFox/types.h:107-132), which Falco
  // shares. Only the values differ -- and the fall accel differs by 0.001,
  // which meleelight had copied from Fox.
  firefoxFallAccel : 0.01600000075995922,       // x60_FOX_FIREFOX_FALL_ACCEL
  firefoxStickRangeMin : 0.5,                   // x64_..._DIRECTION_STICK_RANGE_MIN
  firefoxSpeed : 4.199999809265137,             // x74_FOX_FIREFOX_SPEED
  firefoxReverseAccel : 0.17000000178813934,    // x78_FOX_FIREFOX_REVERSE_ACCEL
  firefoxFacingStickRangeMin : 0.125,           // x88_..._FACING_STICK_RANGE_MIN
  // ftCo_SpecialS.c:45, the side-special entry:
  //   gr_vel += -(gr_vel * (1 - specials_ground_speed_retention))
  //             * ft_GetGroundFrictionMultiplier(fp)
  // which with the usual multiplier of 1 reduces to gr_vel *= retention.
  // 0.2 on every character here, but it is a per-character field.
  specialsGroundSpeedRetention : 0.20000000298023224,
  wallJumpVelX : 1.2999999523162842,
  wallJumpVelY : 3.5999999046325684,
  shieldBreakVel : 3.299999952316284,
  multiJump : false,
  //ecbScale : 2.3,
  ecbScale : 1,
  walkAnimSpeed : 1.5,
  runAnimSpeed : 0.7
});

// start, length
setIntangibility(CHARIDS.FALCO_ID, {
  "ESCAPEAIR" : [5,26],
  "ESCAPEB" : [5,16],
  "ESCAPEF" : [5,16],
  "ESCAPEN" : [3,14],
  "DOWNSTANDN" : [1,23],
  "DOWNSTANDB" : [13,18],
  "DOWNSTANDF" : [1,20],
  "TECHN" : [1,20],
  "TECHB" : [1,20],
  "TECHF" : [1,20],
});

setFrames(CHARIDS.FALCO_ID, {
  "WAIT" : 241,
  "DASH" : 22,
  "RUN" : 20,
  "RUNBRAKE" : 18,
  "RUNTURN" : 20,
  "WALK" : 31,
  "JUMPF" : 40,
  "JUMPB" : 40,
  "FALL" : 8,
  "FALLAERIAL" : 8,
  "FALLSPECIAL" : 8,
  "SQUAT" : 8,
  "SQUATWAIT" : 100,
  "SQUATRV" : 10,
  "JUMPAERIALF" : 50,
  "JUMPAERIALB" : 50,
  "PASS" : 29,
  "GUARDON" : 8,
  "GUARDOFF" : 15,
  "CLIFFCATCH" : 8,
  "CLIFFWAIT" : 50,
  "DAMAGEFLYN" : 29,
  "DAMAGEFALL" : 30,
  "DAMAGEN2" : 24,
  "LANDINGATTACKAIRF" : 22,
  "LANDINGATTACKAIRB" : 20,
  "LANDINGATTACKAIRU" : 18,
  "LANDINGATTACKAIRD" : 18,
  "LANDINGATTACKAIRN" : 15,
  "ESCAPEB" : 32,
  "ESCAPEF" : 32,
  "ESCAPEN" : 23,
  "DOWNBOUND" : 26,
  "DOWNWAIT" : 69,
  "DOWNSTANDN" : 30,
  "DOWNSTANDB" : 36,
  "DOWNSTANDF" : 36,
  "TECHN" : 26,
  "TECHB" : 40,
  "TECHF" : 40,
  "SHIELDBREAKFALL" : 30,
  "SHIELDBREAKDOWNBOUND" : 26,
  "SHIELDBREAKSTAND" : 30,
  "FURAFURA" : 110,
  "CAPTUREWAIT" : 80,
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
  "WALLDAMAGE" : 40,
  "WALLTECH" : 26,
  "WALLJUMP" : 40,
  "OTTOTTO" : 12,
  "OTTOTTOWAIT" : 110,
  "THROWNMARTHUP" : 9,
  "THROWNMARTHBACK" : 5,
  "THROWNMARTHFORWARD" : 11,
  "THROWNMARTHDOWN" : 11,
  "THROWNPUFFUP" : 6,
  "THROWNPUFFBACK" : 19,
  "THROWNPUFFFORWARD" : 9,
  "THROWNPUFFDOWN" : 60,
  "THROWNFOXUP" : 6,
  "THROWNFOXBACK" : 7,
  "THROWNFOXFORWARD" : 10,
  "THROWNFOXDOWN" : 32,
  "THROWNFALCOUP" : 5,
  "THROWNFALCOBACK" : 7,
  "THROWNFALCOFORWARD" : 8,
  "THROWNFALCODOWN" : 26,
  "THROWNFALCONUP" : 14,
  "THROWNFALCONBACK" : 19,
  "THROWNFALCONFORWARD" : 17,
  "THROWNFALCONDOWN" : 14,
  "FURASLEEPSTART" : 30,
  "FURASLEEPLOOP" : 110,
  "FURASLEEPEND" : 60,
  "STOPCEIL" : 8,
  "TECHU" : 26,
  "REBOUND" : 15
});

setActionSounds(CHARIDS.FALCO_ID, {
  "JUMP" : [],
  "ESCAPEAIR" : [[4,"falcoairdodge"]],
  "JUMPAERIAL" : [[1,"falcodoublejump"]],
  "GUARDON" : [],
  "GUARDOFF" : [],
  "CLIFFCATCH" : [[1,"falcocliffcatch"],[1,"puffledgegrab"]],
  "DEAD" : [[1,"falcodeath"]],
  "FURAFURA" : [[28,"falcofura"]],
  "ESCAPEB" : [],
  "ESCAPEF" : [],
  "ESCAPEN" : [],
  "OTTOTTOWAIT" : [[0,"falcoairdodge"]],
  "TECH" : [[1,"falcotech"]]
});

// HITBOX OFFSETS

setOffsets(CHARIDS.FALCO_ID, {
  jab1 : {
    id0 : [new Vec3D(6.4059725,6.7101345,5.545698),new Vec3D(17.799543,9.336861,1.5009353)],
    id1 : [new Vec3D(7.752864,10.328315,2.1799486),new Vec3D(10.310702,8.896936,-0.15717371)]
  },
  jab2 : {
    id0 : [new Vec3D(10.78562,8.151519,-0.29300642),new Vec3D(9.52659,8.769108,-0.26442164)],
    id1 : [new Vec3D(3.1789155,7.126768,-0.6299703),new Vec3D(3.2116904,7.218932,-0.5583311)]
  },
  jab3_1 : {
    id0 : [new Vec3D(2.426439,11.866715,-1.0446284),new Vec3D(2.2885714,11.634987,-0.9427496)],
    id1 : [new Vec3D(5.7219305,13.870121,-0.8036932),new Vec3D(5.27162,13.635756,-0.43919116)],
    id2 : [new Vec3D(11.363775,17.290209,-0.3013029),new Vec3D(10.37689,17.042685,0.5096252)]
  },
  jab3_2 : {
    id0 : [new Vec3D(2.6402023,11.087005,-1.0156436),new Vec3D(2.4922676,10.83584,-0.9893508)],
    id1 : [new Vec3D(6.295917,12.312719,-0.76006585),new Vec3D(5.903347,12.047655,-0.76291263)],
    id2 : [new Vec3D(12.54933,14.409396,-0.23224634),new Vec3D(11.738869,14.119166,-0.286738)]
  },
  jab3_3 : {
    id0 : [new Vec3D(2.1872945,9.635967,-0.9935976),new Vec3D(2.1388636,9.489573,-0.9807328)],
    id1 : [new Vec3D(6.0461087,9.738313,-0.81745285),new Vec3D(5.767019,9.489986,-0.82181627)],
    id2 : [new Vec3D(12.648765,9.914818,-0.42553973),new Vec3D(11.975031,9.490081,-0.46111438)]
  },
  jab3_4 : {
    id0 : [new Vec3D(2.6729898,8.806029,-0.94996184),new Vec3D(2.4928472,8.64628,-0.9678487)],
    id1 : [new Vec3D(6.1592517,7.9833164,-0.7388844),new Vec3D(5.7134438,7.5301094,-0.8560941)],
    id2 : [new Vec3D(12.122547,6.5739036,-0.28723812),new Vec3D(11.224047,5.61786,-0.5761647)]
  },
  jab3_5 : {
    id0 : [new Vec3D(2.372819,7.647513,-1.1504167),new Vec3D(2.315551,7.6813145,-1.1705387)],
    id1 : [new Vec3D(5.4914575,6.5690584,-0.8655963),new Vec3D(5.173256,6.2859316,-0.9273705)],
    id2 : [new Vec3D(10.824934,4.728861,-0.28793174),new Vec3D(10.061314,3.9025664,-0.422737)]
  },
  downtilt : {
    id0 : [new Vec3D(2.3454163,3.5482445,1.8126951),new Vec3D(3.7542493,3.6509607,-1.0475404),new Vec3D(1.6352687,3.7672493,-1.8337324)],
    id1 : [new Vec3D(5.7343445,3.1536915,4.8538055),new Vec3D(8.631103,3.4296837,-1.8121159),new Vec3D(5.1689444,3.5347393,-4.848708)],
    id2 : [new Vec3D(9.123272,2.7591383,7.894916),new Vec3D(13.507956,3.208407,-2.5766916),new Vec3D(8.70262,3.3022292,-7.8636837)]
  },
  uptilt : {
    id0 : [new Vec3D(0.533456,9.385853,0.45744458),new Vec3D(0.5363687,10.865979,0.79434586),new Vec3D(1.1791391,11.709554,1.321458),new Vec3D(2.0944786,11.777894,1.6037722),new Vec3D(2.0495243,11.700108,1.6251723),new Vec3D(1.767724,11.712325,1.6794256),new Vec3D(1.5212771,11.678121,1.74967)],
    id1 : [new Vec3D(-4.3997645,5.4184856,0.39504382),new Vec3D(-6.0696583,13.660798,-0.08179358),new Vec3D(-2.1283402,18.626352,1.7546642),new Vec3D(5.5761642,18.295885,1.5251774),new Vec3D(5.2616334,17.625885,1.4640496),new Vec3D(4.2848186,16.929739,1.6418157),new Vec3D(3.3578544,16.31995,1.8506329)]
  },
  forwardtilt : {
    id0 : [new Vec3D(1.6118851,6.2946067,-7.0853963),new Vec3D(17.397854,9.863834,-1.6765609),new Vec3D(17.639748,9.818222,-0.89038026),new Vec3D(17.480711,9.689026,-0.00037011504),new Vec3D(16.995815,9.530309,0.85122937)],
    id1 : [new Vec3D(4.9293246,8.20643,-3.778576),new Vec3D(12.162019,9.905538,-0.23656932),new Vec3D(12.287821,9.9691105,0.017040133),new Vec3D(12.065453,9.956864,0.30383834),new Vec3D(11.584866,9.899387,0.5779123)],
    id2 : [new Vec3D(3.6244142,8.800216,0),new Vec3D(7.965332,9.899947,0),new Vec3D(8.039669,10.015408,0),new Vec3D(7.7914286,10.059946,0),new Vec3D(7.316974,10.052117,0)]
  },
  dashattack1 : {
    id0 : [new Vec3D(6.1514864,8.580917,0.20833518),new Vec3D(5.8578196,8.643427,0.012843192),new Vec3D(5.5513525,8.619763,-0.09637326),new Vec3D(5.58965,8.515908,-0.09137896)]
  },
  dashattack2 : {
    id0 : [new Vec3D(5.6313725,8.38514,-0.022807062),new Vec3D(5.677953,8.237585,0.08282119),new Vec3D(5.7299156,8.076869,0.19830185),new Vec3D(5.7885704,7.906882,0.2984612),new Vec3D(5.856409,7.736507,0.36179847),new Vec3D(5.936388,7.582118,0.37209535),new Vec3D(6.03022,7.468124,0.3202058),new Vec3D(6.135929,7.425808,0.20583582),new Vec3D(6.2599697,7.3896685,0.19475357),new Vec3D(6.3240833,7.149715,0.69186145)]
  },
  grab : {
    id0 : [new Vec3D(9.453125,7.734375,0),new Vec3D(9.453125,7.734375,0)],
    id1 : [new Vec3D(5.15625,7.734375,0),new Vec3D(5.15625,7.734375,0)]
  },
  grabDash : {
    id0 : [new Vec3D(8.59375,6.4453125,0),new Vec3D(8.59375,6.4453125,0)],
    id1 : [new Vec3D(3.4375,7.734375,0),new Vec3D(3.4375,7.734375,0)],
    id2 : [new Vec3D(-0.859375,7.734375,0),new Vec3D(-0.859375,7.734375,0)]
  },
  downspecialground : {
    id0 : [new Vec2D(-0.69,7.79)]
  },
  downspecialair : {
    id0 : [new Vec3D(0.039074708,8.69803,0.14209901)]
  },
  reflector : {
    id0 : [new Vec3D(0,7.15,0)]
  },
  downattack1 : {
    id0 : [new Vec3D(15.8992405,7.3949227,-1.8019359),new Vec3D(16.008097,7.028821,-0.32724428),new Vec3D(14.961856,7.151255,2.046332)],
    id1 : [new Vec3D(8.792894,7.240812,-1.6220856),new Vec3D(8.792663,7.042957,-1.7123301),new Vec3D(8.738201,7.1452007,-1.7944227)],
    id2 : [new Vec3D(4.5075693,6.617551,0.0102916695),new Vec3D(4.5093246,6.5350337,0.008966925),new Vec3D(4.507464,6.4516873,0.0056832433)]
  },
  downattack2 : {
    id0 : [new Vec3D(-6.7830963,8.986865,4.0377936),new Vec3D(-8.635664,9.811846,0.97409993),new Vec3D(-8.438458,9.392527,0.76268935)],
    id1 : [new Vec3D(-9.868519,9.399741,2.160688),new Vec3D(-12.997191,9.81762,0.7865301),new Vec3D(-12.63293,9.050867,0.40377086)],
    id2 : [new Vec3D(-1.4947592,10.021682,-0.064116664),new Vec3D(-2.0723743,10.351302,-0.070314206),new Vec3D(-2.0717049,10.351792,-0.07031337)]
  },
  ledgegetupquick : {
    id0 : [new Vec3D(6.0354505,7.724103,-1.3244911),new Vec3D(6.136983,6.6327906,-0.886997),new Vec3D(6.3699136,6.312445,-1.6996752),new Vec3D(6.527359,6.5001283,-1.6955776),new Vec3D(6.6858616,5.737965,-0.49835345),new Vec3D(6.834938,4.0488014,-0.16672152),new Vec3D(6.974865,2.9195778,-0.59203595),new Vec3D(7.1090794,2.4936924,-0.9774729),new Vec3D(7.242262,2.363673,-1.0840018),new Vec3D(7.3781757,2.2600298,-1.1617553)],
    id1 : [new Vec3D(5.946549,6.3691115,0.23109257),new Vec3D(5.9557467,5.2868466,0.29873848),new Vec3D(6.395269,5.3045278,-1.1998804),new Vec3D(6.5054884,6.173618,-1.4033378),new Vec3D(6.420374,5.3990464,-0.116536066),new Vec3D(6.4361706,3.4894783,-0.098454244),new Vec3D(6.7275963,3.0167687,-0.56064236),new Vec3D(7.1319942,3.3931348,0.6637204),new Vec3D(6.7961864,2.6363578,1.2493857),new Vec3D(5.842823,2.0734942,1.6255224)],
    id2 : [new Vec3D(-5.236084,8.645734,-2.750293),new Vec3D(-4.985147,8.6229925,-2.6993544),new Vec3D(-5.043892,8.104884,-1.6828771),new Vec3D(-5.1138,7.011462,-1.045712),new Vec3D(-5.1645885,5.734406,-0.17022821),new Vec3D(-5.1353827,4.20697,0.17242302),new Vec3D(-5.2046604,3.347367,-0.29905447),new Vec3D(-5.0138493,3.3405995,-0.45296934),new Vec3D(-4.880433,2.976023,-0.13837709),new Vec3D(-4.7476597,2.714428,-0.05780921)],
  },
  ledgegetupslow : {
    id0 : [new Vec3D(7.077454,11.482662,0.11465793),new Vec3D(8.754482,3.201229,0.21921739),new Vec3D(7.8985615,2.195663,-0.14957461)],
    id1 : [new Vec3D(10.053106,14.456619,0.2087664),new Vec3D(12.986025,1.3290523,0.6378128),new Vec3D(11.422808,0.87038136,0.2626717)],
    id2 : [new Vec3D(-0.5180719,10.465905,-0.25842035),new Vec3D(0.6695628,8.890918,1.654588),new Vec3D(1.8223257,7.501407,2.586776)]
  },
  downsmash : {
    id0 : [new Vec3D(-9.908818,1.6583534,-0.5748871),new Vec3D(-9.46739,1.5972834,-0.5717103),new Vec3D(-8.655198,1.5888143,-1.1103483),new Vec3D(-7.749572,1.6147938,-1.9591695),new Vec3D(-7.007394,1.6568263,-3.0193896)],
    id1 : [new Vec3D(10.434093,2.1049893,0.37355328),new Vec3D(10.01849,1.8962406,1.0987151),new Vec3D(9.218666,1.7972912,1.8776453),new Vec3D(8.282734,1.7601603,2.9587457),new Vec3D(7.438725,1.7640806,4.2508726)],
    id2 : [new Vec3D(-5.3284254,1.671325,-0.5865531),new Vec3D(-5.0948753,1.641361,-0.5941924),new Vec3D(-4.647274,1.6374651,-0.8912872),new Vec3D(-4.125691,1.650622,-1.352572),new Vec3D(-3.6607718,1.6717048,-1.9173394)],
    id3 : [new Vec3D(5.8595486,1.9107451,0.5005021),new Vec3D(5.6519647,1.8075829,0.88206744),new Vec3D(5.243189,1.7590654,1.3227267),new Vec3D(4.7529063,1.7413015,1.9380976),new Vec3D(4.2884207,1.7438574,2.672967)]
  },
  upsmash1 : {
    id0 : [new Vec3D(7.0064764,7.5648546,0.09925094),new Vec3D(8.132795,10.61262,-0.15033092),new Vec3D(8.099847,14.242546,0.0139642805),new Vec3D(6.668468,18.193165,0.19345134)],
    id1 : [new Vec3D(6.4270678,5.135887,-0.4689109),new Vec3D(10.334723,9.308546,-0.24680048),new Vec3D(10.6575165,14.325808,0.11293592),new Vec3D(9.162267,18.760077,0.059360147)]
  },
  upsmash2 : {
    id0 : [new Vec3D(5.1469617,20.412552,-0.1143796),new Vec3D(2.7120252,22.191284,-0.19269238),new Vec3D(-0.6049892,22.63704,-0.0026419759),new Vec3D(-3.7905493,20.434307,-0.024499893),new Vec3D(-4.9807186,18.470705,-0.06028086)],
    id1 : [new Vec3D(6.6698976,22.46782,0.007865973),new Vec3D(3.2519429,24.690166,-0.042776942),new Vec3D(-1.6186494,24.961824,0.35270107),new Vec3D(-5.834529,21.949404,0.26710084),new Vec3D(-7.455979,19.049873,0.24964401)]
  },
  forwardsmash1 : {
    id0 : [new Vec3D(11.356355,15.930561,5.08407),new Vec3D(13.899918,13.942866,4.6626873),new Vec3D(15.360731,11.272894,3.7750773),new Vec3D(15.5796795,8.705811,3.0435295),new Vec3D(15.17849,7.1065364,2.3441925)],
    id1 : [new Vec3D(8.99775,11.829668,2.4546707),new Vec3D(10.158361,10.892711,2.1746757),new Vec3D(10.557182,9.731832,1.7641242),new Vec3D(10.392574,8.6188965,1.4375148),new Vec3D(9.940071,7.9268208,1.1698883)],
    id2 : [new Vec3D(7.4666166,9.029865,-0.21282838),new Vec3D(7.1676545,9.0061245,-0.17434278),new Vec3D(6.809574,8.967634,-0.12679614),new Vec3D(6.391611,8.91454,-0.07265961),new Vec3D(5.9123936,8.846989,-0.014746778)]
  },
  forwardsmash2 : {
    id0 : [new Vec3D(14.657974,6.4116945,1.6546474),new Vec3D(14.058031,6.0623355,1.0486226),new Vec3D(13.379387,5.8743668,0.54566646),new Vec3D(12.604691,5.676447,0.17930919),new Vec3D(11.622164,5.108192,-0.044295102)],
    id1 : [new Vec3D(9.408651,7.6116376,0.949213),new Vec3D(8.808386,7.425512,0.77318347),new Vec3D(8.138582,7.2954807,0.6311136),new Vec3D(7.39093,7.157462,0.5201825),new Vec3D(6.5856724,7.0498133,0.48273286)],
    id2 : [new Vec3D(5.3698807,8.765123,0.04393242),new Vec3D(4.7613335,8.669091,0.1003284),new Vec3D(4.083332,8.559036,0.15151006),new Vec3D(3.331812,8.435106,0.1948174),new Vec3D(2.5021477,8.297444,0.22799955)]
  },
  nair1 : {
    id0 : [new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0)],
    id1 : [new Vec3D(6.566206,7.222038,0.08357495),new Vec3D(6.5634575,7.261648,-0.14056227),new Vec3D(6.562973,7.2482038,-0.16843927),new Vec3D(6.562232,7.256784,-0.1559605)],
    id2 : [new Vec3D(0.57103676,4.487274,-1.5281296),new Vec3D(0.5045204,4.495904,-1.6305361),new Vec3D(0.49123693,4.493561,-1.6175934),new Vec3D(0.47510004,4.4947605,-1.6039598)]
  },
  nair2 : {
    id0 : [new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.1,7.480001,0),new Vec3D(-1.045,7.562501,0)],
    id1 : [new Vec3D(6.560527,7.2865877,-0.11121124),new Vec3D(6.5568724,7.3352814,-0.041834354),new Vec3D(6.5503845,7.3992085,0.045532405),new Vec3D(6.540516,7.4736333,0.14562333),new Vec3D(6.527148,7.552989,0.25467673),new Vec3D(6.510584,7.6315475,0.3701463),new Vec3D(6.4913397,7.7067423,0.48911202),new Vec3D(6.470169,7.776782,0.608578),new Vec3D(6.448085,7.8394055,0.72587025),new Vec3D(6.4263105,7.892056,0.8385644),new Vec3D(6.4062214,7.9320674,0.9443505),new Vec3D(6.389265,7.956845,1.0408283),new Vec3D(6.3768954,7.9640317,1.125263),new Vec3D(6.370493,7.951718,1.1943027),new Vec3D(6.371285,7.918652,1.2436768),new Vec3D(6.3802385,7.8645344,1.2679033),new Vec3D(6.3978868,7.7903886,1.2600229),new Vec3D(6.4240837,7.699056,1.2114207),new Vec3D(6.4575815,7.5958037,1.1117766),new Vec3D(6.5550785,7.471881,0.79243094),new Vec3D(6.6478944,7.3472915,0.27592504),new Vec3D(6.6529093,7.2689714,-0.1237476),new Vec3D(6.563064,7.291494,-0.07883233),new Vec3D(6.2528048,7.621509,0.59044576)],
    id2 : [new Vec3D(0.45642853,4.498879,-1.5904509),new Vec3D(0.43545067,4.505245,-1.5777532),new Vec3D(0.4123894,4.513175,-1.5663761),new Vec3D(0.3875109,4.52203,-1.556626),new Vec3D(0.36116183,4.531251,-1.5486165),new Vec3D(0.33378732,4.54039,-1.5423006),new Vec3D(0.30592966,4.5491304,-1.537506),new Vec3D(0.2782234,4.557279,-1.5339886),new Vec3D(0.25137174,4.564758,-1.5314717),new Vec3D(0.22612238,4.5715775,-1.5296926),new Vec3D(0.20323896,4.5778055,-1.528427),new Vec3D(0.1834662,4.58353,-1.5275096),new Vec3D(0.16749847,4.588819,-1.5268434),new Vec3D(0.15594947,4.593693,-1.5264053),new Vec3D(0.14931858,4.598092,-1.5262445),new Vec3D(0.14796185,4.6018524,-1.5264858),new Vec3D(0.15205383,4.6046815,-1.5273458),new Vec3D(0.1615535,4.606141,-1.5291584),new Vec3D(0.17614675,4.605628,-1.5324272),new Vec3D(0.19519126,4.602364,-1.5379128),new Vec3D(0.21762168,4.5953956,-1.5467587),new Vec3D(0.24184597,4.583618,-1.5606757),new Vec3D(0.26557767,4.5658665,-1.5821822),new Vec3D(0.34400702,4.637253,-1.6442503)]
  },
  bair1 : {
    id0 : [new Vec3D(-0.008793169,9.13738,-0.08009735),new Vec3D(-0.011209919,9.139407,-0.10211162),new Vec3D(-0.013695024,9.141492,-0.12474855),new Vec3D(-0.01623897,9.143627,-0.14792147)],
    id1 : [new Vec3D(-9.216589,10.985336,-0.843295),new Vec3D(-9.244196,10.937654,-0.9640949),new Vec3D(-9.268833,10.843317,-1.1923004),new Vec3D(-9.242606,10.785085,-0.8941752)],
    id2 : [new Vec3D(3.0544236,4.8113947,0.02391982),new Vec3D(3.2078824,4.7593627,0.1982801),new Vec3D(3.286575,4.765897,0.371652),new Vec3D(3.3498783,4.778599,0.5108923)]
  },
  bair2 : {
    id0 : [new Vec3D(-0.018832244,9.1458025,-0.1715437),new Vec3D(-0.02146533,9.148012,-0.1955286),new Vec3D(-0.024128715,9.150247,-0.21978949),new Vec3D(-0.026812885,9.152499,-0.2442397),new Vec3D(-0.029508324,9.154761,-0.26879257),new Vec3D(-0.032205522,9.157024,-0.29336146),new Vec3D(-0.03489496,9.159281,-0.31785965),new Vec3D(-0.037567127,9.161523,-0.34220055),new Vec3D(-0.040212505,9.163743,-0.36629742),new Vec3D(-0.04282159,9.165932,-0.39006367),new Vec3D(-0.045384858,9.168082,-0.41341257),new Vec3D(-0.047892798,9.170187,-0.4362575)],
    id1 : [new Vec3D(-9.072142,10.716518,-0.24584949),new Vec3D(-8.831158,10.579644,0.22918081),new Vec3D(-8.554192,10.421486,0.635015),new Vec3D(-8.25593,10.277156,1.0025499),new Vec3D(-7.951092,10.147606,1.337141),new Vec3D(-7.6488667,10.02925,1.6443022),new Vec3D(-7.353782,9.915899,1.9293088),new Vec3D(-7.0665493,9.799768,2.1968157),new Vec3D(-6.784774,9.671936,2.4504051),new Vec3D(-6.5035257,9.522517,2.691994),new Vec3D(-6.2162905,9.328755,2.9215038),new Vec3D(-5.913027,9.097193,3.133865)],
    id2 : [new Vec3D(3.4005656,4.7924504,0.61560094),new Vec3D(3.4395857,4.802702,0.6876726),new Vec3D(3.4660068,4.8046803,0.7306516),new Vec3D(3.4771702,4.7934732,0.74884236),new Vec3D(3.4827542,4.7803674,0.7449155),new Vec3D(3.4862244,4.769641,0.72174346),new Vec3D(3.4728222,4.743737,0.68332076),new Vec3D(3.426124,4.683919,0.6321273),new Vec3D(3.3711634,4.6225696,0.5690793),new Vec3D(3.3355637,4.593891,0.50074077),new Vec3D(3.3064933,4.5835285,0.4325794),new Vec3D(3.2726064,4.57902,0.36793387)]
  },
  fair1 : {
    id0 : [new Vec3D(3.258981,9.761558,3.7115145),new Vec3D(5.070139,9.843937,0.7616537),new Vec3D(5.125991,9.74345,-0.3284336)],
    id1 : [new Vec3D(7.754447,11.968991,4.9382725),new Vec3D(9.861914,11.329671,-0.4293161),new Vec3D(8.861122,10.441351,-3.8139248)]
  },
  fair2 : {
    id0 : [new Vec3D(5.1482644,8.396725,-0.57114047),new Vec3D(3.2172225,7.6835494,-3.5707703),new Vec3D(0.68208283,7.0069857,-4.0496364)],
    id1 : [new Vec3D(10.192758,7.927316,0.38784987),new Vec3D(8.096403,8.089819,-5.1880074),new Vec3D(3.657951,6.730747,-8.2514)]
  },
  fair3 : {
    id0 : [new Vec3D(3.0899088,10.186558,3.4583302),new Vec3D(5.0323668,9.521486,1.1627264),new Vec3D(5.150206,9.620591,-0.13362414)],
    id1 : [new Vec3D(7.7942142,12.167444,4.188068),new Vec3D(9.862241,10.627052,-0.26449406),new Vec3D(8.850736,10.092853,-3.6931138)]
  },
  fair4 : {
    id0 : [new Vec3D(5.16339,8.688693,-0.24876758),new Vec3D(5.1547318,8.391283,-0.5410162),new Vec3D(3.565202,7.9732304,-3.3036368)],
    id1 : [new Vec3D(5.718991,8.371435,4.8676353),new Vec3D(10.098942,7.853879,0.82019544),new Vec3D(8.537514,8.420061,-4.593356)]
  },
  fair5 : {
    id0 : [new Vec3D(5.0872164,8.8371315,-0.42806798),new Vec3D(5.0877056,8.649648,-0.5579087),new Vec3D(5.1456714,8.399267,-0.32826954)],
    id1 : [new Vec3D(9.252981,8.866781,-1.4809988),new Vec3D(9.243018,8.514018,-1.6433206),new Vec3D(8.913369,8.061492,-2.3662827)]
  },
  dair1 : {
    id0 : [new Vec3D(2.0761588,6.9237027,0.6731056),new Vec3D(2.3197286,7.0752163,-0.10786921),new Vec3D(1.9370434,6.87772,-0.8701246),new Vec3D(1.1278174,6.445998,-1.0288516),new Vec3D(0.46387374,6.109674,-0.36966187),new Vec3D(0.4894172,6.1821604,0.68912),new Vec3D(1.2547708,6.6912856,1.3437483),new Vec3D(2.2158523,7.3211727,1.0322607),new Vec3D(2.6368732,7.6447344,-0.09219849),new Vec3D(2.1610131,7.453214,-1.2687628)],
    id1 : [new Vec3D(3.1163564,4.5267267,0.5663036),new Vec3D(3.3983881,4.697983,0.047587276),new Vec3D(3.221732,4.615857,-0.6009335),new Vec3D(2.5982544,4.2876353,-0.89395845),new Vec3D(1.9228169,3.9418716,-0.47468),new Vec3D(1.7595432,3.9045777,0.4933924),new Vec3D(2.365756,4.324068,1.3136975),new Vec3D(3.3856153,4.9938917,1.2653503),new Vec3D(4.0611305,5.4745736,0.22529846),new Vec3D(3.8166518,5.431043,-1.1760516)]
  },
  dair2 : {
    id0 : [new Vec3D(1.3641717,7.1582994,-1.7968724),new Vec3D(0.932995,6.780266,-1.6387839),new Vec3D(0.68676186,6.4818945,-1.3155235),new Vec3D(0.6535603,6.286473,-0.93897575),new Vec3D(0.82140756,6.202924,-0.6099747),new Vec3D(1.0264199,6.4793234,-0.024131179),new Vec3D(1.3527337,6.8905272,0.59384066),new Vec3D(1.7685966,7.259226,0.94367117),new Vec3D(2.168563,7.5861692,1.0448449),new Vec3D(2.4862242,7.8459144,0.95811474)],
    id1 : [new Vec3D(3.1294258,5.243518,-2.034361),new Vec3D(2.5526218,4.7484846,-1.9347317),new Vec3D(2.1992488,4.3608036,-1.5441471),new Vec3D(2.143224,4.1387424,-1.0230532),new Vec3D(2.3877316,4.1100535,-0.5362467),new Vec3D(2.5331259,4.362266,-0.31877983),new Vec3D(2.547505,4.687821,-0.1541698),new Vec3D(2.6180282,4.9631543,0.024195552),new Vec3D(2.7267845,5.1934524,0.14918518),new Vec3D(2.828396,5.372468,0.18100959)]
  },
  upair1 : {
    id0 : [new Vec3D(-1.2520311,11.448973,1.7716516),new Vec3D(0.15787588,12.81796,-0.29751766)],
    id1 : [new Vec3D(-1.8487304,12.817369,2.6234384),new Vec3D(0.26982605,14.520035,-0.5084882)],
    id2 : [new Vec3D(-0.021137416,9.810335,0.029669791),new Vec3D(0.3181163,10.151271,-0.5994913)]
  },
  upair2 : {
    id0 : [new Vec3D(-1.4685785,14.050222,0.41115344),new Vec3D(0.20796171,15.103895,-1.4621854),new Vec3D(1.8638498,15.005766,-2.643634),new Vec3D(3.1478825,14.35393,-3.1625154)],
    id1 : [new Vec3D(-1.5916723,16.409472,2.3938656),new Vec3D(1.2398965,17.922493,-0.90012884),new Vec3D(4.0159855,17.122755,-2.9284048),new Vec3D(6.027791,15.063948,-3.7143698)],
    id2 : [new Vec3D(0.9345851,10.189351,-1.192702),new Vec3D(1.2667453,10.407133,-1.2482522),new Vec3D(1.4994712,10.42445,-1.1672521),new Vec3D(1.5717742,10.3258915,-0.9764031)]
  },
  upspecial : {
    id0 : [new Vec3D(1.3517237,12.389065,-0.8651364),new Vec3D(1.35216,12.378415,-0.887323),new Vec3D(1.3527737,12.368452,-0.9079813),new Vec3D(1.3535218,12.359187,-0.92710966),new Vec3D(1.3543625,12.350631,-0.9447064),new Vec3D(1.355257,12.34279,-0.96077096),new Vec3D(1.3561716,12.335673,-0.97530264),new Vec3D(1.3570738,12.329287,-0.98830175),new Vec3D(1.3579369,12.323639,-0.9997694),new Vec3D(1.3587346,12.318732,-1.0097058),new Vec3D(1.359446,12.314573,-1.0181115),new Vec3D(1.3600535,12.311166,-1.0249876),new Vec3D(1.3605413,12.308512,-1.0303351),new Vec3D(1.360898,12.306614,-1.034154),new Vec3D(1.361115,12.305475,-1.0364449),new Vec3D(1.3611879,12.305094,-1.0372089),new Vec3D(1.361115,12.305475,-1.0364449),new Vec3D(1.360898,12.306614,-1.034154),new Vec3D(1.3605413,12.308512,-1.0303351),new Vec3D(1.3600535,12.311166,-1.0249876),new Vec3D(1.359446,12.314573,-1.0181115),new Vec3D(1.3587346,12.318732,-1.0097058)]
  },
  pummel : {
    id0 : [new Vec3D(7.8922567,8.512292,-1.6083525)]
  },
  throwforwardextra : {
    id0 : [new Vec3D(7.4572945,9.055644,-1.4987161)]
  },
  thrown : {
    id0 : [new Vec3D(-0.823534,11.182749,0.95949376)]
  }
});




setHitBoxes(CHARIDS.FALCO_ID, {
  fair1 : new createHitboxObject(new createHitbox(offsets[3].fair1.id0,5.156,9,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].fair1.id1,5.156,9,361,100,10,0,0,0,1,1)),
  fair2 : new createHitboxObject(new createHitbox(offsets[3].fair2.id0,4.656,8,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].fair2.id1,4.656,8,361,100,10,0,0,0,1,1)),
  fair3 : new createHitboxObject(new createHitbox(offsets[3].fair3.id0,4.656,7,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].fair3.id1,4.656,7,361,100,10,0,0,0,1,1)),
  fair4 : new createHitboxObject(new createHitbox(offsets[3].fair4.id0,4.656,5,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].fair4.id1,4.656,5,361,100,10,0,0,0,1,1)),
  fair5 : new createHitboxObject(new createHitbox(offsets[3].fair5.id0,4.656,3,361,100,50,0,0,0,1,1),new createHitbox(offsets[3].fair5.id1,4.656,3,361,100,50,0,0,0,1,1)),
  bair1 : new createHitboxObject(new createHitbox(offsets[3].bair1.id0,3.660,15,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].bair1.id1,4.992,15,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].bair1.id2,3.328,9,361,100,0,0,0,0,1,1)),
  bair2 : new createHitboxObject(new createHitbox(offsets[3].bair2.id0,3.328,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].bair2.id1,3.992,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].bair2.id2,3.328,9,361,100,0,0,0,0,1,1)),
  // Third hitbox read .id1, leaving .id2 unused. Fox's identical move
  // references id2 correctly, so this is the same copy-paste class as
  // bair2's second hitbox and downattack2's fourth.
  nair1 : new createHitboxObject(new createHitbox(offsets[3].nair1.id0,3.496,12,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].nair1.id1,3.496,12,361,100,10,0,0,0,1,1),new createHitbox(offsets[3].nair1.id2,2.992,12,361,100,10,0,0,0,1,1)),
  // Third hitbox read .id1, leaving .id2 unused. Fox's identical move
  // references id2 correctly, so this is the same copy-paste class as
  // bair2's second hitbox and downattack2's fourth.
  nair2 : new createHitboxObject(new createHitbox(offsets[3].nair2.id0,3.496,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].nair2.id1,3.496,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[3].nair2.id2,2.992,9,361,100,0,0,0,0,1,1)),
  dair1 : new createHitboxObject(new createHitbox(offsets[3].dair1.id0,5.156,12,290,100,10,0,0,0,1,1),new createHitbox(offsets[3].dair1.id1,5.988,12,290,100,10,0,0,0,1,1)),
  dair2 : new createHitboxObject(new createHitbox(offsets[3].dair2.id0,5.156,9,290,100,20,0,0,0,1,1),new createHitbox(offsets[3].dair2.id1,5.988,9,290,100,20,0,0,0,1,1)),
  upair1 : new createHitboxObject(new createHitbox(offsets[3].upair1.id0,3.125,6,90,20,40,0,0,0,1,1),new createHitbox(offsets[3].upair1.id1,3.906,6,90,20,30,0,0,0,1,1),new createHitbox(offsets[3].upair1.id2,3.906,6,90,20,30,0,0,0,1,1)),
  upair2 : new createHitboxObject(new createHitbox(offsets[3].upair2.id0,3.660,10,70,120,22,0,0,0,1,1),new createHitbox(offsets[3].upair2.id1,5.468,10,70,120,22,0,0,0,1,1),new createHitbox(offsets[3].upair2.id2,3.906,10,90,20,30,0,0,0,1,1)),
  upspecial : new createHitboxObject(new createHitbox(offsets[3].upspecial.id0,4.000,16,80,60,80,0,3,0,1,1)),
  dtilt : new createHitboxObject(new createHitbox(offsets[3].downtilt.id0,1.953,13,75,125,25,0,0,1,1,1),new createHitbox(offsets[3].downtilt.id1,2.930,13,75,125,25,0,0,1,1,1),new createHitbox(offsets[3].downtilt.id2,3.125,13,75,125,25,0,0,1,1,1)),
  uptilt : new createHitboxObject(new createHitbox(offsets[3].uptilt.id0,3.906,9,97,120,30,0,0,1,1,1),new createHitbox(offsets[3].uptilt.id1,5.468,9,90,120,30,0,0,1,1,1)),
  ftilt : new createHitboxObject(new createHitbox(offsets[3].forwardtilt.id0,2.734,9,361,100,0,0,0,1,1,1),new createHitbox(offsets[3].forwardtilt.id1,3.125,9,361,100,0,0,0,1,1,1),new createHitbox(offsets[3].forwardtilt.id2,2.344,9,361,100,0,0,0,1,1,1)),
  dashattack1 : new createHitboxObject(new createHitbox(offsets[3].dashattack1.id0,4.297,9,72,90,35,0,0,1,1,1)),
  dashattack2 : new createHitboxObject(new createHitbox(offsets[3].dashattack2.id0,3.515,6,72,90,20,0,0,1,1,1)),
  jab1 : new createHitboxObject(new createHitbox(offsets[3].jab1.id0,3.515,4,70,100,0,0,0,1,1,1),new createHitbox(offsets[3].jab1.id1,3.515,4,70,100,0,0,0,1,1,1)),
  jab2 : new createHitboxObject(new createHitbox(offsets[3].jab2.id0,3.515,4,50,100,0,0,0,1,1,1),new createHitbox(offsets[3].jab2.id1,3.515,4,50,100,0,0,0,1,1,1)),
  jab3_1 : new createHitboxObject(new createHitbox(offsets[3].jab3_1.id0,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_1.id1,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_1.id2,3.515,1,80,80,10,0,0,1,1,1)),
  jab3_2 : new createHitboxObject(new createHitbox(offsets[3].jab3_2.id0,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_2.id1,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_2.id2,3.515,1,80,80,10,0,0,1,1,1)),
  jab3_3 : new createHitboxObject(new createHitbox(offsets[3].jab3_3.id0,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_3.id1,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_3.id2,3.515,1,80,80,10,0,0,1,1,1)),
  jab3_4 : new createHitboxObject(new createHitbox(offsets[3].jab3_4.id0,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_4.id1,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_4.id2,3.515,1,80,80,10,0,0,1,1,1)),
  jab3_5 : new createHitboxObject(new createHitbox(offsets[3].jab3_5.id0,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_5.id1,3.515,1,80,80,10,0,0,1,1,1),new createHitbox(offsets[3].jab3_5.id2,3.515,1,80,80,10,0,0,1,1,1)),
  fsmash1 : new createHitboxObject(new createHitbox(offsets[3].forwardsmash1.id0,3.515,17,361,90,40,0,0,1,1,1),new createHitbox(offsets[3].forwardsmash1.id1,3.125,17,361,90,40,0,0,1,1,1),new createHitbox(offsets[3].forwardsmash1.id2,2.344,17,110,90,40,0,0,1,1,1)),
  fsmash2 : new createHitboxObject(new createHitbox(offsets[3].forwardsmash2.id0,3.515,14,361,105,10,0,0,1,1,1),new createHitbox(offsets[3].forwardsmash2.id1,3.125,14,361,105,10,0,0,1,1,1),new createHitbox(offsets[3].forwardsmash2.id2,2.344,14,361,105,10,0,0,1,1,1)),
  upsmash1 : new createHitboxObject(new createHitbox(offsets[3].upsmash1.id0,3.328,14,95,100,25,0,0,1,1,1),new createHitbox(offsets[3].upsmash1.id1,4.656,14,95,100,25,0,0,1,1,1)),
  upsmash2 : new createHitboxObject(new createHitbox(offsets[3].upsmash2.id0,3.328,12,361,100,10,0,0,1,1,1),new createHitbox(offsets[3].upsmash2.id1,3.828,12,361,100,10,0,0,1,1,1)),
  dsmash : new createHitboxObject(new createHitbox(offsets[3].downsmash.id0,4.687,16,25,70,20,0,0,1,1,1),new createHitbox(offsets[3].downsmash.id1,4.687,16,25,70,20,0,0,1,1,1),new createHitbox(offsets[3].downsmash.id2,3.515,13,80,70,20,0,0,1,1,1),new createHitbox(offsets[3].downsmash.id3,3.515,13,80,70,20,0,0,1,1,1)),
  grab : new createHitboxObject(new createHitbox(offsets[3].grab.id0,3.906,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[3].grab.id1,2.734,0,361,100,0,0,2,3,1,1)),
  // ftCo_MS_CatchDash -- the DASH grab. 40 frames against Catch's 30;
  // hitbox frames and sizes read off the subaction script by
  // tools/gen_catchdash.py, which self-checks against the line above.
  grabDash : new createHitboxObject(new createHitbox(offsets[3].grabDash.id0,3.90625,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[3].grabDash.id1,3.125,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[3].grabDash.id2,3.125,0,361,100,0,0,2,3,1,1)),
  downattack1 : new createHitboxObject(new createHitbox(offsets[3].downattack1.id0,7.031,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[3].downattack1.id1,3.906,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[3].downattack1.id2,3.906,6,361,50,80,0,0,1,1,1)),
  downattack2 : new createHitboxObject(new createHitbox(offsets[3].downattack2.id0,4.687,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[3].downattack2.id1,6.250,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[3].downattack2.id2,6.250,6,361,50,80,0,0,1,1,1)),
  downspecial : new createHitboxObject(new createHitbox(offsets[3].downspecialair.id0,5.999,8,84,50,110,0,4,0,1,1)),
  // See the note on Fox's reflector. Falco's ReflectDesc is byte-identical:
  // ext_attr+0xB0, size 8.5, offset (0,6.5,0), max_damage 50, damage_mul 1.5.
  reflector : new createHitboxObject(new createHitbox(offsets[3].reflector.id0,8.5,0,361,100,0,0,7,0,1,1)),
  // Third hitbox does 6, not 8 -- see the note on Fox's, which is identical.
  ledgegetupquick : new createHitboxObject(new createHitbox(offsets[3].ledgegetupquick.id0,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[3].ledgegetupquick.id1,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[3].ledgegetupquick.id2,4.687,6,361,100,0,90,0,1,1,1)),
  ledgegetupslow : new createHitboxObject(new createHitbox(offsets[3].ledgegetupslow.id0,3.125,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[3].ledgegetupslow.id1,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[3].ledgegetupslow.id2,4.687,6,361,100,0,90,0,1,1,1)),
  pummel : new createHitboxObject(new createHitbox(offsets[3].pummel.id0,5.859,3,80,100,0,30,0,0,1,1)),
  throwup : new createHitboxObject(new createHitbox(new Vec2D(2.855,24.35-3.55+0.23),0,2,90,110,75,0,0,0,1,1)),
  throwdown : new createHitboxObject(new createHitbox(new Vec2D(0.57363,0),0,1,270,40,150,0,0,0,1,1)),
  throwback : new createHitboxObject(new createHitbox(new Vec2D(-9.36+1.90,7.24-2.81+0.23),0,2,124,85,80,0,0,0,1,1)),
  throwforward : new createHitboxObject(new createHitbox(new Vec2D(18.97-2.05,1.31),0,3,45,135,35,0,0,0,1,1)),
  // ThrowF f10: size 4.6875, dmg 4, angle 60, kg 180, bk 60. Only the size was
  // wrong -- 8.593 is Jigglypuff's ThrowF hitbox size, the same copy that got
  // onto Fox.
  throwforwardextra : new createHitboxObject(new createHitbox(offsets[3].throwforwardextra.id0,4.687,4,60,180,60,0,0,0,1,1)),
  // The tumble-body hitbox: a character in DamageFly* damages anyone they are
  // launched into. In Melee this is a create_hitbox at frame 0 of every
  // DamageFly subaction (DamageFlyN/Hi/Lw/Top/Roll), and it is identical in all
  // five of them and across all five characters:
  //     size 4.6875, dmg 6, angle 361, kg 100, bk 30
  // The previous values (3.906/4/361/50/20) were likewise uniform, so this is
  // one shared estimate being corrected, not five separate ones.
  thrown : new createHitboxObject(new createHitbox(offsets[3].thrown.id0,4.687,6,361,100,30,0,1,0,1,1))
});


setChars(CHARIDS.FALCO_ID, new charObject(CHARIDS.FALCO_ID));
