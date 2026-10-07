import type { Trx } from '../db/knex.js';

/**
 * Gap-free counter. MUST be called inside a transaction: the row lock is held until commit,
 * so concurrent callers are serialised and a rolled-back transaction does not consume a number.
 */
export async function nextSequenceValue(trx: Trx, name: string): Promise<number> {
  await trx.raw('INSERT IGNORE INTO sequences (name, value) VALUES (?, 0)', [name]);
  const row = await trx('sequences').where({ name }).forUpdate().first('value');
  const next = Number(row.value) + 1;
  await trx('sequences').where({ name }).update({ value: next });
  return next;
}

export function pad(n: number, width = 4): string {
  return String(n).padStart(width, '0');
}
