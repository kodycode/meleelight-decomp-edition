// @flow

// Move staling. Port of melee/pl/plstale.c plus ft_80089118 / ft_80089228
// (src/melee/ft/ft_0881.c:339, :363).
//
// meleelight had none of this. `getKnockback(hb, damagestaled, damageunstaled,
// ...)` already carried both parameters, but every one of its three call sites
// passed the same number for both, so the distinction the signature promised
// was never actually made anywhere.
//
// WHAT STALES WHAT. Melee keeps a ten-entry ring of the moves you have landed,
// and a move's damage is reduced once for each time it appears in the nine most
// recent, weighted by how recently. The weights live in a table the fighter
// code reaches through a pointer (Fighter_804D6548 = ftLoadCommonData[3], read
// out of PlCo.dat) rather than in ftCommonData, which is why they are here and
// not in meleeCommon.js.
//
// The KNOCKBACK is not staled -- only the damage, and through it the percent.
// That asymmetry is why the two damage values are threaded separately.

import { f32, sub, mul } from "physics/f32";
import { STALE_MOVE_IDS, FT_MOVE_ID_DEFAULT } from "physics/staleMoveIds";

// Fighter_804D6548, nine floats at PlCo.dat ftLoadCommonData[3]. Index 0 is
// the MOST RECENT entry in the walk-back, index 8 the oldest. They sum to
// 0.45, so a move landed nine times running does 55% damage.
//
// The array is exactly nine long: the tenth float at that address is 100.0,
// the start of an unrelated table, which is a useful check that the loop bound
// of 9 in ft_80089118 is the real extent and not a coincidence.
export const STALE_WEIGHTS = [
  0.09000000357627869,
  0.07999999821186066,
  0.07000000029802322,
  0.05999999865889549,
  0.05000000074505806,
  0.03999999910593033,
  0.029999999329447746,
  0.019999999552965164,
  0.009999999776482582,
];

export const STALE_TABLE_SIZE = 10;   // StaleMoveTable::StaleMoves[10]
export const STALE_LOOKBACK = 9;      // the loop bound in ft_80089118

/** plStale_ResetStaleMoveTableForPlayer (plstale.c:20). */
export function newStaleTable()/*: any */ {
  const moves = [];
  for (let i = 0; i < STALE_TABLE_SIZE; i++) {
    moves.push({ id: 0, instance: 0 });
  }
  return { moves: moves, index: 0 };
}

export function resetStaleTable(t/*: any */)/*: void */ {
  t.index = 0;
  for (let i = 0; i < STALE_TABLE_SIZE; i++) {
    t.moves[i].id = 0;
    t.moves[i].instance = 0;
  }
}

// plStale_IncrementAttackInstance (plstale.c:31). A u16 that skips 0 on wrap,
// because 0 is the "empty slot" marker in the table.
let attackInstance = 1;

export function resetAttackInstance()/*: void */ { attackInstance = 1; }

export function nextAttackInstance()/*: number */ {
  const before = attackInstance;
  attackInstance = (attackInstance + 1) & 0xFFFF;
  if (attackInstance === 0) { attackInstance = 1; }
  return before;
}

/**
 * ft_80089118 (ft_0881.c:339). The damage multiplier for `moveId`.
 *
 *   i = index != 0 ? index - 1 : 9;          // start at the newest entry
 *   for (n = 0; n < 9; n++) {
 *       if (table[i].move_id == 0) return m; // an empty slot ends the walk
 *       if (table[i].move_id == moveId) m -= weights[n];
 *       i = i != 0 ? i - 1 : 9;
 *   }
 *
 * Two details that are easy to lose:
 *  - the weight index is the LOOP counter, not the slot, so it measures how
 *    far back the walk has gone rather than where the entry sits in the ring;
 *  - an empty slot STOPS the walk outright. Since the ring is written in order
 *    that only happens before it has filled, but it means a fresh table short-
 *    circuits instead of scanning nine zeros.
 */
export function staleMultiplier(table/*: any */, moveId/*: number */)/*: number */ {
  if (moveId === FT_MOVE_ID_DEFAULT) { return f32(1.0); }
  let m = f32(1.0);
  let i = table.index !== 0 ? table.index - 1 : STALE_TABLE_SIZE - 1;
  for (let n = 0; n < STALE_LOOKBACK; n++) {
    const slot = table.moves[i];
    if (slot.id === 0) { return m; }
    if (slot.id === moveId) { m = sub(m, STALE_WEIGHTS[n]); }
    i = i !== 0 ? i - 1 : STALE_TABLE_SIZE - 1;
  }
  return m;
}

/**
 * plStale_UpdateStaleMovesFromFighter (plstale.c:41). Records a landed hit.
 *
 * The (id, instance) pair is checked against ALL TEN slots first and dropped if
 * already present. That is what stops a multi-hit move -- or one swing that
 * connects with two opponents -- from staling more than once: every hit of one
 * swing shares an attack instance.
 */
export function pushStaleMove(table/*: any */, moveId/*: number */,
                              instance/*: number */)/*: boolean */ {
  if (moveId === FT_MOVE_ID_DEFAULT) { return false; }
  for (let i = 0; i < STALE_TABLE_SIZE; i++) {
    if (table.moves[i].id === moveId && table.moves[i].instance === instance) {
      return false;
    }
  }
  table.moves[table.index].id = moveId;
  table.moves[table.index].instance = instance;
  table.index = table.index === STALE_TABLE_SIZE - 1 ? 0 : table.index + 1;
  return true;
}

/**
 * The attack id an action state carries, from Melee's motion state table.
 * Anything unlisted is FtMoveId_Default, which does not stale.
 */
export function moveIdFor(charName/*: string */, state/*: string */)/*: number */ {
  const m = STALE_MOVE_IDS[charName];
  if (m === undefined) { return FT_MOVE_ID_DEFAULT; }
  const id = m[state];
  return id === undefined ? FT_MOVE_ID_DEFAULT : id;
}

/**
 * ft_80089228 (ft_0881.c:363): staled damage. Melee skips staling entirely on
 * a debug build; retail always applies it.
 */
export function staleDamage(table/*: any */, moveId/*: number */,
                            damage/*: number */)/*: number */ {
  const m = staleMultiplier(table, moveId);
  // `if (temp_f1 != 1.0F) var_f31 *= temp_f1;` -- the guard is not just an
  // optimisation, it keeps an unstaled damage bit-identical rather than
  // round-tripping it through a multiply by 1.
  if (m === f32(1.0)) { return damage; }
  return mul(damage, m);
}
