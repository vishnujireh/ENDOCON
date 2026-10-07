import ExcelJS from 'exceljs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setClock } from '../src/lib/time.js';
import { admin, at, Client, db, mailer, resetDb } from './helpers/app.js';

/**
 * Online Abstract Review Module – the acceptance scenarios from the requirement brief (TEST 1–20),
 * plus the OTP security rules.
 */

beforeEach(async () => {
  await resetDb();
  at('2026-10-05T12:00:00+05:30');
});
afterAll(() => db.destroy());

const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fake-zip word/document.xml content')]);
const draft = {
  category: 'oral',
  title: 'Outcomes of endoscopic ultrasound guided drainage, a cohort study',
  institution: 'IPGMER, Kolkata',
  department: 'Gastroenterology',
  correspondingAuthor: 'Dr. Anita Sen',
  track: 'Hepatology',
  keywords: ['pancreas', 'drainage', 'EUS'],
  body: 'Background: ... '.repeat(20),
  declarationAccepted: true,
  submittingAuthor: { firstName: 'Anita', lastName: 'Sen', email: 'x@y.in' },
  presentingAuthor: { firstName: 'Anita', lastName: 'Sen' },
  coAuthors: [],
};

async function submitAbstract(title: string, extra: Record<string, unknown> = {}) {
  const c = new Client();
  await c.register(`author${Math.random().toString(36).slice(2, 8)}@test.in`, 'Secret123', 'Anita Sen');
  const res = await c.agent.post('/api/abstracts/submit').set('X-CSRF-Token', c.csrf).field('data', JSON.stringify({ ...draft, title, ...extra })).attach('files', DOCX, 'abstract.docx');
  if (res.status !== 201) throw new Error(`submit failed ${JSON.stringify(res.body)}`);
  return res.body.data.id as number;
}

/** A reviewer's browser: logs in with the emailed code and sends the reviewer CSRF token. */
class ReviewerClient extends Client {
  async otpLogin(email: string) {
    mailer.sent.length = 0;
    const req = await this.agent.post('/api/reviewer/auth/request-otp').send({ email });
    expect(req.status).toBe(200);
    const mail = mailer.sent.find((m) => m.to === email);
    if (!mail) throw new Error('no OTP email');
    const code = /\b(\d{6})\b/.exec(mail.subject)![1];
    const res = await this.agent.post('/api/reviewer/auth/verify-otp').send({ email, code });
    expect(res.status).toBe(200);
    this.csrf = res.body.data.csrfToken;
    return res;
  }
}

async function setup() {
  const a = await admin();
  const c1 = (await a.post('/api/admin/review-criteria', { name: 'Originality', maxScore: 20, displayOrder: 1 })).body.data;
  const c2 = (await a.post('/api/admin/review-criteria', { name: 'Scientific merit', maxScore: 30, displayOrder: 2 })).body.data;
  const judgeA = (await a.post('/api/admin/reviewers', { name: 'Judge A', email: 'judge.a@endocon.test' })).body.data;
  const judgeB = (await a.post('/api/admin/reviewers', { name: 'Judge B', email: 'judge.b@endocon.test' })).body.data;
  const judgeC = (await a.post('/api/admin/reviewers', { name: 'Judge C', email: 'judge.c@endocon.test' })).body.data;
  const abs1 = await submitAbstract('Abstract one on pancreatic drainage');
  const abs2 = await submitAbstract('Abstract two on liver transplant', { category: 'eposter', track: 'Transplant Oncology' });
  return { a, c1, c2, judgeA, judgeB, judgeC, abs1, abs2 };
}

describe('online abstract review', () => {
  it('reviewer management: unique email, codes, edit, deactivate', async () => {
    const a = await admin();
    const r = await a.post('/api/admin/reviewers', { name: 'Dr. Rao', email: 'Rao@Hospital.in' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ reviewerCode: 'REV-001', email: 'rao@hospital.in', status: 'active' });
    expect((await a.post('/api/admin/reviewers', { name: 'Someone', email: 'rao@hospital.in' })).body.errors.email).toMatch(/already exists/);
    const upd = await a.patch(`/api/admin/reviewers/${r.body.data.id}`, { name: 'Dr. K Rao', status: 'inactive' });
    expect(upd.body.data).toMatchObject({ name: 'Dr. K Rao', status: 'inactive' });
    const list = (await a.get('/api/admin/reviewers')).body.data;
    expect(list[0].counts).toEqual({ assigned: 0, pending: 0, completed: 0, coi: 0 });

    // Participants and reviewers cannot use admin APIs.
    const p = new Client();
    await p.register('doc@test.in');
    expect((await p.get('/api/admin/reviewers')).status).toBe(403);
  });

  it('OTP login: expiry, single use, attempt limit, cooldown, no account enumeration', async () => {
    const a = await admin();
    await a.post('/api/admin/reviewers', { name: 'Judge A', email: 'judge.a@endocon.test' });
    const rc = new ReviewerClient();

    // Unknown email: same answer, no email sent.
    mailer.sent.length = 0;
    const unknown = await rc.agent.post('/api/reviewer/auth/request-otp').send({ email: 'nobody@x.in' });
    const known = await rc.agent.post('/api/reviewer/auth/request-otp').send({ email: 'judge.a@endocon.test' });
    expect(unknown.body).toEqual(known.body);
    expect(mailer.sent.map((m) => m.to)).toEqual(['judge.a@endocon.test']);
    const code = /\b(\d{6})\b/.exec(mailer.sent[0].subject)![1];
    const stored = await db('reviewer_otps').first();
    expect(stored.otp_hash).not.toContain(code); // only a hash is stored
    // Logged for the admin email log, but the code is never stored.
    const logged = await db('email_outbox').where({ template: 'reviewer_otp' });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ to_email: 'judge.a@endocon.test', status: 'sent' });
    expect(JSON.stringify(logged[0].payload)).not.toContain(code);

    // Cooldown: an immediate second request sends nothing new.
    await rc.agent.post('/api/reviewer/auth/request-otp').send({ email: 'judge.a@endocon.test' });
    expect(mailer.sent).toHaveLength(1);

    // Wrong code ×5 cancels the code; the right code then fails too.
    for (let i = 0; i < 5; i++) {
      const bad = await rc.agent.post('/api/reviewer/auth/verify-otp').send({ email: 'judge.a@endocon.test', code: code === '000000' ? '111111' : '000000' });
      expect(bad.status).toBe(401);
    }
    expect((await rc.agent.post('/api/reviewer/auth/verify-otp').send({ email: 'judge.a@endocon.test', code })).status).toBe(401);

    // New code after the cooldown; it works once only.
    const later = (minutes: number) => setClock(() => new Date(Date.now() + minutes * 60_000));
    later(2);
    const rc2 = new ReviewerClient();
    await rc2.otpLogin('judge.a@endocon.test');
    const again = /\b(\d{6})\b/.exec(mailer.sent.at(-1)!.subject)![1];
    expect((await rc2.agent.post('/api/reviewer/auth/verify-otp').send({ email: 'judge.a@endocon.test', code: again })).status).toBe(401);
    expect((await rc2.get('/api/reviewer/auth/me')).body.data.reviewer).toMatchObject({ name: 'Judge A' });

    // Expired code.
    later(60);
    mailer.sent.length = 0;
    await rc.agent.post('/api/reviewer/auth/request-otp').send({ email: 'judge.a@endocon.test' });
    const late = /\b(\d{6})\b/.exec(mailer.sent[0].subject)![1];
    later(71);
    expect((await rc.agent.post('/api/reviewer/auth/verify-otp').send({ email: 'judge.a@endocon.test', code: late })).status).toBe(401);
  });

  it('TEST 1–17: assign, OTP login, own abstracts only, read-only, evaluate once, privacy, COI, admin monitoring', async () => {
    const { a, c1, c2, judgeA, judgeB, judgeC, abs1, abs2 } = await setup();

    // TEST 1: existing abstract table + filters still work; the per-abstract view filters by category / track.
    expect((await a.get('/api/admin/abstract-authors')).body.data.rows).toHaveLength(2);
    expect((await a.get('/api/admin/abstracts?category=eposter')).body.data.rows.map((r: { id: number }) => r.id)).toEqual([abs2]);
    expect((await a.get(`/api/admin/abstracts?track=${encodeURIComponent('Transplant Oncology')}`)).body.data.rows.map((r: { id: number }) => r.id)).toEqual([abs2]);

    // TEST 2 + 3: Reviewer A and B on the same abstract (one row each); no duplicates.
    expect((await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeA.id] })).status).toBe(200);
    const two = await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeB.id, judgeC.id] });
    expect(two.body.data.summary).toMatchObject({ assigned: 3, pending: 3, progress: 'in_review' });
    const dup = await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeA.id] });
    expect(dup.status).toBe(409);
    expect(await db('abstract_assignments').where({ abstract_id: abs1 }).count({ n: '*' }).first()).toEqual({ n: 3 });

    // TEST 4 + 5: Reviewer A logs in with OTP and sees only abstract 1.
    const A = new ReviewerClient();
    await A.otpLogin('judge.a@endocon.test');
    const dash = (await A.get('/api/reviewer/dashboard')).body.data;
    expect(dash.counts).toEqual({ assigned: 1, pending: 1, completed: 0, coi: 0 });
    expect(dash.abstracts.map((x: { abstractId: number }) => x.abstractId)).toEqual([abs1]);

    // TEST 6: an unassigned abstract / its files are not reachable by changing the ID.
    expect((await A.get(`/api/reviewer/abstracts/${abs2}`)).status).toBe(404);
    const otherFile = await db('abstract_files').where({ abstract_id: abs2 }).first('id');
    expect((await A.get(`/api/reviewer/files/${otherFile.id}`)).status).toBe(404);
    expect((await A.put(`/api/reviewer/abstracts/${abs2}/review`, { scores: [] })).status).toBe(404);
    // …and reviewers cannot use delegate or admin APIs.
    expect((await A.get('/api/admin/abstracts')).status).toBe(401);
    expect((await A.get('/api/abstracts/mine')).status).toBe(401);

    // TEST 7: read-only view without the submitter's contact details.
    const view = (await A.get(`/api/reviewer/abstracts/${abs1}`)).body.data;
    expect(view.abstract).toMatchObject({ id: abs1, title: 'Abstract one on pancreatic drainage', track: 'Hepatology', categoryLabel: 'Oral Paper Presentation' });
    expect(view.abstract.contactEmail).toBeUndefined();
    expect(view.abstract.submittingAuthor.email).toBeNull();
    expect(view.criteria.map((c: { name: string }) => c.name)).toEqual(['Originality', 'Scientific merit']);
    const ownFile = await db('abstract_files').where({ abstract_id: abs1 }).first('id');
    expect((await A.get(`/api/reviewer/files/${ownFile.id}`)).status).toBe(200);

    // TEST 8: there is no way for a reviewer to change the abstract.
    expect((await A.patch(`/api/reviewer/abstracts/${abs1}`, { title: 'Hacked' })).status).toBe(404);
    expect((await A.agent.post(`/api/abstracts/mine/${abs1}/resubmit`).set('X-CSRF-Token', A.csrf)).status).toBe(401);

    // Draft first (partial), then over-maximum and missing scores are refused on submit.
    expect((await A.put(`/api/reviewer/abstracts/${abs1}/review`, { scores: [{ criterionId: c1.id, score: 15 }], comments: 'Draft' })).status).toBe(200);
    expect((await A.get('/api/reviewer/dashboard')).body.data.abstracts[0].draftSaved).toBe(true);
    const tooHigh = await A.post(`/api/reviewer/abstracts/${abs1}/review`, { scores: [{ criterionId: c1.id, score: 25 }, { criterionId: c2.id, score: 10 }] });
    expect(tooHigh.body.errors[`score.${c1.id}`]).toMatch(/Maximum 20/);
    expect((await A.post(`/api/reviewer/abstracts/${abs1}/review`, { scores: [{ criterionId: c1.id, score: 15 }] })).body.errors[`score.${c2.id}`]).toBeDefined();
    // Scoring sheet: the recommended Category is required on a scored submit and must be a real category.
    const noCat = await A.post(`/api/reviewer/abstracts/${abs1}/review`, { scores: [{ criterionId: c1.id, score: 15 }, { criterionId: c2.id, score: 27 }] });
    expect(noCat.status).toBe(422);
    expect(noCat.body.errors.recommendedCategory).toBeDefined();
    expect((await A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'keynote', scores: [{ criterionId: c1.id, score: 15 }, { criterionId: c2.id, score: 27 }] })).status).toBe(422);

    // TEST 9 + 10: submit; stored permanently with a snapshot of the criteria.
    const sub = await A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 15 }, { criterionId: c2.id, score: 27 }], comments: 'Strong study.' });
    expect(sub.status).toBe(200);
    expect(sub.body.data.review).toMatchObject({ state: 'submitted', totalScore: 42, maxTotal: 50, coi: false, recommendedCategory: 'oral', recommendedCategoryLabel: 'Oral Paper Presentation' });
    await a.patch(`/api/admin/review-criteria/${c1.id}`, { name: 'Novelty', maxScore: 25 });
    const stored = (await A.get(`/api/reviewer/abstracts/${abs1}`)).body.data.review;
    expect(stored.scores).toEqual([
      { criterionId: c1.id, criterionName: 'Originality', maxScore: 20, score: 15 },
      { criterionId: c2.id, criterionName: 'Scientific merit', maxScore: 30, score: 27 },
    ]);
    await a.patch(`/api/admin/review-criteria/${c1.id}`, { name: 'Originality', maxScore: 20 });

    // TEST 11: no second submission (and no editing via draft), even in parallel.
    const [r1, r2] = await Promise.all([
      A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 1 }, { criterionId: c2.id, score: 1 }] }),
      A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 1 }, { criterionId: c2.id, score: 1 }] }),
    ]);
    expect([r1.status, r2.status]).toEqual([409, 409]);
    expect((await A.put(`/api/reviewer/abstracts/${abs1}/review`, { scores: [] })).status).toBe(409);
    expect((await db('judge_reviews').where({ reviewer_id: judgeA.id }).first()).total_score).toBe(42);

    // TEST 13: Reviewer B reviews the same abstract independently.
    const B = new ReviewerClient();
    await B.otpLogin('judge.b@endocon.test');
    const bView = (await B.get(`/api/reviewer/abstracts/${abs1}`)).body.data;
    // TEST 12: B sees nothing of A's review.
    expect(bView.review).toBeNull();
    expect(JSON.stringify(bView)).not.toContain('Strong study');
    expect((await B.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 18 }, { criterionId: c2.id, score: 27 }] })).status).toBe(200);
    expect(JSON.stringify((await A.get(`/api/reviewer/abstracts/${abs1}`)).body.data)).not.toContain('"totalScore":45');

    // TEST 16: Reviewer C declares a conflict of interest (reason required, no score).
    const C = new ReviewerClient();
    await C.otpLogin('judge.c@endocon.test');
    expect((await C.post(`/api/reviewer/abstracts/${abs1}/review`, { coi: true })).body.errors.coiReason).toBeDefined();
    const coi = await C.post(`/api/reviewer/abstracts/${abs1}/review`, { coi: true, coiReason: 'The first author is from my department.', scores: [{ criterionId: c1.id, score: 20 }] });
    expect(coi.body.data.review).toMatchObject({ state: 'submitted', coi: true, totalScore: null, recommendedCategory: null });
    expect((await C.get('/api/reviewer/dashboard')).body.data.counts).toEqual({ assigned: 1, pending: 0, completed: 0, coi: 1 });

    // TEST 14, 15, 17: admin sees every judge's review, statuses, COI; the average excludes COI.
    const details = (await a.get(`/api/admin/abstracts/${abs1}/reviews`)).body.data;
    expect(details.assignments.map((x: { reviewerName: string; status: string; review: { totalScore: number | null } }) => [x.reviewerName, x.status, x.review.totalScore])).toEqual([
      ['Judge A', 'completed', 42],
      ['Judge B', 'completed', 45],
      ['Judge C', 'coi', null],
    ]);
    expect(details.assignments[2].review.coiReason).toMatch(/my department/);
    expect(details.summary).toMatchObject({ assigned: 3, completed: 2, pending: 0, coi: 1, totalScore: 87, averageScore: 43.5, maxPerReview: 50, progress: 'completed' });
    const list = (await a.get('/api/admin/abstracts?review=has_coi')).body.data.rows;
    expect(list.map((r: { id: number }) => r.id)).toEqual([abs1]);
    expect(list[0].assignments.map((x: { statusLabel: string }) => x.statusLabel)).toEqual(['Completed', 'Completed', 'COI']);
    expect((await a.get('/api/admin/abstracts?review=not_assigned')).body.data.rows.map((r: { id: number }) => r.id)).toEqual([abs2]);
    expect((await a.get(`/api/admin/reviewers/${judgeC.id}/assignments?status=coi`)).body.data.assignments).toHaveLength(1);
    expect((await a.get('/api/admin/review-summary')).body.data).toMatchObject({ reviews: { pending: 0, completed: 2, coi: 1 }, abstracts: { total: 2, assigned: 1, notAssigned: 1 } });
  });

  it('TEST 18: reassignment keeps history; the old reviewer loses access; deactivation ends sessions', async () => {
    const { a, c1, c2, judgeA, judgeB, judgeC, abs1 } = await setup();
    await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeA.id] });
    const A = new ReviewerClient();
    await A.otpLogin('judge.a@endocon.test');
    await A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 10 }, { criterionId: c2.id, score: 10 }] });

    // Judge A → Judge B
    const re = await a.patch(`/api/admin/abstracts/${abs1}/reviewers/${judgeA.id}`, { newReviewerId: judgeB.id });
    expect(re.status).toBe(200);
    const byName = Object.fromEntries(re.body.data.assignments.map((x: { reviewerName: string }) => [x.reviewerName, x]));
    expect(byName['Judge A']).toMatchObject({ active: false, replacedBy: 'Judge B', status: 'completed' });
    expect(byName['Judge A'].review.totalScore).toBe(20); // history kept
    expect(byName['Judge B']).toMatchObject({ active: true, status: 'pending' });
    expect(re.body.data.summary).toMatchObject({ assigned: 1, pending: 1, averageScore: null });
    expect((await A.get(`/api/reviewer/abstracts/${abs1}`)).status).toBe(404);
    expect((await A.get('/api/reviewer/dashboard')).body.data.counts.assigned).toBe(0);

    // Reassigning to someone already assigned, or to an inactive reviewer, is refused.
    await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeC.id] });
    expect((await a.patch(`/api/admin/abstracts/${abs1}/reviewers/${judgeB.id}`, { newReviewerId: judgeC.id })).status).toBe(409);
    await a.patch(`/api/admin/reviewers/${judgeA.id}`, { status: 'inactive' });
    expect((await a.patch(`/api/admin/abstracts/${abs1}/reviewers/${judgeB.id}`, { newReviewerId: judgeA.id })).status).toBe(409);
    // Deactivation logs the reviewer out immediately.
    expect((await A.get('/api/reviewer/dashboard')).status).toBe(401);

    // Removing (soft) and re-adding restores the earlier assignment and its review.
    await a.patch(`/api/admin/reviewers/${judgeA.id}`, { status: 'active' });
    await a.del(`/api/admin/abstracts/${abs1}/reviewers/${judgeC.id}`);
    const back = await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeA.id] });
    const aRow = back.body.data.assignments.find((x: { reviewerName: string }) => x.reviewerName === 'Judge A');
    expect(aRow).toMatchObject({ active: true, status: 'completed' });
    expect(await db('abstract_assignments').where({ abstract_id: abs1 }).count({ n: '*' }).first()).toEqual({ n: 3 });
    expect(await db('audit_logs').where({ action: 'abstract.reviewer_reassigned' }).count({ n: '*' }).first()).toEqual({ n: 1 });
  });

  it('TEST 19 + 20: Excel review export (one row per judge) and final review report', async () => {
    const { a, c1, c2, judgeA, judgeB, abs1 } = await setup();
    await a.post(`/api/admin/abstracts/${abs1}/reviewers`, { reviewerIds: [judgeA.id, judgeB.id] });
    const A = new ReviewerClient();
    await A.otpLogin('judge.a@endocon.test');
    await A.post(`/api/reviewer/abstracts/${abs1}/review`, { recommendedCategory: 'oral', scores: [{ criterionId: c1.id, score: 12 }, { criterionId: c2.id, score: 30 }], comments: 'Good, "clear", concise' });
    const B = new ReviewerClient();
    await B.otpLogin('judge.b@endocon.test');
    await B.post(`/api/reviewer/abstracts/${abs1}/review`, { coi: true, coiReason: 'Co-author is my student.' });

    const read = async (url: string) => {
      const res = await a.agent.get(url).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (d: Buffer) => chunks.push(d));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as any);
      const ws = wb.worksheets[0];
      const rows: Record<string, unknown>[] = [];
      const header = (ws.getRow(1).values as unknown[]).slice(1) as string[];
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const v = (row.values as unknown[]).slice(1);
        rows.push(Object.fromEntries(header.map((h, j) => [h, v[j] ?? ''])));
      });
      return { header, rows };
    };

    const exp = await read('/api/admin/review-export.xlsx');
    expect(exp.header).toEqual(
      expect.arrayContaining(['Abstract ID', 'Abstract Title', 'Author / Presenter', 'Presentation Category', 'Track / Theme', 'Assigned Judge', 'Judge Review Status', 'Individual Score', 'Total Score (abstract)', 'Average Score (abstract)', 'COI Status', 'COI Reason', 'Final Review Status', 'Originality (max 20)', 'Scientific merit (max 30)']),
    );
    const one = exp.rows.filter((r) => r['Abstract Title'] === 'Abstract one on pancreatic drainage');
    expect(one.map((r) => [r['Assigned Judge'], r['Judge Review Status'], r['Individual Score'], r['COI Status']])).toEqual([
      ['Judge A (REV-001)', 'Completed', 42, 'No'],
      ['Judge B (REV-002)', 'COI', '', 'Yes'],
    ]);
    expect(one[0]['Comments']).toBe('Good, "clear", concise');
    expect(one.map((r) => r['Recommended Category'])).toEqual(['Oral Paper Presentation', '']);
    expect(one[1]['COI Reason']).toBe('Co-author is my student.');
    expect(one[0]['Average Score (abstract)']).toBe(42);
    expect(exp.rows.find((r) => r['Abstract Title'] === 'Abstract two on liver transplant')!['Assigned Judge']).toBe('(not assigned)');

    const rep = await read('/api/admin/review-report.xlsx');
    expect(rep.header).toEqual(
      expect.arrayContaining(['Abstract ID', 'Abstract Title', 'Author / Presenter', 'Presentation Category', 'Track / Theme', 'Assigned Judge(s)', 'Individual Scores', 'Total Score', 'Average Score', 'Conflict of Interest', 'Final Review Status']),
    );
    const r1 = rep.rows.find((r) => r['Abstract Title'] === 'Abstract one on pancreatic drainage')!;
    expect(r1).toMatchObject({ 'Individual Scores': 'Judge A: 42/50\nJudge B: COI', 'Total Score': 42, 'Average Score': 42, 'Conflict of Interest': 'Yes – Judge B', 'Final Review Status': 'Review complete' });
    expect(r1['Author / Presenter']).toBe('Anita Sen');

    // Filters apply to the downloads too.
    expect((await read('/api/admin/review-report.xlsx?category=eposter')).rows).toHaveLength(1);
  });
});
