import type { Request } from 'express';
import type { DbOrTrx } from '../db/knex.js';

export interface AuditEntry {
  actorUserId: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  req?: Request;
}

export async function audit(conn: DbOrTrx, entry: AuditEntry): Promise<void> {
  await conn('audit_logs').insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: String(entry.entityId),
    before: entry.before === undefined ? null : JSON.stringify(entry.before),
    after: entry.after === undefined ? null : JSON.stringify(entry.after),
    ip: entry.req?.ip ?? null,
    user_agent: entry.req?.get('user-agent')?.slice(0, 255) ?? null,
  });
}
