import 'dotenv/config';
import { AuthService } from '../src/services/authService';

async function main() {
  const email = process.env.DEVELOPER_EMAIL;
  if (!email) {
    console.error('DEVELOPER_EMAIL is not set in .env');
    process.exit(1);
  }
  console.log(`[mail:reset:test] Requesting password reset for ${email}`);
  await AuthService.requestPasswordReset(email);
  console.log(`[mail:reset:test] If SMTP is enabled, a reset email was sent to ${email}`);
}

main().catch((e) => {
  console.error('[mail:reset:test] Failed:', e?.message || e);
  process.exit(1);
});

