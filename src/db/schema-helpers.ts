import type { Knex } from 'knex';

/** created_at / updated_at with millisecond precision, maintained by MySQL. */
export function timestamps(knex: Knex, t: Knex.CreateTableBuilder, withUpdated = true): void {
  t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  if (withUpdated) {
    t.datetime('updated_at', { precision: 3 })
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
  }
}

/** Money is always stored as integer minor units (paise / cents). */
export function money(t: Knex.CreateTableBuilder, name: string): Knex.ColumnBuilder {
  return t.bigInteger(name).notNullable();
}

export function dt(t: Knex.CreateTableBuilder, name: string): Knex.ColumnBuilder {
  return t.datetime(name, { precision: 3 });
}

export const TABLE_DEFAULTS = (t: Knex.CreateTableBuilder): void => {
  t.engine('InnoDB');
  t.charset('utf8mb4');
  t.collate('utf8mb4_unicode_ci');
};
