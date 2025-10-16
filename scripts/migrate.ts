import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db } from '../src/db/client';

async function main() {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('Migrations applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

