import { incMailDisabled, incMailSent } from './metrics';

export type MailSendInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

export interface Mailer {
  isEnabled(): boolean;
  send(input: MailSendInput): Promise<void | { id?: string }>;
}

export type MailerConfig =
  | { kind: 'null' }
  | { kind: 'devlog' }
  | {
      kind: 'smtp';
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
      tls?: { rejectUnauthorized?: boolean };
      from?: string;
    };

export function parseMailerUrl(url?: string | null, from?: string | null): MailerConfig {
  if (!url || url === 'null://null') return { kind: 'null' };
  if (url === 'dev://log') return { kind: 'devlog' };
  try {
    const u = new URL(url);
    if (u.protocol !== 'smtp:') throw new Error('unsupported_protocol');
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 587;
    const secure = port === 465; // heuristic
    const user = u.username ? decodeURIComponent(u.username) : '';
    const pass = u.password ? decodeURIComponent(u.password) : '';
    const verifyPeer = u.searchParams.get('verify_peer');
    const tls: any = {};
    if (verifyPeer === '0') tls.rejectUnauthorized = false;
    return {
      kind: 'smtp',
      host,
      port,
      secure,
      auth: user || pass ? { user, pass } : undefined,
      tls,
      from: from || undefined,
    };
  } catch {
    return { kind: 'null' };
  }
}

class NullMailer implements Mailer {
  isEnabled(): boolean {
    return false;
  }
  async send(_input: MailSendInput) {
    incMailDisabled();
    return;
  }
}

class DevLogMailer implements Mailer {
  constructor(private from?: string) {}
  isEnabled(): boolean {
    return true;
  }
  async send(input: MailSendInput) {
    const payload = { ...input, from: input.from || this.from };
    console.log(`[mail:devlog] to=${payload.to} subject=${payload.subject}`);
    incMailSent(true);
    return;
  }
}

class SmtpMailer implements Mailer {
  private transporter: any;
  private from?: string;
  constructor(private cfg: Extract<MailerConfig, { kind: 'smtp' }>) {
    this.from = cfg.from;
    try {
      // Lazy require nodemailer; if unavailable, degrade gracefully
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth,
        tls: cfg.tls,
      });
    } catch (e) {
      console.warn('[mailer] nodemailer not installed; SMTP disabled');
      this.transporter = null;
    }
  }
  isEnabled(): boolean {
    return !!this.transporter;
  }
  async send(input: MailSendInput) {
    if (!this.transporter) {
      incMailDisabled();
      return;
    }
    try {
      const info = await this.transporter.sendMail({
        from: input.from || this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      incMailSent(true);
      return { id: info?.messageId };
    } catch (e) {
      incMailSent(false);
      console.warn('[mailer] send failed');
      return;
    }
  }
}

export function createMailerFromEnv(): Mailer {
  const addr = process.env.MAILER_FROM || undefined;
  const name = process.env.MAILER_FROM_NAME || undefined;
  const from = name && addr ? `${name} <${addr}>` : addr;
  const url = process.env.MAILER_URL || undefined;
  const cfg = parseMailerUrl(url, from);
  if (cfg.kind === 'null') return new NullMailer();
  if (cfg.kind === 'devlog') return new DevLogMailer(from);
  return new SmtpMailer(cfg);
}
