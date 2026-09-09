// @flow
//
// Gekko-specific floating point instructions that have no JavaScript
// equivalent, and the MSL library functions built on top of them.
//
// The GameCube's CPU is a PowerPC 750CXe derivative ("Gekko"). Most of its
// float arithmetic is plain IEEE-754, which `physics/f32.js` already covers by
// rounding each result with Math.fround. Two instructions are not: `frsqrte`
// and `fres` produce deliberately LOW-PRECISION estimates from a hardware
// lookup table, and their exact output is part of the architecture. Melee's
// sqrtf is built on frsqrte, so reproducing sqrtf means reproducing the table.

import { f32 } from "./f32";

// frsqrte's lookup table, indexed by the high bits of the mantissa plus a
// 16-entry offset for odd exponents. Each entry gives a base value and a
// per-step decrement, so the estimate is piecewise linear in the mantissa.
//
// Every entry is checked by test/physics.test.mjs against the architectural
// guarantee -- the estimate must be within 1/32 relative error of the true
// reciprocal square root -- sampled across all 32 segments. A wrong base or
// decrement moves that segment's line off the curve and breaks the bound.
const FRSQRTE_BASE = [
  0x3ffa000, 0x3c29000, 0x38aa000, 0x3572000,
  0x3279000, 0x2fb7000, 0x2d26000, 0x2ac0000,
  0x2881000, 0x2665000, 0x2468000, 0x2287000,
  0x20c1000, 0x1f12000, 0x1d79000, 0x1bf4000,
  0x1a7e800, 0x17cb800, 0x1552800, 0x130c000,
  0x10f2000, 0x0eff000, 0x0d2e000, 0x0b7c000,
  0x09e5000, 0x0867000, 0x06ff000, 0x05ab000,
  0x0468000, 0x0336000, 0x0213000, 0x00fe000,
];
const FRSQRTE_DEC = [
  0x7a4, 0x700, 0x670, 0x5f2,
  0x584, 0x524, 0x4cc, 0x47e,
  0x43a, 0x3fa, 0x3c2, 0x38e,
  0x35e, 0x332, 0x30a, 0x2e6,
  0x2c4, 0x284, 0x24a, 0x218,
  0x1e8, 0x1c4, 0x1a0, 0x180,
  0x164, 0x14a, 0x134, 0x11c,
  0x10c, 0x0fa, 0x0ea, 0x0da,
];

const P32 = 0x100000000;         // 2^32
const P52 = 4503599627370496;    // 2^52
const P37 = 137438953472;        // 2^37
const P26 = 67108864;            // 2^26

// One scratch buffer. Explicitly big-endian so the byte order does not depend
// on the host: typed-array views over an ArrayBuffer use platform endianness,
// DataView does not.
const BITS = new DataView(new ArrayBuffer(8));

/**
 * `frsqrte` -- reciprocal square root ESTIMATE.
 *
 * Not 1/sqrt(x). The architecture only promises the result is within 1/32 of
 * it; the exact value comes from the table above. Melee's sqrtf feeds this to
 * Newton-Raphson, so this function's output is a real input to the game's
 * arithmetic, not an implementation detail.
 */
export function frsqrte (x /*: number */) /*: number */ {
  BITS.setFloat64(0, x);
  const hi = BITS.getUint32(0);
  const lo = BITS.getUint32(4);

  const negative = (hi & 0x80000000) !== 0;
  let exp = (hi >>> 20) & 0x7FF;
  // The 52-bit mantissa exceeds 32 bits, so it is carried as a Number. Every
  // value here is below 2^53, where integer arithmetic on doubles is exact.
  let mant = (hi & 0xFFFFF) * P32 + lo;

  if (exp === 0 && mant === 0) { return negative ? -Infinity : Infinity; }
  if (exp === 0x7FF) {
    if (mant !== 0) { return x; }                  // NaN propagates
    return negative ? NaN : 0;                     // 1/sqrt(+inf) -> +0
  }
  if (negative) { return NaN; }

  if (exp === 0) {
    // Denormal: shift the mantissa up until the implicit bit appears, paying
    // for it in the exponent, then drop that bit again.
    do { exp -= 1; mant *= 2; } while (mant < P52);
    mant -= P52;
    exp += 1;
  }

  // The table is split by the parity of the exponent because sqrt halves it:
  // an odd exponent leaves a factor of 2 that the mantissa segment absorbs.
  const oddExponent = (exp & 1) === 0;

  // Biased exponent of the result. Derived from
  //   (0x3FF << 52) - ((E << 52) - (0x3FE << 52)) / 2   masked to 11 bits,
  // which in units of E is floor((0xBFC - E) / 2).
  let outExp = Math.floor((0xBFC - exp) / 2) & 0x7FF;

  const i = Math.floor(mant / P37);                // top 15 bits of mantissa
  const index = Math.floor(i / 2048) + (oddExponent ? 16 : 0);
  const frac = FRSQRTE_BASE[index] - FRSQRTE_DEC[index] * (i % 2048);

  // frac occupies bits 26..51 of the result mantissa; the low 26 bits are zero.
  const outMant = frac * P26;
  const outHi = (outExp << 20) | Math.floor(outMant / P32);
  const outLo = outMant % P32;
  BITS.setUint32(0, outHi >>> 0);
  BITS.setUint32(4, outLo >>> 0);
  return BITS.getFloat64(0);
}

/**
 * Melee's sqrtf, verbatim from src/MSL/math_ppc.h:11.
 *
 *     extern inline float sqrtf(float x) {
 *         volatile float y;
 *         if (x > 0.0f) {
 *             double guess = __frsqrte((double) x);
 *             guess = 0.5 * guess * (3.0 - guess * guess * x);   // 12 bits
 *             guess = 0.5 * guess * (3.0 - guess * guess * x);   // 24 bits
 *             guess = 0.5 * guess * (3.0 - guess * guess * x);   // 32 bits
 *             y = (float) (x * guess);
 *             return y;
 *         }
 *         return x;
 *     }
 *
 * Every intermediate is DOUBLE, which JavaScript gives natively, so only the
 * final store to `volatile float y` rounds -- hence a single f32() at the end
 * and none in between. Adding rounding to the iterations would be wrong.
 *
 * Three Newton-Raphson steps take the estimate's 2^-5 relative error down to
 * roughly 2^-36, comfortably finer than float32's 2^-24, so this agrees with a
 * correctly rounded square root except where the true result sits within
 * ~2^-36 of a float32 rounding boundary. Those cases are the entire reason
 * this exists: that is where Melee's arithmetic and Math.sqrt part company.
 *
 * Note `x > 0.0f` -- not `>= 0`. Negative x and -0 are returned unchanged, and
 * for -0 that is also the right answer.
 */
export function sqrtf (x /*: number */) /*: number */ {
  if (x > 0) {
    let guess = frsqrte(x);
    guess = 0.5 * guess * (3.0 - guess * guess * x);
    guess = 0.5 * guess * (3.0 - guess * guess * x);
    guess = 0.5 * guess * (3.0 - guess * guess * x);
    return f32(x * guess);
  }
  return x;
}
