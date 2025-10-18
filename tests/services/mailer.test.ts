import { parseMailerUrl, createMailerFromEnv } from '../../src/services/mailer';

describe('Mailer config and factory', () => {
  const env = process.env;
  afterEach(() => {
    process.env = { ...env };
  });

  it('parses null url', () => {
    const cfg = parseMailerUrl('null://null');
    expect(cfg.kind).toBe('null');
  });

  it('parses dev log url', () => {
    const cfg = parseMailerUrl('dev://log');
    expect(cfg.kind).toBe('devlog');
  });

  it('parses smtp url with verify_peer=0', () => {
    const cfg: any = parseMailerUrl('smtp://user%40example.com:pass@mail.example.com:587?verify_peer=0', 'noreply@example.com');
    expect(cfg.kind).toBe('smtp');
    expect(cfg.host).toBe('mail.example.com');
    expect(cfg.port).toBe(587);
    expect(cfg.secure).toBe(false);
    expect(cfg.auth.user).toBe('user@example.com');
    expect(cfg.tls.rejectUnauthorized).toBe(false);
    expect(cfg.from).toBe('noreply@example.com');
  });

  it('factory returns NullMailer when MAILER_URL is null', async () => {
    process.env.MAILER_URL = 'null://null';
    const mailer = createMailerFromEnv();
    expect(mailer.isEnabled()).toBe(false);
    await mailer.send({ to: 'a@b', subject: 'x' });
  });

  it('factory returns DevLogMailer when MAILER_URL is dev://log', async () => {
    process.env.MAILER_URL = 'dev://log';
    const mailer = createMailerFromEnv();
    expect(mailer.isEnabled()).toBe(true);
    await mailer.send({ to: 'a@b', subject: 'x' });
  });
});
