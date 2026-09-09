// @flow

// Per-frame hurtbox capsules, generated from the disc by tools/gen_hurtbox.py.
//
// Melee tests hitboxes against a list of CAPSULES riding the fighter's bones,
// not against a box. Each capsule is two 3D endpoints plus a radius, and the
// endpoints move with every frame of every animation.
//
// Layout, per character:
//
//   { radii, bones, height, grabbable,       // one entry per capsule
//     frames: { STATE: [ ... ] } }           // flat, six numbers per capsule
//
// A state's array is flat rather than nested: six numbers per capsule
// (ax, ay, az, bx, by, bz), capsules in declaration order, frames one after
// another. This is the largest data in the project and the brackets of a
// nested form would cost more than the numbers do.
//
// x is Melee's X, the DEPTH axis meleelight otherwise has no notion of; y is
// vertical; z is Melee's Z, which is meleelight's horizontal. Depth is kept
// because limbs swing several units through it -- more than a hitbox's own
// radius -- so flattening it would land hits that Melee misses.

export const hurtboxData/*: any */ = [];

export function setHurtboxData(index/*: number */, val/*: any */) {
  hurtboxData[index] = val;
}

// Six numbers per capsule.
export const STRIDE = 6;

/**
 * The capsules for one character in one state on one frame, as
 * [{ a: {x,y,z}, b: {x,y,z}, r, height, grabbable }].
 *
 * `frame` is 0-based. Each table holds ONE PASS of the animation rather than
 * the whole state, because a state routinely outlives its animation -- Puff's
 * WAIT runs 464 frames over a much shorter loop. So past the end:
 *
 *   - a state in `looping` WRAPS, which is Melee replaying the animation
 *   - every other state HOLDS its last frame, which is Melee letting the
 *     animation finish and stop
 *
 * Either way this cannot index off the end, which matters because meleelight's
 * state durations are its own and do not track the animation's length.
 */
export function hurtCapsules(charId/*: number */, state/*: string */,
                             frame/*: number */)/*: any */ {
  const data = hurtboxData[charId];
  if (data === undefined) { return null; }
  const flat = data.frames[state];
  if (flat === undefined) { return null; }
  const n = data.radii.length;
  const perFrame = n * STRIDE;
  const frames = flat.length / perFrame;
  let f = frame;
  if (f < 0) { f = 0; }
  if (f >= frames) {
    f = data.looping.indexOf(state) >= 0 ? f % frames : frames - 1;
  }
  const base = f * perFrame;
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = base + i * STRIDE;
    out.push({
      a: { x: flat[o], y: flat[o + 1], z: flat[o + 2] },
      b: { x: flat[o + 3], y: flat[o + 4], z: flat[o + 5] },
      r: data.radii[i],
      height: data.height[i],
      grabbable: data.grabbable[i] === 1,
    });
  }
  return out;
}
