//
// Melee's capsule-vs-capsule overlap test, in 3D.
//
// WHY 3D, IN A 2D GAME
// --------------------
// meleelight is 2D and everything positional here is projected to (Z, Y) --
// see tools/README.md. Hurtboxes are the one place that projection cannot be
// applied, because the axis it throws away is the one fighters use to DODGE.
//
// Melee's hurtboxes are capsules riding bones, and bones swing through the
// depth axis. Measured on the disc: a hurtbox capsule travels 3 to 8.4 units
// in X during ordinary moves -- Marth's forearm reaches 8.4 units deep during
// his forward smash, Fox's 7.4 during up-tilt. Hitbox radii are 2 to 5. So the
// depth offset is routinely LARGER than the hitbox itself, and collapsing it
// to zero would make this engine connect on hits that Melee misses.
//
// That does not make meleelight a 3D game. Both fighters sit at z = 0; every
// bit of depth comes from the animations, and the animations are baked. So the
// collision runs in 3D over data that is fully determined by a 2D game state.
//
// Ported from lbColl_80006094 (lbcollision.c:443), with its helpers
// lbColl_80005EBC (:350) and the `end` inline (:430). Structure, branch order
// and degenerate handling are the decompilation's, not a tidier equivalent:
// the clamps and the parallel-segment fallback decide real edge cases.
//
import { f32, add, sub, mul, div } from "physics/f32";

// lbcollision.h:79. Note the bound is absolute, not relative.
function approximatelyZero(x) {
  return x < f32(0.00001) && x > f32(-0.00001);
}

function clamp01(v) {
  if (v > 1.0) { return f32(1.0); }
  if (v < 0.0) { return f32(0.0); }
  return v;
}

function dot3(ax, ay, az, bx, by, bz) {
  // Grouped as the original does: (z*z) + ((x*x) + (y*y)). The order is
  // observable once each add rounds.
  return add(mul(az, bz), add(mul(ax, bx), mul(ay, by)));
}

// lbColl_80005EBC: squared distance from point p to segment a->b, and the
// parameter along the segment. There is NO guard on a degenerate segment --
// `-d1_dot_d2 / d1_dot_d1` divides by zero and the result is an infinity that
// clamp01 then pins to 1. Reproduced rather than guarded, because callers rely
// on reaching it only where it is well defined.
function closestOnSegment(ax, ay, az, bx, by, bz, px, py, pz) {
  const dx = sub(bx, ax), dy = sub(by, ay), dz = sub(bz, az);
  const ex = sub(ax, px), ey = sub(ay, py), ez = sub(az, pz);
  const dd = dot3(dx, dy, dz, dx, dy, dz);
  const de = dot3(dx, dy, dz, ex, ey, ez);
  const t = clamp01(div(-de, dd));
  const qx = sub(add(mul(dx, t), ax), px);
  const qy = sub(add(mul(dy, t), ay), py);
  const qz = sub(add(mul(dz, t), az), pz);
  return { distSq: dot3(qx, qy, qz, qx, qy, qz), t };
}

// The broadphase rejection lbColl_80006094 opens with: per axis, if one
// segment's extent plus the combined radius falls entirely outside the other's
// two endpoints, there is no overlap. Written per-axis exactly as the original,
// including that it compares against BOTH of the other segment's endpoints
// rather than against its min/max.
function separatedOnAxis(a0, a1, b0, b1, r) {
  if (a0 > a1) {
    if (add(a0, r) < b0 && add(a0, r) < b1) { return true; }
    if (sub(a1, r) > b0 && sub(a1, r) > b1) { return true; }
  } else {
    if (sub(a0, r) > b0 && sub(a0, r) > b1) { return true; }
    if (add(a1, r) < b0 && add(a1, r) < b1) { return true; }
  }
  return false;
}

/**
 * lbColl_80006094. True when the two capsules overlap.
 *
 * Each capsule is a segment plus a radius. `a` is the first segment
 * (arg0 -> arg1), `b` the second (arg2 -> arg3); the test is symmetric in
 * outcome but not in arithmetic, so the caller should keep the original order:
 * lbColl_80007AFC passes the HURT capsule first and the HIT capsule second.
 *
 * Points are {x, y, z}. In this engine x is Melee's X (depth), y is Y, and
 * z is Melee's Z, which is meleelight's horizontal.
 */
export function capsuleOverlap(a0, a1, b0, b1, rA, rB) {
  const rSum = add(f32(rA), f32(rB));

  if (separatedOnAxis(a0.x, a1.x, b0.x, b1.x, rSum)) { return false; }
  if (separatedOnAxis(a0.y, a1.y, b0.y, b1.y, rSum)) { return false; }
  if (separatedOnAxis(a0.z, a1.z, b0.z, b1.z, rSum)) { return false; }

  // d1 along segment a, d2 along segment b, e from b's start to a's start.
  const d1x = sub(a1.x, a0.x), d1y = sub(a1.y, a0.y), d1z = sub(a1.z, a0.z);
  const d2x = sub(b1.x, b0.x), d2y = sub(b1.y, b0.y), d2z = sub(b1.z, b0.z);
  const ex = sub(a0.x, b0.x), ey = sub(a0.y, b0.y), ez = sub(a0.z, b0.z);

  const d1sq = dot3(d1x, d1y, d1z, d1x, d1y, d1z);
  const d2sq = dot3(d2x, d2y, d2z, d2x, d2y, d2z);
  const d1d2 = dot3(d1x, d1y, d1z, d2x, d2y, d2z);
  const d2e = dot3(d2x, d2y, d2z, ex, ey, ez);
  const d1e = dot3(d1x, d1y, d1z, ex, ey, ez);
  const denom = sub(mul(d1sq, d2sq), mul(d1d2, d1d2));

  let s, t;
  if (approximatelyZero(d2sq)) {
    // Segment b is a point.
    if (approximatelyZero(d1sq)) {
      s = f32(0.0);
      t = f32(0.0);
    } else {
      t = f32(0.0);
      s = clamp01(div(-d1e, d1sq));
    }
  } else if (approximatelyZero(denom)) {
    // Parallel. Take whichever END of segment a is nearer b's MIDPOINT, then
    // project that end onto b. Picking by midpoint is the original's choice and
    // it is not equivalent to picking by distance to the segment.
    const mx = add(mul(f32(0.5), d2x), b0.x);
    const my = add(mul(f32(0.5), d2y), b0.y);
    const mz = add(mul(f32(0.5), d2z), b0.z);
    const s0x = sub(a0.x, mx), s0y = sub(a0.y, my), s0z = sub(a0.z, mz);
    const s1x = sub(a1.x, mx), s1y = sub(a1.y, my), s1z = sub(a1.z, mz);
    const near0 = dot3(s0x, s0y, s0z, s0x, s0y, s0z);
    const near1 = dot3(s1x, s1y, s1z, s1x, s1y, s1z);
    if (near0 < near1) {
      s = f32(0.0);
      const g = dot3(d2x, d2y, d2z, sub(b0.x, a0.x), sub(b0.y, a0.y),
                     sub(b0.z, a0.z));
      t = clamp01(div(-g, dot3(d2x, d2y, d2z, d2x, d2y, d2z)));
    } else {
      s = f32(1.0);
      const g = dot3(d2x, d2y, d2z, sub(b0.x, a1.x), sub(b0.y, a1.y),
                     sub(b0.z, a1.z));
      t = clamp01(div(-g, dot3(d2x, d2y, d2z, d2x, d2y, d2z)));
    }
  } else {
    s = div(sub(mul(d1d2, d2e), mul(d2sq, d1e)), denom);
    t = div(sub(mul(d1sq, d2e), mul(d1d2, d1e)), denom);
    if (s > 1.0 || s < 0.0 || t > 1.0 || t < 0.0) {
      // The unclamped solution left the segments. Test both ways of clamping
      // and keep the closer, which is not the same as clamping both.
      let cand0s, cand0t, cand0d;
      if (s < 0.0) {
        cand0s = f32(0.0);
        const r = closestOnSegment(b0.x, b0.y, b0.z, b1.x, b1.y, b1.z,
                                   a0.x, a0.y, a0.z);
        cand0d = r.distSq; cand0t = r.t;
      } else {
        cand0s = f32(1.0);
        const r = closestOnSegment(b0.x, b0.y, b0.z, b1.x, b1.y, b1.z,
                                   a1.x, a1.y, a1.z);
        cand0d = r.distSq; cand0t = r.t;
      }
      let cand1s, cand1d;
      if (t < 0.0) {
        t = f32(0.0);
        const r = closestOnSegment(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z,
                                   b0.x, b0.y, b0.z);
        cand1d = r.distSq; cand1s = r.t;
      } else {
        t = f32(1.0);
        const r = closestOnSegment(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z,
                                   b1.x, b1.y, b1.z);
        cand1d = r.distSq; cand1s = r.t;
      }
      if (cand0d < cand1d) {
        s = cand0s;
        t = cand0t;
      } else {
        s = cand1s;   // t keeps the 0 or 1 just assigned
      }
    }
  }

  const px = add(mul(d1x, s), a0.x);
  const py = add(mul(d1y, s), a0.y);
  const pz = add(mul(d1z, s), a0.z);
  const qx = add(mul(d2x, t), b0.x);
  const qy = add(mul(d2y, t), b0.y);
  const qz = add(mul(d2z, t), b0.z);

  // `end` (lbcollision.c:430): overlap when the gap is within the radii. The
  // comparison is `rSum*rSum < distSq -> miss`, so exactly touching counts as
  // a hit.
  const gx = sub(px, qx), gy = sub(py, qy), gz = sub(pz, qz);
  return !(mul(rSum, rSum) < dot3(gx, gy, gz, gx, gy, gz));
}
