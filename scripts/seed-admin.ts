import 'dotenv/config'
import { AuthService } from '../src/services/authService'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const displayName = process.env.ADMIN_DISPLAY_NAME

  if (!email || !password) {
    console.warn('[seed-admin] ADMIN_EMAIL/ADMIN_PASSWORD not set; nothing to seed.')
    return
  }

  console.log(`[seed-admin] Seeding admin user: ${email}${displayName ? ` (${displayName})` : ''}`)
  await AuthService.seedAdminIfConfigured()
  console.log('[seed-admin] Done.')
}

main().catch((e) => {
  console.error('[seed-admin] Failed:', e?.message || e)
  process.exit(1)
})

