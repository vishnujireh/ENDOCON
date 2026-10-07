import type { Knex } from 'knex';

/**
 * Judge scoring sheet as supplied by the organising team:
 *   - five criteria, each scored 0–3 (total out of 15): Originality, Relevance, Method,
 *     Readability, Overall Quality – seeded only when no criteria have been set up yet, so a
 *     configuration an admin already made is never overwritten;
 *   - a "Category" the judge recommends for the abstract (stored per review).
 * Instruction texts (criterion descriptions) were not supplied and are left empty; admins can add
 * them under Reviewers → Scoring criteria.
 */
const SCORING_SHEET = ['Originality', 'Relevance', 'Method', 'Readability', 'Overall Quality'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('judge_reviews', (t) => {
    t.string('recommended_category', 20).nullable();
  });
  const existing = await knex('review_criteria').count<{ n: number }[]>({ n: '*' });
  if (Number(existing[0].n) === 0) {
    await knex('review_criteria').insert(
      SCORING_SHEET.map((name, i) => ({ name, description: null, max_score: 3, display_order: i + 1, status: 'active' })),
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove the seeded criteria only if no review has used them.
  const used = knex('judge_review_scores').select('criterion_id');
  await knex('review_criteria').whereIn('name', SCORING_SHEET).where({ max_score: 3 }).whereNotIn('id', used).del();
  await knex.schema.alterTable('judge_reviews', (t) => {
    t.dropColumn('recommended_category');
  });
}
