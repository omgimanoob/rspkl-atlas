import 'dotenv/config';
import { AuthService } from '../src/services/authService';
import { config } from '../src/config';

function resolveOrigin(): string {
  const envOrigin = process.env.PASSWORD_RESET_ORIGIN || process.env.RESET_ORIGIN;
  if (envOrigin) return envOrigin;
  if (config.web.allowedOrigins.length) return config.web.allowedOrigins[0];
  return 'http://localhost:5173';
}

async function main() {
  const email = process.env.DEVELOPER_EMAIL;
  if (!email) {
    console.error('DEVELOPER_EMAIL is not set in .env');
    process.exit(1);
  }
  const origin = resolveOrigin();
  console.log(`[mail:reset:test] Requesting password reset for ${email}`);
  console.log(`[mail:reset:test] Using origin ${origin}`);
  await AuthService.requestPasswordReset(email, origin);
  console.log(`[mail:reset:test] If SMTP is enabled, a reset email was sent to ${email}`);
}

main().catch((e) => {
  console.error('[mail:reset:test] Failed:', e?.message || e);
  process.exit(1);
});
