import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { processEmailOutbox } from '../src/modules/email/email.worker.js';
import { Client, admin, app, db, mailer, resetDb } from './helpers/app.js';

beforeEach(resetDb);
afterAll(() => db.destroy());

describe('registration & login', () => {
  it('registers, hashes the password, and starts a session', async () => {
    const c = new Client();
    const user = await c.register('Doc@Example.com');
    expect(user.email).toBe('doc@example.com');
    const row = await db('users').where({ id: user.id }).first();
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    const me = await c.get('/api/auth/me');
    expect(me.body.data.user.email).toBe('doc@example.com');
    expect(me.body.data.user).not.toHaveProperty('password_hash');
  });

  it('rejects weak passwords and duplicate emails', async () => {
    const weak = await request(app).post('/api/auth/register').send({ fullName: 'X Y', email: 'a@b.in', phoneNumber: '9876543210', password: 'short' });
    expect(weak.status).toBe(422);
    expect(weak.body.errors.password).toBeDefined();
    await new Client().register('dup@test.in');
    const dup = await request(app).post('/api/auth/register').send({ fullName: 'X Y', email: 'dup@test.in', phoneNumber: '9876543210', password: 'Secret123' });
    expect(dup.status).toBe(409);
  });

  it('login succeeds with the right password and returns the same error otherwise', async () => {
    await new Client().register('login@test.in');
    const c = new Client();
    expect((await c.login('login@test.in', 'Secret123')).status).toBe(200);
    const wrong = await new Client().login('login@test.in', 'Wrong1234');
    const unknown = await new Client().login('nobody@test.in', 'Wrong1234');
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('logout revokes the session', async () => {
    const c = new Client();
    await c.register('out@test.in');
    expect((await c.post('/api/auth/logout')).status).toBe(200);
    const me = await c.get('/api/auth/me');
    expect(me.body.data.user).toBeNull();
    expect((await c.get('/api/profile')).status).toBe(401);
  });

  it('protects routes and requires the CSRF token for state changes', async () => {
    expect((await request(app).get('/api/registration/status')).status).toBe(401);
    const c = new Client();
    await c.register('csrf@test.in');
    const noToken = await c.agent.put('/api/profile').send({});
    expect(noToken.status).toBe(403);
    expect(noToken.body.code).toBe('CSRF_TOKEN');
    const badOrigin = await c.agent.post('/api/auth/logout').set('Origin', 'https://evil.example').set('X-CSRF-Token', c.csrf);
    expect(badOrigin.status).toBe(403);
  });
});

describe('forgot / reset password', () => {
  it('responds identically for known and unknown emails (no enumeration)', async () => {
    await new Client().register('known@test.in');
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'known@test.in' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@test.in' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    const queued = await db('email_outbox').where({ template: 'password_reset' });
    expect(queued).toHaveLength(1);
    expect(queued[0].to_email).toBe('known@test.in');
  });

  it('resets with a single-use token, revokes sessions and invalidates the token', async () => {
    const c = new Client();
    await c.register('reset@test.in');
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@test.in' });
    await processEmailOutbox();
    const mail = mailer.sent.find((m) => m.to === 'reset@test.in')!;
    const token = decodeURIComponent(/token=([^\s"&<]+)/.exec(mail.text)![1]);

    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewSecret99' });
    expect(ok.status).toBe(200);
    expect((await c.get('/api/profile')).status).toBe(401); // old session revoked
    expect((await new Client().login('reset@test.in', 'Secret123')).status).toBe(400);
    expect((await new Client().login('reset@test.in', 'NewSecret99')).status).toBe(200);

    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'Another123' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired tokens', async () => {
    await new Client().register('exp@test.in');
    await request(app).post('/api/auth/forgot-password').send({ email: 'exp@test.in' });
    await db('password_reset_tokens').update({ expires_at: new Date(Date.now() - 1000) });
    await processEmailOutbox();
    const mail = mailer.sent.find((m) => m.to === 'exp@test.in')!;
    const token = decodeURIComponent(/token=([^\s"&<]+)/.exec(mail.text)![1]);
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewSecret99' });
    expect(res.status).toBe(400);
  });
});

describe('admin authentication & authorisation', () => {
  it('admin login only accepts admin accounts', async () => {
    await new Client().register('p@test.in');
    const res = await new Client().login('p@test.in', 'Secret123', '/api/admin/auth/login');
    expect(res.status).toBe(400);
    const a = await admin();
    expect((await a.get('/api/admin/stats')).status).toBe(200);
    // …and admins must use the separate admin login
    const row = await db('users').where({ role: 'admin' }).first('email');
    expect((await new Client().login(row.email, 'AdminPass1')).status).toBe(400);
  });

  it('participants cannot call admin APIs', async () => {
    const c = new Client();
    await c.register('nosy@test.in');
    expect((await c.get('/api/admin/registrations')).status).toBe(403);
    expect((await request(app).get('/api/admin/registrations')).status).toBe(401);
  });
});
