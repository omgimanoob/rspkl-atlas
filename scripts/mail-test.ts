import 'dotenv/config';
import { createMailerFromEnv } from '../src/services/mailer';

async function main() {
  const to = process.env.DEVELOPER_EMAIL;
  const baseFrom = process.env.MAILER_FROM || 'no-reply@localhost';
  const from = process.env.MAILER_FROM_NAME ? `${process.env.MAILER_FROM_NAME} <${baseFrom}>` : baseFrom;
  const url = process.env.MAILER_URL || 'null://null';
  if (!to) {
    console.error('DEVELOPER_EMAIL is not set in .env');
    process.exit(1);
  }

  const mailer = createMailerFromEnv();
  const redacted = url.replace(/(\/\/[^:@]+:)([^@]+)(@)/, '$1xxxxx$3');
  console.log(`[mail:test] MAILER_URL=${redacted}`);
  if (!mailer.isEnabled()) {
    console.warn('[mail:test] Mailer is disabled or unavailable (using null provider). No email will be sent.');
    process.exit(0);
  }

  const subject = 'RSPKL Atlas – Test Email';
  const text = `Hello!\n\nThis is a test email from RSPKL Atlas.\n\nTime: ${new Date().toISOString()}\nFrom: ${from}\nTo: ${to}\n`;

  await mailer.send({ to, from, subject, text });
  console.log(`[mail:test] Sent test email to ${to}`);
}

main().catch((e) => {
  console.error('[mail:test] Failed to send test email:', e?.message || e);
  process.exit(1);
});
