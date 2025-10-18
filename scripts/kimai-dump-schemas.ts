import 'dotenv/config';
import { kimaiPool } from '../db';
import { promises as fs } from 'fs';
import path from 'path';

async function listKimaiTables(): Promise<string[]> {
  try {
    const [rows]: any = await kimaiPool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'kimai2\_%' ORDER BY table_name"
    );
    return rows.map((r: any) => r.table_name || r.TABLE_NAME).filter(Boolean);
  } catch (e) {
    const [rows2]: any = await kimaiPool.query('SHOW TABLES');
    const key = rows2.length ? Object.keys(rows2[0])[0] : '';
    return rows2.map((r: any) => r[key]).filter((t: string) => t && t.startsWith('kimai2_')).sort();
  }
}

async function showColumns(table: string) {
  const [rows]: any = await kimaiPool.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows as Array<{ Field: string; Type: string; Null: string; Key: string; Default: any; Extra: string }>;
}

function toMarkdown(table: string, cols: Awaited<ReturnType<typeof showColumns>>): string {
  const header = `# ${table} Table Schema (Kimai)\n\n`;
  const intro = `Reference of the Kimai table \`${table}\`.\n\n`;
  const headRow = '| Field | Type | Null | Key | Default | Extra |\n';
  const sepRow = '|-------|------|------|-----|---------|-------|\n';
  const body = cols
    .map((c) => `| ${c.Field} | ${c.Type} | ${c.Null} | ${c.Key || ''} | ${c.Default === null ? 'NULL' : String(c.Default)} | ${c.Extra || ''} |`)
    .join('\n');
  const notes = '\n\nNotes:\n- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.\n';
  return header + intro + headRow + sepRow + body + notes + '\n';
}

async function main() {
  const outDir = path.join(process.cwd(), 'docs', 'kimai2_schemas');
  await fs.mkdir(outDir, { recursive: true });

  const tables = await listKimaiTables();
  const indexLines: string[] = ['# Kimai Tables – Schemas', ''];
  for (const t of tables) {
    try {
      const cols = await showColumns(t);
      const md = toMarkdown(t, cols);
      const file = path.join(outDir, `${t}.md`);
      await fs.writeFile(file, md, 'utf8');
      indexLines.push(`- [${t}](./${t}.md)`);
      console.log(`[kimai:dump] Wrote ${file}`);
    } catch (e: any) {
      console.error(`[kimai:dump] Failed for ${t}:`, e?.message || e);
    }
  }
  await fs.writeFile(path.join(outDir, 'README.md'), indexLines.join('\n') + '\n', 'utf8');
  await kimaiPool.end();
}

main().catch((e) => {
  console.error('[kimai:dump] Unexpected error:', e?.message || e);
  process.exit(1);
});

