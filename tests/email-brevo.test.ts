import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrevoProvider, parseAddress } from '../src/modules/email/provider.js';

describe('Brevo email provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses "Name <email>" sender addresses', () => {
    expect(parseAddress('ENDOCON 2027 <no-reply@endocon.org>')).toEqual({ name: 'ENDOCON 2027', email: 'no-reply@endocon.org' });
    expect(parseAddress('"ENDOCON, Kolkata" <a@b.in>')).toEqual({ name: 'ENDOCON, Kolkata', email: 'a@b.in' });
    expect(parseAddress('plain@b.in')).toEqual({ email: 'plain@b.in' });
  });

  it('posts the message to the Brevo API with the key header and base64 attachments', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messageId: '<1@smtp-relay>' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await new BrevoProvider('xkeysib-test', 'https://brevo.test/v3/smtp/email').send({
      to: 'delegate@example.org',
      subject: 'Registration confirmed – ENDO-0001',
      html: '<p>₹1,180 paid</p>',
      text: '₹1,180 paid',
      attachments: [{ filename: 'invoice.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://brevo.test/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      to: [{ email: 'delegate@example.org' }],
      subject: 'Registration confirmed – ENDO-0001',
      htmlContent: '<p>₹1,180 paid</p>',
      textContent: '₹1,180 paid',
      attachment: [{ name: 'invoice.pdf', content: Buffer.from('%PDF-1.4').toString('base64') }],
    });
    expect(body.sender.email).toBeTruthy();
  });

  it('throws on an API error so the email outbox retries it (and never echoes the key)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 })));
    const p = new BrevoProvider('xkeysib-secret', 'https://brevo.test/v3/smtp/email');
    const err = await p.send({ to: 'a@b.in', subject: 's', html: 'h', text: 't' }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Brevo API 401/);
    expect((err as Error).message).not.toContain('xkeysib-secret');
  });

  it('refuses to start without an API key', () => {
    expect(() => new BrevoProvider('', 'https://brevo.test')).toThrow(/BREVO_API_KEY/);
  });
});
