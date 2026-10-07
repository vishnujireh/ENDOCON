import type { Knex } from 'knex';

/**
 * Abstract uploads are no longer tied to the presentation type: an abstract has 1–5 files of any
 * accepted type – documents (PDF / Word), images (JPG / PNG) and videos (MP4 / MOV / WebM, up to
 * UPLOAD_MAX_VIDEO_MB). `kind` now describes the file itself; several files of one kind are allowed.
 * Video files can exceed 2 GB in principle, so size_bytes becomes BIGINT.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE abstract_files MODIFY kind VARCHAR(20) NOT NULL');
  await knex('abstract_files').whereIn('kind', ['abstract_doc', 'manuscript_pdf', 'eposter_doc']).update({ kind: 'document' });
  await knex.raw("ALTER TABLE abstract_files MODIFY kind ENUM('document','image','video') NOT NULL");
  await knex.schema.alterTable('abstract_files', (t) => {
    t.dropUnique(['abstract_id', 'kind', 'revision']);
    t.index(['abstract_id', 'revision']);
  });
  await knex.raw('ALTER TABLE abstract_files MODIFY size_bytes BIGINT UNSIGNED NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  // Keep one file per kind and revision so the old unique key can be restored.
  await knex.raw(`
    DELETE f FROM abstract_files f
    JOIN abstract_files g ON g.abstract_id = f.abstract_id AND g.revision = f.revision AND g.id < f.id`);
  await knex.raw('ALTER TABLE abstract_files MODIFY kind VARCHAR(20) NOT NULL');
  await knex('abstract_files').whereIn('kind', ['document', 'image', 'video']).update({ kind: 'abstract_doc' });
  await knex.raw("ALTER TABLE abstract_files MODIFY kind ENUM('abstract_doc','manuscript_pdf','eposter_doc') NOT NULL");
  await knex.schema.alterTable('abstract_files', (t) => {
    t.dropIndex(['abstract_id', 'revision']);
    t.unique(['abstract_id', 'kind', 'revision']);
  });
  await knex.raw('ALTER TABLE abstract_files MODIFY size_bytes INT UNSIGNED NOT NULL');
}
