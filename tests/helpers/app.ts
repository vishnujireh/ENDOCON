import request from 'supertest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/knex.js';
import { hashPassword } from '../../src/lib/crypto.js';
import { resetClock, setPricingClock } from '../../src/lib/time.js';
import { catalogue, loadCatalogueFile, setCatalogue, type Catalogue } from '../../src/modules/catalogue/catalogue.js';
import { ConsoleProvider, setEmailProvider } from '../../src/modules/email/provider.js';
import { FakeGateway } from '../../src/modules/payments/gateway/fake.gateway.js';
import { setGateway } from '../../src/modules/payments/gateway/index.js';

export const app = createApp();
export { db };

export const gateway = new FakeGateway();
setGateway(gateway);
export const mailer = new ConsoleProvider();
setEmailProvider(mailer);

const TRANSACTIONAL_TABLES = [
  'payment_events',
  'email_outbox',
  'invoices',
  'order_accompanying_persons',
  'order_accommodations',
  'order_workshops',
  'conference_registrations',
  'payment_items',
  'payments',
  'orders',
  'judge_review_scores',
  'judge_reviews',
  'abstract_assignments',
  'review_criteria',
  'reviewer_sessions',
  'reviewer_otps',
  'reviewers',
  'abstract_reviews',
  'abstract_versions',
  'abstract_files',
  'abstract_authors',
  'abstracts',
  'audit_logs',
  'password_reset_tokens',
  'sessions',
  'user_profiles',
  'users',
  'sequences',
];

/** Wipe all transactional data (master data stays) and reset test doubles. */
export async function resetDb(): Promise<void> {
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TRANSACTIONAL_TABLES) await db(t).truncate();
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
  // The real shared catalogue file, minus workshops (tests add their own via seedWorkshops()).
  setCatalogue({ ...realCatalogue(), workshops: [] });
  gateway.orders.clear();
  gateway.payments.clear();
  gateway.autoCapture = true;
  mailer.sent.length = 0;
  resetClock();
}

/** Pin the server's pricing date (pricing uses server time only, never the browser's). */
export function at(iso: string): void {
  setPricingClock(() => new Date(iso));
}

let real: Catalogue | null = null;
/** The actual shared/catalogue.json (parsed + validated once). */
export function realCatalogue(): Catalogue {
  if (!real) real = loadCatalogueFile();
  return structuredClone(real);
}

/** Replace parts of the in-memory catalogue for a test (e.g. simulate a later price edit). */
export function editCatalogue(fn: (c: Catalogue) => void): void {
  const next = structuredClone(catalogue());
  fn(next);
  setCatalogue(next);
}

/** Three test workshops; "ws-a" has only 2 seats. Returns their codes. */
export async function seedWorkshops() {
  editCatalogue((c) => {
    c.workshops = [
      { code: 'ws-a', name: 'Workshop A', description: null, sessionLabel: null, currency: 'INR', amountMinor: 100000, capacity: 2 },
      { code: 'ws-b', name: 'Workshop B', description: null, sessionLabel: null, currency: 'INR', amountMinor: 150000, capacity: null },
      { code: 'ws-c', name: 'Workshop C', description: null, sessionLabel: null, currency: 'INR', amountMinor: 200000, capacity: null },
    ];
  });
  return { a: 'ws-a', b: 'ws-b', c: 'ws-c' };
}

/** Catalogue codes are used directly (there are no catalogue IDs any more). */
export async function categoryCode(code: string): Promise<string> {
  return code;
}

export async function accommodationCode(code: string): Promise<string> {
  return code;
}

/** A logged-in browser: keeps cookies and sends the CSRF header automatically. */
export class Client {
  agent = request.agent(app);
  csrf = '';

  get(url: string) {
    return this.agent.get(url);
  }
  post(url: string, body?: unknown) {
    return this.agent.post(url).set('X-CSRF-Token', this.csrf).send(body as object);
  }
  put(url: string, body?: unknown) {
    return this.agent.put(url).set('X-CSRF-Token', this.csrf).send(body as object);
  }
  patch(url: string, body?: unknown) {
    return this.agent.patch(url).set('X-CSRF-Token', this.csrf).send(body as object);
  }
  del(url: string) {
    return this.agent.delete(url).set('X-CSRF-Token', this.csrf);
  }

  async register(email: string, password = 'Secret123', fullName = 'Test Doctor') {
    const res = await this.agent.post('/api/auth/register').send({ fullName, email, phoneCountryCode: '+91', phoneNumber: '9876543210', password });
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    this.csrf = res.body.data.csrfToken;
    return res.body.data.user as { id: number; email: string };
  }

  async login(email: string, password = 'Secret123', path = '/api/auth/login') {
    const res = await this.agent.post(path).send({ email, password });
    if (res.status === 200) this.csrf = res.body.data.csrfToken;
    return res;
  }
}

export const VALID_PROFILE = {
  title: 'Dr.',
  fullName: 'Anita Sen',
  age: 38,
  gender: 'Female',
  designation: 'Consultant Gastroenterologist',
  organization: 'SSKM Hospital',
  mciStateCode: 'WBMC',
  mciRegNo: '12345',
  membershipType: 'sgei_member',
  membershipNo: 'SGEI-LM-100',
  phoneCountryCode: '+91',
  phoneNumber: '9876543210',
  address: '244 AJC Bose Road',
  city: 'Kolkata',
  state: 'West Bengal',
  country: 'India',
  pinCode: '700020',
};

export async function participant(email = `doc${Math.random().toString(36).slice(2, 8)}@test.in`, profile: Record<string, unknown> = VALID_PROFILE) {
  const c = new Client();
  const user = await c.register(email);
  const res = await c.put('/api/profile', profile);
  if (res.status !== 200) throw new Error(`profile failed ${JSON.stringify(res.body)}`);
  return { client: c, user };
}

export async function admin() {
  const email = `admin${Math.random().toString(36).slice(2, 8)}@endocon.test`;
  const [id] = await db('users').insert({ email, password_hash: await hashPassword('AdminPass1'), role: 'admin' });
  await db('user_profiles').insert({ user_id: id, full_name: 'Admin' });
  const c = new Client();
  const res = await c.login(email, 'AdminPass1', '/api/admin/auth/login');
  if (res.status !== 200) throw new Error('admin login failed');
  return c;
}

/** Checkout + pay successfully through the verify endpoint (like the browser would). */
export async function buy(c: Client, cart: Record<string, unknown>) {
  const co = await c.post('/api/payments/checkout', { cart });
  if (co.status !== 200) throw new Error(`checkout failed ${co.status} ${JSON.stringify(co.body)}`);
  const { paymentId, gatewayOrderId } = co.body.data;
  const sim = gateway.simulatePayment(gatewayOrderId, 'success');
  const v = await c.post(`/api/payments/${paymentId}/verify`, {
    razorpay_order_id: gatewayOrderId,
    razorpay_payment_id: sim.payment.id,
    razorpay_signature: sim.signature,
  });
  return { checkout: co.body.data, verify: v, gatewayPaymentId: sim.payment.id, paymentId: paymentId as number };
}

export function webhookBody(event: string, payment: { id: string; orderId: string | null; status: string; amountMinor: number; currency: string }) {
  return JSON.stringify({ event, payload: { payment: { entity: { ...payment, method: 'upi', amountRefundedMinor: 0, errorCode: null, errorDescription: null } } } });
}

export async function sendWebhook(raw: string, eventId: string) {
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', gateway.signWebhook(raw))
    .set('X-Razorpay-Event-Id', eventId)
    .send(raw);
}
