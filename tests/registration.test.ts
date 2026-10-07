import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, VALID_PROFILE, accommodationCode, at, buy, categoryCode, db, editCatalogue, participant, resetDb, seedWorkshops } from './helpers/app.js';

beforeEach(async () => {
  await resetDb();
  at('2026-09-23T12:00:00+05:30'); // Early Bird
});
afterAll(() => db.destroy());

describe('Step 1 – personal details', () => {
  it('validates PRD fields server-side', async () => {
    const c = new Client();
    await c.register('v@test.in');
    const res = await c.put('/api/profile', { ...VALID_PROFILE, title: 'Prof.', gender: 'X', designation: '' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['title', 'gender', 'designation']));
    // Cross-field rules
    const res2 = await c.put('/api/profile', { ...VALID_PROFILE, membershipNo: '', pinCode: '12' });
    expect(Object.keys(res2.body.errors)).toEqual(expect.arrayContaining(['membershipNo', 'pinCode']));
    const intl = await c.put('/api/profile', { ...VALID_PROFILE, country: 'United Kingdom', pinCode: 'SW1A 1AA' });
    expect(intl.status).toBe(200);
  });

  it('persists and pre-fills on the next login (resume)', async () => {
    const c = new Client();
    await c.register('resume@test.in');
    expect((await c.put('/api/profile', VALID_PROFILE)).status).toBe(200);

    const again = new Client();
    await again.login('resume@test.in');
    const profile = (await again.get('/api/profile')).body.data;
    expect(profile).toMatchObject({ fullName: 'Anita Sen', organization: 'SSKM Hospital', membershipNo: 'SGEI-LM-100', email: 'resume@test.in' });
    expect(profile.completedAt).not.toBeNull();
    const status = (await again.get('/api/registration/status')).body.data;
    expect(status.steps.personal).toBe('complete');
    expect(status.nextStep).toBe('conference');
  });

  it('new accounts start at the personal step', async () => {
    const c = new Client();
    await c.register('new@test.in');
    const status = (await c.get('/api/registration/status')).body.data;
    expect(status.nextStep).toBe('personal');
    expect(status.profile.fullName).toBe('Test Doctor');
    expect((await c.post('/api/registration/quote', { conferenceCategoryCode: 'sgei-member' })).body.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('pricing (server time, IST)', () => {
  it.each([
    ['2026-12-01T10:00:00+05:30', 'early_bird', 1850000],
    ['2027-01-15T23:59:59+05:30', 'early_bird', 1850000],
    ['2027-01-16T00:00:00+05:30', 'regular', 2150000],
    ['2027-04-10T23:59:00+05:30', 'regular', 2150000],
    ['2027-04-11T00:00:00+05:30', 'on_spot', 2450000],
  ])('at %s the SGEI member price is %s', async (when, period, amount) => {
    const { client } = await participant();
    at(when);
    const q = (await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('sgei-member') })).body.data;
    expect(q.pricingPeriod.code).toBe(period);
    expect(q.lines[0].amountMinor).toBe(amount);
    expect(q.gstMinor).toBe(Math.round(amount * 0.18));
    expect(q.totalMinor).toBe(amount + Math.round(amount * 0.18));
  });

  it('ignores any price sent by the client', async () => {
    const { client } = await participant();
    const q = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('sgei-member'), totalMinor: 100, price: 1 });
    expect(q.body.data.totalMinor).toBe(1850000 + 333000);
  });

  it('converts USD categories to INR at the configured rate', async () => {
    const { client } = await participant(undefined, { ...VALID_PROFILE, membershipType: 'non_member', membershipNo: null, country: 'UK', pinCode: 'SW1A1AA' });
    const q = (await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('international-delegate') })).body.data;
    expect(q.lines[0]).toMatchObject({ originalCurrency: 'USD', originalUnitAmountMinor: 35000, fxRate: '84', amountMinor: 2940000 });
    expect(q.currency).toBe('INR');
  });

  it('prices accommodation per night for the selected dates, within the stay window', async () => {
    const { client } = await participant();
    const cat = await categoryCode('sgei-member');
    const opt = await accommodationCode('venue-twin');
    const q = (await client.post('/api/registration/quote', { conferenceCategoryCode: cat, accommodation: { optionCode: opt, checkIn: '2027-04-21', checkOut: '2027-04-25' } })).body.data;
    const acc = q.lines.find((l: { itemType: string }) => l.itemType === 'accommodation');
    expect(acc).toMatchObject({ quantity: 4, unitAmountMinor: 800000, amountMinor: 3200000, gstMinor: 576000 });
    const bad = await client.post('/api/registration/quote', { conferenceCategoryCode: cat, accommodation: { optionCode: opt, checkIn: '2027-04-10', checkOut: '2027-04-12' } });
    expect(bad.status).toBe(422);
    const reversed = await client.post('/api/registration/quote', { conferenceCategoryCode: cat, accommodation: { optionCode: opt, checkIn: '2027-04-23', checkOut: '2027-04-22' } });
    expect(reversed.status).toBe(422);
  });
});

describe('Step 1 – all personal details are mandatory', () => {
  it('rejects a profile without age or Medical Council registration', async () => {
    const c = new Client();
    await c.register(`m${Date.now()}@test.in`);
    const res = await c.put('/api/profile', { ...VALID_PROFILE, age: null, mciStateCode: '', mciRegNo: null });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors).sort()).toEqual(['age', 'mciRegNo', 'mciStateCode']);
    // The SGEI membership number stays required only for SGEI members.
    const nonMember = await c.put('/api/profile', { ...VALID_PROFILE, membershipType: 'non_member', membershipNo: null });
    expect(nonMember.status).toBe(200);
  });
});

describe('eligibility & business rules', () => {
  it('SGEI Member requires membership; non-members can buy every other category', async () => {
    const { client } = await participant(undefined, { ...VALID_PROFILE, membershipType: 'non_member', membershipNo: null });
    const r1 = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(r1.body.code).toBe('MEMBERSHIP_REQUIRED');
    for (const code of ['non-member', 'pg-student', 'international-delegate']) {
      const r = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode(code) });
      expect(r.status).toBe(200);
    }
  });

  it('accompanying categories cannot be bought as the delegate category', async () => {
    const { client } = await participant();
    const r = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('accompanying-national') });
    expect(r.body.code).toBe('INVALID_CATEGORY');
  });

  it('add-ons require a conference registration', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    const r = await client.post('/api/registration/quote', { workshopCodes: [ws.a] });
    expect(r.body.code).toBe('CONFERENCE_REQUIRED');
  });

  it('rejects the same workshop twice in one selection', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    const r = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('sgei-member'), workshopCodes: [ws.a, ws.a] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('DUPLICATE_WORKSHOP');
  });

  it('workshops and accommodation are optional', async () => {
    const { client } = await participant();
    const { verify } = await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(verify.body.data.status).toBe('success');
    const status = (await client.get('/api/registration/status')).body.data;
    expect(status.conference.categoryCode).toBe('sgei-member');
    expect(status.workshops).toEqual([]);
    expect(status.accommodation).toBeNull();
  });

  it('only one conference per user, ever', async () => {
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    const again = await client.post('/api/registration/quote', { conferenceCategoryCode: await categoryCode('non-member') });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CONFERENCE_ALREADY_PURCHASED');
    // DB-level guarantee as well
    const { user_id } = await db('conference_registrations').first('user_id');
    await expect(db('conference_registrations').insert({ ...(await db('conference_registrations').first()), id: undefined, order_id: 99999 })).rejects.toThrow();
    expect(user_id).toBeDefined();
  });

  it('previously purchased workshops and accommodation cannot be bought again', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    const cat = await categoryCode('sgei-member');
    const opt = await accommodationCode('alternate-single');
    await buy(client, { conferenceCategoryCode: cat, workshopCodes: [ws.a], accommodation: { optionCode: opt, checkIn: '2027-04-21', checkOut: '2027-04-23' } });
    const w = await client.post('/api/registration/quote', { workshopCodes: [ws.a] });
    expect(w.body.code).toBe('WORKSHOP_ALREADY_PURCHASED');
    const a = await client.post('/api/registration/quote', { accommodation: { optionCode: await accommodationCode('venue-single'), checkIn: '2027-04-21', checkOut: '2027-04-22' } });
    expect(a.body.code).toBe('ACCOMMODATION_ALREADY_PURCHASED');
  });

  it('enforces workshop capacity', async () => {
    const ws = await seedWorkshops(); // Workshop A capacity 2
    const cat = await categoryCode('sgei-member');
    for (let i = 0; i < 2; i++) {
      const { client } = await participant();
      await buy(client, { conferenceCategoryCode: cat, workshopCodes: [ws.a] });
    }
    const { client } = await participant();
    const r = await client.post('/api/registration/quote', { conferenceCategoryCode: cat, workshopCodes: [ws.a] });
    expect(r.body.code).toBe('WORKSHOP_FULL');
  });
});

describe('resumable status / next step', () => {
  it('walks conference -> workshops -> accommodation -> complete', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    const next = async () => (await client.get('/api/registration/status')).body.data.nextStep;
    expect(await next()).toBe('conference');
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member') });
    expect(await next()).toBe('workshops'); // Scenario A/B
    await buy(client, { workshopCodes: [ws.b] });
    expect(await next()).toBe('accommodation'); // Scenario C
    await buy(client, { accommodation: { optionCode: await accommodationCode('venue-single'), checkIn: '2027-04-22', checkOut: '2027-04-25' } });
    expect(await next()).toBe('complete');
  });

  it('snapshots prices: master price changes never alter past purchases', async () => {
    const ws = await seedWorkshops();
    const { client } = await participant();
    await buy(client, { conferenceCategoryCode: await categoryCode('sgei-member'), workshopCodes: [ws.c] });
    editCatalogue((c) => {
      c.workshops.find((w) => w.code === ws.c)!.amountMinor = 600000;
      for (const cat of c.categories) for (const k of Object.keys(cat.pricesMinor)) cat.pricesMinor[k] = 9999900;
    });
    const status = (await client.get('/api/registration/status')).body.data;
    expect(status.workshops[0].amountMinor).toBe(200000);
    expect(status.conference.amountMinor).toBe(1850000);
    expect(status.payments[0].totalMinor).toBe((1850000 + 200000) * 1.18);
  });
});
