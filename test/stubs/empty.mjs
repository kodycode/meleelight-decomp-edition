// Stub for src/main/render.js and for unresolvable third-party packages.
// Rendering is never exercised by the physics harness.
export const lostStockQueue = [];
export const twoPi = Math.PI * 2;
export function renderPlayer() {}
export function renderForeground() {}
export function renderOverlay() {}
export function resetLostStockQueue() { lostStockQueue.length = 0; }
export function drawArrayPathCompress() {}
export function rotateVector(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}
export default {};
