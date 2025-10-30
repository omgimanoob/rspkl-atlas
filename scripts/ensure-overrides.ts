import 'dotenv/config';
import { atlasPool } from '../db';

async function main() {
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`project_overrides\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`kimai_project_id\` bigint unsigned NULL,
    \`money_collected\` decimal(12,2) NULL,
    \`is_prospective\` tinyint(1) NULL,
    \`notes\` varchar(1024) NULL,
    \`source\` varchar(64) NULL,
    \`updated_by_user_id\` bigint unsigned NULL,
    \`updated_by_email\` varchar(255) NULL,
    \`extras_json\` json NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`);
  try { await atlasPool.query('CREATE UNIQUE INDEX `ux_project_overrides_kimai_project` ON `project_overrides` (`kimai_project_id`)'); } catch {}
  // status column removed; using status_id only
  try { await atlasPool.query('CREATE INDEX `ix_project_overrides_prospective` ON `project_overrides` (`is_prospective`)'); } catch {}
  console.log('[ensure-overrides] ensured project_overrides table and indexes');
  await atlasPool.end();
}

main().catch((e) => { console.error('[ensure-overrides] Failed:', e?.message || e); process.exit(1); });
