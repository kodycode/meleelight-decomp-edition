//
// Melee's own float32 trigonometry, ported from the decompilation.
//
// WHY NOT Math.sin / Math.cos
// ---------------------------
// Math.sin computes in float64. Math.fround(Math.sin(x)) is therefore a DOUBLE
// rounding of the exact result, whereas the console performs a single rounding
// to float32 -- and, more importantly, the console does not compute the exact
// result at all. It runs Metrowerks' polynomial approximation.
//
// So matching the hardware does not mean "round Math.sin better". It means
// running the same polynomial. That is what this file does, and because every
// operation in it is a float32 +, - or *, the whole thing is bit-exact via
// Math.fround -- no approximation ceiling.
//
// Source: src/MSL/trigf.c (sinf at :24, cosf at :68)
// Tables: src/MSL/math_data.c (__sincos_on_quadrant :69, __sincos_poly :71)
//
// atanf, atan2f, acosf and asinf are further down. They have no source in the
// decomp at all and were disassembled out of the retail DOL instead -- see the
// header above them.

import { f32, add, sub, mul, div, fmadds, fnmsubs } from "physics/f32";
import { frsqrte } from "physics/gekko";

// src/MSL/math_data.c:69
const ON_QUADRANT = [0, 1, 1, 0, 0, -1, -1, 0];

// src/MSL/math_data.c:71
const POLY = [
  0.0000035287617, 0.0000003089747, -0.0003259365,
  -0.00003657235, 0.015854323, 0.0024903931,
  -0.30842513, -0.08074551, 1,
  0.7853982,
].map(Math.fround);

// trigf.c:10 -- copied into __four_over_pi_m1 by the static initialiser at :14.
const FOUR_OVER_PI_M1 = [
  0.25, 0.0232393741608, 1.70555722434e-7, 1.86736494323e-11,
].map(Math.fround);

const EPSILON = Math.fround(3.45266983e-4);          // trigf.c:3
const TWO_OVER_PI = f32(2.0 / Math.fround(Math.PI)); // trigf.c:31, (2.0f/(f32)M_PI)

// __HI(x) -- the raw high word, used only for its sign bit. Going through the
// actual bit pattern (rather than `x < 0`) matters for negative zero.
const _fbuf = new Float32Array(1);
const _ibuf = new Int32Array(_fbuf.buffer);
function hiWord(x) {
  _fbuf[0] = x;
  return _ibuf[0];
}

// Shared argument reduction from trigf.c:31-36 / :75-80.
// Returns { n, y } with n already masked to 0..3.
function reduce(x) {
  const z = mul(TWO_OVER_PI, x);
  // C truncates toward zero on the float->int cast.
  const n0 = (hiWord(x) & 0x80000000)
    ? Math.trunc(sub(z, f32(0.5)))
    : Math.trunc(add(z, f32(0.5)));

  // y = x - n*2 + a0*x + a1*x + a2*x + a3*x, evaluated left to right.
  let y = sub(x, f32(n0 * 2));
  y = add(y, mul(FOUR_OVER_PI_M1[0], x));
  y = add(y, mul(FOUR_OVER_PI_M1[1], x));
  y = add(y, mul(FOUR_OVER_PI_M1[2], x));
  y = add(y, mul(FOUR_OVER_PI_M1[3], x));

  return { n: n0 & 3, y };
}

// Horner evaluation of the even-index polynomial (POLY[0,2,4,6,8]).
function polyEven(ysq) {
  let z = add(mul(POLY[0], ysq), POLY[2]);
  z = add(mul(z, ysq), POLY[4]);
  z = add(mul(z, ysq), POLY[6]);
  z = add(mul(z, ysq), POLY[8]);
  return z;
}

// Horner evaluation of the odd-index polynomial (POLY[1,3,5,7,9]), times y.
function polyOdd(ysq, y) {
  let z = add(mul(POLY[1], ysq), POLY[3]);
  z = add(mul(z, ysq), POLY[5]);
  z = add(mul(z, ysq), POLY[7]);
  z = add(mul(z, ysq), POLY[9]);
  return mul(z, y);
}

// Port of sinf (decomp: src/MSL/trigf.c:24).
export function sinf(x) {
  const { n, y } = reduce(f32(x));

  if (Math.abs(y) < EPSILON) {
    const i = n << 1;
    return add(ON_QUADRANT[i], mul(mul(ON_QUADRANT[i + 1], y), POLY[9]));
  }

  const ysq = mul(y, y);
  if (n & 1) {
    return mul(polyEven(ysq), ON_QUADRANT[n << 1]);
  }
  return mul(polyOdd(ysq, y), ON_QUADRANT[(n << 1) + 1]);
}

// Port of cosf (decomp: src/MSL/trigf.c:68).
export function cosf(x) {
  const { n, y } = reduce(f32(x));

  if (Math.abs(y) < EPSILON) {
    const i = n << 1;
    return sub(ON_QUADRANT[i + 1], mul(y, ON_QUADRANT[i]));
  }

  const ysq = mul(y, y);
  if (n & 1) {
    return mul(-polyOdd(ysq, y), ON_QUADRANT[n << 1]);
  }
  return mul(polyEven(ysq), ON_QUADRANT[(n << 1) + 1]);
}

// Port of tanf (decomp: src/MSL/trigf.c:126).
export function tanf(x) {
  return f32(sinf(x) / cosf(x));
}

// ---------------------------------------------------------------------------
// atanf / atan2f / acosf / asinf
//
// These were long recorded here as PERMANENTLY BLOCKED: src/MSL/math.h:75
// declares them but no definition appears anywhere in src/MSL/*.c, and the
// decomp ships no assembly for them either. That conclusion was wrong, and it
// was wrong because it only ever asked the decomp.
//
// The retail DOL has the compiled functions, and the decomp's own symbol map
// gives their addresses:
//
//     atanf  = .text:0x80022E68   size 0x1F4
//     atan2f = .text:0x80022C30   size 0x0EC
//     acosf  = .text:0x80022D1C   size 0x0A0
//     asinf  = .text:0x80022DBC   size 0x03C
//
// so they can simply be disassembled. Everything below is transcribed from that
// disassembly, with the constants read out of the DOL rather than guessed:
// r2 (the SDA2 base) is 0x804DF9E0, set by __init_registers at 0x80005340, so
// `lfs f0, -0x7c30(r2)` is the float at 0x804D7DB0.
//
// Every operation is a float32 +, -, * or /, or a Gekko fused multiply-add, so
// this is bit-exact rather than merely close.
// ---------------------------------------------------------------------------

// The coefficient table at 0x803B7300. atanf indexes columns by segment with
// `r4 + seg*4`, and reaches a slot at seg = -1 whose entries are zero -- that
// is the "no range reduction" case, not an out-of-bounds read, so it is
// spelled out here as index 0 of a shifted array rather than reproduced by
// pointer arithmetic.
const ATAN_POLY = [                       // +0x04 .. +0x18
  -0.3333333134651184, 0.1999988704919815, -0.14281649887561798,
  0.11041180044412613, -0.08459755778312683, 0.04714243486523628,
].map(Math.fround);

// Indexed by segment + 1, so entry 0 is the seg = -1 slot.
const ATAN_A = [0, 6.828420162200928, 3.239828109741211, 2.0,               // +0x1c
                1.4464620351791382, 1.1715729236602783].map(Math.fround);
const ATAN_B = [0, 7.1350000325764995e-06, 8.200000252145401e-07, 0.0,      // +0x34
                6.299999881775875e-07, 0.0].map(Math.fround);
const ATAN_C = [0, 0.3926900029182434, 0.5890486240386963, 0.7853981256484985,
                0.9817469716072083, 1.1780970096588135].map(Math.fround);   // +0x50
const ATAN_D = [0, 9.081698408408556e-06, 2.3000000126671694e-08,           // +0x6c
                6.30000016599297e-08, 7.040000014058023e-07,
                2.499999993688107e-07].map(Math.fround);
const ATAN_E = [0, 2.414212942123413, 1.4966057538986206, 1.0,              // +0x84
                0.6681786179542542, 0.4142135679721832].map(Math.fround);
const ATAN_F = [0, 5.620000251838064e-07, 0.0, 0.0, 0.0, 0.0].map(Math.fround);

const ATAN_HI = f32(2.4142136573791504);   // 0x804D7DD0, cot(pi/8)
const ATAN_LO = f32(0.4142135679721832);   // 0x804D7DD4, tan(pi/8)
// Exported because gameplay code needs the same float32 pi the DOL uses --
// Melee's HALF_PI32 / M_PI_2_F, not Math.PI/2 rounded at the use site.
export const HALF_PI = f32(1.5707963705062866);   // 0x804D7DC0
export const PI_F = f32(3.1415927410125732);      // 0x804D7DB8

// MTXDegToRad(a) is `((a) * 0.01745329252f)` -- extern/dolphin/include/dolphin/mtx.h:59.
// A literal, not a derived pi/180, and it is applied as a float32 MULTIPLY.
// Every angle Melee stores in degrees (hitbox trajectories, Puff's rollout
// tilt, the Sakurai-angle ramp) comes through this.
export const DEG_TO_RAD = f32(0.01745329252);
export function mtxDegToRad(deg) { return mul(f32(deg), DEG_TO_RAD); }

// The float whose BITS are 0x3FC90FDB, i.e. pi/2. atan2f builds its result for
// x == 0 by adding the sign bit to this integer, so it is kept as an integer.
const BITS_PI_2 = 0x3fc90fdb;

function bitsOf(x) {
  _fbuf[0] = x;
  return _ibuf[0];
}

function fromBits(i) {
  _ibuf[0] = i | 0;
  return _fbuf[0];
}

// Port of atanf (DOL 0x80022E68).
//
// Three cases by magnitude, then one shared odd polynomial in z:
//   |x| >= cot(pi/8)   ->  z = 1/|x|,  answer folded about pi/2 at the end
//   |x| <= tan(pi/8)   ->  z = |x|,    no reduction
//   otherwise          ->  z = (|x| - t)/(1 + |x|*t) for the nearest of five
//                          tabulated angles, and that angle added back
//
// The middle case picks its segment from the raw EXPONENT FIELD and two
// integer comparisons against float bit patterns, not from a floating-point
// compare -- reproduced literally, because the boundaries are exactly where
// those bit patterns fall.
export function atanf(x) {
  x = f32(x);
  const bits = bitsOf(x);
  const sign = bits & -0x80000000;          // 0x80000000 without the overflow
  const mag = bits & 0x7fffffff;
  const ax = fromBits(mag);

  let seg = -1;
  let recip = false;
  let z;

  if (ax >= ATAN_HI) {
    recip = true;
    z = div(f32(1.0), ax);
  } else if (ATAN_LO >= ax) {
    z = ax;
  } else {
    const exp = mag & 0x7f800000;
    seg = 0;
    if (exp === 0x3f800000) {               // |x| in [1, 2)
      seg = 2;
      if (mag >= 0x3f9bf7ec) {
        seg = 3;
      }
      if (mag >= 0x3fef789e) {
        seg += 1;
      }
    } else if (exp > 0x3f800000) {
      if (exp === 0x40000000) {
        seg = 4;
      }
    } else if (exp === 0x3f000000) {        // |x| in [0.5, 1)
      seg = 0;
      if (mag >= 0x3f08d5b9) {
        seg = 1;
      }
      if (mag >= 0x3f521801) {
        seg += 1;
      }
    }
    const k = seg + 1;
    // w = 1 / (E + (|x| + F)), rounded to float32 before being used again --
    // the original stores it and reloads it, and that rounding is observable.
    const w = div(f32(1.0), add(ATAN_E[k], add(ax, ATAN_F[k])));
    z = add(fnmsubs(w, ATAN_A[k], ATAN_E[k]), fnmsubs(w, ATAN_B[k], ATAN_F[k]));
  }

  const k = seg + 1;
  const zsq = mul(z, z);
  let p = fmadds(zsq, ATAN_POLY[5], ATAN_POLY[4]);
  const zcu = mul(z, zsq);
  p = fmadds(zsq, p, ATAN_POLY[3]);
  p = fmadds(zsq, p, ATAN_POLY[2]);
  p = fmadds(zsq, p, ATAN_POLY[1]);
  p = fmadds(zsq, p, ATAN_POLY[0]);
  let r = fmadds(zcu, p, z);
  r = add(r, ATAN_D[k]);
  r = add(r, ATAN_C[k]);

  if (recip) {
    // atan(x) = +-pi/2 - atan(1/x); the sign of x decides which.
    const t = sub(r, HALF_PI);
    return sign === 0 ? -t : t;
  }
  return fromBits(bitsOf(r) | sign);
}

// Port of atan2f (DOL 0x80022C30). Branches on the SIGN BITS of the two
// arguments rather than on their values, which is why -0.0 behaves differently
// from 0.0 here.
export function atan2f(y, x) {
  y = f32(y);
  x = f32(x);
  const sx = bitsOf(x) & -0x80000000;
  const sy = bitsOf(y) & -0x80000000;

  if (sx === sy) {
    if (sx !== 0) {
      // Both negative. The -0.0 test is a VALUE compare against -0.0, which is
      // true for +0.0 too, so x == 0 with both signs set lands here.
      return x === f32(-0.0) ? f32(-1.5707963705062866)
                             : sub(atanf(div(y, x)), PI_F);
    }
    return x !== f32(0.0) ? atanf(div(y, x)) : HALF_PI;
  }

  if (x < f32(0.0)) {
    return add(PI_F, atanf(div(y, x)));
  }
  if (x !== f32(0.0)) {
    return atanf(div(y, x));
  }
  // x is zero and the signs differ: copysign(pi/2, y), built by integer add.
  return fromBits((sy + BITS_PI_2) | 0);
}

// Port of acosf (DOL 0x80022D1C): pi/2 - atanf(x / sqrt(1 - x*x)), with the
// reciprocal square root done by frsqrte plus three Newton-Raphson steps --
// the same sequence as sqrtf in gekko.js, and the reason acosf is not simply
// Math.acos rounded.
export function acosf(x) {
  x = f32(x);
  const s = fnmsubs(x, x, f32(1.0));        // 1 - x*x
  let inv;
  if (s > f32(0.0)) {
    let g = f32(frsqrte(s));
    for (let i = 0; i < 3; i++) {
      const gg = mul(g, g);
      const half = mul(f32(0.5), g);
      g = mul(half, fnmsubs(s, gg, f32(3.0)));
    }
    inv = g;
  } else if (s !== f32(0.0)) {
    inv = NaN;                              // |x| > 1: bits 0x7FFFFFFF
  } else {
    inv = Infinity;                         // |x| == 1: bits 0x7F800000
  }
  return sub(HALF_PI, atanf(mul(x, inv)));
}

// Port of lb_8000D008 (lbcommon), Melee's own atan2. It is NOT atan2f: it
// handles the quadrants itself on top of atanf, and its special cases differ.
//
//   |x| ~ 0 and |y| ~ 0   ->  0
//   |x| ~ 0               ->  +-pi/2 by the sign of y
//   x > 0                 ->  atanf(y/x)
//   x < 0                 ->  +-(pi - atanf(|y/x|)) by the sign of y
//
// "~ 0" is the same 1e-5 window `approximatelyZero` uses elsewhere, so an x of
// 1e-6 takes the vertical branch rather than dividing.
//
// The two constant expressions are evaluated in DOUBLE and then stored to a
// float -- `(f32)((M_PI / 2) * (f64) sign)` and `(f32)((f64) sign * (M_PI -
// atanf(...)))` -- so they use double pi, not the float32 pi the rest of this
// file uses. That is a visible difference in the last bits and is reproduced.
export function meleeAtan2(y, x) {
  y = f32(y);
  x = f32(x);
  if (x < f32(0.00001) && x > f32(-0.00001)) {
    if (y < f32(0.00001) && y > f32(-0.00001)) {
      return f32(0.0);
    }
    return f32((Math.PI / 2) * (y < 0 ? -1 : 1));
  }
  if (x > f32(0.0)) {
    return atanf(div(y, x));
  }
  // x < 0
  let q = div(y, x);
  if (q < f32(0.0)) { q = -q; }
  return f32((y < 0 ? -1 : 1) * (Math.PI - atanf(q)));
}

// Port of asinf (DOL 0x80022DBC): atanf(x * (1/sqrt(1 - x*x))), reusing the
// same reciprocal square root acosf uses.
export function asinf(x) {
  x = f32(x);
  const s = fnmsubs(x, x, f32(1.0));
  let inv;
  if (s > f32(0.0)) {
    let g = f32(frsqrte(s));
    for (let i = 0; i < 3; i++) {
      const gg = mul(g, g);
      const half = mul(f32(0.5), g);
      g = mul(half, fnmsubs(s, gg, f32(3.0)));
    }
    inv = g;
  } else if (s !== f32(0.0)) {
    inv = NaN;
  } else {
    inv = Infinity;
  }
  return atanf(mul(x, inv));
}

// ---------------------------------------------------------------------------
// expf / logf / powf
//
// Like atan2f, these are declared in src/MSL/math.h and defined nowhere in the
// decomp, so they were read out of the retail DOL:
//
//   powf = .text:0x8000CEE0; // size:0x94
//   expf = .text:0x8000CE50; // size:0x90
//
// Both are naive series summed in SINGLE precision (fadds/fmuls/fdivs), run
// until the running sum stops changing. That termination test is the whole
// reason these are ported rather than routed to Math.exp/Math.log: the answer
// is not the correctly-rounded one, it is whatever a float32 series happens to
// converge to, and the two differ in the last bits.
//
// The `(double)k` in each loop is Metrowerks' magic-number int-to-double
// (0x43300000 / k^0x80000000, minus 2^52+2^31) followed by `fsubs`, so k
// arrives as an exact single. Reproduced here as plain arithmetic since every
// k involved is far too small to lose anything.

/**
 * expf (DOL 0x8000CE50). Taylor series, float32 throughout:
 *
 *     sum = 1 + x;  term = x;  fact = 1;
 *     for (k = 2; sum changes; k++) { term *= x; fact *= k; sum += term/fact; }
 *
 * Negative arguments are computed as 1/expf(-x), not by summing an alternating
 * series -- see the `fneg`/`fdivs` pair around the loop.
 *
 * The loop always terminates: `fact` is a float32, so by k = 35 it has
 * overflowed to +inf, term/fact is 0, and the sum stops moving.
 */
export function expf(x) {
  x = f32(x);
  let negate = false;
  if (x < f32(0.0)) { x = -x; negate = true; }

  let term = x;             // f4
  let fact = f32(1.0);      // f6
  let sum = add(f32(1.0), x); // f3
  for (let k = 2; ; k++) {
    const prev = sum;
    term = mul(term, x);
    fact = mul(fact, f32(k));
    sum = add(sum, div(term, fact));
    if (sum === prev) { break; }
    if (k > 4096) { break; } // unreachable in float32; guards a NaN argument
  }
  return negate ? div(f32(1.0), sum) : sum;
}

/**
 * logf, as inlined into powf (DOL 0x8000CEEC..0x8000CF58). Not the MSL `logf`
 * symbol -- powf carries its own copy, an atanh series:
 *
 *     u = (x - 1) / (x + 1);
 *     sum = u;  term = u;
 *     for (k = 3; sum changes; k += 2) { term *= u*u; sum += term/k; }
 *     return 2 * sum;
 *
 * Converges for x > 0 because |u| < 1 there. powf's only guard is `x == 0`,
 * so a negative base gives |u| > 1 and the series runs away -- Melee never
 * calls it with one.
 */
export function logf(x) {
  x = f32(x);
  const u = div(sub(x, f32(1.0)), add(f32(1.0), x)); // f6
  const usq = mul(u, u);                             // f5
  let term = u;
  let sum = u;                                       // f4
  for (let k = 3; ; k += 2) {
    const prev = sum;
    term = mul(term, usq);
    sum = add(sum, div(term, f32(k)));
    if (sum === prev) { break; }
    if (k > 8192) { break; }
  }
  return mul(f32(2.0), sum);
}

/**
 * powf (DOL 0x8000CEE0): `expf(y * logf(x))`, with one special case.
 *
 * That special case is `x == 0 -> return 0`, tested BEFORE anything else and
 * with no companion test on y, so Melee's powf(0, 0) is 0 rather than the 1
 * that C99 and Math.pow both give.
 *
 * Note also what is NOT here: no integer-exponent fast path. Melee's one
 * gameplay call site passes an integer exponent (the walljump count,
 * ftCo_PassiveWall.c:146) but still goes the long way round through exp/log,
 * so powf(0.975, 3) is not 0.975*0.975*0.975.
 */
export function powf(x, y) {
  x = f32(x);
  y = f32(y);
  if (x === f32(0.0)) { return f32(0.0); }
  return expf(mul(y, logf(x)));
}
