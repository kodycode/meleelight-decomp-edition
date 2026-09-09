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


setCharAttributes(CHARIDS.FOX_ID, {
  dashFrameMin : 11,
  dInitV : 2.02,
  dMaxV : 2.200000047683716,
  dAccA : 0.10000000149011612,
  dAccB : 0.019999999552965164,
  dTInitV : 1.899999976158142,
  traction : 0.07999999821186066,
  maxWalk : 1.600000023841858,
  jumpSquat : 3,
  sHopInitV : 2.0999999046325684,
  fHopInitV : 3.680000066757202,
  gravity : 0.23000000417232513,
  walkAccelMul : 0.20000000298023224,
  walkAccelBase : 0.10000000149011612,
  groundMaxHorizontalV : 3.0,
  groundToAir : 0.8299999833106995,
  jumpHmaxV : 1.7000000476837158,
  jumpHinitV : 0.7200000286102295,
  airMobA : 0.05999999865889549,
  airMobB : 0.019999999552965164,
  aerialHmaxV : 0.8299999833106995,
  airMaxHorizontalV : 3,
  airFriction : 0.019999999552965164,
  fastFallV : 3.4000000953674316,
  terminalV : 2.799999952316284,
  walkInitV : 0.16,
  walkAcc : 0.2,
  walkMaxV : 1.600000023841858,
  djMultiplier : 1.2000000476837158,
  djMomentum : 0.8999999761581421,
  shieldScale : 14.375,
  modelScale : 0.9599999785423279,
  weight : 75,
  waitAnimSpeed : 1,
  walljump : true,
  hurtboxOffset : [6,13],
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
  shieldOffset : [5,34],
  charScale : 0.35,
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
  airdodgeIntangible : 25,
  // Up special (Firefox). These live in the CHARACTER-SPECIFIC attribute block
  // at ftData+0x04, not the shared ftCo_DatAttrs at +0x00 -- layout from
  // ftFox_DatAttrs (src/melee/ft/kinds/ftFox/types.h:107-132).
  firefoxFallAccel : 0.014999999664723873,      // x60_FOX_FIREFOX_FALL_ACCEL
  firefoxStickRangeMin : 0.5,                   // x64_..._DIRECTION_STICK_RANGE_MIN
  firefoxSpeed : 3.799999952316284,             // x74_FOX_FIREFOX_SPEED
  firefoxReverseAccel : 0.10000000149011612,    // x78_FOX_FIREFOX_REVERSE_ACCEL
  firefoxFacingStickRangeMin : 0.125,           // x88_..._FACING_STICK_RANGE_MIN
  // ftCo_SpecialS.c:45, the side-special entry:
  //   gr_vel += -(gr_vel * (1 - specials_ground_speed_retention))
  //             * ft_GetGroundFrictionMultiplier(fp)
  // which with the usual multiplier of 1 reduces to gr_vel *= retention.
  // 0.2 on every character here, but it is a per-character field.
  specialsGroundSpeedRetention : 0.20000000298023224,
  wallJumpVelX : 1.399999976158142,
  wallJumpVelY : 3.299999952316284,
  shieldBreakVel : 3.299999952316284,
  multiJump : false,
  //ecbScale : 2.5,
  ecbScale : 1,
  walkAnimSpeed : 1,
  runAnimSpeed : 1
});

// start, length
setIntangibility(CHARIDS.FOX_ID, {
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

setFrames(CHARIDS.FOX_ID, {
  "WAIT" : 120,
  "DASH" : 22,
  "RUN" : 25,
  "RUNBRAKE" : 18,
  "RUNTURN" : 20,
  "WALK" : 26,
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
  "DOWNWAIT" : 70,
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
  "THROWNMARTHFORWARD" : 9,
  "THROWNMARTHDOWN" : 10,
  "THROWNPUFFUP" : 5,
  "THROWNPUFFBACK" : 18,
  "THROWNPUFFFORWARD" : 9,
  "THROWNPUFFDOWN" : 60,
  "THROWNFOXUP" : 5,
  "THROWNFOXBACK" : 6,
  "THROWNFOXFORWARD" : 10,
  "THROWNFOXDOWN" : 32,
  "THROWNFALCOUP" : 5,
  "THROWNFALCOBACK" : 6,
  "THROWNFALCOFORWARD" : 8,
  "THROWNFALCODOWN" : 24,
  "THROWNFALCONUP" : 14,
  "THROWNFALCONBACK" : 19,
  "THROWNFALCONFORWARD" : 17,
  "THROWNFALCONDOWN" : 15,
  "FURASLEEPSTART" : 30,
  "FURASLEEPLOOP" : 110,
  "FURASLEEPEND" : 60,
  "STOPCEIL" : 8,
  "TECHU" : 26,
  "REBOUND" : 14
});

setActionSounds(CHARIDS.FOX_ID, {
  "JUMP" : [],
  "ESCAPEAIR" : [[4,"foxairdodge"]],
  "JUMPAERIAL" : [[1,"foxjump"]],
  "GUARDON" : [],
  "GUARDOFF" : [],
  "CLIFFCATCH" : [[1,"foxcliffcatch"],[1,"puffledgegrab"]],
  "DEAD" : [[1,"foxdeath"]],
  "FURAFURA" : [[0,"foxfura"]],
  "ESCAPEB" : [],
  "ESCAPEF" : [],
  "ESCAPEN" : [],
  "OTTOTTOWAIT" : [[0,"foxairdodge"]],
  "TECH" : []
});

// HITBOX OFFSETS

setOffsets(CHARIDS.FOX_ID, {
  ledgegetupquick : {
    id0 : [new Vec3D(5.274702,6.747875,-1.1569482),new Vec3D(5.368274,5.8284135,-0.74572134),new Vec3D(5.585229,5.583241,-1.395852),new Vec3D(5.730076,5.7455835,-1.30258),new Vec3D(5.8678026,4.8152924,-0.2748215),new Vec3D(5.9910507,3.2523906,-0.24282707),new Vec3D(6.1053486,2.3992481,-0.7912234),new Vec3D(6.220104,2.1594536,-1.1221427),new Vec3D(6.3329067,2.1490076,-1.1455146),new Vec3D(6.44471,2.162234,-1.1299174)],
    id1 : [new Vec3D(5.196104,5.542312,0.17958999),new Vec3D(5.2078185,4.645113,0.28258997),new Vec3D(5.5879774,4.6934495,-0.8727961),new Vec3D(5.668103,5.3465433,-0.8711846),new Vec3D(5.5595484,4.235145,-0.05771798),new Vec3D(5.5541553,2.7468896,-0.54371655),new Vec3D(5.827076,2.7561297,-0.9933753),new Vec3D(6.231983,3.1804633,0.37765858),new Vec3D(5.881588,3.0940816,0.868865),new Vec3D(4.994293,2.7190888,1.1670327)],
    id2 : [new Vec3D(-4.279317,7.6819477,-1.3349501),new Vec3D(-4.145084,7.2367215,-1.248599),new Vec3D(-4.043421,6.342232,-0.71262723),new Vec3D(-3.9782052,5.2784243,-0.6366619),new Vec3D(-3.919015,4.584928,-0.7728556),new Vec3D(-3.8164482,3.9172435,-0.48554263),new Vec3D(-3.6764393,3.3348355,-0.42805958),new Vec3D(-3.4368715,3.051658,-0.2837811),new Vec3D(-3.3098984,2.7444284,-0.025450839),new Vec3D(-3.1876602,2.533227,0.05646548)],
  },
  ledgegetupslow : {
    id0 : [new Vec3D(6.2065954,9.99384,0.100677304),new Vec3D(7.6407437,2.7953641,0.19138601),new Vec3D(6.896878,1.9732306,-0.004828334)],
    id1 : [new Vec3D(8.827295,12.565282,0.18328302),new Vec3D(11.3337345,1.161634,0.5565617),new Vec3D(9.9759655,0.86464465,0.4614592)],
    id2 : [new Vec3D(-0.58807826,8.200629,-0.6166756),new Vec3D(0.19971657,6.9780817,1.0515859),new Vec3D(1.2297912,5.787838,1.8667465)],
  },
  downspecial : {
    id0 : [new Vec3D(-0.6033032,6.7974424,-0.0679834)]
  },
  reflector : {
    id0 : [new Vec3D(0,6.24,0)]
  },
  jab1 : {
    id0 : [new Vec3D(6.0789075,5.7350883,4.881321),new Vec3D(15.534145,8.148534,1.3099074)],
    id1 : [new Vec3D(6.43765,9.016277,1.8670202),new Vec3D(8.99843,7.7646,-0.13716957)],
  },
  jab2 : {
    id0 : [new Vec3D(9.739273,7.0190043,-0.4398197),new Vec3D(8.655905,7.5747213,-0.399946)],
    id1 : [new Vec3D(3.1002326,6.126975,-0.7304535),new Vec3D(3.141975,6.2326927,-0.6544608)],
  },
  jab3_1 : {
    id0 : [new Vec3D(2.1177,10.356504,-0.9136261),new Vec3D(1.9965775,10.154667,-0.82049406)],
    id1 : [new Vec3D(4.994069,12.105303,-0.7107253),new Vec3D(4.597241,11.902673,-0.3724503)],
    id2 : [new Vec3D(10.813634,15.634062,-0.20741487),new Vec3D(9.856605,15.421028,0.6236263)],
  },
  jab3_2 : {
    id0 : [new Vec3D(2.3041523,9.675947,-0.8861116),new Vec3D(2.1752176,9.4564705,-0.86426115)],
    id1 : [new Vec3D(5.494503,10.745724,-0.66204894),new Vec3D(5.1527176,10.513063,-0.66977024)],
    id2 : [new Vec3D(11.943936,12.908823,-0.11560631),new Vec3D(11.172558,12.648102,-0.1849581)],
  },
  jab3_3 : {
    id0 : [new Vec3D(1.9088604,8.409581,-0.86604536),new Vec3D(1.8666904,8.281596,-0.85697764)],
    id1 : [new Vec3D(5.27636,8.498935,-0.7081834),new Vec3D(5.0332537,8.281159,-0.7223131)],
    id2 : [new Vec3D(12.0858555,8.681539,-0.29560828),new Vec3D(11.436695,8.280111,-0.35842308)],
  },
  jab3_4 : {
    id0 : [new Vec3D(2.3330045,7.6853228,-0.8324634),new Vec3D(2.1754932,7.545583,-0.8449069)],
    id1 : [new Vec3D(5.376366,6.9675493,-0.6611195),new Vec3D(4.985883,6.57048,-0.7482792)],
    id2 : [new Vec3D(11.529054,5.514724,-0.22129744),new Vec3D(10.669094,4.5966096,-0.4613751)]
  },
  jab3_5 : {
    id0 : [new Vec3D(2.070859,6.6741652,-1.0044918),new Vec3D(2.0204868,6.7034764,-1.0186782)],
    id1 : [new Vec3D(4.7927127,5.732863,-0.7577797),new Vec3D(4.513132,5.4848676,-0.795566)],
    id2 : [new Vec3D(10.294172,3.835099,-0.16575134),new Vec3D(9.551836,3.0255406,-0.25308794)]
  },
  dtilt : {
    id0 : [new Vec3D(8.943894,1.6904699,8.002237),new Vec3D(10.257852,2.592733,-2.3315387),new Vec3D(7.2070737,2.7225904,-7.0213532)],
    id1 : [new Vec3D(10.704847,0.96455574,11.0049),new Vec3D(13.976608,2.567071,-2.7830787),new Vec3D(9.940318,2.7341526,-9.179563)],
    id2 : [new Vec3D(12.465801,0.23864174,14.007563),new Vec3D(17.695362,2.541409,-3.2346184),new Vec3D(12.673563,2.745715,-11.337772)]
  },
  uptilt : {
    id0 : [new Vec3D(-3.8433473,4.7482133,0.4030235),new Vec3D(-5.2949743,11.929293,0.035308003),new Vec3D(-1.7366829,16.293009,1.6147826),new Vec3D(4.935894,15.916714,1.3648021),new Vec3D(4.6826,15.321838,1.2897645),new Vec3D(3.818451,14.692632,1.4395341),new Vec3D(3.0045996,14.157302,1.6179626)],
    id1 : [new Vec3D(-3.8433473,4.7482133,0.4030235),new Vec3D(-5.2949743,11.929293,0.035308003),new Vec3D(-1.7366829,16.293009,1.6147826),new Vec3D(4.935894,15.916714,1.3648021),new Vec3D(4.6826,15.321838,1.2897645),new Vec3D(3.818451,14.692632,1.4395341),new Vec3D(3.0045996,14.157302,1.6179626)],
    id2 : [new Vec3D(-3.8261983,4.712905,0.3050163),new Vec3D(-5.300259,11.914998,-0.07075301),new Vec3D(-1.822652,16.270885,1.5533499),new Vec3D(4.8487206,15.976921,1.3469349),new Vec3D(4.595716,15.381418,1.2756273),new Vec3D(3.7481701,14.773091,1.4285226),new Vec3D(2.9433935,14.24174,1.6120147)],
    id3 : [new Vec3D(0.46713722,8.189497,0.39470157),new Vec3D(0.4677505,9.482222,0.6933194),new Vec3D(1.0330148,10.220999,1.1557791),new Vec3D(1.8258823,10.27997,1.4014627),new Vec3D(1.7896552,10.211419,1.4194176),new Vec3D(1.5453773,10.223379,1.4700403),new Vec3D(1.3320084,10.194826,1.5355996)]
  },
  ftilt : {
    id0 : [new Vec3D(1.4067359,5.4934754,-6.1836166),new Vec3D(15.187819,8.607868,-1.4473948),new Vec3D(15.400166,8.563887,-0.742452),new Vec3D(15.258262,8.451117,0.05450833)],
    id1 : [new Vec3D(4.301956,7.1619754,-3.2976658),new Vec3D(10.61544,8.644659,-0.20136595),new Vec3D(10.725573,8.698852,0.026027858),new Vec3D(10.530443,8.688172,0.28282753)],
    id2 : [new Vec3D(3.163125,7.680188,0),new Vec3D(6.9515624,8.639954,0),new Vec3D(7.0164385,8.740719,0),new Vec3D(6.799792,8.77959,0)]
  },
  dsmash : {
    id0 : [new Vec3D(-8.647832,1.4518517,-0.4732737),new Vec3D(-8.262503,1.3963276,-0.48464185),new Vec3D(-7.5531616,1.3871927,-0.97730625),new Vec3D(-6.7578797,1.4089248,-1.7412736),new Vec3D(-6.0983977,1.4450661,-2.686769)],
    id1 : [new Vec3D(9.106326,1.8369908,0.3318088),new Vec3D(8.743891,1.635562,0.9568552),new Vec3D(8.047851,1.502417,1.6228137),new Vec3D(7.2339516,1.4140595,2.5611434),new Vec3D(6.500533,1.3589678,3.6885896)],
    id2 : [new Vec3D(-4.6504545,1.4608797,-0.4977311),new Vec3D(-4.4465265,1.4338857,-0.51173794),new Vec3D(-4.0555387,1.4298699,-0.7825172),new Vec3D(-3.5977862,1.4411299,-1.1968243),new Vec3D(-3.186096,1.4594852,-1.699897)],
    id3 : [new Vec3D(5.113921,1.667347,0.43963113),new Vec3D(4.9328976,1.5675296,0.76839316),new Vec3D(4.5771923,1.5014287,1.1456786),new Vec3D(4.1509476,1.4574401,1.6797469),new Vec3D(3.747474,1.4298458,2.3206472)]
  },
  upsmash1 : {
    id0 : [new Vec3D(6.3664503,7.5824633,-0.36980733),new Vec3D(7.1986485,11.141746,-0.15197948),new Vec3D(6.148308,15.559214,-0.17540658)],
    id1 : [new Vec3D(5.9672456,5.3845205,-0.43985566),new Vec3D(9.3253,10.454795,-0.17796102),new Vec3D(8.361449,15.824669,-0.33900332)]
  },
  upsmash2 : {
    id0 : [new Vec3D(3.336639,18.524818,-0.54667205),new Vec3D(0.17510808,19.385479,-0.58012),new Vec3D(-2.3615987,18.5068,-0.41330943),new Vec3D(-3.9029708,16.713388,-0.33978045),new Vec3D(-4.620282,14.920191,-0.2511616),new Vec3D(-4.938531,13.314143,-0.1383388),new Vec3D(-5.0036635,11.780224,-0.060415387),new Vec3D(-4.858227,10.288093,-0.044409215)],
    id1 : [new Vec3D(3.8276067,20.698656,-0.7158085),new Vec3D(-0.821309,21.383139,-0.68843114),new Vec3D(-4.106975,19.902815,-0.4079372),new Vec3D(-5.9944973,17.5007,-0.3100392),new Vec3D(-6.822357,15.302362,-0.25713998),new Vec3D(-7.1662216,13.48722,-0.18993804),new Vec3D(-7.2379646,11.790358,-0.11539188),new Vec3D(-7.082617,10.070627,-0.0491798)]
  },
  fsmash1 : {
    id0 : [new Vec3D(9.910999,13.903034,4.437006),new Vec3D(12.0478,12.127148,4.2385283),new Vec3D(13.280427,9.830877,3.5804102),new Vec3D(13.590776,7.670444,2.6692333),new Vec3D(13.340806,6.418478,1.7218864)],
    id1 : [new Vec3D(7.852582,10.324074,2.1422582),new Vec3D(8.838573,9.492956,1.9526507),new Vec3D(9.17312,8.490864,1.6316298),new Vec3D(9.067852,7.5454135,1.2582605),new Vec3D(8.705123,6.9878907,0.9159403)],
    id2 : [new Vec3D(6.51632,7.8806095,-0.18574111),new Vec3D(6.255407,7.8598905,-0.1521537),new Vec3D(5.9429007,7.826299,-0.11065844),new Vec3D(5.5781345,7.779963,-0.06341202),new Vec3D(5.1599083,7.7210083,-0.012869915)]
  },
  fsmash2 : {
    id0 : [new Vec3D(12.906104,5.913206,0.9238756),new Vec3D(12.358957,5.6604877,0.3194125),new Vec3D(11.73174,5.4896054,-0.09185821),new Vec3D(11.030815,5.2440696,-0.30176347),new Vec3D(10.158058,4.5993958,-0.32427904),new Vec3D(8.495855,2.8964653,-0.1474511)],
    id1 : [new Vec3D(8.247663,6.7454967,0.6601396),new Vec3D(7.7162914,6.599878,0.48228478),new Vec3D(7.120517,6.4841185,0.36738592),new Vec3D(6.459982,6.3400817,0.30617028),new Vec3D(5.751299,6.1987314,0.32826388),new Vec3D(4.926958,5.8773108,0.34261274)],
    id2 : [new Vec3D(4.6864414,7.6495624,0.03834102),new Vec3D(4.155346,7.565752,0.08755932),new Vec3D(3.5636358,7.4697046,0.13222697),new Vec3D(2.9077644,7.361547,0.17002243),new Vec3D(2.183693,7.241406,0.19898142),new Vec3D(1.3869858,7.1094084,0.21759887)]
  },
  downattack1 : {
    id0 : [new Vec3D(13.617726,6.427325,-1.80791),new Vec3D(13.386305,6.3939533,-2.0618966),new Vec3D(14.125763,6.434511,-2.2459514)],
    id1 : [new Vec3D(7.9515924,6.30179,-1.6889157),new Vec3D(7.5393786,6.196993,-1.7674495),new Vec3D(8.309442,6.37642,-1.8411584)],
    id2 : [new Vec3D(3.9338784,5.7753167,-0.0001961765),new Vec3D(3.524627,5.7759166,-0.00019464744),new Vec3D(4.344558,5.775774,-0.00019625385)]
  },
  downattack2 : {
    id0 : [new Vec3D(-5.712076,7.607539,3.3418376),new Vec3D(-7.5363593,8.560782,0.89064217),new Vec3D(-8.091127,8.569092,0.8402169)],
    id1 : [new Vec3D(-8.608851,7.839361,1.9421804),new Vec3D(-11.344107,8.564825,0.7612441),new Vec3D(-11.784976,8.597465,0.6614318)],
    id2 : [new Vec3D(-0.99821895,8.693902,-0.055226304),new Vec3D(-1.8086175,9.033863,-0.061613448),new Vec3D(-2.4970214,9.010244,-0.049961407)]
  },
  grab : {
    id0 : [new Vec3D(8.25,6.75,0),new Vec3D(8.25,6.75,0)],
    id1 : [new Vec3D(4.5,6.75,0),new Vec3D(4.5,6.75,0)]
  },
  grabDash : {
    id0 : [new Vec3D(7.5,5.625,0),new Vec3D(7.5,5.625,0)],
    id1 : [new Vec3D(3,6.75,0),new Vec3D(3,6.75,0)],
    id2 : [new Vec3D(-0.75,6.75,0),new Vec3D(-0.75,6.75,0)]
  },
  pummel : {
    id0 : [new Vec3D(6.847451,7.5955186,-1.716824)]
  },
  nair1 : {
    id0 : [new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0)],
    id1 : [new Vec3D(5.730464,6.2994804,0.07504359),new Vec3D(5.7281036,6.336679,-0.12259439),new Vec3D(5.7276917,6.3260784,-0.14690837),new Vec3D(5.7270412,6.3343115,-0.13613743)],
    id2 : [new Vec3D(0.49835938,3.9161673,-1.3336397),new Vec3D(0.4403088,3.9236987,-1.4230125),new Vec3D(0.42871594,3.9216542,-1.411717),new Vec3D(0.4146328,3.9227004,-1.3998184)]
  },
  nair2 : {
    id0 : [new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.96,6.528001,0),new Vec3D(-0.91199994,6.600001,0)],
    id1 : [new Vec3D(5.7255383,6.360796,-0.09730393),new Vec3D(5.722332,6.4036236,-0.037028313),new Vec3D(5.716652,6.4597445,0.038930714),new Vec3D(5.7080154,6.525167,0.12597221),new Vec3D(5.6963124,6.5951743,0.22077146),new Vec3D(5.6818066,6.664695,0.3211112),new Vec3D(5.664956,6.731301,0.42449117),new Vec3D(5.6464252,6.7933974,0.5283046),new Vec3D(5.627104,6.8489833,0.6302291),new Vec3D(5.6080666,6.895804,0.72816586),new Vec3D(5.590519,6.9315085,0.8201161),new Vec3D(5.5757284,6.9538116,0.9040058),new Vec3D(5.5649686,6.960634,0.9774679),new Vec3D(5.559441,6.9502826,1.0375981),new Vec3D(5.560215,6.9216337,1.0806867),new Vec3D(5.568125,6.874389,1.1019657),new Vec3D(5.5836267,6.8093953,1.0953722),new Vec3D(5.606574,6.729069,1.0533924),new Vec3D(5.6358624,6.637931,0.96701336),new Vec3D(5.720924,6.527564,0.68908715),new Vec3D(5.801834,6.4154053,0.2392376),new Vec3D(5.8061466,6.3437614,-0.10869442),new Vec3D(5.727745,6.3616424,-0.06894207),new Vec3D(5.4570675,6.6490593,0.51542515)],
    id2 : [new Vec3D(0.39833772,3.9262958,-1.3880287),new Vec3D(0.38002956,3.9318516,-1.3769472),new Vec3D(0.35990345,3.9387722,-1.367018),new Vec3D(0.33819115,3.9464996,-1.3585088),new Vec3D(0.3151958,3.9545472,-1.3515191),new Vec3D(0.29130507,3.9625232,-1.3460068),new Vec3D(0.26699317,3.9701517,-1.3418227),new Vec3D(0.24281311,3.977262,-1.3387529),new Vec3D(0.21937883,3.9837894,-1.3365563),new Vec3D(0.19734323,3.9897413,-1.3350035),new Vec3D(0.17737234,3.9951773,-1.3338988),new Vec3D(0.16011572,4.000172,-1.3330984),new Vec3D(0.14618039,4.0047884,-1.3325171),new Vec3D(0.13610137,4.0090423,-1.3321347),new Vec3D(0.13031435,4.0128813,-1.3319944),new Vec3D(0.12913024,4.0161633,-1.3322052),new Vec3D(0.13270175,4.018633,-1.3329554),new Vec3D(0.14099205,4.019906,-1.3345373),new Vec3D(0.15372813,4.019458,-1.3373904),new Vec3D(0.17034853,4.0166097,-1.3421776),new Vec3D(0.1899246,4.0105276,-1.3498977),new Vec3D(0.21106553,4.0002494,-1.3620434),new Vec3D(0.23177719,3.9847572,-1.3808129),new Vec3D(0.3002243,4.0470576,-1.4349812)]
  },
  bair1 : {
    id0 : [new Vec3D(-0.007674038,7.97444,-0.069903135),new Vec3D(-0.009783202,7.9762096,-0.0891156),new Vec3D(-0.011952021,7.9780297,-0.10887146),new Vec3D(-0.014172192,7.9798923,-0.12909509)],
    id1 : [new Vec3D(-8.043568,9.587202,-0.73596597),new Vec3D(-8.06766,9.545588,-0.8413919),new Vec3D(-8.089161,9.463259,-1.0405527),new Vec3D(-8.066273,9.412437,-0.78037053)],
    id2 : [new Vec3D(2.661257,4.194005,0.020489097),new Vec3D(2.7959032,4.1500607,0.17565823),new Vec3D(2.864183,4.1558294,0.32830143),new Vec3D(2.9184055,4.1658134,0.4498657)]
  },
  bair2 : {
    id0 : [new Vec3D(-0.016435413,7.9817915,-0.14971086),new Vec3D(-0.018733378,7.98372,-0.17064314),new Vec3D(-0.021057788,7.98567,-0.19181627),new Vec3D(-0.023400335,7.9876356,-0.21315463),new Vec3D(-0.02575272,7.9896092,-0.23458259),new Vec3D(-0.028106637,7.991585,-0.25602454),new Vec3D(-0.030453783,7.993554,-0.2774048),new Vec3D(-0.032785855,7.995511,-0.29864773),new Vec3D(-0.03509455,7.997448,-0.31967774),new Vec3D(-0.03737157,7.9993587,-0.34041917),new Vec3D(-0.0396086,8.001236,-0.36079642),new Vec3D(-0.04179735,8.003072,-0.38073382)],
    id1 : [new Vec3D(-7.9175034,9.352599,-0.21455956),new Vec3D(-7.7071905,9.233143,0.20001316),new Vec3D(-7.465475,9.095115,0.5541949),new Vec3D(-7.2051735,8.969154,0.8749535),new Vec3D(-6.939133,8.856092,1.1669596),new Vec3D(-6.675373,8.7528,1.4350274),new Vec3D(-6.417845,8.653875,1.6837608),new Vec3D(-6.1671696,8.552525,1.917222),new Vec3D(-5.921256,8.440962,2.1385357),new Vec3D(-5.675802,8.310561,2.3493762),new Vec3D(-5.4251256,8.141459,2.549676),new Vec3D(-5.160458,7.9393673,2.73501)],
    id2 : [new Vec3D(2.9615784,4.176241,0.54034674),new Vec3D(2.995047,4.1836324,0.60159934),new Vec3D(3.0184681,4.184568,0.6367725),new Vec3D(3.0299485,4.175369,0.64960814),new Vec3D(3.0367508,4.1645203,0.64271724),new Vec3D(3.040636,4.1543574,0.6188954),new Vec3D(3.029113,4.130283,0.581825),new Vec3D(2.9883728,4.0769606,0.53408027),new Vec3D(2.939476,4.0219646,0.47715342),new Vec3D(2.9057715,3.9942474,0.4171164),new Vec3D(2.8768435,3.9821978,0.35886705),new Vec3D(2.8435864,3.975818,0.30531442)]
  },
  fair1 : {
    id0 : [new Vec3D(2.8442008,8.519177,3.2391388),new Vec3D(4.424847,8.591072,0.66471565),new Vec3D(4.473587,8.50339,-0.28661758)],
    id1 : [new Vec3D(6.7675166,10.445665,4.309764),new Vec3D(8.60676,9.8877125,-0.37467623),new Vec3D(7.7333555,9.11246,-3.3284829)]
  },
  fair2 : {
    id0 : [new Vec3D(4.4926662,7.325497,-0.49763525),new Vec3D(2.8094554,6.6999073,-3.112979),new Vec3D(0.59758127,6.108174,-3.5309095)],
    id1 : [new Vec3D(8.895428,6.9180555,0.33883357),new Vec3D(7.06575,7.061728,-4.528268),new Vec3D(3.1899319,5.8726854,-7.20164)]
  },
  fair3 : {
    id0 : [new Vec3D(2.6966472,8.890086,3.0181777),new Vec3D(4.391882,8.309661,1.0147425),new Vec3D(4.4947243,8.3961525,-0.11661747)],
    id1 : [new Vec3D(6.8022227,10.61886,3.6550398),new Vec3D(8.607044,9.274519,-0.2308321),new Vec3D(7.7242775,8.808308,-3.2230806)]
  },
  fair4 : {
    id0 : [new Vec3D(4.5050917,7.570734,-0.21783572),new Vec3D(4.4980597,7.3194275,-0.47161698),new Vec3D(3.1123672,6.9522796,-2.8804266)],
    id1 : [new Vec3D(4.9915953,7.30937,4.248147),new Vec3D(8.813528,6.8534803,0.71566033),new Vec3D(7.4503026,7.3483353,-4.0097876)]
  },
  fair5 : {
    id0 : [new Vec3D(4.44398,7.703861,-0.35545233),new Vec3D(4.4436407,7.5435247,-0.47172233),new Vec3D(4.491372,7.3302617,-0.28195307)],
    id1 : [new Vec3D(8.085152,7.719254,-1.2521886),new Vec3D(8.074678,7.4186845,-1.4004225),new Vec3D(7.782189,7.03514,-2.0556297)]
  },
  upair1 : {
    id0 : [new Vec3D(-3.2926817,12.498793,4.647584),new Vec3D(-0.024569348,15.771166,0.046301097)],
    id1 : [new Vec3D(-4.456455,13.522146,6.278804),new Vec3D(-0.15139034,18.004839,0.28529572)],
    id2 : [new Vec3D(-1.8308687,12.781409,2.569923),new Vec3D(0.6436648,14.05089,-1.2129886)]
  },
  upair2 : {
    id0 : [new Vec3D(-1.2729454,12.272213,0.34769225),new Vec3D(0.18496497,13.182124,-1.2795095),new Vec3D(1.6266322,13.09594,-2.3071713),new Vec3D(2.7468572,12.52737,-2.7597744)],
    id1 : [new Vec3D(-1.9193456,14.412998,1.560078),new Vec3D(0.658448,15.678242,-1.405539),new Vec3D(3.1598392,14.9082155,-3.2212865),new Vec3D(4.949755,13.052398,-3.9183345)],
    id2 : [new Vec3D(0.8156379,8.892524,-1.0409036),new Vec3D(1.1055231,9.082589,-1.0893837),new Vec3D(1.3086294,9.097701,-1.0186926),new Vec3D(1.3717302,9.011687,-0.8521337)]
  },
  dair : {
    id0 : [new Vec3D(1.8237454,6.0571322,0.5917616),new Vec3D(2.0414305,6.19913,-0.11432198)],
    id1 : [new Vec3D(2.729591,3.963855,0.51106834),new Vec3D(2.99578,4.1316776,0.039736807)]
  },
  upb1 : {
    id0 : [new Vec3D(0,7.5,0)]
  },
  upb2 : {
    id0 : [new Vec3D(2.9283948,11.724672,0.10507692),new Vec3D(2.3056903,11.724672,0.16553304),new Vec3D(2.651094,11.724672,-0.33779758),new Vec3D(2.8689418,11.724672,0.21468604),new Vec3D(2.296719,11.724672,0.14822333),new Vec3D(2.566832,11.724672,-0.3390567),new Vec3D(2.9419322,11.724672,0.045519903),new Vec3D(2.5094447,11.724672,0.3277361),new Vec3D(2.2815928,11.724672,-0.11156898),new Vec3D(2.7026129,11.724672,-0.3264828),new Vec3D(2.940432,11.724672,0.0555358),new Vec3D(2.6226606,11.724672,0.3405617),new Vec3D(2.2847204,11.724672,0.12022644),new Vec3D(2.3713565,11.724672,-0.24950892),new Vec3D(2.7201095,11.724672,-0.32067236),new Vec3D(2.9377518,11.724672,-0.06986387),new Vec3D(2.8577528,11.724672,0.22780684),new Vec3D(2.5967507,11.724672,0.34100255),new Vec3D(2.3578248,11.724672,0.23617318),new Vec3D(2.2633157,11.724672,0.018219933),new Vec3D(2.319788,11.724672,-0.18870847),new Vec3D(2.4665155,11.724672,-0.31218228),new Vec3D(2.633677,11.724672,-0.33977592),new Vec3D(2.7743607,11.724672,-0.29543048),new Vec3D(2.870026,11.724672,-0.21334064),new Vec3D(2.922349,11.724672,-0.122180104),new Vec3D(2.9426355,11.724672,-0.039953783),new Vec3D(2.9440765,11.724672,0.024862528),new Vec3D(2.9377284,11.724672,0.06997309),new Vec3D(2.9311824,11.724672,0.09604218)]
  },
  dashattack1 : {
    id0 : [new Vec3D(9.83415,7.1608634,0.626675),new Vec3D(9.197013,7.19606,0.47091052),new Vec3D(8.541584,7.1436267,0.42488602),new Vec3D(8.548114,6.982476,0.55641365)],
    id1 : [new Vec3D(5.3702335,7.4866576,0.16113034),new Vec3D(5.111327,7.542352,0.02079779),new Vec3D(4.8419476,7.5272784,-0.052603483),new Vec3D(4.873082,7.4438457,-0.02991268)]
  },
  dashattack2 : {
    id0 : [new Vec3D(7.819997,6.902911,0.61413205),new Vec3D(7.8261623,6.712077,0.81366503),new Vec3D(7.8370056,6.503959,0.99729174),new Vec3D(7.8603573,6.28399,1.1284441),new Vec3D(7.905569,6.067425,1.176866),new Vec3D(7.98114,5.8822827,1.1210538),new Vec3D(8.090935,5.768366,0.9510915),new Vec3D(8.230787,5.777515,0.6714534),new Vec3D(8.376335,5.8242893,0.5249478),new Vec3D(8.384691,5.5966887,1.2168127)],
    id1 : [new Vec3D(4.906823,7.3362436,0.043479204),new Vec3D(4.9447327,7.2117124,0.14454007),new Vec3D(4.987833,7.0726433,0.2497533),new Vec3D(5.037838,6.9223576,0.3373247),new Vec3D(5.0973244,6.7691035,0.38857377),new Vec3D(5.1689606,6.6281385,0.38937765),new Vec3D(5.253971,6.5221505,0.3318629),new Vec3D(5.3499794,6.4801383,0.21618716),new Vec3D(5.460985,6.446511,0.18794459),new Vec3D(5.5184402,6.2390914,0.6069612)]
  },
  throwforwardextra : {
    id0 : [new Vec3D(6.4833064,7.5234804,-1.6248472)]
  },
  thrown : {
    id0 : [new Vec3D(-0.71872056,9.75949,0.83737636)]
  }
});



setHitBoxes(CHARIDS.FOX_ID, {
  fair1 : new createHitboxObject(new createHitbox(offsets[2].fair1.id0,5.156,7,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].fair1.id1,5.156,7,361,100,10,0,0,0,1,1)),
  fair2 : new createHitboxObject(new createHitbox(offsets[2].fair2.id0,4.656,5,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].fair2.id1,4.656,5,361,100,10,0,0,0,1,1)),
  fair3 : new createHitboxObject(new createHitbox(offsets[2].fair3.id0,4.656,6,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].fair3.id1,4.656,6,361,100,10,0,0,0,1,1)),
  fair4 : new createHitboxObject(new createHitbox(offsets[2].fair4.id0,4.656,4,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].fair4.id1,4.656,4,361,100,10,0,0,0,1,1)),
  fair5 : new createHitboxObject(new createHitbox(offsets[2].fair5.id0,4.656,3,361,100,50,0,0,0,1,1),new createHitbox(offsets[2].fair5.id1,4.656,3,361,100,50,0,0,0,1,1)),
  bair1 : new createHitboxObject(new createHitbox(offsets[2].bair1.id0,3.660,15,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].bair1.id1,4.992,15,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].bair1.id2,3.328,9,361,100,0,0,0,0,1,1)),
  bair2 : new createHitboxObject(new createHitbox(offsets[2].bair2.id0,3.328,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].bair2.id1,3.992,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].bair2.id2,3.328,9,361,100,0,0,0,0,1,1)),
  // Corrected against the AttackAirN subaction decoded from PlFx.dat
  // (subaction 68, event 0x0B create_hitbox). Three defects were present:
  //   1. nair2 base knockback was 10; the script says 0.
  //   2. nair2's third hitbox size was 2.922; the script says 2.992 -- the
  //      digits were transposed (nair1's third hitbox already had 2.992).
  //   3. Both third hitboxes referenced `.id1` offsets. `.id2` is populated
  //      just above and was never used -- a copy-paste that silently gave the
  //      third hitbox the second one's position.
  nair1 : new createHitboxObject(new createHitbox(offsets[2].nair1.id0,3.496,12,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].nair1.id1,3.496,12,361,100,10,0,0,0,1,1),new createHitbox(offsets[2].nair1.id2,2.992,12,361,100,10,0,0,0,1,1)),
  nair2 : new createHitboxObject(new createHitbox(offsets[2].nair2.id0,3.496,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].nair2.id1,3.496,9,361,100,0,0,0,0,1,1),new createHitbox(offsets[2].nair2.id2,2.992,9,361,100,0,0,0,0,1,1)),
  dair : new createHitboxObject(new createHitbox(offsets[2].dair.id0,5.156,3,290,100,0,30,0,0,1,1),new createHitbox(offsets[2].dair.id1,5.988,2,290,100,0,30,0,0,1,1)),
  upair1 : new createHitboxObject(new createHitbox(offsets[2].upair1.id0,4.297,5,92,120,0,30,0,0,1,1),new createHitbox(offsets[2].upair1.id1,4.297,5,92,120,0,30,0,0,1,1),new createHitbox(offsets[2].upair1.id2,4.297,5,92,120,0,30,0,0,1,1)),
  upair2 : new createHitboxObject(new createHitbox(offsets[2].upair2.id0,3.660,13,85,116,40,0,0,0,1,1),new createHitbox(offsets[2].upair2.id1,4.883,13,85,116,40,0,0,0,1,1),new createHitbox(offsets[2].upair2.id2,4.883,13,85,116,40,0,0,0,1,1)),
  upb1 : new createHitboxObject(new createHitbox(offsets[2].upb1.id0,8.203,2,70,40,40,0,3,0,1,1)),
  upb2 : new createHitboxObject(new createHitbox(offsets[2].upb2.id0,4.000,14,80,60,60,0,3,0,1,1)),
  dtilt : new createHitboxObject(new createHitbox(offsets[2].dtilt.id0,2.734,10,70,125,25,0,0,1,1,1),new createHitbox(offsets[2].dtilt.id1,2.734,10,80,125,25,0,0,1,1,1),new createHitbox(offsets[2].dtilt.id2,3.125,10,90,125,25,0,0,1,1,1)),
  uptilt : new createHitboxObject(new createHitbox(offsets[2].uptilt.id0,5.078,12,110,140,18,0,0,1,1,1),new createHitbox(offsets[2].uptilt.id1,5.078,9,84,140,18,0,0,1,1,1),new createHitbox(offsets[2].uptilt.id2,3.515,9,80,140,18,0,0,1,1,1),new createHitbox(offsets[2].uptilt.id3,3.125,9,80,140,18,0,0,1,1,1)),
  ftilt : new createHitboxObject(new createHitbox(offsets[2].ftilt.id0,2.734,9,361,100,0,0,0,1,1,1),new createHitbox(offsets[2].ftilt.id1,3.125,9,361,100,0,0,0,1,1,1),new createHitbox(offsets[2].ftilt.id2,2.344,9,361,100,0,0,0,1,1,1)),
  dashattack1 : new createHitboxObject(new createHitbox(offsets[2].dashattack1.id0,3.828,7,72,90,35,0,0,1,1,1),new createHitbox(offsets[2].dashattack1.id1,3.828,7,72,90,35,0,0,1,1,1)),
  dashattack2 : new createHitboxObject(new createHitbox(offsets[2].dashattack2.id0,2.734,5,72,90,20,0,0,1,1,1),new createHitbox(offsets[2].dashattack2.id1,2.734,5,72,90,20,0,0,1,1,1)),
  jab1 : new createHitboxObject(new createHitbox(offsets[2].jab1.id0,3.328,4,70,100,0,0,0,1,1,1),new createHitbox(offsets[2].jab1.id1,3.328,4,70,100,0,0,0,1,1,1)),
  jab2 : new createHitboxObject(new createHitbox(offsets[2].jab2.id0,3.328,4,70,100,0,0,0,1,1,1),new createHitbox(offsets[2].jab2.id1,3.328,4,70,100,0,0,0,1,1,1)),
  jab3_1 : new createHitboxObject(new createHitbox(offsets[2].jab3_1.id0,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_1.id1,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_1.id2,3.328,1,78,80,10,0,0,1,1,1)),
  jab3_2 : new createHitboxObject(new createHitbox(offsets[2].jab3_2.id0,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_2.id1,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_2.id2,3.328,1,78,80,10,0,0,1,1,1)),
  jab3_3 : new createHitboxObject(new createHitbox(offsets[2].jab3_3.id0,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_3.id1,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_3.id2,3.328,1,78,80,10,0,0,1,1,1)),
  jab3_4 : new createHitboxObject(new createHitbox(offsets[2].jab3_4.id0,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_4.id1,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_4.id2,3.328,1,78,80,10,0,0,1,1,1)),
  jab3_5 : new createHitboxObject(new createHitbox(offsets[2].jab3_5.id0,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_5.id1,3.328,1,78,80,10,0,0,1,1,1),new createHitbox(offsets[2].jab3_5.id2,3.328,1,78,80,10,0,0,1,1,1)),
  fsmash1 : new createHitboxObject(new createHitbox(offsets[2].fsmash1.id0,3.515,15,361,105,10,0,0,1,1,1),new createHitbox(offsets[2].fsmash1.id1,3.125,15,361,105,10,0,0,1,1,1),new createHitbox(offsets[2].fsmash1.id2,2.344,15,361,105,10,0,0,1,1,1)),
  fsmash2 : new createHitboxObject(new createHitbox(offsets[2].fsmash2.id0,3.515,12,361,100,2,0,0,1,1,1),new createHitbox(offsets[2].fsmash2.id1,3.125,12,361,100,2,0,0,1,1,1),new createHitbox(offsets[2].fsmash2.id2,2.344,12,361,100,2,0,0,1,1,1)),
  upsmash1 : new createHitboxObject(new createHitbox(offsets[2].upsmash1.id0,3.328,18,80,112,30,0,0,1,1,1),new createHitbox(offsets[2].upsmash1.id1,4.656,18,80,112,30,0,0,1,1,1)),
  upsmash2 : new createHitboxObject(new createHitbox(offsets[2].upsmash2.id0,3.328,13,361,100,10,0,0,1,1,1),new createHitbox(offsets[2].upsmash2.id1,3.828,13,361,100,10,0,0,1,1,1)),
  dsmash : new createHitboxObject(new createHitbox(offsets[2].dsmash.id0,4.687,15,25,65,20,0,0,1,1,1),new createHitbox(offsets[2].dsmash.id1,4.687,15,25,65,20,0,0,1,1,1),new createHitbox(offsets[2].dsmash.id2,3.515,12,361,65,20,0,0,1,1,1),new createHitbox(offsets[2].dsmash.id3,3.515,12,361,65,20,0,0,1,1,1)),
  grab : new createHitboxObject(new createHitbox(offsets[2].grab.id0,3.906,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[2].grab.id1,2.734,0,361,100,0,0,2,3,1,1)),
  // ftCo_MS_CatchDash -- the DASH grab. 40 frames against Catch's 30;
  // hitbox frames and sizes read off the subaction script by
  // tools/gen_catchdash.py, which self-checks against the line above.
  grabDash : new createHitboxObject(new createHitbox(offsets[2].grabDash.id0,3.90625,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[2].grabDash.id1,3.125,0,361,100,0,0,2,3,1,1),new createHitbox(offsets[2].grabDash.id2,3.125,0,361,100,0,0,2,3,1,1)),
  downattack1 : new createHitboxObject(new createHitbox(offsets[2].downattack1.id0,7.031,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[2].downattack1.id1,3.906,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[2].downattack1.id2,3.906,6,361,50,80,0,0,1,1,1)),
  downattack2 : new createHitboxObject(new createHitbox(offsets[2].downattack2.id0,4.687,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[2].downattack2.id1,6.250,6,361,50,80,0,0,1,1,1),new createHitbox(offsets[2].downattack2.id2,6.25, 6, 361, 50, 80,0,0,1,1,1)),
  downspecial : new createHitboxObject(new createHitbox(offsets[2].downspecial.id0,7.999,5,0,100,0,80,4,0,1,1)),
  // The reflect bubble is NOT a script hitbox. It is a ReflectDesc in the
  // character's ext_attr block (ftData+0x04, types.h:614) at +0xB0, installed
  // by ftFx_SpecialLw_CreateReflectHit -> ftColl_CreateReflectHit
  // (ftfoxspeciallw.c:424, ftcoll.c:3189), which assigns size unscaled:
  //     fp->reflect_hit.size = reflect->x14_size;
  // Disc value: size 8.5, offset (0,6.5,0) from bone 1 = FtPart_TransN,
  // max_damage 50, damage_mul 1.5, speed_mul 1.0, behavior 0.
  // The offset stays as meleelight's measured value because TransN moves with
  // the animation and we have no skeleton here; the size does not.
  reflector : new createHitboxObject(new createHitbox(offsets[2].reflector.id0,8.5,0,361,100,0,0,7,0,1,1)),
  // The THIRD hitbox does 6, not 8. CliffAttackQuick frame 25 and
  // CliffAttackSlow frame 57 both read [8, 8, 6] off the disc; every other
  // field already matched. All three were recorded as 8.
  ledgegetupquick : new createHitboxObject(new createHitbox(offsets[2].ledgegetupquick.id0,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[2].ledgegetupquick.id1,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[2].ledgegetupquick.id2,4.687,6,361,100,0,90,0,1,1,1)),
  ledgegetupslow : new createHitboxObject(new createHitbox(offsets[2].ledgegetupslow.id0,3.125,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[2].ledgegetupslow.id1,4.687,8,361,100,0,90,0,1,1,1),new createHitbox(offsets[2].ledgegetupslow.id2,4.687,6,361,100,0,90,0,1,1,1)),
  // CatchAttack f4: size 5.85938, dmg 3, angle 80, kg 100, bk 0, set kb 30.
  // The angle was 361 (Sakurai angle); Falco's identical pummel already had 80.
  pummel : new createHitboxObject(new createHitbox(offsets[2].pummel.id0,5.859,3,80,100,0,30,0,0,1,1)),
  throwup : new createHitboxObject(new createHitbox(new Vec2D(-0.067,17.54),0,2,90,110,75,0,0,0,1,1)),
  throwdown : new createHitboxObject(new createHitbox(new Vec2D(0.50063,0),0,1,270,40,150,0,0,0,1,1)),
  throwback : new createHitboxObject(new createHitbox(new Vec2D(-6.59,5.66),0,2,124,85,80,0,0,0,1,1)),
  throwforward : new createHitboxObject(new createHitbox(new Vec2D(14.19-4.61,2.805),0,3,45,130,35,0,0,0,1,1)),
  // Bystander hitbox of the forward throw: ThrowF's create_hitbox (event 0x0B)
  // at frame 10 -- size 4.6875, dmg 4, angle 55, kg 100, bk 10, SET knockback
  // 140. The previous values (8.593/7/361/110/40) are Jigglypuff's ThrowF f10
  // verbatim; they appear identically in puffAttributes.js, where they ARE
  // correct. Fox's set-knockback field was also 0, so this hit was running the
  // growth-knockback formula instead of the set-knockback one.
  throwforwardextra : new createHitboxObject(new createHitbox(offsets[2].throwforwardextra.id0,4.687,4,55,100,10,140,0,0,1,1)),
  // The tumble-body hitbox: a character in DamageFly* damages anyone they are
  // launched into. In Melee this is a create_hitbox at frame 0 of every
  // DamageFly subaction (DamageFlyN/Hi/Lw/Top/Roll), and it is identical in all
  // five of them and across all five characters:
  //     size 4.6875, dmg 6, angle 361, kg 100, bk 30
  // The previous values (3.906/4/361/50/20) were likewise uniform, so this is
  // one shared estimate being corrected, not five separate ones.
  thrown : new createHitboxObject(new createHitbox(offsets[2].thrown.id0,4.687,6,361,100,30,0,1,0,1,1))
});


setChars(CHARIDS.FOX_ID, new charObject(CHARIDS.FOX_ID));
