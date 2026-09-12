// Stub for src/main/characters.js.
//
// The important part: setCharAttributes is a real capture, not a no-op. Import
// e.g. "characters/fox/attributes" and this records the character's ACTUAL
// attribute table, so tests run against the same numbers the app would use
// rather than against values retyped into the test.

export const capturedAttributes = {};

// The REAL values from src/main/characters.js, not a name-returning Proxy.
//
// This used to be `new Proxy({}, { get: (_, k) => String(k) })` on the grounds
// that "ids are only ever used as table keys here". That stopped being true
// when staleMoveIds.js arrived: it is keyed by the numeric id, so a stubbed
// "FOX_ID" silently missed every lookup and returned FtMoveId_Default for
// everything -- which reads as "all moves are the same move", not as an error.
// Keeping the stub honest is cheaper than the assertion that caught it.
export const CHARIDS = {
  MARTH_ID: 0,
  PUFF_ID: 1,
  FOX_ID: 2,
  FALCO_ID: 3,
  FALCON_ID: 4,
};

export function setCharAttributes(id, attrs) {
  capturedAttributes[id] = Object.assign(capturedAttributes[id] || {}, attrs);
}

// Everything else the attribute files import, neutered.
// The attribute files also populate deep hitbox-offset tables
// (offsets[id].nair1.id0.push(...)). Auto-vivify so those writes are harmless.
function autoVivify() {
  const t = {};
  return new Proxy(t, {
    get(target, k) {
      if (typeof k === "symbol") return undefined;
      if (k === "push" || k === "pop" || k === "unshift") return () => {};
      if (k === "length") return 0;
      if (!(k in target)) target[k] = autoVivify();
      return target[k];
    },
    set(target, k, v) { target[k] = v; return true; },
    has() { return true; },
  });
}
export const offsets = autoVivify();
export function charObject() { return {}; }
export function setChars() {}
export function setHitBoxes() {}
export function setIntangibility() {}
export function setActionSounds() {}
export function setFrames() {}
export function setOffsets() {}

export const intangibility = new Proxy({}, { get: () => [] });
export const actionSounds = new Proxy({}, { get: () => new Proxy({}, { get: () => [] }) });
export const framesData = new Proxy({}, { get: () => ({}) });
export const ecb = new Proxy({}, { get: () => [] });

// Character table -- playerObject reads chars[i].attributes / .hitboxes.
export const chars = new Proxy({}, {
  get: () => ({ attributes: {}, hitboxes: {} }),
});
export function setEcbData() {}
