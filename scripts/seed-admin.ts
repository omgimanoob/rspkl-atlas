import 'dotenv/config'
import { AuthService } from '../src/services/authService'
import { atlasPool } from '../db'

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

main()
  .then(async () => { try { await atlasPool.end() } catch {}; process.exit(0) })
  .catch(async (e) => {
    console.error('[seed-admin] Failed:', e?.message || e)
    try { await atlasPool.end() } catch {}
    process.exit(1)
  })
