import { readdirSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { processEmailOutbox } from '../src/modules/email/email.worker.js';
import { resetClock, setClock } from '../src/lib/time.js';
import { admin, app, at, buy, categoryCode, Client, db, editCatalogue, mailer, participant, resetDb, seedWorkshops } from './helpers/app.js';

beforeEach(async () => {
  await resetDb();
  at('2026-09-23T12:00:00+05:30');
});
afterAll(() => db.destroy());

const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fake-zip word/document.xml content')]);
const PDF = Buffer.from('%PDF-1.4\n% fake manuscript\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake image')]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.from('fake video data')]);

const draft = {
  category: 'oral',
  title: 'Outcomes of endoscopic ultrasound guided drainage, a cohort study',
  institution: 'IPGMER, Kolkata',
  department: 'Gastroenterology',
  correspondingAuthor: 'Dr. Anita Sen',
  track: 'Hepatology',
  keywords: ['pancreas', 'drainage', 'EUS'],
  body: 'Background: ... '.repeat(20),
  referencesText: '1. Guzman-Prado Y, et al. Inflamm Bowel Dis. 2020,26:1819-30.',
  conflictOfInterest: 'None',
  declarationAccepted: true,
  submittingAuthor: { firstName: 'Anita', lastName: 'Sen', email: 'anita@hospital.in' },
  presentingAuthor: { firstName: 'Anita', lastName: 'Sen' },
  coAuthors: [{ firstName: 'Ravi', middleName: 'K', lastName: 'Das', institution: 'AIIMS' }],
};

type Files = [Buffer, string][];

/** Multipart submission with the JSON in `data` and the uploads in `files`, as the browser sends it. */
function send(c: Client | null, url: string, data: Record<string, unknown>, files: Files) {
  let r = (c ? c.agent.post(url).set('X-CSRF-Token', c.csrf) : request(app).post(url)).field('data', JSON.stringify({ ...draft, ...data }));
  for (const [buf, name] of files) r = r.attach('files', buf, name);
  return r;
}
const submit = (c: Client | null, data: Record<string, unknown> = {}, files: Files = [[DOCX, 'abstract.docx']]) => send(c, '/api/abstracts/submit', data, files);
/** Resubmits; unless `keepFileIds` is given, all files of the current revision are kept (as the form does by default). */
async function resubmit(c: Client, id: number, data: Record<string, unknown> = {}, files: Files = []) {
  const a = await db('abstracts').where({ id }).first('revision');
  const keepFileIds = a ? (await db('abstract_files').where({ abstract_id: id, revision: a.revision }).select('id')).map((f) => f.id) : [];
  return send(c, `/api/abstracts/mine/${id}/resubmit`, { keepFileIds, ...data }, files);
}

/** A delegate who created an account with the short sign-up (name, email, mobile, password). */
async function author(email = `author${Math.random().toString(36).slice(2, 8)}@test.in`, fullName = 'Anita Sen') {
  const c = new Client();
  await c.register(email, 'Secret123', fullName);
  return c;
}

describe('abstract submission (account required)', () => {
  it('needs a logged-in delegate account; admins cannot submit', async () => {
    const anon = await submit(null);
    expect(anon.status).toBe(401);

    const a = await admin();
    const byAdmin = await submit(a);
    expect(byAdmin.status).toBe(403);
    expect(await db('abstracts').count({ n: '*' }).first()).toEqual({ n: 0 });
  });

  it('short sign-up → submit: numbered, linked to the account, contact taken from the account, emails queued', async () => {
    const c = await author('anita.sen@hospital.in');
    const res = await submit(c, { submittingAuthor: { firstName: 'Anita', lastName: 'Sen', email: 'someone.else@x.in' } });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ abstractNumber: 'ENDO27-ABS-0001' });

    const row = await db('abstracts').where({ id: res.body.data.id }).first();
    const user = await db('users').where({ email: 'anita.sen@hospital.in' }).first('id');
    expect(row).toMatchObject({ user_id: user.id, status: 'submitted', revision: 1, contact_name: 'Anita Sen', contact_email: 'anita.sen@hospital.in', contact_phone: '+91 9876543210' });
    const keywords = typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords;
    expect(keywords).toEqual(['drainage', 'EUS', 'pancreas']);
    // The submitting author's email is always the account email (cannot submit as someone else).
    const sub = await db('abstract_authors').where({ abstract_id: row.id, role: 'submitting' }).first();
    expect(sub.email).toBe('anita.sen@hospital.in');
    expect(await db('abstract_versions').where({ abstract_id: row.id }).count({ n: '*' }).first()).toEqual({ n: 1 });

    await processEmailOutbox();
    expect(mailer.sent.filter((m) => m.subject.includes('Abstract received')).map((m) => m.to)).toEqual(['anita.sen@hospital.in']);
    expect(mailer.sent.filter((m) => m.subject.includes('New abstract')).map((m) => m.to)).toEqual(['team@endocon.test']);
  });

  it('enforces the guideline: word limit, plenary SGEI no and real file types (files are optional)', async () => {
    const c = await author();
    const noFiles = await submit(c, {}, []);
    expect(noFiles.status).toBe(201);

    const fake = await submit(c, {}, [[Buffer.from('MZ....'), 'virus.docx']]);
    expect(fake.status).toBe(422);
    expect(fake.body.errors.files).toMatch(/not an accepted file type/);

    const plenary = await submit(c, { category: 'plenary', body: 'word '.repeat(301) });
    expect(Object.keys(plenary.body.errors)).toEqual(expect.arrayContaining(['body', 'sgeiMembershipNo']));

    const ok = await submit(c, { category: 'plenary', sgeiMembershipNo: 'SGEI-1', coAuthors: [{ firstName: 'Ramesh', lastName: '' }] }, [[PDF, 'manuscript.pdf']]);
    expect(ok.status).toBe(201);
    expect(await db('abstracts').count({ n: '*' }).first()).toEqual({ n: 2 }); // the no-file one + this one
    expect(await db('abstract_files').where({ abstract_id: noFiles.body.data.id }).count({ n: '*' }).first()).toEqual({ n: 0 });
    // Temporary upload files are always cleaned up.
    expect(readdirSync(path.resolve(process.env.STORAGE_LOCAL_DIR ?? './storage', 'tmp'))).toEqual([]);
  });

  it('uploads are not tied to the presentation type: documents, images and one video, no video link', async () => {
    const c = await author();
    const video = await submit(c, { category: 'video', videoUrl: 'https://example.com/old-link' }, [[DOCX, 'abstract.docx'], [MP4, 'procedure.mp4'], [PNG, 'figure.png']]);
    expect(video.status).toBe(201);
    const files = await db('abstract_files').where({ abstract_id: video.body.data.id }).orderBy('id');
    expect(files.map((f) => [f.kind, f.mime_type, f.original_name])).toEqual([
      ['document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'abstract.docx'],
      ['video', 'video/mp4', 'procedure.mp4'],
      ['image', 'image/png', 'figure.png'],
    ]);
    expect((await db('abstracts').where({ id: video.body.data.id }).first('video_url')).video_url).toBeNull();

    // An e-poster may be a PDF; an oral paper may be just a video.
    expect((await submit(c, { category: 'eposter' }, [[PDF, 'poster.pdf']])).status).toBe(201);
    expect((await submit(c, { category: 'oral' }, [[MP4, 'talk.mp4']])).status).toBe(201);

    const twoVideos = await submit(c, { category: 'video' }, [[MP4, 'a.mp4'], [MP4, 'b.mp4']]);
    expect(twoVideos.status).toBe(422);
    expect(twoVideos.body.errors.files).toMatch(/only 1 video/);

    const six = await submit(c, {}, Array.from({ length: 6 }, (_, i) => [PDF, `f${i}.pdf`] as [Buffer, string]));
    expect(six.status).toBe(400);

    // Downloads stream the stored file back unchanged.
    const vid = files.find((f) => f.kind === 'video');
    const dl = await c.agent.get(`/api/abstracts/files/${vid.id}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('video/mp4');
    expect(Buffer.compare(dl.body as Buffer, MP4)).toBe(0);
  });

  it('My Abstracts: authors see only their own abstracts and files', async () => {
    const mine = await author();
    const other = await author();
    const id = (await submit(mine)).body.data.id;

    const list = (await mine.get('/api/abstracts/mine')).body.data;
    expect(list.abstracts).toHaveLength(1);
    expect(list.abstracts[0]).toMatchObject({ id, status: 'submitted', statusLabel: 'Submitted', canResubmit: false, reviewComment: null });
    expect((await other.get('/api/abstracts/mine')).body.data.abstracts).toHaveLength(0);

    const detail = (await mine.get(`/api/abstracts/mine/${id}`)).body.data;
    expect(detail.history.map((e: { type: string }) => e.type)).toEqual(['submitted']);
    expect((await other.get(`/api/abstracts/mine/${id}`)).status).toBe(404);
    expect((await mine.get(`/api/abstracts/files/${detail.files[0].id}`)).status).toBe(200);
    expect((await other.get(`/api/abstracts/files/${detail.files[0].id}`)).status).toBe(404);
    expect((await request(app).get('/api/abstracts/mine')).status).toBe(401);
  });
});

describe('abstract review loop', () => {
  it('reject (comment required) → author sees comment → revise & resubmit → accept (final)', async () => {
    const c = await author('ravi@aiims.in', 'Ravi Das');
    const id = (await submit(c)).body.data.id;
    const firstFile = (await c.get(`/api/abstracts/mine/${id}`)).body.data.files[0];
    const a = await admin();

    // Not resubmittable while waiting for review.
    expect((await resubmit(c, id)).status).toBe(409);

    // Reject / Duplicate need a comment for the author.
    const noComment = await a.post(`/api/admin/abstracts/${id}/review`, { decision: 'rejected' });
    expect(noComment.status).toBe(422);
    expect(noComment.body.errors.comment).toBeDefined();

    const rej = await a.post(`/api/admin/abstracts/${id}/review`, { decision: 'rejected', comment: 'Please add the sample size to the Methods.' });
    expect(rej.status).toBe(200);
    expect(rej.body.data.status).toBe('rejected');

    await processEmailOutbox();
    const rejMail = mailer.sent.find((m) => m.to === 'ravi@aiims.in' && m.subject.includes('Returned for revision'))!;
    expect(rejMail.html).toContain('Please add the sample size to the Methods.');
    expect(rejMail.html).toContain('/my-abstracts');

    const listed = (await c.get('/api/abstracts/mine')).body.data.abstracts[0];
    expect(listed).toMatchObject({ status: 'rejected', reviewComment: 'Please add the sample size to the Methods.', canResubmit: true });

    // Revise: new title, keep the uploaded file (no new upload).
    const re = await resubmit(c, id, { title: 'Outcomes of EUS guided drainage in 120 patients' });
    expect(re.status).toBe(200);
    expect(re.body.data).toMatchObject({ abstractNumber: 'ENDO27-ABS-0001', revision: 2 });
    const row = await db('abstracts').where({ id }).first();
    expect(row).toMatchObject({ status: 'resubmitted', revision: 2, title: 'Outcomes of EUS guided drainage in 120 patients' });
    // Only one abstract – the same number is kept.
    expect(await db('abstracts').count({ n: '*' }).first()).toEqual({ n: 1 });
    const files2 = await db('abstract_files').where({ abstract_id: id }).orderBy('revision');
    expect(files2.map((f) => f.revision)).toEqual([1, 2]);
    expect(files2[1].storage_key).toBe(files2[0].storage_key); // carried over, not re-uploaded

    // Double resubmit is refused.
    expect((await resubmit(c, id)).status).toBe(409);

    // Admin sees the whole history and the earlier revision.
    const detail = (await a.get(`/api/admin/abstracts/${id}`)).body.data;
    expect(detail.history.map((e: { type: string; decision?: string }) => e.decision ?? e.type)).toEqual(['submitted', 'rejected', 'resubmitted']);
    expect(detail.previousVersions).toHaveLength(1);
    expect(detail.previousVersions[0].snapshot.title).toBe('Outcomes of endoscopic ultrasound guided drainage, a cohort study');
    expect(detail.previousVersions[0].files[0].id).toBe(firstFile.id);
    expect((await a.get(`/api/admin/abstract-files/${firstFile.id}`)).status).toBe(200);

    // Accept – no comment needed; final for the author.
    const acc = await a.post(`/api/admin/abstracts/${id}/review`, { decision: 'accepted' });
    expect(acc.body.data.status).toBe('accepted');
    await processEmailOutbox();
    expect(mailer.sent.some((m) => m.to === 'ravi@aiims.in' && m.subject.includes('Accepted'))).toBe(true);
    expect((await c.get('/api/abstracts/mine')).body.data.abstracts[0]).toMatchObject({ status: 'accepted', canResubmit: false, reviewComment: null });
    expect((await resubmit(c, id)).status).toBe(409);

    const audit = await db('audit_logs').where({ action: 'abstract.reviewed', entity_id: String(id) }).count({ n: '*' }).first();
    expect(Number(audit?.n)).toBe(2);
  });

  it('duplicate → resubmit with a replacement file; resubmission stops at the closing date', async () => {
    const c = await author();
    const id = (await submit(c)).body.data.id;
    const a = await admin();
    await a.post(`/api/admin/abstracts/${id}/review`, { decision: 'duplicate', comment: 'Same study as ENDO27-ABS-0002.' });

    // Drop the old file, upload a revised document and a video.
    const re = await resubmit(c, id, { keepFileIds: [] }, [[DOCX, 'revised.docx'], [MP4, 'demo.mp4']]);
    expect(re.status).toBe(200);
    const current = (await c.get(`/api/abstracts/mine/${id}`)).body.data;
    expect(current.files.map((f: { originalName: string }) => f.originalName)).toEqual(['revised.docx', 'demo.mp4']);

    // Returned again, but after the submission window has closed.
    await a.post(`/api/admin/abstracts/${id}/review`, { decision: 'rejected', comment: 'Needs more data.' });
    setClock(() => new Date('2028-01-05T10:00:00+05:30'));
    const late = await author(); // new session at the late date
    expect((await submit(late)).status).toBe(409);
    const email = (await db('users').join('abstracts', 'abstracts.user_id', 'users.id').where('abstracts.id', id).first('users.email')).email;
    const again = new Client();
    await again.login(email);
    expect((await again.get('/api/abstracts/mine')).body.data.abstracts[0]).toMatchObject({ status: 'rejected', canResubmit: false });
    const tooLate = await resubmit(again, id);
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.code).toBe('SUBMISSION_CLOSED');
    resetClock();
  });
});

describe('admin – registrations', () => {
  it('dashboard counts, list with filters, detail with full payment history, edit + resend', async () => {
    const ws = await seedWorkshops();
    const paid = await participant('paid@test.in');
    await buy(paid.client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    await buy(paid.client, { workshopCodes: [ws.b] });
    await participant('pending@test.in');
    const a = await admin();

    const stats = (await a.get('/api/admin/stats')).body.data;
    expect(stats.registrations).toEqual({ total: 2, paid: 1, pending: 1 });
    expect(stats.revenueMinor).toBe(2183000 + 177000);

    const list = (await a.get('/api/admin/registrations?paymentStatus=paid')).body.data;
    expect(list.total).toBe(1);
    expect(list.rows[0]).toMatchObject({ slNo: 1, orderNumber: 'ENDO-0001', email: 'paid@test.in', paymentStatus: 'Paid' });
    const search = (await a.get('/api/admin/registrations?q=pending@')).body.data;
    expect(search.rows.map((r: { email: string }) => r.email)).toEqual(['pending@test.in']);
    const catFilter = (await a.get(`/api/admin/registrations?categoryCode=${await categoryCode('non-member')}`)).body.data;
    expect(catFilter.total).toBe(0);

    const userId = list.rows[0].userId;
    const detail = (await a.get(`/api/admin/registrations/${userId}`)).body.data;
    expect(detail.profile.fullName).toBe('Anita Sen');
    expect(detail.order.orderNumber).toBe('ENDO-0001');
    expect(detail.payments).toHaveLength(2);
    expect(detail.payments.map((p: { items: { description: string }[] }) => p.items[0].description)).toEqual([
      expect.stringContaining('Conference Registration – SGEI Member'),
      'Workshop – Workshop B',
    ]);
    expect(detail.totals.totalPaidMinor).toBe(2183000 + 177000);

    // Edit participant details (audited) – financial fields are not accepted.
    const edit = await a.patch(`/api/admin/registrations/${userId}`, { city: 'Howrah', reason: 'Participant request by phone' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.profile.city).toBe('Howrah');
    expect(edit.body.data.audit[0].action).toBe('registration.profile_edited');
    const forbidden = await a.patch(`/api/admin/registrations/${userId}`, { totalMinor: 1, reason: 'hack attempt' });
    expect(forbidden.status).toBe(422);
    // Same rules as the participant's own form: mandatory fields cannot be cleared, pin code checked.
    const invalid = await a.patch(`/api/admin/registrations/${userId}`, { fullName: '', age: null, pinCode: '12', reason: 'Correction' });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.errors).sort()).toEqual(['age', 'fullName', 'pinCode']);
    // Age and several fields at once; unchanged fields untouched; the audit records only what changed.
    const multi = await a.patch(`/api/admin/registrations/${userId}`, { age: '41', designation: 'Professor', phoneNumber: '9123456780', reason: 'Updated by email' });
    expect(multi.status).toBe(200);
    expect(multi.body.data.profile).toMatchObject({ age: 41, designation: 'Professor', phoneNumber: '9123456780', city: 'Howrah', fullName: 'Anita Sen' });
    expect(Object.keys(multi.body.data.audit[0].after).sort()).toEqual(['age', 'designation', 'phone_number', 'reason']);
    // Membership decided the price – locked once the conference is paid.
    const member = await a.patch(`/api/admin/registrations/${userId}`, { membershipType: 'non_member', reason: 'Correction' });
    expect(member.status).toBe(422);
    expect(member.body.errors.membershipType).toMatch(/cannot be changed/);

    const resend = await a.post(`/api/admin/registrations/${userId}/resend-confirmation`, {});
    expect(resend.status).toBe(200);
    expect(await db('email_outbox').where({ template: 'registration_confirmation' }).count({ n: '*' }).first()).toEqual({ n: 3 });
  });

  it('exports all matching registrations as CSV (server-side, escaped, UTF-8 BOM)', async () => {
    const p = await participant('csv@test.in', {
      title: 'Dr.', fullName: 'Sen, "Anita"', age: 41, gender: 'Female', designation: 'Consultant', organization: 'SSKM, Kolkata',
      mciStateCode: 'WB', mciRegNo: '1', membershipType: 'sgei_member', membershipNo: 'S1', phoneCountryCode: '+91',
      phoneNumber: '9876543210', address: 'Line 1', city: 'Kolkata', state: 'WB', country: 'India', pinCode: '700020',
    });
    await buy(p.client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const a = await admin();
    const res = await a.get('/api/admin/registrations/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Order ID,Title,Name,Email');
    expect(text).toContain('"Sen, ""Anita"""');
    expect(text).toContain('"SSKM, Kolkata"');
    expect(text).toContain('21830.00');
    expect(text).toMatch(/pay_fake_/);
  });
});

describe('admin – abstracts', () => {
  it('lists submitters by account with review counts and registration, filters, detail and CSV', async () => {
    const anita = await author('anita@hospital.in', 'Anita Sen');
    await submit(anita);
    await submit(anita, { title: 'Second study on colonoscopy quality', body: 'Line one,\nline "two"' });
    const ravi = await author('ravi@aiims.in', 'Ravi Das');
    const raviId = (await submit(ravi, { institution: 'AIIMS, Delhi', track: 'Transplant Oncology', department: 'Surgical Oncology' })).body.data.id;
    const a = await admin();
    await a.post(`/api/admin/abstracts/${raviId}/review`, { decision: 'accepted' });

    const authors = (await a.get('/api/admin/abstract-authors')).body.data;
    expect(authors.rows).toHaveLength(2);
    const row = authors.rows.find((r: { email: string }) => r.email === 'anita@hospital.in');
    expect(row).toMatchObject({ author: 'Anita Sen', abstractCount: 2, needsReview: 2, institution: 'IPGMER, Kolkata', registration: 'Not registered', phone: '+91 9876543210' });
    expect((await a.get('/api/admin/abstract-authors?institution=AIIMS')).body.data.rows).toHaveLength(1);
    expect((await a.get(`/api/admin/abstract-authors?track=${encodeURIComponent('Transplant Oncology')}`)).body.data.rows.map((r: { email: string }) => r.email)).toEqual(['ravi@aiims.in']);
    expect((await a.get('/api/admin/abstract-authors?status=needs_review')).body.data.rows.map((r: { email: string }) => r.email)).toEqual(['anita@hospital.in']);
    expect((await a.get('/api/admin/abstract-authors?status=accepted')).body.data.rows.map((r: { email: string }) => r.email)).toEqual(['ravi@aiims.in']);

    const theirs = (await a.get(`/api/admin/abstract-authors/${row.userId}`)).body.data;
    expect(theirs.abstracts).toHaveLength(2);
    expect(theirs.author).toMatchObject({ name: 'Anita Sen', email: 'anita@hospital.in', registration: 'Not registered' });
    const detail = (await a.get(`/api/admin/abstracts/${theirs.abstracts[0].id}`)).body.data;
    expect(detail.coAuthors[0].fullName).toBe('Ravi K Das');
    expect(detail).toMatchObject({ department: 'Gastroenterology', correspondingAuthor: 'Dr. Anita Sen', track: 'Hepatology' });

    const csv = (await a.get('/api/admin/abstracts/export.csv')).text;
    expect(csv).toContain('Abstract No,Status,Latest Comment,Revision,Resubmissions,Category,Track / Theme,Title,Institution,Department,Corresponding Author');
    expect(csv).toContain('Transplant Oncology');
    expect(csv).toContain('Account Name,Account Email,Account Phone,Conference Registration');
    expect(csv).toContain('"Line one,\nline ""two"""');
    expect(csv.match(/ENDO27-ABS-/g)).toHaveLength(3);

    const stats = (await a.get('/api/admin/stats')).body.data;
    expect(stats).toMatchObject({ abstractsSubmitted: 3, abstractsNeedingReview: 2 });

    // Participants cannot reach admin data or review.
    const p = await participant();
    expect((await p.client.get('/api/admin/abstract-authors')).status).toBe(403);
    expect((await p.client.post(`/api/admin/abstracts/${raviId}/review`, { decision: 'accepted' })).status).toBe(403);
  });

  it('shows "Paid · ENDO-0001" for submitters who hold a paid conference registration', async () => {
    const p = await participant('paid.author@test.in');
    await buy(p.client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    await submit(p.client);
    const a = await admin();
    const rows = (await a.get('/api/admin/abstract-authors')).body.data.rows;
    expect(rows[0]).toMatchObject({ email: 'paid.author@test.in', registration: 'Paid · ENDO-0001' });
  });

  it('workshops are static (catalogue file): no admin editing; later price edits do not affect past purchases', async () => {
    const a = await admin();
    expect((await a.get('/api/admin/workshops')).status).toBe(404);
    expect((await a.post('/api/admin/workshops', { code: 'x', name: 'x', amountMinor: 1 })).status).toBe(404);

    const ws = await seedWorkshops();
    const p = await participant();
    await buy(p.client, { conferenceCategoryCode: await categoryCode('sgei-member'), workshopCodes: [ws.b] });
    editCatalogue((c) => {
      c.workshops.find((w) => w.code === ws.b)!.amountMinor = 700000; // catalogue file edited later
    });
    const status = (await p.client.get('/api/registration/status')).body.data;
    expect(status.workshops[0].amountMinor).toBe(150000);
    expect(status.workshops[0].name).toBe('Workshop B');
  });
});
