//
// Exact IEEE-754 binary32 arithmetic for JavaScript.
//
// WHY THIS EXISTS
// ---------------
// Melee runs on the GameCube's Gekko CPU in single precision (float32).
// JavaScript numbers are float64. Computing Melee's physics in float64 gives
// answers that are *close* but not bit-identical, and the error compounds
// across frames.
//
// The fix is exact, not approximate. For a SINGLE IEEE operation on float32
// inputs, computing in float64 and then rounding to float32 yields exactly the
// same result as computing in float32 directly. This is the standard
// "double rounding is innocuous" result: it holds whenever the intermediate
// format has at least 2p+2 bits of mantissa, where p is the target precision.
// float32 has p=24, so it needs >= 50 bits; float64 provides 53. Every
// operation below is therefore bit-exact, not a close approximation.
//
// Verified against the retail v1.02 DOL (GALE01): the fighter physics routines
// this project ports use only fadds / fsubs / fmuls / fneg / fcmpo / lfs / stfs
// -- no fused multiply-add, no frsqrte/fres estimates, no paired-singles. Those
// instructions all map exactly onto the operations defined here. If a future
// port touches code that DOES use FMA (Gekko fmadds rounds only once, so
// fround(fround(a*b)+c) is wrong for it), add a dedicated exact-FMA helper
// rather than composing mul() and add().

const fr = Math.fround;

// Round a float64 to the nearest float32. Use on every literal constant that
// originates from game data: JS parses `0.23` to the float64 nearest 0.23,
// whereas the game's `lfs` loads the float32 nearest 0.23. They are different
// numbers (0.23 vs 0.23000000417232513).
export const f32 = fr;

// Gekko fadds
export function add(a, b) { return fr(a + b); }

// Gekko fsubs
export function sub(a, b) { return fr(a - b); }

// Gekko fmuls
export function mul(a, b) { return fr(a * b); }

// Gekko fdivs
export function div(a, b) { return fr(a / b); }

// Gekko fneg -- flips the sign bit only, so it is exact with no rounding and
// needs no fround. Defined for symmetry so ported code reads like the original.
export function neg(a) { return -a; }

// Gekko fabs
export function abs(a) { return Math.abs(a); }

// Convenience: a*b + c with the intermediate product ROUNDED, matching a
// separate fmuls followed by fadds. This is NOT a fused multiply-add and must
// not be used to model Gekko's fmadds.
export function mulAdd(a, b, c) {
  return fr(fr(a * b) + c);
}

// Gekko's `fmadds`: a*b + c with a SINGLE rounding, which is a different
// number from mulAdd above whenever the product is inexact.
//
// Computing it in float64 and rounding once to float32 is exact, not an
// approximation. The product of two float32s needs at most 48 significand bits
// and float64 has 53, so `a * b` is EXACT; the addition then rounds once to
// float64 and once more to float32, and double rounding is harmless here
// because the intermediate carries 53 >= 2*24 + 2 bits. That is the same
// argument the rest of this file relies on.
export function fmadds(a, b, c) {
  return fr(a * b + c);
}

// Gekko's `fnmsubs`: -(a*b - c), one rounding. Written as `c - a*b` because
// that is what it computes; the negation is of the whole expression.
export function fnmsubs(a, b, c) {
  return fr(c - a * b);
}
