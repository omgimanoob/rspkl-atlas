import 'dotenv/config';
import { atlasPool } from '../db';

async function main() {
  await atlasPool.query(`CREATE TABLE IF NOT EXISTS \`overrides_projects\` (
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
  try { await atlasPool.query('CREATE UNIQUE INDEX `ux_overrides_projects_kimai_project` ON `overrides_projects` (`kimai_project_id`)'); } catch {}
  -- status column removed; using status_id only
  try { await atlasPool.query('CREATE INDEX `ix_overrides_projects_prospective` ON `overrides_projects` (`is_prospective`)'); } catch {}
  console.log('[ensure-overrides] ensured overrides_projects table and indexes');
  await atlasPool.end();
}

main().catch((e) => { console.error('[ensure-overrides] Failed:', e?.message || e); process.exit(1); });
