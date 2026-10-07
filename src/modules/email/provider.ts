import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

/** Provider abstraction (EMAIL_TRANSPORT): brevo (API) | smtp | console. Add a class for another service. */
export interface EmailProvider {
  send(message: OutgoingEmail): Promise<void>;
}

class SmtpProvider implements EmailProvider {
  private transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      auth: env.EMAIL_USER ? { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD } : undefined,
    });
  }
  async send(m: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments,
    });
  }
}

/** Splits "ENDOCON 2027 <no-reply@x.org>" into Brevo's { name, email } shape. */
export function parseAddress(value: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (m) return m[1].trim() ? { name: m[1].trim(), email: m[2].trim() } : { email: m[2].trim() };
  return { email: value.trim() };
}

/**
 * Brevo (formerly Sendinblue) transactional email API v3.
 * https://developers.brevo.com/reference/sendtransacemail
 * Sender: BREVO_SENDER_EMAIL / BREVO_SENDER_NAME (as in LTSICON), else EMAIL_FROM. It must be a
 * verified sender or domain in the Brevo account.
 */
export class BrevoProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string = env.BREVO_API_KEY,
    private readonly endpoint: string = env.BREVO_API_URL,
  ) {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set.');
  }

  async send(m: OutgoingEmail): Promise<void> {
    const body = {
      sender: env.BREVO_SENDER_EMAIL
        ? { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL }
        : parseAddress(env.EMAIL_FROM),
      to: [{ email: m.to }],
      ...(env.EMAIL_REPLY_TO ? { replyTo: parseAddress(env.EMAIL_REPLY_TO) } : {}),
      subject: m.subject,
      htmlContent: m.html,
      textContent: m.text,
      ...(m.attachments?.length
        ? { attachment: m.attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })) }
        : {}),
    };
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // Brevo answers { code, message }; never include the request (it carries the API key header).
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo API ${res.status}: ${detail.slice(0, 500)}`);
    }
  }
}

/** Development / test: logs instead of sending, and keeps the last messages in memory. */
export class ConsoleProvider implements EmailProvider {
  sent: OutgoingEmail[] = [];
  async send(m: OutgoingEmail): Promise<void> {
    this.sent.push(m);
    if (this.sent.length > 200) this.sent.shift();
    logger.info(
      { to: m.to, subject: m.subject, attachments: m.attachments?.map((a) => a.filename) },
      `[email:console] ${m.subject}\n${m.text}`,
    );
  }
}

let provider: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  provider ??=
    env.EMAIL_TRANSPORT === 'brevo' ? new BrevoProvider() : env.EMAIL_TRANSPORT === 'smtp' ? new SmtpProvider() : new ConsoleProvider();
  return provider;
}

export function setEmailProvider(p: EmailProvider): void {
  provider = p;
}
