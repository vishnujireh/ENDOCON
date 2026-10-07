import type { DbOrTrx } from '../../db/knex.js';

/** Active (not refunded) seats taken per workshop code. Capacity itself comes from the static catalogue. */
export async function workshopSeatsTaken(conn: DbOrTrx, workshopCodes?: string[]): Promise<Map<string, number>> {
  const q = conn('order_workshops').where({ status: 'active' }).groupBy('workshop_code').select('workshop_code').count({ taken: '*' });
  if (workshopCodes?.length) q.whereIn('workshop_code', workshopCodes);
  const rows = (await q) as { workshop_code: string; taken: number | string }[];
  return new Map(rows.map((r) => [r.workshop_code, Number(r.taken)]));
}
